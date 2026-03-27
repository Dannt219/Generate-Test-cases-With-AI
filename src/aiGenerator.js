const { fetch } = require('@forge/api');

const MAX_RETRIES = 3;

// System prompt dùng chung cho cả 2 provider
const SYSTEM_PROMPT =
  'You are a Test Lead with 10+ years of QA experience. ' +
  'Generate production-ready, specific, and fully verifiable test cases. ' +
  'Always return a valid, complete JSON array. Never truncate your response mid-array. ' +
  'If you are running low on tokens, finish the current test case completely and close the JSON array properly.';

// Định nghĩa các batch để split API call
const BATCHES = [
  {
    id: 'functional',
    label: 'UI / Functional / Happy Path / End-to-End',
    types: ['UI', 'Functional', 'End-to-End'],
    instruction:
      'Generate ONLY test cases of TYPE: UI, Functional, End-to-End.\n' +
      'Focus on: UI display verification, happy path flows, complete E2E scenarios.',
  },
  {
    id: 'negative',
    label: 'Negative / Validation / Boundary / Edge Case',
    types: ['Negative', 'Validation'],
    instruction:
      'Generate ONLY test cases of TYPE: Negative, Validation.\n' +
      'Focus on: invalid inputs, error messages, boundary values, edge cases, empty/null inputs.',
  },
];

const MOBILE_BATCH = {
  id: 'platform',
  label: 'Platform / Integration',
  types: ['Platform', 'Integration'],
  instruction:
    'Generate ONLY test cases of TYPE: Platform, Integration.\n' +
    'Focus on: iOS vs Android differences, app lifecycle (background/foreground/kill), ' +
    'network switching, system interruptions (calls, notifications), deep links, third-party integrations.',
};

// ───────── Figma context formatter ─────────

function formatFigmaContext(figmaData) {
  if (!figmaData || !figmaData.screens || figmaData.screens.length === 0) return '';
  let context = '## Figma Design — Screen-by-Screen Breakdown\n';
  context += '(Use the exact UI text below in your test case steps and expected results. Reference screen names in preconditions.)\n';
  for (let i = 0; i < figmaData.screens.length; i++) {
    const screen = figmaData.screens[i];
    context += `\n### Screen ${i + 1}: "${screen.name}"\n`;
    if (screen.textContent.length > 0) {
      context += `**Exact UI Text / Labels on this screen:**\n`;
      for (const t of screen.textContent) context += `  - "${t}"\n`;
    }
    if (screen.components.length > 0) {
      context += `**UI Components / Layers:**\n`;
      for (const c of screen.components) context += `  - ${c}\n`;
    }
    if (screen.imageUrl) context += `**Screenshot:** ${screen.imageUrl}\n`;
  }
  return context;
}

// ───────── Comments context formatter ─────────

function formatCommentsContext(allComments) {
  if (!allComments || allComments.length === 0) return '';
  let context = '## Comments & Requirement Updates\n';
  context += '(Sorted oldest → newest. The LAST comment is the most recent and its values MUST override all previous comments and the original description.)\n';
  context += '(Analyze each comment for: new requirements, changed requirements, removed requirements, edge cases, clarifications.)\n';
  for (const c of allComments) {
    const dt = new Date(c.created);
    const timestamp = `${dt.toISOString().split('T')[0]} ${dt.toISOString().split('T')[1].slice(0, 5)} UTC`;
    context += `\n[${timestamp}] ${c.author}:\n${c.body}\n`;
  }

  // Tóm tắt các thay đổi từ comment mới nhất để AI không bỏ sót
  const latest = allComments[allComments.length - 1];
  if (allComments.length > 1 && latest) {
    context += `\n⚠️ LATEST UPDATE (most recent comment — MUST use these values):\n`;
    context += `Author: ${latest.author}\n`;
    context += `Content: ${latest.body}\n`;
    context += `→ Any numeric values, limits, or rules in this comment OVERRIDE all previous comments and description.\n`;
  }

  return context;
}

// ───────── Prompt builder ─────────

function buildPrompt(taskData, figmaData, batch, config) {
  const {
    title, description, parentTitle, parentDescription,
    acceptanceCriteria, allComments, subTasks, linkedIssues,
    platform, priority, issueType,
  } = taskData;

  const hasFigma    = figmaData && figmaData.screens && figmaData.screens.length > 0;
  const hasComments = allComments && allComments.length > 0;
  const isMobile    = platform === 'mobile';
  const descLower   = (title + ' ' + (description || '') + ' ' + (parentDescription || '')).toLowerCase();
  const hasOtp      = /\botp\b|one.time.pass|verification code|sms code/.test(descLower);

  let prompt = `You are a Test Lead with 10+ years of experience in mobile and web QA.\n`;
  prompt += `Your job: produce a complete, production-ready test case suite. Coverage drives quantity — do NOT stop early.\n\n`;

  // App context: ưu tiên Jira project description, fallback về manual config
  const projectDesc = taskData.projectDescription?.trim() || '';
  const manualCtx   = config.appContext?.trim() || '';
  const appContext  = projectDesc || manualCtx;
  if (appContext) {
    prompt += `## App Context\n${appContext}\n`;
    if (projectDesc && manualCtx) {
      prompt += `### Additional Context\n${manualCtx}\n`;
    }
    prompt += `\n`;
  }

  prompt += `## Platform\n${isMobile ? 'Mobile App (Android & iOS)' : 'Web'}\n\n`;

  prompt += `## Task Info\n`;
  prompt += `- Issue Key: ${taskData.issueKey}\n`;
  prompt += `- Issue Type: ${issueType || 'Story'}\n`;
  prompt += `- Priority: ${priority || 'Medium'}\n`;
  prompt += `- Title: ${title}\n\n`;

  prompt += `## Description\n${description || 'No description provided.'}\n\n`;

  if (acceptanceCriteria) {
    prompt += `## Acceptance Criteria\n${acceptanceCriteria}\n\n`;
  }

  // Parent task — đây thường là nơi chứa requirements chi tiết nhất
  if (parentTitle || parentDescription) {
    prompt += `## Parent Task\n`;
    if (parentTitle) prompt += `- Title: ${parentTitle}\n`;
    if (parentDescription) prompt += `\n${parentDescription}\n`;
    prompt += `\n`;
  }

  if (subTasks && subTasks.length > 0) {
    prompt += `## Sub-tasks\n${subTasks.map(s => `- ${s.key}: ${s.summary}`).join('\n')}\n\n`;
  }
  if (linkedIssues && linkedIssues.length > 0) {
    prompt += `## Linked Issues\n${linkedIssues.map(l => `- ${l.key} (${l.type}): ${l.summary}`).join('\n')}\n\n`;
  }
  if (hasComments) prompt += formatCommentsContext(allComments) + '\n';
  if (hasFigma)    prompt += formatFigmaContext(figmaData) + '\n';

  // STEP 1 — Analysis
  prompt += `## STEP 1 — REQUIREMENT ANALYSIS (do this mentally before writing)\n`;
  prompt += `Before writing a single test case, extract and list:\n`;
  prompt += `A) Every INPUT FIELD visible (from Figma + description + comments): name, data type, constraints (min/max length, format, allowed chars)\n`;
  prompt += `B) Every BUTTON/ACTION and its enable conditions\n`;
  prompt += `C) Every SCREEN and its navigation targets (forward + back)\n`;
  prompt += `D) Every API CALL triggered by user actions\n`;
  prompt += `E) Every VALIDATION RULE from ANY source — description, acceptance criteria, Figma labels, AND comments\n`;
  if (hasComments) {
    prompt += `F) From COMMENTS specifically: extract every new constraint, changed rule, clarification, or edge case mentioned\n`;
    prompt += `   → The LAST comment in the list is the MOST RECENT — its values are the ground truth\n`;
    prompt += `   → If an older comment says max=20 but the newest comment says max=30, USE 30\n`;
    prompt += `   → NEVER use a value from an older comment if a newer comment has updated it\n`;
    prompt += `   → Extract all numeric limits, validation rules, and constraints from the latest comment first\n`;
  }
  prompt += `\n`;

  // STEP 2 — Coverage rules (only for negative batch, functional batch has its own focus)
  if (batch.id === 'negative') {
    prompt += `## STEP 2 — VALIDATION COVERAGE (apply to every input field)\n`;
    prompt += `Apply Boundary Value Analysis + Equivalence Partitioning:\n`;
    prompt += `1. Valid value AT minimum boundary (exactly min chars)\n`;
    prompt += `2. Invalid value BELOW minimum (min - 1)\n`;
    prompt += `3. Valid value AT maximum boundary (exactly max chars)\n`;
    prompt += `4. Invalid value ABOVE maximum (max + 1)\n`;
    prompt += `5. Empty / null\n`;
    prompt += `6. Whitespace only\n`;
    prompt += `7. Invalid format (wrong pattern, wrong character type)\n`;
    prompt += `8. Special characters / emoji (verify allowed vs rejected)\n`;
    prompt += `9. Duplicate value (if uniqueness is required)\n\n`;
  }

  if (batch.id === 'functional') {
    prompt += `## STEP 2 — FUNCTIONAL COVERAGE\n`;
    prompt += `For EVERY BUTTON: verify disabled state, enabled state, correct action on tap.\n`;
    prompt += `For EVERY SCREEN: UI display (all elements + exact text), forward navigation, back navigation.\n`;
    prompt += `For API calls: success response handling, loading states.\n\n`;
  }

  // OTP rules — chỉ thêm khi task liên quan đến OTP
  if (hasOtp) {
    prompt += `## OTP Flow Rules\n`;
    prompt += `1. Correct OTP → success\n`;
    prompt += `2. Incorrect OTP (1st attempt) → error shown, can retry\n`;
    prompt += `3. Incorrect OTP reaching max attempts → locked out\n`;
    prompt += `4. Expired OTP → error shown\n`;
    prompt += `5. Resend OTP → new code sent, timer reset, old code invalidated\n\n`;
  }

  if (isMobile && batch.id === 'platform') {
    prompt += `## Mobile Platform Rules\n`;
    prompt += `1. iOS vs Android differences (platform-specific UI/behavior)\n`;
    prompt += `2. App lifecycle: background → foreground (data preserved), app kill → reopen\n`;
    prompt += `3. Network switching mid-action (WiFi → 4G, offline mode)\n`;
    prompt += `4. System interruptions: incoming call, low battery alert, push notification\n`;
    prompt += `5. Keyboard overlap on input fields\n`;
    prompt += `6. Deep links / universal links behavior\n\n`;
  }

  if (hasFigma && batch.id === 'functional') {
    prompt += `## STEP 3 — FIGMA-DRIVEN EXECUTION\n`;
    prompt += `Go through each Figma screen IN ORDER:\n`;
    prompt += `- Use EXACT UI text from Figma in steps and expected results (do not paraphrase)\n`;
    prompt += `- Reference screen name in every preCondition\n`;
    prompt += `- Verify every UI element listed under each screen\n\n`;
  }

  if (batch.id === 'functional') {
    prompt += `## STEP 4 — E2E SCENARIOS\n`;
    prompt += `1. Complete happy-path E2E flow from first screen to successful completion\n`;
    prompt += `2. Re-entry / re-login after completion\n`;
    prompt += `3. Security: unauthorized access, token expiry, session handling\n\n`;
  }

  // Quality rules
  prompt += `## QUALITY RULES\n`;
  prompt += `- Each test case tests ONE thing only\n`;
  prompt += `- preCondition: specify exact screen, app state, pre-entered data\n`;
  prompt += `- steps: numbered, use action verbs (Tap, Enter, Observe, Navigate, Scroll)\n`;
  prompt += `- expected: specific and verifiable — include exact UI text, error messages\n`;
  prompt += `- Do NOT group multiple validations into one test case\n`;
  prompt += `- Do NOT stop until ALL elements from Step 1 are fully covered for this batch\n`;
  prompt += `- Write in the same language as the task description\n\n`;

  // Batch-specific instruction
  prompt += `## THIS BATCH — What to generate\n`;
  prompt += batch.instruction + '\n\n';

  // Output format
  prompt += `## Output Format\n`;
  prompt += `Return ONLY a valid JSON array, no extra text, no markdown fences.\n`;
  prompt += `Test Case ID format: TC_[SHORT_FEATURE]_XXX (e.g. TC_LOGIN_001, TC_CHECKOUT_001, TC_PROFILE_001)\n\n`;
  prompt += `[\n`;
  prompt += `  {\n`;
  prompt += `    "id": "TC_LOGIN_001",\n`;
  prompt += `    "no": 1,\n`;
  prompt += `    "testCase": "Verify login screen displays all required elements",\n`;
  prompt += `    "preCondition": "1. App is installed and launched\\n2. User is on Start Screen\\n3. User is not logged in",\n`;
  prompt += `    "steps": "1. Tap Login button\\n2. Observe all screen elements",\n`;
  prompt += `    "expected": "1. Navigates to Login screen\\n2. Screen displays email field, password field, Login button (disabled), Forgot Password link",\n`;
  prompt += `    "priority": "High",\n`;
  prompt += `    "type": "UI"\n`;
  prompt += `  }\n`;
  prompt += `]\n\n`;
  prompt += `priority values: High | Medium | Low\n`;
  prompt += `type values: UI | Functional | Negative | Validation | Integration | End-to-End | Platform`;

  return prompt;
}

// ───────── API callers ─────────

async function callClaudeAPI(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAIAPI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 16384,
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ───────── JSON parser ─────────

function parseAndValidateTestCases(rawText) {
  // Xử lý trường hợp AI bọc trong markdown code block
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Tìm JSON array — lấy từ '[' đầu tiên đến ']' cuối cùng
  const start = cleaned.indexOf('[');
  const end   = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON array found in AI response');
  }

  let jsonStr = cleaned.slice(start, end + 1);

  // Cố gắng fix JSON bị cắt giữa chừng: xóa object cuối nếu không đóng đúng
  let testCases;
  try {
    testCases = JSON.parse(jsonStr);
  } catch {
    // Thử cắt bỏ phần tử cuối bị incomplete rồi đóng array
    const lastComma = jsonStr.lastIndexOf(',');
    if (lastComma !== -1) {
      try {
        testCases = JSON.parse(jsonStr.slice(0, lastComma) + ']');
        console.warn('[AIGenerator] JSON was truncated — recovered by dropping last incomplete test case');
      } catch (e2) {
        throw new Error(`Failed to parse JSON: ${e2.message}`);
      }
    } else {
      throw new Error('Failed to parse JSON and could not recover');
    }
  }

  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error('AI returned empty or invalid test cases array');
  }

  const required = ['no', 'testCase', 'preCondition', 'steps', 'expected'];
  for (const tc of testCases) {
    for (const field of required) {
      if (tc[field] === undefined || tc[field] === null) {
        throw new Error(`Test case missing required field: "${field}"`);
      }
    }
  }

  return testCases.map((tc, idx) => ({
    id:           String(tc.id || `TC_${String(idx + 1).padStart(3, '0')}`),
    no:           idx + 1,
    testCase:     String(tc.testCase),
    preCondition: String(tc.preCondition),
    steps:        String(tc.steps),
    expected:     String(tc.expected),
    priority:     String(tc.priority || 'Medium'),
    type:         String(tc.type || 'Functional'),
    status:       'New',
  }));
}

// ───────── Single batch runner with retry ─────────

async function runBatch(taskData, figmaData, batch, config) {
  const prompt = buildPrompt(taskData, figmaData, batch, config);
  const { aiProvider, aiApiKey } = config;

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = aiProvider === 'openai'
        ? await callOpenAIAPI(prompt, aiApiKey)
        : await callClaudeAPI(prompt, aiApiKey);
      const cases = parseAndValidateTestCases(raw);
      console.log(`[AIGenerator] Batch "${batch.label}": ${cases.length} test cases`);
      return cases;
    } catch (err) {
      lastError = err;
      console.error(`[AIGenerator] Batch "${batch.label}" attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  console.error(`[AIGenerator] Batch "${batch.label}" failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  return { failed: true, error: lastError?.message || 'Unknown error', batchLabel: batch.label };
}

// ───────── Public API ─────────

/**
 * @param {object} taskData
 * @param {object|null} figmaData
 * @param {object} config - từ config.js (getConfig())
 */
async function generateTestCases(taskData, figmaData, config) {
  const { aiApiKey } = config;
  if (!aiApiKey) throw new Error('AI API Key is not configured. Go to Jira Settings → Apps → AI TestCase Generator to set it up.');

  const screenCount = figmaData?.screens?.length || 0;
  console.log(
    `[AIGenerator] ${taskData.issueKey} | provider: ${config.aiProvider} | ` +
    `platform: ${taskData.platform} | figma: ${!!figmaData} | screens: ${screenCount} | ` +
    `comments: ${taskData.allComments?.length || 0} | ` +
    `parentDesc: ${taskData.parentDescription ? 'yes' : 'no'}`
  );

  // Xác định batches cần chạy
  const batches = [...BATCHES];
  if (taskData.platform === 'mobile') {
    batches.push(MOBILE_BATCH);
  }

  // Chạy từng batch tuần tự và merge kết quả
  const allTestCases = [];
  const batchErrors = [];
  let globalCounter = 1;

  for (const batch of batches) {
    const result = await runBatch(taskData, figmaData, batch, config);
    if (result && result.failed) {
      batchErrors.push(`[${result.batchLabel}]: ${result.error}`);
    } else {
      for (const tc of result) {
        tc.no = globalCounter++;
      }
      allTestCases.push(...result);
    }
  }

  if (allTestCases.length === 0) {
    const errorDetail = batchErrors.length > 0
      ? `AI failed to generate any test cases. Errors:\n${batchErrors.join('\n')}`
      : 'AI failed to generate any test cases across all batches';
    throw new Error(errorDetail);
  }

  console.log(`[AIGenerator] Total: ${allTestCases.length} test cases from ${batches.length} batches`);
  return allTestCases;
}

module.exports = { generateTestCases, buildPrompt, parseAndValidateTestCases };

const { fetch } = require('@forge/api');

const MAX_RETRIES = 3;

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

function formatCommentsContext(allComments) {
  if (!allComments || allComments.length === 0) return '';
  let context = '## Comments & Requirement Updates\n';
  context += '(Sorted oldest → newest. Newer comments override older ones and the original description.)\n';
  context += '(Analyze each comment for: new requirements, changed requirements, removed requirements, edge cases, clarifications.)\n';
  for (const c of allComments) {
    const date = new Date(c.created).toISOString().split('T')[0];
    context += `\n[${date}] ${c.author}:\n${c.body}\n`;
  }
  return context;
}

function buildPrompt(taskData, figmaData) {
  const { title, description, acceptanceCriteria, allComments, subTasks, linkedIssues, platform } = taskData;
  const hasFigma = figmaData && figmaData.screens && figmaData.screens.length > 0;
  const hasComments = allComments && allComments.length > 0;
  const isMobile = platform === 'mobile';

  let prompt = `You are a Test Lead with 10+ years of experience in mobile and web QA.\n`;
  prompt += `Your job: produce a complete, production-ready test case suite. Coverage drives quantity — do NOT stop early.\n\n`;

  prompt += `## Platform\n${isMobile ? 'Mobile App (Android & iOS)' : 'Web (CMS)'}\n\n`;

  prompt += `## App Context (AIEDU — Mobile Education App)\n`;
  prompt += `- User Types: Student, Parent — infer from task title/description\n`;
  prompt += `- Student: requires Grade Selection (小学5年生/小学6年生/中学1年生/中学2年生/中学3年生)\n`;
  prompt += `- Parent: skips Grade Selection; requires Phone Verification for Social auth\n`;
  prompt += `- Auth methods: Email (→OTP→Password), Social/LINE/Gmail/Apple (→OAuth→Grade or Phone→Nickname), Phone (→SMS OTP→Nickname)\n`;
  prompt += `- Screen IDs: 2-1-1 (Email/Phone Input), 2-1-2 (OTP), 2-3 (User Type), 2-4 (Grade), 2-5 (Nickname/Password), 2-6 (Completion)\n\n`;

  prompt += `## Task Title\n${title}\n\n`;
  prompt += `## Description\n${description || 'No description provided.'}\n\n`;
  if (acceptanceCriteria) prompt += `## Acceptance Criteria\n${acceptanceCriteria}\n\n`;
  if (subTasks && subTasks.length > 0) prompt += `## Sub-tasks\n${subTasks.map(s => `- ${s.key}: ${s.summary}`).join('\n')}\n\n`;
  if (linkedIssues && linkedIssues.length > 0) prompt += `## Linked Issues\n${linkedIssues.map(l => `- ${l.key} (${l.type}): ${l.summary}`).join('\n')}\n\n`;
  if (hasComments) prompt += formatCommentsContext(allComments) + '\n';
  if (hasFigma) prompt += formatFigmaContext(figmaData) + '\n';

  prompt += `## STEP 1 — REQUIREMENT ANALYSIS (do this mentally before writing)\n`;
  prompt += `Before writing a single test case, extract and list:\n`;
  prompt += `A) Every INPUT FIELD visible (from Figma + description + comments): name, data type, constraints (min/max length, format, allowed chars)\n`;
  prompt += `B) Every BUTTON/ACTION and its enable conditions\n`;
  prompt += `C) Every SCREEN and its navigation targets (forward + back)\n`;
  prompt += `D) Every API CALL triggered by user actions\n`;
  prompt += `E) Every VALIDATION RULE from ANY source — description, acceptance criteria, Figma labels, AND comments\n`;
  if (hasComments) {
    prompt += `F) From COMMENTS specifically: extract every new constraint, changed rule, clarification, or edge case mentioned\n`;
    prompt += `   → Treat comment-derived rules with SAME priority as hardcoded requirements\n`;
    prompt += `   → Newest comment overrides older ones and the original description\n`;
  }
  prompt += `\n`;

  prompt += `## STEP 2 — MANDATORY COVERAGE RULES\n`;
  prompt += `Apply these rules systematically to every element found in Step 1:\n\n`;

  prompt += `### For EVERY INPUT FIELD (apply Boundary Value Analysis + Equivalence Partitioning):\n`;
  prompt += `1. Valid value — typical happy path input\n`;
  prompt += `2. Valid value AT minimum boundary (e.g., exactly min chars)\n`;
  prompt += `3. Invalid value BELOW minimum (min - 1, e.g., 1 char if min=2)\n`;
  prompt += `4. Valid value AT maximum boundary (e.g., exactly max chars)\n`;
  prompt += `5. Invalid value ABOVE maximum (max + 1, e.g., 11 chars if max=10)\n`;
  prompt += `6. Empty / null\n`;
  prompt += `7. Whitespace only\n`;
  prompt += `8. Invalid format (wrong pattern, wrong character type)\n`;
  prompt += `9. Special characters / emoji (verify allowed vs rejected)\n`;
  prompt += `10. Duplicate value (if uniqueness is required)\n\n`;

  prompt += `### For EVERY BUTTON:\n`;
  prompt += `1. Verify disabled state (when conditions NOT met)\n`;
  prompt += `2. Verify enabled state (when ALL conditions met)\n`;
  prompt += `3. Tap on enabled button → verify correct action/navigation\n\n`;

  prompt += `### For EVERY SCREEN:\n`;
  prompt += `1. UI display: all elements shown with correct exact text (use Figma labels)\n`;
  prompt += `2. Forward navigation: correct screen appears on success\n`;
  prompt += `3. Back navigation: correct screen appears, data handling\n`;
  prompt += `4. Network error: API call fails → error shown, user can retry\n\n`;

  prompt += `### For OTP flows:\n`;
  prompt += `1. Correct OTP → success\n`;
  prompt += `2. Incorrect OTP (1st attempt) → error shown, can retry\n`;
  prompt += `3. Incorrect OTP reaching max attempts → locked out\n`;
  prompt += `4. Expired OTP → error shown\n`;
  prompt += `5. Resend OTP → new code sent, timer reset, old code invalidated\n\n`;

  if (isMobile) {
    prompt += `### For Mobile platform:\n`;
    prompt += `1. iOS vs Android differences (Apple Sign In iOS-only, Face ID, SMS auto-fill differences)\n`;
    prompt += `2. App lifecycle: background → foreground (data preserved), app kill → reopen\n`;
    prompt += `3. Network switching mid-action (WiFi → 4G, offline mode)\n`;
    prompt += `4. System interruptions: incoming call, low battery alert, push notification\n`;
    prompt += `5. Keyboard overlap on input fields\n\n`;
  }

  if (hasFigma) {
    prompt += `## STEP 3 — FIGMA-DRIVEN EXECUTION\n`;
    prompt += `Go through each Figma screen IN ORDER:\n`;
    prompt += `- Use EXACT UI text from Figma in steps and expected results (do not paraphrase)\n`;
    prompt += `- Reference screen name in every preCondition\n`;
    prompt += `- Apply ALL Step 2 rules to every element on that screen\n\n`;
  }

  prompt += `## STEP 4 — SCENARIO TESTS (after field-level coverage is complete)\n`;
  prompt += `1. Complete happy-path E2E flow from first screen to completion\n`;
  prompt += `2. Re-login after successful registration\n`;
  prompt += `3. Student vs Parent diverging flows (grade screen present/absent)\n`;
  prompt += `4. Security: unauthorized access, token expiry, session handling\n\n`;

  prompt += `## QUALITY RULES\n`;
  prompt += `- Each test case tests ONE thing only\n`;
  prompt += `- preCondition: specify exact screen, app state, pre-entered data\n`;
  prompt += `- steps: numbered, use action verbs (Tap, Enter, Observe, Navigate)\n`;
  prompt += `- expected: specific and verifiable — include exact UI text, error messages (Japanese where applicable)\n`;
  prompt += `- Do NOT group multiple validations into one test case\n`;
  prompt += `- Do NOT stop until ALL elements from Step 1 are fully covered\n`;
  prompt += `- Write in the same language as the task description\n\n`;

  prompt += `## Output Format\nReturn ONLY a valid JSON array, no extra text.\n`;
  prompt += `Test Case ID: TC_[USERTYPE]_[METHOD]_XXX (infer from context, e.g. TC_PARENT_EMAIL_001)\n\n`;
  prompt += `[\n`;
  prompt += `  {\n`;
  prompt += `    "id": "TC_PARENT_EMAIL_001",\n`;
  prompt += `    "no": 1,\n`;
  prompt += `    "testCase": "Verify Email Input screen displays all required elements",\n`;
  prompt += `    "preCondition": "1. App is installed and launched\\n2. User is on Start Screen\\n3. User has not logged in",\n`;
  prompt += `    "steps": "1. Tap '無料ではじめる' button\\n2. Observe all screen elements",\n`;
  prompt += `    "expected": "1. Navigates to Email Input screen (2-1-1)\\n2. Screen displays:\\n   - Email input field with placeholder\\n   - Consent checkbox (unchecked)\\n   - '確認コードを送る' button (disabled)\\n   - Back button",\n`;
  prompt += `    "priority": "High",\n`;
  prompt += `    "type": "UI"\n`;
  prompt += `  }\n`;
  prompt += `]\n\n`;
  prompt += `priority values: High | Medium | Low\n`;
  prompt += `type values: UI | Functional | Negative | Validation | Integration | End-to-End | Platform`;
  return prompt;
}

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
      max_tokens: 8192,
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
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 16384,
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseAndValidateTestCases(rawText) {
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array found in AI response');
  let testCases;
  try { testCases = JSON.parse(jsonMatch[0]); }
  catch (e) { throw new Error(`Failed to parse JSON: ${e.message}`); }
  if (!Array.isArray(testCases) || testCases.length === 0) throw new Error('AI returned empty or invalid test cases array');
  const required = ['no', 'testCase', 'preCondition', 'steps', 'expected'];
  for (const tc of testCases) {
    for (const field of required) {
      if (tc[field] === undefined || tc[field] === null) throw new Error(`Test case missing required field: "${field}"`);
    }
  }
  return testCases.map((tc, idx) => ({
    id: String(tc.id || `TC_${String(idx + 1).padStart(3, '0')}`),
    no: idx + 1,
    testCase: String(tc.testCase),
    preCondition: String(tc.preCondition),
    steps: String(tc.steps),
    expected: String(tc.expected),
    priority: String(tc.priority || 'Medium'),
    type: String(tc.type || 'Functional'),
    status: 'New',
  }));
}

/**
 * @param {object} taskData
 * @param {object|null} figmaData
 * @param {object} config - từ config.js (getConfig())
 */
async function generateTestCases(taskData, figmaData, config) {
  const { aiProvider, aiApiKey } = config;
  if (!aiApiKey) throw new Error('AI API Key chưa được cấu hình. Vào Settings để nhập.');

  const prompt = buildPrompt(taskData, figmaData);
  const screenCount = figmaData?.screens?.length || 0;
  console.log(`[AIGenerator] ${taskData.issueKey} | provider: ${aiProvider} | figma: ${!!figmaData} | screens: ${screenCount} | comments: ${taskData.allComments?.length || 0}`);

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const rawResponse = aiProvider === 'openai'
        ? await callOpenAIAPI(prompt, aiApiKey)
        : await callClaudeAPI(prompt, aiApiKey);
      const testCases = parseAndValidateTestCases(rawResponse);
      console.log(`[AIGenerator] Generated ${testCases.length} test cases`);
      return testCases;
    } catch (err) {
      lastError = err;
      console.error(`[AIGenerator] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }
  throw new Error(`AI failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

module.exports = { generateTestCases, buildPrompt, parseAndValidateTestCases };

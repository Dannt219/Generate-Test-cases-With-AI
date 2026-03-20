const { parseAndValidateTestCases, buildPrompt } = require('../aiGenerator');

describe('parseAndValidateTestCases', () => {
  const validTestCases = [
    {
      no: 1,
      testCase: 'Login with valid credentials',
      preCondition: 'User is on login page',
      steps: '1. Enter username\n2. Enter password\n3. Click Login',
      expected: 'User is redirected to dashboard',
    },
    {
      no: 2,
      testCase: 'Login with invalid password',
      preCondition: 'User is on login page',
      steps: '1. Enter valid username\n2. Enter wrong password\n3. Click Login',
      expected: 'Error message is displayed',
    },
  ];

  test('Parse valid JSON array correctly', () => {
    const result = parseAndValidateTestCases(JSON.stringify(validTestCases));
    expect(result).toHaveLength(2);
    expect(result[0].testCase).toBe('Login with valid credentials');
  });

  test('Extract JSON array from response with surrounding text', () => {
    const raw = `Here are the test cases:\n${JSON.stringify(validTestCases)}\nDone.`;
    const result = parseAndValidateTestCases(raw);
    expect(result).toHaveLength(2);
  });

  test('Normalize no field to sequential numbers', () => {
    const unordered = validTestCases.map((tc, i) => ({ ...tc, no: i + 10 }));
    const result = parseAndValidateTestCases(JSON.stringify(unordered));
    expect(result[0].no).toBe(1);
    expect(result[1].no).toBe(2);
  });

  test('Throw error when no JSON array found', () => {
    expect(() => parseAndValidateTestCases('No JSON here')).toThrow('No JSON array found');
  });

  test('Throw error when missing required field', () => {
    const invalid = [{ no: 1, testCase: 'TC 1', preCondition: 'Pre' }];
    expect(() => parseAndValidateTestCases(JSON.stringify(invalid))).toThrow('missing required field');
  });

  test('Throw error for empty array', () => {
    expect(() => parseAndValidateTestCases('[]')).toThrow('empty or invalid');
  });
});

describe('buildPrompt', () => {
  const taskData = {
    issueKey: 'AIEDU-48',
    title: '[CMS] User Login Feature',
    description: 'Users should be able to login with email and password.',
    acceptanceCriteria: 'Given valid credentials, when user logs in, then redirect to dashboard.',
    allComments: [
      { author: 'PM Alice', body: 'Please also add remember me checkbox', created: '2026-03-10T10:00:00Z' },
      { author: 'Designer Bob', body: 'Updated: Use "Sign In" instead of "Login" per latest Figma', created: '2026-03-12T14:00:00Z' },
    ],
    subTasks: [{ key: 'AIEDU-49', summary: 'Backend API' }],
    linkedIssues: [],
  };

  const figmaData = {
    screens: [{
      name: 'Login Screen',
      components: ['Email Input', 'Password Input', 'Sign In Button'],
      textContent: ['Enter your email', 'Password', 'Sign In', 'Forgot password?'],
      imageUrl: null,
    }],
  };

  test('Prompt contains issue title', () => {
    const prompt = buildPrompt(taskData, null);
    expect(prompt).toContain('[CMS] User Login Feature');
  });

  test('Prompt contains comments section when comments exist', () => {
    const prompt = buildPrompt(taskData, null);
    expect(prompt).toContain('Comments & Requirements Updates');
    expect(prompt).toContain('remember me checkbox');
    expect(prompt).toContain('PM Alice');
  });

  test('Prompt includes comment priority rule when comments exist', () => {
    const prompt = buildPrompt(taskData, null);
    expect(prompt).toContain('Comments priority rule');
    expect(prompt).toContain('newest comment');
  });

  test('Prompt contains Figma section when figmaData provided', () => {
    const prompt = buildPrompt(taskData, figmaData);
    expect(prompt).toContain('Figma Design Information');
    expect(prompt).toContain('Login Screen');
    expect(prompt).toContain('Sign In Button');
    expect(prompt).toContain('Enter your email');
  });

  test('Prompt includes Figma UI instructions when figmaData provided', () => {
    const prompt = buildPrompt(taskData, figmaData);
    expect(prompt).toContain('UI elements');
  });

  test('No Figma section when figmaData is null', () => {
    const prompt = buildPrompt(taskData, null);
    expect(prompt).not.toContain('Figma Design Information');
  });

  test('No comments section when allComments is empty', () => {
    const taskNoComments = { ...taskData, allComments: [] };
    const prompt = buildPrompt(taskNoComments, null);
    expect(prompt).not.toContain('Comments & Requirements Updates');
  });

  test('Prompt requests JSON output format', () => {
    const prompt = buildPrompt(taskData, null);
    expect(prompt).toContain('JSON array');
    expect(prompt).toContain('"testCase"');
    expect(prompt).toContain('"expected"');
  });
});

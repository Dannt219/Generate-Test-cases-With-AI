/**
 * Sample Jira webhook payload — dùng để test local
 * Simulates: task AIEDU-48 ([CMS]) transitions from "Open" to "In Progress"
 */
const sampleTransitionEvent = {
  eventType: 'jira:issue_updated',
  cloudId: 'castalk-cloud-id',
  issue: {
    id: '10048',
    key: 'AIEDU-48',
    fields: {
      summary: '[CMS] User Authentication — Login & Logout Feature',
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Users should be able to login using their email and password.\n\nDesign: https://www.figma.com/file/AbCdEfGh123/Login-Screen?node-id=1-2',
            }],
          },
          {
            type: 'heading',
            content: [{ type: 'text', text: 'Acceptance Criteria' }],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Given valid credentials, when user clicks Login, then redirect to /dashboard' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Given invalid password, when user clicks Login, then show error "Invalid credentials"' }] }] },
            ],
          },
        ],
      },
      priority: { name: 'High' },
      issuetype: { name: 'Story' },
      assignee: { displayName: 'John Developer', accountId: 'dev-001' },
      reporter: { displayName: 'Alice PM', accountId: 'pm-001' },
      status: { name: 'In Progress' },
      subtasks: [
        { key: 'AIEDU-49', fields: { summary: '[CMS] Login API endpoint' } },
        { key: 'AIEDU-50', fields: { summary: '[CMS] Login UI component' } },
      ],
      issuelinks: [],
      labels: ['auth', 'cms'],
    },
  },
  changelog: {
    id: 'changelog-001',
    items: [
      {
        field: 'status',
        fromString: 'Open',
        toString: 'In Progress',
      },
    ],
  },
  user: { accountId: 'dev-001', displayName: 'John Developer' },
  timestamp: 1742090000000,
};

/**
 * Sample Mobile task event ([Android])
 */
const sampleMobileEvent = {
  ...sampleTransitionEvent,
  issue: {
    ...sampleTransitionEvent.issue,
    key: 'AIEDU-55',
    fields: {
      ...sampleTransitionEvent.issue.fields,
      summary: '[Android] Push Notification — New Message Alert',
      description: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'App should show push notification when user receives a new message.\n\nFigma: https://www.figma.com/design/XyZ123/Notifications' }],
        }],
      },
      subtasks: [],
    },
  },
};

/**
 * Sample merged comments (task + subtasks, sorted cũ → mới)
 */
const sampleAllComments = [
  {
    author: 'Alice PM',
    body: 'Please make sure the login button says "Sign In" not "Login" per design system.',
    created: '2026-03-10T09:00:00Z',
  },
  {
    author: 'John Developer',
    body: '[AIEDU-49] API will support both email and phone number login.',
    created: '2026-03-11T11:00:00Z',
  },
  {
    author: 'Bob Designer',
    body: '[AIEDU-50] Updated Figma with new error state designs. See: https://www.figma.com/file/AbCdEfGh123/Login-Screen?node-id=3-4',
    created: '2026-03-12T14:30:00Z',
  },
  {
    author: 'Alice PM',
    body: 'IMPORTANT: Removed phone number login. Only email now. Ignore previous comment about phone.',
    created: '2026-03-13T10:00:00Z', // newest = highest priority
  },
];

/**
 * Sample Figma design data output
 */
const sampleFigmaData = {
  screens: [
    {
      name: 'Login Screen',
      components: ['Email Input', 'Password Input', 'Sign In Button', 'Forgot Password Link', 'Remember Me Checkbox'],
      textContent: ['Enter your email', 'Password', 'Sign In', 'Forgot password?', 'Remember me', 'Invalid credentials'],
      imageUrl: 'https://figma-cdn.com/sample-login-thumbnail.png',
    },
    {
      name: 'Login Error State',
      components: ['Email Input', 'Password Input', 'Sign In Button', 'Error Banner'],
      textContent: ['Invalid credentials. Please try again.', 'Sign In'],
      imageUrl: null,
    },
  ],
};

/**
 * Sample AI response — valid JSON test cases
 */
const sampleAIResponse = `
Here are the test cases for the login feature:

[
  {
    "no": 1,
    "testCase": "Login with valid email and password",
    "preCondition": "User has a registered account. User is on the login page.",
    "steps": "1. Navigate to /login\\n2. Enter valid email: test@example.com\\n3. Enter valid password: Test@123\\n4. Click the Sign In button",
    "expected": "User is redirected to /dashboard. Welcome message displays user's name."
  },
  {
    "no": 2,
    "testCase": "Login with invalid password — verify error banner",
    "preCondition": "User has a registered account. User is on the login page.",
    "steps": "1. Navigate to /login\\n2. Enter valid email: test@example.com\\n3. Enter wrong password: wrongpass\\n4. Click the Sign In button",
    "expected": "Error banner displays: 'Invalid credentials. Please try again.' User remains on login page."
  },
  {
    "no": 3,
    "testCase": "Verify Sign In button label matches Figma design",
    "preCondition": "User is on the login page.",
    "steps": "1. Navigate to /login\\n2. Observe the login button text",
    "expected": "Button displays 'Sign In' (not 'Login') per design system requirement."
  }
]
`;

module.exports = {
  sampleTransitionEvent,
  sampleMobileEvent,
  sampleAllComments,
  sampleFigmaData,
  sampleAIResponse,
};

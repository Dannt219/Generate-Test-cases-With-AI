const { extractNodeInfo } = require('../figmaFetcher');
const { extractFigmaLinks } = require('../jiraDataFetcher');

describe('extractFigmaLinks', () => {
  test('Extract figma.com/file link', () => {
    const text = 'Design: https://www.figma.com/file/ABC123xyz/Login-Screen';
    const links = extractFigmaLinks(text);
    expect(links).toHaveLength(1);
    expect(links[0].fileKey).toBe('ABC123xyz');
    expect(links[0].nodeIds).toEqual([]);
  });

  test('Extract figma.com/design link', () => {
    const text = 'See design at https://www.figma.com/design/XYZ789abc/Dashboard?node-id=10-20';
    const links = extractFigmaLinks(text);
    expect(links).toHaveLength(1);
    expect(links[0].fileKey).toBe('XYZ789abc');
    expect(links[0].nodeIds).toEqual(['10:20']);
  });

  test('Extract multiple Figma links', () => {
    const text = `
      Login: https://www.figma.com/file/FILE1/Login
      Dashboard: https://www.figma.com/file/FILE2/Dashboard?node-id=5-10
    `;
    const links = extractFigmaLinks(text);
    expect(links).toHaveLength(2);
    expect(links[0].fileKey).toBe('FILE1');
    expect(links[1].fileKey).toBe('FILE2');
    expect(links[1].nodeIds).toEqual(['5:10']);
  });

  test('No Figma links → empty array', () => {
    expect(extractFigmaLinks('No links here')).toEqual([]);
    expect(extractFigmaLinks('')).toEqual([]);
    expect(extractFigmaLinks(null)).toEqual([]);
  });

  test('Deduplicate identical links', () => {
    const text = 'https://www.figma.com/file/SAME/Screen https://www.figma.com/file/SAME/Screen';
    const links = extractFigmaLinks(text);
    expect(links).toHaveLength(1);
  });
});

describe('extractNodeInfo', () => {
  const mockFrame = {
    type: 'FRAME',
    name: 'Login Screen',
    children: [
      { type: 'TEXT', characters: 'Enter your email' },
      { type: 'TEXT', characters: 'Password' },
      {
        type: 'INSTANCE',
        name: 'Login Button',
        children: [
          { type: 'TEXT', characters: 'Log In' },
        ],
      },
      {
        type: 'GROUP',
        name: 'Form Group',
        children: [
          { type: 'TEXT', characters: 'Forgot password?' },
        ],
      },
    ],
  };

  test('Extract text content from text nodes', () => {
    const { textContent } = extractNodeInfo(mockFrame);
    expect(textContent).toContain('Enter your email');
    expect(textContent).toContain('Password');
    expect(textContent).toContain('Log In');
    expect(textContent).toContain('Forgot password?');
  });

  test('Extract component names', () => {
    const { components } = extractNodeInfo(mockFrame);
    expect(components).toContain('Login Button');
    expect(components).toContain('Form Group');
  });

  test('Root frame not included in components (depth=0)', () => {
    const { components } = extractNodeInfo(mockFrame, 0);
    expect(components).not.toContain('Login Screen');
  });

  test('Deduplicate text content', () => {
    const nodeWithDups = {
      type: 'FRAME',
      name: 'Screen',
      children: [
        { type: 'TEXT', characters: 'Submit' },
        { type: 'TEXT', characters: 'Submit' }, // duplicate
      ],
    };
    const { textContent } = extractNodeInfo(nodeWithDups);
    expect(textContent.filter(t => t === 'Submit')).toHaveLength(1);
  });

  test('Handle null/undefined node', () => {
    const result = extractNodeInfo(null);
    expect(result.components).toEqual([]);
    expect(result.textContent).toEqual([]);
  });
});

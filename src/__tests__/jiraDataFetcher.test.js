const { detectPlatform, isValidTransition } = require('../jiraDataFetcher');

describe('detectPlatform', () => {
  test('[CMS] prefix → web', () => {
    expect(detectPlatform('[CMS] Login page')).toBe('web');
    expect(detectPlatform('[cms] dashboard')).toBe('web');
  });

  test('[Android] prefix → mobile', () => {
    expect(detectPlatform('[Android] Push notification')).toBe('mobile');
    expect(detectPlatform('[android] login')).toBe('mobile');
  });

  test('[IOS] prefix → mobile', () => {
    expect(detectPlatform('[IOS] Home screen')).toBe('mobile');
    expect(detectPlatform('[ios] settings')).toBe('mobile');
  });

  test('No prefix → mobile (default)', () => {
    expect(detectPlatform('Some task without prefix')).toBe('mobile');
    expect(detectPlatform('')).toBe('mobile');
    expect(detectPlatform(null)).toBe('mobile');
  });
});

describe('isValidTransition', () => {
  const makeEvent = (fromStatus, toStatus) => ({
    changelog: {
      items: [{ field: 'status', fromString: fromStatus, toString: toStatus }],
    },
  });

  test('Open → In Progress is valid', () => {
    expect(isValidTransition(makeEvent('Open', 'In Progress'))).toBe(true);
  });

  test('To Do → In Progress is valid', () => {
    expect(isValidTransition(makeEvent('To Do', 'In Progress'))).toBe(true);
  });

  test('In Progress → Done is NOT valid', () => {
    expect(isValidTransition(makeEvent('In Progress', 'Done'))).toBe(false);
  });

  test('Open → Done is NOT valid', () => {
    expect(isValidTransition(makeEvent('Open', 'Done'))).toBe(false);
  });

  test('Missing changelog → false', () => {
    expect(isValidTransition({})).toBe(false);
    expect(isValidTransition({ changelog: { items: [] } })).toBe(false);
  });

  test('Non-status changelog items → false', () => {
    expect(isValidTransition({
      changelog: { items: [{ field: 'assignee', fromString: 'Alice', toString: 'Bob' }] },
    })).toBe(false);
  });
});

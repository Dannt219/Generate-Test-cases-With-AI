const { buildHeaderConfig } = require('../googleSheetsExporter');

describe('buildHeaderConfig', () => {
  describe('platform = "mobile"', () => {
    const config = buildHeaderConfig('mobile');

    test('Row 1 has correct headers', () => {
      expect(config.row1[0]).toBe('#');
      expect(config.row1[1]).toBe('Test case');
      expect(config.row1[2]).toBe('Pre-condition');
      expect(config.row1[3]).toBe('Steps');
      expect(config.row1[4]).toBe('Expected');
      expect(config.row1[5]).toBe('Android');
      expect(config.row1[7]).toBe('IOS');
    });

    test('Row 2 has Actual Result and Jira bug for both platforms', () => {
      expect(config.row2[5]).toBe('Actual Result');
      expect(config.row2[6]).toBe('Jira bug');
      expect(config.row2[7]).toBe('Actual Result');
      expect(config.row2[8]).toBe('Jira bug');
    });

    test('Total columns = 9 (A-I)', () => {
      expect(config.totalColumns).toBe(9);
    });

    test('Has 2 merge ranges for Android and IOS', () => {
      expect(config.merges).toHaveLength(2);
      expect(config.merges[0]).toEqual({ startColumnIndex: 5, endColumnIndex: 7 }); // F:G = Android
      expect(config.merges[1]).toEqual({ startColumnIndex: 7, endColumnIndex: 9 }); // H:I = IOS
    });
  });

  describe('platform = "web"', () => {
    const config = buildHeaderConfig('web');

    test('Row 1 has Web header', () => {
      expect(config.row1[5]).toBe('Web');
    });

    test('Row 2 has Actual Result and Jira bug for Web', () => {
      expect(config.row2[5]).toBe('Actual Result');
      expect(config.row2[6]).toBe('Jira bug');
    });

    test('Total columns = 7 (A-G)', () => {
      expect(config.totalColumns).toBe(7);
    });

    test('Has 1 merge range for Web', () => {
      expect(config.merges).toHaveLength(1);
      expect(config.merges[0]).toEqual({ startColumnIndex: 5, endColumnIndex: 7 }); // F:G = Web
    });
  });

  describe('Default platform', () => {
    test('Unknown platform defaults to mobile layout', () => {
      const config = buildHeaderConfig('unknown');
      expect(config.totalColumns).toBe(9);
      expect(config.row1[5]).toBe('Android');
    });
  });
});

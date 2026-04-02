/**
 * AI TestCase Generator — Google Apps Script Web App
 * Deploy as: Execute as Me | Anyone can access
 */

// ── Color palette ─────────────────────────────────────────
var COLOR_HEADER_DARK  = '#203764'; // dark navy — section labels
var COLOR_HEADER_BLUE  = '#2F75B6'; // mid blue  — platform header rows
var COLOR_HEADER_LIGHT = '#BDD7EE'; // light blue — sub-column headers
var COLOR_META_LABEL   = '#D6E4F0'; // pale blue  — metadata label cells
var COLOR_WHITE        = '#FFFFFF';
var COLOR_FONT_WHITE   = '#FFFFFF';
var COLOR_FONT_DARK    = '#1F1F1F';

// Handle GET requests (happens when HTTP client converts POST→GET on 302 redirect)
function doGet(e) {
  return doPost(e);
}

function doPost(e) {
  try {
    var data        = JSON.parse(e.postData.contents);
    var folderId    = data.folderId    || '';
    var fileName    = data.fileName    || ('TestCases_' + new Date().toISOString().slice(0, 10));
    var platform    = data.platform    || 'mobile'; // 'web' | 'mobile'
    var testCases   = data.testCases   || [];
    var issueTitle  = data.issueTitle  || '';
    var issueUrl    = data.issueUrl    || '';
    var assignee    = data.assignee    || '';

    // 1. Tạo spreadsheet mới
    var ss    = SpreadsheetApp.create(fileName);
    var sheet = ss.getActiveSheet();
    sheet.setName('Test Cases');

    var tcCount = testCases.length;

    // ── 2. Metadata section (rows 1-9) ───────────────────
    _writeMetadataSection(sheet, issueTitle, issueUrl, assignee, tcCount, platform);

    // ── 3. Blank separator row 10 ────────────────────────
    sheet.getRange(10, 1).setValue('');

    // ── 4. Test case headers (row 11+) ───────────────────
    var totalCols;
    if (platform === 'web') {
      totalCols = _writeWebHeaders(sheet, 11);
    } else {
      totalCols = _writeMobileHeaders(sheet, 11);
    }

    // ── 5. Test case data rows ────────────────────────────
    if (tcCount > 0) {
      _writeTestCaseRows(sheet, testCases, platform, 13, totalCols);
    }

    // ── 6. Column widths ──────────────────────────────────
    _setColumnWidths(sheet, platform);

    // ── 7. Freeze rows (meta + header) ───────────────────
    sheet.setFrozenRows(12);

    // ── 8. Move to folder ─────────────────────────────────
    if (folderId) {
      var file   = DriveApp.getFileById(ss.getId());
      var folder = DriveApp.getFolderById(folderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    }

    return _json({ success: true, url: ss.getUrl(), spreadsheetId: ss.getId() });

  } catch (err) {
    return _json({ success: false, error: err.message });
  }
}

// ── Metadata Section ─────────────────────────────────────

function _writeMetadataSection(sheet, issueTitle, issueUrl, assignee, tcCount, platform) {
  // Labels column A, values column B (merged B-E)
  var labels = [
    ['Module',          issueTitle],
    ['Test requirement', issueUrl],
    ['Tester',          assignee],
    ['Reviewer',        ''],
    ['Status',          ''],
  ];

  for (var i = 0; i < labels.length; i++) {
    var row = i + 1;
    sheet.getRange(row, 1).setValue(labels[i][0]);
    sheet.getRange(row, 2).setValue(labels[i][1]);
    // Merge B-E for value cell
    sheet.getRange(row, 2, 1, 4).merge();
  }

  // Style label cells A1:A5
  var labelRange = sheet.getRange(1, 1, 5, 1);
  labelRange.setBackground(COLOR_META_LABEL);
  labelRange.setFontWeight('bold');
  labelRange.setFontColor(COLOR_FONT_DARK);
  labelRange.setBorder(true, true, true, true, true, true);

  // Style value cells B1:E5
  var valueRange = sheet.getRange(1, 2, 5, 4);
  valueRange.setBackground(COLOR_WHITE);
  valueRange.setBorder(true, true, true, true, true, true);
  valueRange.setWrap(true);

  // Make Test requirement a hyperlink if URL provided
  if (issueUrl) {
    try {
      sheet.getRange(2, 2).setFormula('=HYPERLINK("' + issueUrl + '","' + issueUrl + '")');
    } catch(ex) {
      sheet.getRange(2, 2).setValue(issueUrl);
    }
  }

  // ── Platform stats table (rows 6-9) ──
  // Row 6: header row for stats table
  // Cols: A=Platform, B-E=In-sprint TC (OK/NG/Untest/Blocked),
  //       F-I=Mainflow (OK/NG/Untest/Blocked), J-L=Automation (Todo/Inprogress/Done)

  // Header row 6
  sheet.getRange(6, 1).setValue('Platform');
  sheet.getRange(6, 2, 1, 4).setValues([['In-sprint Test Cases', '', '', '']]);
  sheet.getRange(6, 2, 1, 4).merge();
  sheet.getRange(6, 6, 1, 4).setValues([['Mainflow', '', '', '']]);
  sheet.getRange(6, 6, 1, 4).merge();
  sheet.getRange(6, 10, 1, 3).setValues([['Automation', '', '']]);
  sheet.getRange(6, 10, 1, 3).merge();

  // Sub-header row 7
  sheet.getRange(7, 1).setValue('');
  sheet.getRange(7, 2, 1, 4).setValues([['OK', 'NG', 'Untest', 'Blocked']]);
  sheet.getRange(7, 6, 1, 4).setValues([['OK', 'NG', 'Untest', 'Blocked']]);
  sheet.getRange(7, 10, 1, 3).setValues([['Todo', 'In progress', 'Done']]);

  // Platform rows 8-9
  var platformRows;
  if (platform === 'web') {
    platformRows = [['Web'], ['']];
  } else {
    platformRows = [['Android'], ['IOS']];
  }
  for (var p = 0; p < platformRows.length; p++) {
    var pRow = 8 + p;
    sheet.getRange(pRow, 1).setValue(platformRows[p][0]);
    // Leave count cells empty (filled manually)
    sheet.getRange(pRow, 2, 1, 10).setValue('');
  }

  // Style stats header rows 6-7
  var statsHeaderRange = sheet.getRange(6, 1, 2, 12);
  statsHeaderRange.setBackground(COLOR_HEADER_BLUE);
  statsHeaderRange.setFontColor(COLOR_FONT_WHITE);
  statsHeaderRange.setFontWeight('bold');
  statsHeaderRange.setHorizontalAlignment('center');
  statsHeaderRange.setVerticalAlignment('middle');
  statsHeaderRange.setBorder(true, true, true, true, true, true);

  // Style platform data rows 8-9
  var statsDataRange = sheet.getRange(8, 1, 2, 12);
  statsDataRange.setBackground(COLOR_WHITE);
  statsDataRange.setBorder(true, true, true, true, true, true);
  statsDataRange.setHorizontalAlignment('center');
  // Bold platform name column
  sheet.getRange(8, 1, 2, 1).setFontWeight('bold').setBackground(COLOR_META_LABEL);

  // Total TC count summary in row 1 cols F-I
  sheet.getRange(1, 6).setValue('No. of Test cases');
  sheet.getRange(1, 7).setValue(tcCount);
  sheet.getRange(1, 8).setValue('No. in-sprint TC');
  sheet.getRange(1, 9).setValue('');
  sheet.getRange(2, 6).setValue('No. mainflow TC');
  sheet.getRange(2, 7).setValue('');
  sheet.getRange(2, 8).setValue('No. Automation TC');
  sheet.getRange(2, 9).setValue('');

  // Style summary cells F1:I2
  var summaryRange = sheet.getRange(1, 6, 2, 4);
  summaryRange.setBackground(COLOR_META_LABEL);
  summaryRange.setBorder(true, true, true, true, true, true);
  summaryRange.setFontWeight('bold');

  // Rows 3-5 cols F onward: merge and leave blank
  sheet.getRange(3, 6, 3, 4).setBackground(COLOR_WHITE);
  sheet.getRange(3, 6, 3, 4).setBorder(true, true, true, true, true, true);
}

// ── Test Case Headers ─────────────────────────────────────

// Web: 11 data columns
function _writeWebHeaders(sheet, startRow) {
  var row1 = ['#', 'Test case', 'Pre-condition', 'Steps', 'Expected', 'Web', '', 'In Sprint', 'Regression test', 'Priority', 'LLM', 'Automatable'];
  var row2 = ['', '', '', '', '', 'Actual Result', 'Jira bug', '', '', '', '', ''];
  var totalCols = row1.length;

  sheet.getRange(startRow,     1, 1, totalCols).setValues([row1]);
  sheet.getRange(startRow + 1, 1, 1, totalCols).setValues([row2]);

  // Merge main headers that span 2 rows: cols 1-5, 8-12
  for (var c = 1; c <= 5; c++) {
    sheet.getRange(startRow, c, 2, 1).merge();
  }
  for (var c2 = 8; c2 <= totalCols; c2++) {
    sheet.getRange(startRow, c2, 2, 1).merge();
  }
  // Merge Web cols (6-7 in row startRow)
  sheet.getRange(startRow, 6, 1, 2).merge();

  _styleTestCaseHeaders(sheet, startRow, totalCols);
  return totalCols;
}

// Mobile: 13 data columns
function _writeMobileHeaders(sheet, startRow) {
  var row1 = ['#', 'Test case', 'Pre-condition', 'Steps', 'Expected', 'Android', '', 'IOS', '', 'In Sprint', 'Regression test', 'Priority', 'LLM', 'Automatable'];
  var row2 = ['', '', '', '', '', 'Actual Result', 'Jira bug', 'Actual Result', 'Jira bug', '', '', '', '', ''];
  var totalCols = row1.length;

  sheet.getRange(startRow,     1, 1, totalCols).setValues([row1]);
  sheet.getRange(startRow + 1, 1, 1, totalCols).setValues([row2]);

  // Merge main headers cols 1-5, 10-14 (span 2 rows)
  for (var c = 1; c <= 5; c++) {
    sheet.getRange(startRow, c, 2, 1).merge();
  }
  for (var c2 = 10; c2 <= totalCols; c2++) {
    sheet.getRange(startRow, c2, 2, 1).merge();
  }
  // Merge Android (cols 6-7) and IOS (cols 8-9)
  sheet.getRange(startRow, 6, 1, 2).merge();
  sheet.getRange(startRow, 8, 1, 2).merge();

  _styleTestCaseHeaders(sheet, startRow, totalCols);
  return totalCols;
}

function _styleTestCaseHeaders(sheet, startRow, totalCols) {
  var headerRange = sheet.getRange(startRow, 1, 2, totalCols);
  headerRange.setBackground(COLOR_HEADER_DARK);
  headerRange.setFontColor(COLOR_FONT_WHITE);
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  headerRange.setBorder(true, true, true, true, true, true);
}

// ── Test Case Data Rows ────────────────────────────────────

function _writeTestCaseRows(sheet, testCases, platform, startRow, totalCols) {
  var rows = testCases.map(function(tc, i) {
    var base = [
      tc.no || (i + 1),
      tc.testCase    || tc.title       || '',
      tc.preCondition || tc.precondition || '',
      tc.steps       || '',
      tc.expected    || '',
    ];
    if (platform === 'web') {
      // Web: Actual, Bug, InSprint, Regression, Priority, LLM, Automatable
      return base.concat(['', '', tc.inSprint || '', tc.regression || '', tc.priority || '', tc.llm || '', tc.automatable || '']);
    } else {
      // Mobile: Android Actual, Android Bug, IOS Actual, IOS Bug, InSprint, Regression, Priority, LLM, Automatable
      return base.concat(['', '', '', '', tc.inSprint || '', tc.regression || '', tc.priority || '', tc.llm || '', tc.automatable || '']);
    }
  });

  sheet.getRange(startRow, 1, rows.length, totalCols).setValues(rows);

  var dataRange = sheet.getRange(startRow, 1, rows.length, totalCols);
  dataRange.setWrap(true);
  dataRange.setBorder(true, true, true, true, true, true);
  dataRange.setVerticalAlignment('top');

  // Alternate row shading
  for (var i = 0; i < rows.length; i++) {
    var rowRange = sheet.getRange(startRow + i, 1, 1, totalCols);
    rowRange.setBackground(i % 2 === 0 ? COLOR_WHITE : '#F0F7FF');
  }
}

// ── Column Widths ──────────────────────────────────────────

function _setColumnWidths(sheet, platform) {
  // Col 1: # (narrow)
  sheet.setColumnWidth(1, 40);
  // Col 2: Test case
  sheet.setColumnWidth(2, 260);
  // Col 3: Pre-condition
  sheet.setColumnWidth(3, 180);
  // Col 4: Steps
  sheet.setColumnWidth(4, 220);
  // Col 5: Expected
  sheet.setColumnWidth(5, 200);

  if (platform === 'web') {
    sheet.setColumnWidth(6, 160); // Actual
    sheet.setColumnWidth(7, 120); // Bug
    sheet.setColumnWidth(8, 80);  // In Sprint
    sheet.setColumnWidth(9, 110); // Regression
    sheet.setColumnWidth(10, 70); // Priority
    sheet.setColumnWidth(11, 60); // LLM
    sheet.setColumnWidth(12, 90); // Automatable
  } else {
    sheet.setColumnWidth(6, 160); // Android Actual
    sheet.setColumnWidth(7, 120); // Android Bug
    sheet.setColumnWidth(8, 160); // IOS Actual
    sheet.setColumnWidth(9, 120); // IOS Bug
    sheet.setColumnWidth(10, 80); // In Sprint
    sheet.setColumnWidth(11, 110); // Regression
    sheet.setColumnWidth(12, 70); // Priority
    sheet.setColumnWidth(13, 60); // LLM
    sheet.setColumnWidth(14, 90); // Automatable
  }

  // Meta label column A
  sheet.setColumnWidth(1, 140);
}

// ── Helpers ───────────────────────────────────────────────

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Local test ────────────────────────────────────────────
function _testLocally() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        folderId:   '',
        fileName:   'TestCases_AIEDU-11_2026-03-30',
        platform:   'mobile',
        issueTitle: '[EDU] Login screen improvements',
        issueUrl:   'https://your-site.atlassian.net/browse/PROJ-11',
        assignee:   'Nguyen Van A',
        testCases: [
          { no: 1, testCase: 'Login with valid credentials', preCondition: 'User is on login screen', steps: '1. Enter valid email\n2. Enter password\n3. Tap Login', expected: 'User is logged in', priority: 'High', inSprint: 'Yes', automatable: 'Yes' },
          { no: 2, testCase: 'Login with invalid password', preCondition: 'User is on login screen', steps: '1. Enter valid email\n2. Enter wrong password\n3. Tap Login', expected: 'Error message shown', priority: 'Medium', inSprint: 'Yes', automatable: 'No' }
        ]
      })
    }
  };
  var result = doPost(mockEvent);
  Logger.log(result.getContent());
}

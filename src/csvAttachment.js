const api = require('@forge/api');

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsv(testCases, platform) {
  const rows = [];
  if (platform === 'web') {
    rows.push(['Test Case ID', '#', 'Test Case Title', 'Preconditions', 'Test Steps', 'Expected Results', 'Priority', 'Type', 'Status', 'Actual Result', 'Jira Bug']);
  } else {
    rows.push(['Test Case ID', '#', 'Test Case Title', 'Preconditions', 'Test Steps', 'Expected Results', 'Priority', 'Type', 'Status', 'Android Actual', 'Android Bug', 'iOS Actual', 'iOS Bug']);
  }
  testCases.forEach(tc => {
    rows.push([tc.id || '', tc.no, tc.testCase, tc.preCondition, tc.steps, tc.expected, tc.priority || 'Medium', tc.type || 'Functional', tc.status || 'New']);
  });
  return rows.map(row => row.map(escapeCsv).join(',')).join('\n');
}

async function attachCsvToJira(issueKey, platform, testCases) {
  const csvContent = '\uFEFF' + buildCsv(testCases, platform); // BOM for Excel
  const filename = `${issueKey}-testcases.csv`;
  const boundary = '----ForgeBoundary' + Date.now().toString(16);

  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: text/csv; charset=utf-8`,
    '',
    csvContent,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await api.asApp().requestJira(
    api.route`/rest/api/3/issue/${issueKey}/attachments`,
    {
      method: 'POST',
      headers: {
        'X-Atlassian-Token': 'no-check',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    throw new Error(`Attach CSV failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const attachment = Array.isArray(data) ? data[0] : data;
  console.log(`[CsvAttachment] Attached: ${filename}`);
  return { filename, url: attachment?.content || '' };
}

module.exports = { attachCsvToJira };

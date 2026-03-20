const { fetch } = require('@forge/api');

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const HEADER_BG = { red: 0.267, green: 0.447, blue: 0.769 }; // #4472C4
const HEADER_FG = { red: 1, green: 1, blue: 1 };

async function getAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);
  // Strip markdown link formatting if email was pasted as [email](mailto:email)
  const clientEmail = (sa.client_email || '').replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1').trim();
  if (!clientEmail || !clientEmail.includes('@')) {
    throw new Error(`Invalid client_email in Service Account JSON: "${sa.client_email}". Please re-paste the raw JSON file.`);
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: OAUTH_URL, iat: now, exp: now + 3600,
  };
  const jwt = await createJWT(header, payload, sa.private_key);
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google OAuth error: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function createJWT(header, payload, pem) {
  const b64 = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const input = `${b64(header)}.${b64(payload)}`;
  const keyData = pemToBuffer(pem);
  const key = await crypto.subtle.importKey('pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${input}.${b64Sig}`;
}

function pemToBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function getOrCreateSpreadsheet(token, spreadsheetId) {
  if (spreadsheetId) {
    // Accept full URL: extract ID from https://docs.google.com/spreadsheets/d/{ID}/...
    const match = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return spreadsheetId;
  }
  // Use Drive API to create spreadsheet (more permissive than Sheets API create)
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'AI TestCase Generator',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    }),
  });
  if (!res.ok) throw new Error(`Create spreadsheet failed: ${await res.text()}`);
  return (await res.json()).id;
}

async function addSheetTab(token, spreadsheetId, tabName) {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('already exists')) return getSheetId(token, spreadsheetId, tabName);
    throw new Error(`Add sheet tab failed: ${text}`);
  }
  return (await res.json()).replies?.[0]?.addSheet?.properties?.sheetId;
}

async function getSheetId(token, spreadsheetId, tabName) {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  return data.sheets?.find(s => s.properties.title === tabName)?.properties?.sheetId;
}

function buildHeaderConfig(platform) {
  if (platform === 'web') {
    return {
      row1: ['#', 'Test case', 'Pre-condition', 'Steps', 'Expected', 'Web', ''],
      row2: ['', '', '', '', '', 'Actual Result', 'Jira bug'],
      merges: [{ startColumnIndex: 5, endColumnIndex: 7 }],
      totalColumns: 7,
    };
  }
  return {
    row1: ['#', 'Test case', 'Pre-condition', 'Steps', 'Expected', 'Android', '', 'IOS', ''],
    row2: ['', '', '', '', '', 'Actual Result', 'Jira bug', 'Actual Result', 'Jira bug'],
    merges: [{ startColumnIndex: 5, endColumnIndex: 7 }, { startColumnIndex: 7, endColumnIndex: 9 }],
    totalColumns: 9,
  };
}

function buildFormatRequests(sheetId, headerConfig, rowCount) {
  const { merges, totalColumns } = headerConfig;
  const requests = [];
  merges.forEach(m => requests.push({
    mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, ...m }, mergeType: 'MERGE_ALL' },
  }));
  requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalColumns },
      cell: { userEnteredFormat: { backgroundColor: HEADER_BG, textFormat: { foregroundColor: HEADER_FG, bold: true }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', borders: { top: { style: 'SOLID' }, bottom: { style: 'SOLID' }, left: { style: 'SOLID' }, right: { style: 'SOLID' } } } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
    },
  });
  if (rowCount > 0) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 2 + rowCount, startColumnIndex: 0, endColumnIndex: totalColumns },
        cell: { userEnteredFormat: { borders: { top: { style: 'SOLID' }, bottom: { style: 'SOLID' }, left: { style: 'SOLID' }, right: { style: 'SOLID' } }, verticalAlignment: 'TOP', wrapStrategy: 'WRAP' } },
        fields: 'userEnteredFormat(borders,verticalAlignment,wrapStrategy)',
      },
    });
  }
  requests.push({ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: totalColumns } } });
  return requests;
}

async function shareSheet(token, spreadsheetId, shareEmails) {
  const emails = (shareEmails || '').split(',').map(e => e.trim()).filter(Boolean);
  for (const email of emails) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }),
    });
  }
}

/**
 * @param {string} issueKey
 * @param {string} platform
 * @param {Array} testCases
 * @param {object} config - từ config.js
 */
async function exportToGoogleSheets(issueKey, platform, testCases, config) {
  const { googleSaJson, spreadsheetId: configSpreadsheetId, shareEmails } = config;
  if (!googleSaJson) throw new Error('Google Service Account JSON chưa được cấu hình.');

  const token = await getAccessToken(googleSaJson);
  const spreadsheetId = await getOrCreateSpreadsheet(token, configSpreadsheetId);
  const isNewSpreadsheet = !configSpreadsheetId;
  const sheetId = await addSheetTab(token, spreadsheetId, issueKey);
  const headerConfig = buildHeaderConfig(platform);

  // Ghi header
  await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(issueKey)}!A1:append?valueInputOption=RAW`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [headerConfig.row1, headerConfig.row2] }),
  });

  // Ghi data (cột A-E)
  if (testCases.length > 0) {
    const rows = testCases.map(tc => [tc.no, tc.testCase, tc.preCondition, tc.steps, tc.expected]);
    await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(issueKey)}!A3:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    });
  }

  // Apply formatting
  const formatReqs = buildFormatRequests(sheetId, headerConfig, testCases.length);
  await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: formatReqs }),
  });

  await shareSheet(token, spreadsheetId, shareEmails);

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;
  console.log(`[SheetsExporter] Done: ${url}`);
  return { url, spreadsheetId, isNewSpreadsheet };
}

module.exports = { exportToGoogleSheets, buildHeaderConfig };

const { fetch } = require('@forge/api');

/**
 * Export test cases to Google Sheets via Apps Script Web App.
 *
 * Strategy: Forge's fetch may not support `redirect: 'manual'`.
 * Instead, we first do a GET to discover the redirect URL (Apps Script
 * always redirects to script.googleusercontent.com), then POST the
 * payload directly to that final URL.
 *
 * Fallback: If GET-then-POST doesn't work, try direct POST with
 * redirect: 'follow' (which converts to GET but Apps Script doGet
 * can also handle if we pass data as query param — not ideal for
 * large payloads, so we try POST first).
 */
async function exportToGoogleSheets(issueKey, platform, testCases, config, meta = {}) {
  const { appsScriptUrl, folderId } = config;
  if (!appsScriptUrl) throw new Error('Apps Script URL is not configured.');

  const fileName = `TestCases_${issueKey}_${new Date().toISOString().slice(0, 10)}`;
  const payload = JSON.stringify({
    folderId:   folderId || '',
    fileName,
    platform,
    testCases,
    issueTitle: meta.issueTitle || issueKey,
    issueUrl:   meta.issueUrl   || '',
    assignee:   meta.assignee   || '',
  });

  console.log(`[SheetsExporter] Exporting ${testCases.length} test cases for ${issueKey}`);
  console.log(`[SheetsExporter] Apps Script URL: ${appsScriptUrl}`);

  // Strategy: Try direct POST with redirect:'follow'.
  // If Forge follows the redirect, POST becomes GET on googleusercontent.com.
  // Apps Script doGet can handle this IF we also pass data in query param.
  // But first try: POST directly, see what happens.

  let finalRes;
  let lastError;

  // ── Attempt 1: Direct POST with redirect:'follow' ──
  try {
    console.log('[SheetsExporter] Attempt 1: POST with redirect:follow');
    finalRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'follow',
    });
    console.log(`[SheetsExporter] Attempt 1 response: ${finalRes.status}`);

    if (finalRes.ok) {
      const result = await finalRes.json();
      if (result.success) {
        console.log(`[SheetsExporter] Done (attempt 1): ${result.url}`);
        return { url: result.url, spreadsheetId: result.spreadsheetId };
      }
    }
    lastError = `Attempt 1: status ${finalRes.status}`;
    console.warn(`[SheetsExporter] Attempt 1 failed: ${lastError}`);
  } catch (err) {
    lastError = `Attempt 1: ${err.message}`;
    console.warn(`[SheetsExporter] ${lastError}`);
  }

  // ── Attempt 2: Manual redirect - POST, read Location, re-POST ──
  try {
    console.log('[SheetsExporter] Attempt 2: POST with redirect:manual');
    const res1 = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'manual',
    });
    console.log(`[SheetsExporter] Attempt 2 step 1: ${res1.status}`);

    if (res1.status >= 300 && res1.status < 400) {
      const redirectUrl = res1.headers.get('location');
      console.log(`[SheetsExporter] Redirect to: ${redirectUrl}`);
      if (redirectUrl) {
        const res2 = await fetch(redirectUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        console.log(`[SheetsExporter] Attempt 2 step 2: ${res2.status}`);
        if (res2.ok) {
          const result = await res2.json();
          if (result.success) {
            console.log(`[SheetsExporter] Done (attempt 2): ${result.url}`);
            return { url: result.url, spreadsheetId: result.spreadsheetId };
          }
        }
        const errText = await res2.text();
        lastError = `Attempt 2 step 2: status ${res2.status}, body: ${errText.slice(0, 200)}`;
      }
    } else if (res1.ok) {
      const result = await res1.json();
      if (result.success) {
        console.log(`[SheetsExporter] Done (attempt 2 direct): ${result.url}`);
        return { url: result.url, spreadsheetId: result.spreadsheetId };
      }
    } else {
      const errText = await res1.text();
      lastError = `Attempt 2 step 1: status ${res1.status}, body: ${errText.slice(0, 200)}`;
    }
    console.warn(`[SheetsExporter] ${lastError}`);
  } catch (err) {
    lastError = `Attempt 2: ${err.message}`;
    console.warn(`[SheetsExporter] ${lastError}`);
  }

  // ── Attempt 3: GET with payload as base64 query param ──
  try {
    console.log('[SheetsExporter] Attempt 3: GET with data in query param');
    const encoded = Buffer.from(payload).toString('base64');
    const getUrl = `${appsScriptUrl}?data=${encodeURIComponent(encoded)}`;
    const res3 = await fetch(getUrl, {
      method: 'GET',
      redirect: 'follow',
    });
    console.log(`[SheetsExporter] Attempt 3 response: ${res3.status}`);
    if (res3.ok) {
      const text = await res3.text();
      // Try to parse as JSON (skip any HTML)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.success) {
          console.log(`[SheetsExporter] Done (attempt 3): ${result.url}`);
          return { url: result.url, spreadsheetId: result.spreadsheetId };
        }
      }
    }
    lastError = `Attempt 3: status ${res3.status}`;
    console.warn(`[SheetsExporter] ${lastError}`);
  } catch (err) {
    lastError = `Attempt 3: ${err.message}`;
    console.warn(`[SheetsExporter] ${lastError}`);
  }

  throw new Error(`All export attempts failed. Last: ${lastError}`);
}

module.exports = { exportToGoogleSheets };

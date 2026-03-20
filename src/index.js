const api = require('@forge/api');
const { Queue } = require('@forge/events');
const { isValidTransition } = require('./jiraDataFetcher');

const testcaseQueue = new Queue({ key: 'testcase-queue' });

function isWriteTestCaseTitle(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return lower.includes('write testcase') || lower.includes('write test case');
}

async function triggerHandler(event) {
  const issueKey = event?.issue?.key;
  const eventType = event?.eventType;
  console.log(`[Main] TRIGGER FIRED. issue: ${issueKey} | eventType: ${eventType}`);

  // Case 1: Status transition → To Do/Backlog → In Progress
  if (eventType === 'avi:jira:updated:issue') {
    if (!isValidTransition(event)) {
      console.log('[Main] Not a valid transition, skipping.');
      return;
    }
    if (!issueKey) return;
    console.log(`[Main] Valid transition — queuing ${issueKey}`);
    await testcaseQueue.push({ body: { issueKey, trigger: 'transition' } });
    console.log(`[Main] ${issueKey} queued (transition)`);
    return;
  }

  // Case 2: New comment added
  if (eventType === 'avi:jira:commented:issue') {
    if (!issueKey) return;

    // Bỏ qua comment từ bot để tránh vòng lặp vô hạn
    const bodyStr = JSON.stringify(event.comment?.body || '');
    const authorType = event.comment?.author?.accountType || '';
    console.log(`[Main] Comment authorType: "${authorType}" | bodyContainsBot: ${bodyStr.includes('Auto-Generated Test Cases')}`);
    if (bodyStr.includes('Auto-Generated Test Cases') || bodyStr.includes('AI TestCase Generator')) {
      console.log('[Main] Bot comment detected, skipping.');
      return;
    }

    const title = event.issue?.fields?.summary || '';
    const status = (event.issue?.fields?.status?.name || '').toLowerCase();

    // Case 2a: Comment trực tiếp trên task "write test case"
    if (isWriteTestCaseTitle(title)) {
      if (status !== 'in progress') {
        console.log(`[Main] Comment on write-testcase task but not In Progress (${status}), skipping.`);
        return;
      }
      console.log(`[Main] New comment on write-testcase task — queuing ${issueKey}`);
      await testcaseQueue.push({ body: { issueKey, trigger: 'comment' } });
      console.log(`[Main] ${issueKey} queued (comment on self)`);
      return;
    }

    // Case 2b: Comment trên task cha → fetch subtasks qua API (event payload không có đủ data)
    let targets = [];
    try {
      const res = await api.asApp().requestJira(
        api.route`/rest/api/3/issue/${issueKey}?fields=subtasks`,
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        targets = (data.fields?.subtasks || [])
          .filter(s => isWriteTestCaseTitle(s.fields?.summary || ''));
        console.log(`[Main] Fetched ${data.fields?.subtasks?.length || 0} subtasks, found ${targets.length} write-testcase task(s)`);
      }
    } catch (err) {
      console.warn(`[Main] Could not fetch subtasks of ${issueKey}:`, err.message);
    }

    if (targets.length === 0) {
      console.log(`[Main] Comment on ${issueKey} — no write-testcase subtasks found, skipping.`);
      return;
    }

    for (const subtask of targets) {
      console.log(`[Main] Queuing ${subtask.key} (comment on parent ${issueKey})`);
      await testcaseQueue.push({ body: { issueKey: subtask.key, trigger: 'comment' } });
      console.log(`[Main] ${subtask.key} queued (comment on parent)`);
    }
    return;
  }

  console.log(`[Main] Unhandled eventType: ${eventType}, skipping.`);
}

module.exports = { triggerHandler };

const api = require('@forge/api');

/**
 * Detect platform từ prefix trong title của Jira task
 * [CMS] → "web"
 * [Android] hoặc [IOS] → "mobile"
 * Không có prefix → "mobile" (default)
 */
function detectPlatform(title) {
  if (!title) return 'mobile';
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.startsWith('[cms]')) return 'web';
  if (lowerTitle.startsWith('[android]') || lowerTitle.startsWith('[ios]')) return 'mobile';
  return 'mobile';
}

/**
 * Extract Figma links từ một đoạn text.
 * Hỗ trợ:
 *   https://www.figma.com/file/{fileKey}/...
 *   https://www.figma.com/design/{fileKey}/...
 * Trả về mảng { fileKey, nodeIds }
 */
function extractFigmaLinks(text) {
  if (!text) return [];
  const results = [];
  const regex = /https:\/\/(?:www\.)?figma\.com\/(?:file|design)\/([a-zA-Z0-9_-]+)[^\s"]*/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const fileKey = match[1];
    const url = match[0];
    // Parse node-id từ query string nếu có: ?node-id=XX-XX hoặc ?node-id=XX%3AXX
    const nodeIdMatch = url.match(/[?&]node-id=([^&\s"]+)/);
    const nodeIds = nodeIdMatch
      ? [decodeURIComponent(nodeIdMatch[1]).replace(/-/g, ':')]
      : [];
    // Tránh duplicate cùng fileKey + nodeIds
    const exists = results.find(r => r.fileKey === fileKey && JSON.stringify(r.nodeIds) === JSON.stringify(nodeIds));
    if (!exists) results.push({ fileKey, nodeIds });
  }
  return results;
}

/**
 * Extract acceptance criteria từ plain text description
 */
function extractAcceptanceCriteria(description) {
  if (!description) return '';
  const acPatterns = [
    /acceptance criteria[:\s]*([\s\S]*?)(?=\n#+|\n\*\*[A-Z]|$)/gi,
    /\bAC[:\s]*([\s\S]*?)(?=\n#+|\n\*\*[A-Z]|$)/gi,
  ];
  for (const pattern of acPatterns) {
    const match = description.match(pattern);
    if (match) return match[0];
  }
  return '';
}

/**
 * Kiểm tra xem event có phải là transition từ Open/To Do → In Progress không
 */
function isValidTransition(event) {
  const changelog = event.changelog;
  if (!changelog || !changelog.items) return false;
  const statusChange = changelog.items.find(item => item.field === 'status');
  if (!statusChange) return false;
  const validFromStatuses = ['open', 'to do', 'todo', 'backlog'];
  const validToStatuses = ['in progress'];
  const from = (statusChange.fromString || '').toLowerCase();
  const to = (statusChange.toString || '').toLowerCase();
  return validFromStatuses.includes(from) && validToStatuses.includes(to);
}

/**
 * Gọi Jira REST API lấy issue details
 */
async function fetchIssueDetails(issueKey) {
  const response = await api.asApp().requestJira(
    api.route`/rest/api/3/issue/${issueKey}?expand=renderedFields,names`,
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  );
  if (!response.ok) {
    throw new Error(`Jira API error fetching ${issueKey}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Lấy comments của một issue, trả về mảng { author, body (plain text), created }
 */
async function fetchCommentsForIssue(issueKey) {
  try {
    const response = await api.asApp().requestJira(
      api.route`/rest/api/3/issue/${issueKey}/comment?maxResults=50&orderBy=created`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.comments || []).map(c => ({
      author: c.author?.displayName || 'Unknown',
      body: extractTextFromADF(c.body),
      created: c.created,
    })).filter(c => c.body.trim());
  } catch (err) {
    console.warn(`[JiraFetcher] Could not fetch comments for ${issueKey}:`, err.message);
    return [];
  }
}

/**
 * Lấy toàn bộ comments: task chính + tất cả subtasks, merge theo thời gian (cũ → mới)
 */
async function fetchAllComments(issueKey, subtasks) {
  const allKeys = [issueKey, ...subtasks.map(s => s.key)];
  const commentArrays = await Promise.all(
    allKeys.map(key => fetchCommentsForIssue(key))
  );

  // Flatten và sort theo thời gian tăng dần
  const merged = commentArrays.flat();
  merged.sort((a, b) => new Date(a.created) - new Date(b.created));

  return merged;
}

/**
 * Extract plain text từ Atlassian Document Format (ADF)
 * Bao gồm:
 *   - href từ link marks (hyperlink thông thường)
 *   - url từ inlineCard/blockCard/embedCard (Jira Smart Links)
 */
function extractTextFromADF(adf) {
  if (!adf || typeof adf !== 'object') return String(adf || '');
  if (adf.type === 'text') {
    let result = adf.text || '';
    const linkMark = adf.marks?.find(m => m.type === 'link');
    if (linkMark?.attrs?.href) {
      result += ' ' + linkMark.attrs.href;
    }
    return result;
  }
  // Jira Smart Links: inlineCard, blockCard, embedCard — URL nằm trong attrs.url
  if (['inlineCard', 'blockCard', 'embedCard'].includes(adf.type)) {
    return adf.attrs?.url ? ' ' + adf.attrs.url : '';
  }
  if (adf.content && Array.isArray(adf.content)) {
    return adf.content.map(extractTextFromADF).join('\n');
  }
  return '';
}

/**
 * Fetch task data trực tiếp từ issueKey (dùng cho queue worker)
 * Không cần event, không validate transition
 */
async function fetchTaskDataByKey(issueKey) {
  console.log(`[JiraFetcher] fetchTaskDataByKey: ${issueKey}`);

  const issueDetails = await fetchIssueDetails(issueKey);
  const fields = issueDetails.fields;

  const title = fields.summary || '';

  // Filter "write test case"
  const titleLower = title.toLowerCase();
  if (!titleLower.includes('write testcase') && !titleLower.includes('write test case')) {
    console.log(`[JiraFetcher] Skipping "${title}" — title does not contain "write test case"`);
    return null;
  }

  const platform = detectPlatform(title);

  let descriptionText = '';
  if (fields.description) {
    descriptionText = extractTextFromADF(fields.description);
  }

  const acceptanceCriteria = extractAcceptanceCriteria(descriptionText);

  const subTasks = (fields.subtasks || []).map(s => ({
    key: s.key,
    summary: s.fields?.summary || '',
  }));

  const allComments = await fetchAllComments(issueKey, subTasks);

  // Fetch parent task description + comments (requirements thường update ở đây)
  let parentDescriptionText = '';
  let parentComments = [];
  const parentKey = fields.parent?.key;
  if (parentKey) {
    try {
      const parentDetails = await fetchIssueDetails(parentKey);
      if (parentDetails.fields?.description) {
        parentDescriptionText = extractTextFromADF(parentDetails.fields.description);
      }
      parentComments = await fetchCommentsForIssue(parentKey);
      console.log(`[JiraFetcher] Fetched parent ${parentKey}: description + ${parentComments.length} comment(s)`);
    } catch (err) {
      console.warn(`[JiraFetcher] Could not fetch parent ${parentKey}:`, err.message);
    }
  }

  // Merge tất cả comments (task + subtasks + parent), sort theo thời gian cũ → mới
  const mergedComments = [...allComments, ...parentComments];
  mergedComments.sort((a, b) => new Date(a.created) - new Date(b.created));
  console.log(`[JiraFetcher] Total comments: ${mergedComments.length} (task/subtasks: ${allComments.length}, parent: ${parentComments.length})`);

  const allText = [descriptionText, parentDescriptionText, ...mergedComments.map(c => c.body)].join('\n');
  const figmaLinks = extractFigmaLinks(allText);
  console.log(`[JiraFetcher] Found ${figmaLinks.length} Figma link(s)${parentKey ? ` (including parent ${parentKey})` : ''}`);

  const linkedIssues = (fields.issuelinks || []).map(l => ({
    key: l.inwardIssue?.key || l.outwardIssue?.key || '',
    summary: l.inwardIssue?.fields?.summary || l.outwardIssue?.fields?.summary || '',
    type: l.type?.name || '',
  }));

  return {
    issueKey,
    title,
    description: descriptionText,
    acceptanceCriteria,
    allComments: mergedComments,
    figmaLinks,
    subTasks,
    linkedIssues,
    platform,
    priority: fields.priority?.name || 'Medium',
    issueType: fields.issuetype?.name || 'Story',
    assignee: fields.assignee?.displayName || '',
    reporter: fields.reporter?.displayName || '',
  };
}

module.exports = { fetchTaskDataByKey, detectPlatform, isValidTransition, extractFigmaLinks };

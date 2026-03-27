const { fetch } = require('@forge/api');

const FIGMA_API_BASE = 'https://api.figma.com/v1';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function figmaHeaders(token) {
  return { 'X-Figma-Token': token };
}

async function figmaGet(path, token, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(`${FIGMA_API_BASE}${path}`, {
      method: 'GET',
      headers: figmaHeaders(token),
    });
    if (response.status === 429) {
      if (attempt < retries) {
        const wait = attempt * 2000;
        console.warn(`[FigmaFetcher] Rate limit hit, retrying in ${wait}ms (attempt ${attempt}/${retries})`);
        await sleep(wait);
        continue;
      }
      throw new Error('Figma: rate limit exceeded (429)');
    }
    if (response.status === 403) throw new Error('Figma: no permission (403)');
    if (response.status === 404) throw new Error('Figma: file not found (404)');
    if (!response.ok) throw new Error(`Figma API error: ${response.status}`);
    return response.json();
  }
}

function extractNodeInfo(node, depth = 0) {
  if (!node) return { components: [], textContent: [] };
  const components = [];
  const textContent = [];
  if (node.type === 'TEXT' && node.characters) textContent.push(node.characters.trim());
  const componentTypes = ['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP'];
  if (componentTypes.includes(node.type) && node.name && depth > 0) components.push(node.name);
  if (node.children && depth < 8) {
    for (const child of node.children) {
      const c = extractNodeInfo(child, depth + 1);
      components.push(...c.components);
      textContent.push(...c.textContent);
    }
  }
  return { components: [...new Set(components)], textContent: [...new Set(textContent)] };
}

async function fetchFigmaFile(fileKey, nodeIds, token) {
  const screens = [];
  try {
    if (nodeIds.length > 0) {
      const param = nodeIds.join(',');
      const data = await figmaGet(`/files/${fileKey}/nodes?ids=${encodeURIComponent(param)}`, token);
      const entries = Object.entries(data.nodes || {});
      for (const [, nodeData] of entries) {
        const node = nodeData.document;
        if (!node) continue;
        const { components, textContent } = extractNodeInfo(node);
        screens.push({ name: node.name || 'Screen', components, textContent, imageUrl: null });
      }
      // Lấy thumbnails
      await sleep(200);
      try {
        const imgs = await figmaGet(`/images/${fileKey}?ids=${encodeURIComponent(param)}&format=png&scale=1`, token);
        Object.entries(imgs.images || {}).forEach(([id, url], idx) => {
          if (screens[idx]) screens[idx].imageUrl = url;
        });
      } catch { /* thumbnails optional */ }
    } else {
      // Không có nodeIds → lấy top-level frames của page đầu tiên
      const data = await figmaGet(`/files/${fileKey}?depth=2`, token);
      const topFrames = (data.document?.children?.[0]?.children || [])
        .filter(n => n.type === 'FRAME' || n.type === 'COMPONENT')
        .slice(0, 15);
      if (topFrames.length === 0) return screens;
      const frameIds = topFrames.map(f => f.id).join(',');
      await sleep(200);
      const nodesData = await figmaGet(`/files/${fileKey}/nodes?ids=${encodeURIComponent(frameIds)}`, token);
      for (const frame of topFrames) {
        const node = nodesData.nodes?.[frame.id]?.document || frame;
        const { components, textContent } = extractNodeInfo(node);
        screens.push({ name: frame.name, components, textContent, imageUrl: null });
      }
      await sleep(200);
      try {
        const imgs = await figmaGet(`/images/${fileKey}?ids=${encodeURIComponent(frameIds)}&format=png&scale=1`, token);
        topFrames.forEach((frame, idx) => {
          if (screens[idx] && imgs.images?.[frame.id]) screens[idx].imageUrl = imgs.images[frame.id];
        });
      } catch { /* thumbnails optional */ }
    }
  } catch (err) {
    console.error(`[FigmaFetcher] ${fileKey}: ${err.message}`);
    return [];
  }
  return screens;
}

/**
 * @param {Array} figmaLinks - [{ fileKey, nodeIds }]
 * @param {object} config - từ config.js
 */
async function fetchFigmaDesignData(figmaLinks, config) {
  if (!figmaLinks || figmaLinks.length === 0) return null;

  const token = config.figmaToken;
  if (!token) {
    console.log('[FigmaFetcher] FIGMA_ACCESS_TOKEN not configured, skipping.');
    return null;
  }

  // Group links by fileKey → gộp tất cả nodeIds cùng file vào 1 API call
  const byFile = {};
  for (const link of figmaLinks) {
    if (!byFile[link.fileKey]) byFile[link.fileKey] = new Set();
    for (const id of link.nodeIds) byFile[link.fileKey].add(id);
    // Nếu có link không có nodeId (lấy toàn bộ file), đánh dấu riêng
    if (link.nodeIds.length === 0) byFile[link.fileKey].add('__all__');
  }

  const fileKeys = Object.keys(byFile);
  console.log(`[FigmaFetcher] Processing ${figmaLinks.length} link(s) → ${fileKeys.length} file(s) (batched)`);

  const allScreens = [];
  for (const fileKey of fileKeys) {
    const nodeIdSet = byFile[fileKey];
    nodeIdSet.delete('__all__');
    const nodeIds = [...nodeIdSet];
    const screens = await fetchFigmaFile(fileKey, nodeIds, token);
    allScreens.push(...screens);
    if (fileKeys.indexOf(fileKey) < fileKeys.length - 1) await sleep(500);
  }

  const useful = allScreens.filter(s => s.components.length > 0 || s.textContent.length > 0);
  if (useful.length === 0) return null;
  console.log(`[FigmaFetcher] ${useful.length} screen(s) extracted`);
  return { screens: useful };
}

module.exports = { fetchFigmaDesignData, extractNodeInfo };

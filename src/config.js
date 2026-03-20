const { storage } = require('@forge/api');

const KEYS = {
  AI_PROVIDER:    'ai-provider',
  AI_API_KEY:     'ai-api-key',
  FIGMA_TOKEN:    'figma-token',
  GOOGLE_SA_JSON: 'google-sa-json',
  SPREADSHEET_ID: 'spreadsheet-id',
  SHARE_EMAILS:   'share-emails',
};

async function getConfig() {
  const [
    aiProvider,
    aiApiKey,
    figmaToken,
    googleSaJson,
    spreadsheetId,
    shareEmails,
  ] = await Promise.all([
    storage.get(KEYS.AI_PROVIDER),
    storage.getSecret(KEYS.AI_API_KEY),
    storage.getSecret(KEYS.FIGMA_TOKEN),
    storage.getSecret(KEYS.GOOGLE_SA_JSON),
    storage.get(KEYS.SPREADSHEET_ID),
    storage.get(KEYS.SHARE_EMAILS),
  ]);

  return {
    aiProvider:    aiProvider    || 'claude',
    aiApiKey:      aiApiKey      || null,
    figmaToken:    figmaToken    || null,
    googleSaJson:  googleSaJson  || null,
    spreadsheetId: spreadsheetId || null,
    shareEmails:   shareEmails   || '',
  };
}

function validateConfig(config) {
  if (!config.aiApiKey) {
    throw new Error('AI API Key chưa được cấu hình. Vào Jira Settings → Apps → AI TestCase Generator để nhập.');
  }
}

module.exports = { getConfig, validateConfig };

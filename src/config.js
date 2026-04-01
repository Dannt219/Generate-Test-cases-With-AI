const { storage } = require('@forge/api');

const KEYS = {
  AI_PROVIDER:      'ai-provider',
  AI_API_KEY:       'ai-api-key',
  FIGMA_TOKEN:      'figma-token',
  APPS_SCRIPT_URL:  'apps-script-url',
  FOLDER_ID:        'folder-id',
  SHARE_EMAILS:     'share-emails',
  APP_CONTEXT:      'app-context',
};

async function getConfig() {
  const [
    aiProvider,
    aiApiKey,
    figmaToken,
    appsScriptUrl,
    folderId,
    shareEmails,
    appContext,
  ] = await Promise.all([
    storage.get(KEYS.AI_PROVIDER),
    storage.getSecret(KEYS.AI_API_KEY),
    storage.getSecret(KEYS.FIGMA_TOKEN),
    storage.get(KEYS.APPS_SCRIPT_URL),
    storage.get(KEYS.FOLDER_ID),
    storage.get(KEYS.SHARE_EMAILS),
    storage.get(KEYS.APP_CONTEXT),
  ]);

  return {
    aiProvider:     aiProvider     || 'claude',
    aiApiKey:       aiApiKey       || null,
    figmaToken:     figmaToken     || null,
    appsScriptUrl:  appsScriptUrl  || null,
    folderId:       folderId       || null,
    shareEmails:    shareEmails    || '',
    appContext:     appContext      || '',
  };
}

function validateConfig(config) {
  if (!config.aiApiKey) {
    throw new Error('AI API Key is not configured. Go to Jira Settings → Apps → AI TestCase Generator to set it up.');
  }
}

module.exports = { getConfig, validateConfig };

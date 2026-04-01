const Resolver = require('@forge/resolver').default;
const { storage } = require('@forge/api');

const resolver = new Resolver();

const KEYS = {
  AI_PROVIDER:      'ai-provider',
  AI_API_KEY:       'ai-api-key',
  FIGMA_TOKEN:      'figma-token',
  APPS_SCRIPT_URL:  'apps-script-url',
  FOLDER_ID:        'folder-id',
  SHARE_EMAILS:     'share-emails',
  APP_CONTEXT:      'app-context',
};

resolver.define('getConfig', async () => {
  const [provider, appsScriptUrl, folderId, shareEmails, appContext, aiApiKey, figmaToken] = await Promise.all([
    storage.get(KEYS.AI_PROVIDER),
    storage.get(KEYS.APPS_SCRIPT_URL),
    storage.get(KEYS.FOLDER_ID),
    storage.get(KEYS.SHARE_EMAILS),
    storage.get(KEYS.APP_CONTEXT),
    storage.getSecret(KEYS.AI_API_KEY),
    storage.getSecret(KEYS.FIGMA_TOKEN),
  ]);
  return {
    aiProvider:       provider       || 'claude',
    appsScriptUrl:    appsScriptUrl  || '',
    folderId:         folderId       || '',
    shareEmails:      shareEmails    || '',
    appContext:       appContext      || '',
    hasAiApiKey:      !!aiApiKey,
    hasFigmaToken:    !!figmaToken,
    hasAppsScriptUrl: !!appsScriptUrl,
  };
});

resolver.define('saveConfig', async ({ payload }) => {
  await storage.set(KEYS.AI_PROVIDER,     payload.aiProvider     || 'claude');
  await storage.set(KEYS.APPS_SCRIPT_URL, payload.appsScriptUrl  || '');
  await storage.set(KEYS.FOLDER_ID,       payload.folderId       || '');
  await storage.set(KEYS.SHARE_EMAILS,    payload.shareEmails    || '');
  await storage.set(KEYS.APP_CONTEXT,     payload.appContext      || '');

  if (payload.aiApiKey?.trim())   await storage.setSecret(KEYS.AI_API_KEY,   payload.aiApiKey.trim());
  if (payload.figmaToken?.trim()) await storage.setSecret(KEYS.FIGMA_TOKEN,  payload.figmaToken.trim());

  return { success: true };
});

module.exports = { handler: resolver.getDefinitions() };

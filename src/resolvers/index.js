const Resolver = require('@forge/resolver').default;
const { storage } = require('@forge/api');

const resolver = new Resolver();

const KEYS = {
  AI_PROVIDER:    'ai-provider',
  AI_API_KEY:     'ai-api-key',
  FIGMA_TOKEN:    'figma-token',
  GOOGLE_SA_JSON: 'google-sa-json',
  SPREADSHEET_ID: 'spreadsheet-id',
  SHARE_EMAILS:   'share-emails',
  APP_CONTEXT:    'app-context',
};

resolver.define('getConfig', async () => {
  const [provider, spreadsheetId, shareEmails, appContext, aiApiKey, figmaToken, googleSaJson] = await Promise.all([
    storage.get(KEYS.AI_PROVIDER),
    storage.get(KEYS.SPREADSHEET_ID),
    storage.get(KEYS.SHARE_EMAILS),
    storage.get(KEYS.APP_CONTEXT),
    storage.getSecret(KEYS.AI_API_KEY),
    storage.getSecret(KEYS.FIGMA_TOKEN),
    storage.getSecret(KEYS.GOOGLE_SA_JSON),
  ]);
  return {
    aiProvider:      provider      || 'claude',
    spreadsheetId:   spreadsheetId || '',
    shareEmails:     shareEmails   || '',
    appContext:      appContext     || '',
    hasAiApiKey:     !!aiApiKey,
    hasFigmaToken:   !!figmaToken,
    hasGoogleSaJson: !!googleSaJson,
  };
});

resolver.define('saveConfig', async ({ payload }) => {
  await storage.set(KEYS.AI_PROVIDER,    payload.aiProvider    || 'claude');
  await storage.set(KEYS.SPREADSHEET_ID, payload.spreadsheetId || '');
  await storage.set(KEYS.SHARE_EMAILS,   payload.shareEmails   || '');
  await storage.set(KEYS.APP_CONTEXT,    payload.appContext    || '');

  if (payload.aiApiKey?.trim())     await storage.setSecret(KEYS.AI_API_KEY,     payload.aiApiKey.trim());
  if (payload.figmaToken?.trim())   await storage.setSecret(KEYS.FIGMA_TOKEN,    payload.figmaToken.trim());
  if (payload.googleSaJson?.trim()) await storage.setSecret(KEYS.GOOGLE_SA_JSON, payload.googleSaJson.trim());

  return { success: true };
});

module.exports = { handler: resolver.getDefinitions() };

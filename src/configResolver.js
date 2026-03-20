import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

const KEYS = {
  AI_PROVIDER:    'ai-provider',
  AI_API_KEY:     'ai-api-key',
  FIGMA_TOKEN:    'figma-token',
  GOOGLE_SA_JSON: 'google-sa-json',
  SPREADSHEET_ID: 'spreadsheet-id',
  SHARE_EMAILS:   'share-emails',
};

resolver.define('getConfig', async () => {
  const [provider, spreadsheetId, shareEmails] = await Promise.all([
    storage.get(KEYS.AI_PROVIDER),
    storage.get(KEYS.SPREADSHEET_ID),
    storage.get(KEYS.SHARE_EMAILS),
  ]);
  return {
    aiProvider:    provider       || 'claude',
    spreadsheetId: spreadsheetId  || '',
    shareEmails:   shareEmails    || '',
  };
});

resolver.define('saveConfig', async ({ payload }) => {
  await storage.set(KEYS.AI_PROVIDER,    payload.aiProvider    || 'claude');
  await storage.set(KEYS.SPREADSHEET_ID, payload.spreadsheetId || '');
  await storage.set(KEYS.SHARE_EMAILS,   payload.shareEmails   || '');

  if (payload.aiApiKey?.trim())      await storage.setSecret(KEYS.AI_API_KEY,     payload.aiApiKey.trim());
  if (payload.figmaToken?.trim())    await storage.setSecret(KEYS.FIGMA_TOKEN,    payload.figmaToken.trim());
  if (payload.googleSaJson?.trim())  await storage.setSecret(KEYS.GOOGLE_SA_JSON, payload.googleSaJson.trim());

  return { success: true };
});

export const handler = resolver.getDefinitions();

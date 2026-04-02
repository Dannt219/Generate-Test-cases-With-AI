import ForgeUI, {
  render,
  AdminPage,
  Fragment,
  Form,
  FormSection,
  TextField,
  TextArea,
  Select,
  Option,
  Text,
  SectionMessage,
  Heading,
  useState,
} from '@forge/react';
import { storage } from '@forge/api';

const KEYS = {
  AI_PROVIDER: 'ai-provider',
  AI_API_KEY: 'ai-api-key',
  FIGMA_TOKEN: 'figma-token',
  GOOGLE_SA_JSON: 'google-sa-json',
  SPREADSHEET_ID: 'spreadsheet-id',
  SHARE_EMAILS: 'share-emails',
  APP_CONTEXT: 'app-context',
};

const App = () => {
  const [saved, setSaved] = useState(false);
  const [config] = useState(async () => {
    const [provider, spreadsheetId, shareEmails, appContext] = await Promise.all([
      storage.get(KEYS.AI_PROVIDER),
      storage.get(KEYS.SPREADSHEET_ID),
      storage.get(KEYS.SHARE_EMAILS),
      storage.get(KEYS.APP_CONTEXT),
    ]);
    return {
      aiProvider: provider || 'claude',
      spreadsheetId: spreadsheetId || '',
      shareEmails: shareEmails || '',
      appContext: appContext || '',
    };
  });

  const onSubmit = async (formData) => {
    await storage.set(KEYS.AI_PROVIDER, formData.aiProvider || 'claude');
    await storage.set(KEYS.SPREADSHEET_ID, formData.spreadsheetId || '');
    await storage.set(KEYS.SHARE_EMAILS, formData.shareEmails || '');
    await storage.set(KEYS.APP_CONTEXT, formData.appContext || '');

    if (formData.aiApiKey?.trim()) await storage.setSecret(KEYS.AI_API_KEY, formData.aiApiKey.trim());
    if (formData.figmaToken?.trim()) await storage.setSecret(KEYS.FIGMA_TOKEN, formData.figmaToken.trim());
    if (formData.googleSaJson?.trim()) await storage.setSecret(KEYS.GOOGLE_SA_JSON, formData.googleSaJson.trim());

    setSaved(true);
  };

  return (
    <AdminPage>
      <Heading size="large">AI TestCase Generator — Configuration</Heading>
      <Text>
        When a task/subtask with "write testcase" in the title transitions To Do → In Progress,
        the app automatically generates test cases using AI and attaches a CSV file to the Jira issue.
      </Text>

      {saved && (
        <SectionMessage appearance="confirmation" title="Saved successfully!">
          <Text>Configuration has been updated.</Text>
        </SectionMessage>
      )}

      <Form onSubmit={onSubmit} submitButtonText="Save Configuration">
        <FormSection>
          <Heading size="medium">AI Settings</Heading>
          <Select name="aiProvider" label="AI Provider" defaultValue={config.aiProvider} isRequired>
            <Option label="Claude (Anthropic) — Recommended" value="claude" />
            <Option label="OpenAI (GPT-4o)" value="openai" />
          </Select>
          <Text>
            Claude: claude-sonnet-4-6 (max 16,000 output tokens) | OpenAI: gpt-4o (max 16,384 output tokens)
          </Text>
          <TextField
            name="aiApiKey"
            label="AI API Key"
            description="Leave blank to keep the existing key."
            placeholder="sk-ant-... or sk-..."
            type="password"
          />
        </FormSection>

        <FormSection>
          <Heading size="medium">Figma (Optional)</Heading>
          <TextField
            name="figmaToken"
            label="Figma Personal Access Token"
            description="Leave blank if not using Figma."
            placeholder="figd_..."
            type="password"
          />
        </FormSection>

        <FormSection>
          <Heading size="medium">App Context (Per-Project Prompt)</Heading>
          <Text>
            Describe your app to help AI generate more accurate test cases. E.g. user types, auth methods, screen IDs, business rules.
            Leave blank to use a generic prompt.
          </Text>
          <TextArea
            name="appContext"
            label="App Context"
            defaultValue={config.appContext}
            placeholder={`Example:\nApp: E-commerce mobile app (iOS & Android)\nUser types: Guest, Registered User, Admin\nKey flows: Browse → Add to Cart → Checkout → Payment\nPayment methods: Credit Card, PayPal, COD\nSpecial rules: Guest can checkout but must register to track orders`}
          />
        </FormSection>

        <FormSection>
          <Heading size="medium">Google Sheets</Heading>
          <TextArea
            name="googleSaJson"
            label="Google Service Account JSON"
            description="Paste the JSON key file contents. Leave blank to keep the existing key."
            placeholder='{"type": "service_account", "project_id": "...", ...}'
          />
          <TextField
            name="spreadsheetId"
            label="Google Spreadsheet ID (Optional)"
            defaultValue={config.spreadsheetId}
            placeholder="Leave blank → app creates a new sheet automatically"
          />
          <TextField
            name="shareEmails"
            label="Auto-share emails (Optional)"
            defaultValue={config.shareEmails}
            placeholder="qa@company.com, pm@company.com"
          />
        </FormSection>
      </Form>
    </AdminPage>
  );
};

export const run = render(<App />);

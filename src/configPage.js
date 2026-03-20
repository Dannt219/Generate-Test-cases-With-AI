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
  AI_PROVIDER:    'ai-provider',
  AI_API_KEY:     'ai-api-key',
  FIGMA_TOKEN:    'figma-token',
  GOOGLE_SA_JSON: 'google-sa-json',
  SPREADSHEET_ID: 'spreadsheet-id',
  SHARE_EMAILS:   'share-emails',
};

const App = () => {
  const [saved, setSaved] = useState(false);
  const [config] = useState(async () => {
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

  const onSubmit = async (formData) => {
    await storage.set(KEYS.AI_PROVIDER,    formData.aiProvider    || 'claude');
    await storage.set(KEYS.SPREADSHEET_ID, formData.spreadsheetId || '');
    await storage.set(KEYS.SHARE_EMAILS,   formData.shareEmails   || '');

    if (formData.aiApiKey?.trim())     await storage.setSecret(KEYS.AI_API_KEY,     formData.aiApiKey.trim());
    if (formData.figmaToken?.trim())   await storage.setSecret(KEYS.FIGMA_TOKEN,    formData.figmaToken.trim());
    if (formData.googleSaJson?.trim()) await storage.setSecret(KEYS.GOOGLE_SA_JSON, formData.googleSaJson.trim());

    setSaved(true);
  };

  return (
    <AdminPage>
      <Heading size="large">AI TestCase Generator — Configuration</Heading>
      <Text>
        Khi Jira task chuyển trạng thái Open → In Progress, app sẽ tự động
        generate test cases bằng AI và export ra Google Sheets.
      </Text>

      {saved && (
        <SectionMessage appearance="confirmation" title="Đã lưu thành công!">
          <Text>Cấu hình đã được cập nhật.</Text>
        </SectionMessage>
      )}

      <Form onSubmit={onSubmit} submitButtonText="Save Configuration">
        <FormSection>
          <Heading size="medium">AI Settings</Heading>
          <Select name="aiProvider" label="AI Provider" defaultValue={config.aiProvider} isRequired>
            <Option label="Claude (Anthropic) — Recommended" value="claude" />
            <Option label="OpenAI (GPT-4o)" value="openai" />
          </Select>
          <TextField
            name="aiApiKey"
            label="AI API Key"
            description="Để trống nếu không muốn đổi key cũ."
            placeholder="sk-ant-... hoặc sk-..."
            type="password"
          />
        </FormSection>

        <FormSection>
          <Heading size="medium">Figma (Optional)</Heading>
          <TextField
            name="figmaToken"
            label="Figma Personal Access Token"
            description="Để trống nếu không dùng Figma."
            placeholder="figd_..."
            type="password"
          />
        </FormSection>

        <FormSection>
          <Heading size="medium">Google Sheets</Heading>
          <TextArea
            name="googleSaJson"
            label="Google Service Account JSON"
            description="Paste nội dung file JSON key. Để trống nếu không muốn đổi."
            placeholder='{"type": "service_account", "project_id": "...", ...}'
          />
          <TextField
            name="spreadsheetId"
            label="Google Spreadsheet ID (Optional)"
            defaultValue={config.spreadsheetId}
            placeholder="Để trống → app tự tạo sheet mới"
          />
          <TextField
            name="shareEmails"
            label="Auto-share với emails (Optional)"
            defaultValue={config.shareEmails}
            placeholder="qa@company.com, pm@company.com"
          />
        </FormSection>
      </Form>
    </AdminPage>
  );
};

export const run = render(<App />);

import React, { useState, useEffect } from 'react';
import {
  render,
  Fragment,
  Form,
  FormSection,
  Label,
  TextField,
  TextArea,
  Select,
  Option,
  Button,
  SectionMessage,
  Text,
  Heading,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ aiProvider: 'claude', spreadsheetId: '', shareEmails: '', appContext: '' });

  useEffect(() => {
    invoke('getConfig').then((data) => {
      setConfig(data);
      setLoading(false);
    });
  }, []);

  const onSubmit = async (formData) => {
    await invoke('saveConfig', formData);
    setSaved(true);
  };

  if (loading) return <Text>Loading configuration...</Text>;

  return (
    <Fragment>
      <Heading as="h1">AI TestCase Generator — Configuration</Heading>
      <Text>
        Khi Jira task chuyển trạng thái Open → In Progress, app sẽ tự động
        generate test cases bằng AI và export ra Google Sheets.
      </Text>

      {saved && (
        <SectionMessage appearance="confirmation" title="Đã lưu thành công!">
          <Text>Cấu hình đã được cập nhật. Áp dụng cho tất cả tasks từ bây giờ.</Text>
        </SectionMessage>
      )}

      <Form onSubmit={onSubmit} submitButtonText="Save Configuration">

        <FormSection>
          <Heading as="h2">App Context (Optional)</Heading>
          <Text>
            Mô tả ngắn về app/product để AI hiểu context tốt hơn.
            App sẽ tự động lấy từ Jira Project Description — chỉ cần điền ở đây nếu muốn bổ sung thêm.
          </Text>
          <Label labelFor="appContext">Additional App Context</Label>
          <TextArea
            name="appContext"
            id="appContext"
            defaultValue={config.appContext}
            placeholder="VD: App fintech cho người dùng Việt Nam, gồm: đăng nhập, chuyển tiền, nạp rút, lịch sử giao dịch..."
          />
        </FormSection>

        <FormSection>
          <Heading as="h2">AI Settings</Heading>
          <Label labelFor="aiProvider">AI Provider</Label>
          <Select name="aiProvider" id="aiProvider" defaultValue={config.aiProvider}>
            <Option label="Claude (Anthropic) — Recommended" value="claude" />
            <Option label="OpenAI (GPT-4o)" value="openai" />
          </Select>

          <Label labelFor="aiApiKey">AI API Key</Label>
          <TextField
            name="aiApiKey"
            id="aiApiKey"
            placeholder="sk-ant-... hoặc sk-... (để trống nếu không muốn đổi)"
            type="password"
          />
        </FormSection>

        <FormSection>
          <Heading as="h2">Figma (Optional)</Heading>
          <Label labelFor="figmaToken">Figma Personal Access Token</Label>
          <TextField
            name="figmaToken"
            id="figmaToken"
            placeholder="figd_... (để trống nếu không dùng Figma)"
            type="password"
          />
        </FormSection>

        <FormSection>
          <Heading as="h2">Google Sheets</Heading>
          <Label labelFor="googleSaJson">Google Service Account JSON</Label>
          <TextArea
            name="googleSaJson"
            id="googleSaJson"
            placeholder='{"type": "service_account", "project_id": "...", ...}'
          />

          <Label labelFor="spreadsheetId">Google Spreadsheet ID (Optional)</Label>
          <TextField
            name="spreadsheetId"
            id="spreadsheetId"
            defaultValue={config.spreadsheetId}
            placeholder="Để trống → app tự tạo sheet mới"
          />

          <Label labelFor="shareEmails">Auto-share với emails (Optional)</Label>
          <TextField
            name="shareEmails"
            id="shareEmails"
            defaultValue={config.shareEmails}
            placeholder="qa@company.com, pm@company.com"
          />
        </FormSection>

      </Form>
    </Fragment>
  );
};

export default render(<App />);

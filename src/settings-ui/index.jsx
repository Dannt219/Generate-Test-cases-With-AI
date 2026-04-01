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
  Link,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const DOCS_URL = 'https://gist.github.com/Aidan-castalk/c8d4f1a867e19fbe0430979216e352a2';

const App = () => {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ aiProvider: 'claude', appsScriptUrl: '', folderId: '', shareEmails: '', appContext: '' });

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
        Khi Jira task chuyển trạng thái sang In Progress, app sẽ tự động
        generate test cases bằng AI và export ra Google Sheets.
      </Text>
      <Text>
        📖 <Link href={DOCS_URL} openNewTab={true}>Full Documentation & Setup Guide</Link>
      </Text>

      {saved && (
        <SectionMessage appearance="confirmation" title="Đã lưu thành công!">
          <Text>Cấu hình đã được cập nhật. Áp dụng cho tất cả tasks từ bây giờ.</Text>
        </SectionMessage>
      )}

      <Form onSubmit={onSubmit} submitButtonText="Save Configuration">

        <FormSection>
          <Heading as="h2">App Context (Optional)</Heading>
          <Text>Mô tả ngắn về app/product để AI hiểu context tốt hơn.</Text>
          <Label labelFor="appContext">Additional App Context</Label>
          <TextArea
            name="appContext"
            id="appContext"
            defaultValue={config.appContext}
            placeholder="VD: EdTech app cho học sinh và phụ huynh Nhật Bản, gồm: đăng ký, đăng nhập, chọn khối lớp..."
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
          <Text>
            Tạo Google Apps Script Web App và paste URL vào đây.
            Hướng dẫn: script.google.com → New project → paste script → Deploy as Web App.
          </Text>

          <Label labelFor="appsScriptUrl">Apps Script URL</Label>
          <TextField
            name="appsScriptUrl"
            id="appsScriptUrl"
            defaultValue={config.appsScriptUrl}
            placeholder="https://script.google.com/macros/s/.../exec"
          />

          <Label labelFor="folderId">Google Drive Folder ID (Optional)</Label>
          <TextField
            name="folderId"
            id="folderId"
            defaultValue={config.folderId}
            placeholder="Lấy từ URL Drive: drive.google.com/drive/folders/FOLDER_ID"
          />
          <Text>Để trống → sheet được tạo trong My Drive của tài khoản deploy script.</Text>
        </FormSection>

      </Form>
    </Fragment>
  );
};

export default render(<App />);

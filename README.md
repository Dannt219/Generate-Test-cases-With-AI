# AI TestCase Generator — Jira App

Tự động generate test cases bằng AI khi Jira task chuyển trạng thái **To Do → In Progress**.
Test cases được export ra **Google Sheets** và đính kèm CSV vào Jira task.

---

## Cách hoạt động

1. Tạo task/subtask có title chứa **"write testcase"** hoặc **"write test case"**
2. Chuyển task sang **In Progress**
3. App tự động generate test cases từ description, acceptance criteria, comments và Figma (nếu có)
4. Kết quả được comment vào task: link Google Sheets + file CSV đính kèm

### Platform Detection

| Prefix trong title | Format Google Sheets |
|--------------------|----------------------|
| `[CMS]` | Web (Actual Result, Jira bug) |
| Không có prefix | Mobile (Android + IOS) |

---

## Cài đặt

### Bước 1 — Cài Jira App

Cài app vào Jira site từ Atlassian Marketplace.

### Bước 2 — Tạo Google Apps Script Web App

Đây là bước bắt buộc để app tạo được Google Sheet tự động.

#### 2.1 Tạo project

1. Truy cập [script.google.com](https://script.google.com)
2. Click **New project** → đặt tên, ví dụ: `TestCase Sheet Generator`

#### 2.2 Paste script

1. Xóa code mặc định trong editor
2. Vào repo này → mở file [`apps-script/TestCaseSheetGenerator.gs`](apps-script/TestCaseSheetGenerator.gs) → copy toàn bộ nội dung → paste vào editor

#### 2.3 Authorize (bắt buộc)

1. Trong editor, chọn function **`_testLocally`** từ dropdown
2. Click **▶ Run**
3. Popup xuất hiện → **Review permissions** → chọn tài khoản Google → **Allow**

#### 2.4 Deploy thành Web App

1. Click **Deploy** → **New deployment**
2. Click icon ⚙️ → chọn **Web app**
3. Cấu hình:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy** → copy **Web App URL**

> Mỗi lần sửa code cần **Deploy → New deployment** mới để cập nhật.

#### 2.5 Chuẩn bị Google Drive Folder (tùy chọn)

Nếu muốn sheet được tạo vào folder riêng:

1. Mở folder trên Google Drive
2. Lấy **Folder ID** từ URL:
   ```
   https://drive.google.com/drive/folders/1ABC123xyzFOLDERID
                                           ↑ đây là Folder ID
   ```
3. Đảm bảo tài khoản Google dùng để deploy script có quyền **Editor** trên folder

> Nếu để trống, sheet được tạo trong **My Drive**.

---

### Bước 3 — Cấu hình trong Jira

Vào **Jira Settings → Apps → AI TestCase Generator**:

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| AI Provider | ✅ | Claude (Anthropic) hoặc OpenAI |
| AI API Key | ✅ | API key của provider đã chọn |
| Apps Script URL | ✅ | URL Web App từ bước 2.4 |
| Google Drive Folder ID | ❌ | ID folder (để trống → lưu vào My Drive) |
| Figma Token | ❌ | Personal Access Token của Figma |
| App Context | ❌ | Mô tả ngắn về sản phẩm để AI hiểu context |

**Lấy AI API Key:**
- Claude: [console.anthropic.com](https://console.anthropic.com) → API Keys
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

## Sử dụng

1. Tạo task hoặc subtask, đặt title có chứa `write testcase` hoặc `write test case`
   - Ví dụ: `[CMS] Write testcase — Email Template`
   - Ví dụ: `Write testcase — Login flow`
2. Điền description, acceptance criteria, comments đầy đủ càng tốt
3. Chuyển task sang **In Progress**
4. Sau 30–60 giây, kiểm tra comment trong task — sẽ có:
   - Link Google Sheets
   - File CSV đính kèm

---

## Format Google Sheet

### Metadata (rows 1–9)

| Field | Nội dung |
|-------|----------|
| Module | Title của Jira task |
| Test requirement | Link Jira task |
| Tester | Assignee của task |
| Reviewer | Điền thủ công |
| Status | Điền thủ công |
| Bảng thống kê | In-sprint / Mainflow / Automation × OK / NG / Untest / Blocked |

### Cột test cases

| # | Test case | Pre-condition | Steps | Expected | Platform columns | In Sprint | Regression test | Priority | LLM | Automatable |

---

## Xem logs

```bash
forge logs --environment production
```

---

## Troubleshooting

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| Không có comment sau khi chuyển In Progress | Title không chứa "write testcase" | Đổi title task |
| `AI API Key is not configured` | Chưa điền AI API Key | Vào Settings → điền API Key → Save |
| `Apps Script HTTP error: 403` | Script chưa authorize | Chạy `_testLocally` trong editor → Allow → New deployment |
| Google Sheets không tạo được | Script chưa authorize hoặc URL sai | Tạo New deployment → copy URL mới → paste vào Settings |
| Figma rate limit (429) | Quá nhiều request | Tự động retry 3 lần; nếu vẫn fail thì skip Figma, AI vẫn generate từ description |

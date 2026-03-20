# Jira AI TestCase Generator — Forge App

Tự động generate test cases bằng AI khi Jira task chuyển trạng thái **Open → In Progress**.
Test cases được export ra **Google Sheets** theo template của team và comment link về Jira task.

---

## Cách hoạt động

```
Jira task: Open → In Progress
    ↓
[Forge Trigger] Nhận event jira:issue:updated
    ↓
[Jira Data Fetcher] Lấy summary, description, AC
                    + comments từ task VÀ tất cả subtasks (merged, cũ→mới)
                    + extract Figma links từ description/comments
    ↓  (detect platform từ title prefix)
[Figma Fetcher] Gọi Figma API lấy screen names, components, text content
                (skip nếu không có Figma link — graceful degradation)
    ↓
[AI Generator] Claude/OpenAI generate test cases
               Context: Jira data + Comments + Figma design
    ↓
[Google Sheets Exporter] Export theo template (Web hoặc Mobile variant)
    ↓
Comment link Google Sheets vào Jira task
```

### Platform Detection
| Prefix trong title | Variant Google Sheets |
|--------------------|-----------------------|
| `[CMS]` | Web: # / Test case / Pre-condition / Steps / Expected / **Web** (Actual, Bug) |
| `[Android]` hoặc `[IOS]` | Mobile: ... / **Android** (Actual, Bug) / **IOS** (Actual, Bug) |
| Không có prefix | Mobile (default) |

---

## Cài đặt

### 1. Cài Forge CLI

```bash
npm install -g @forge/cli
forge login
```

### 2. Clone và cài dependencies

```bash
git clone <repo-url>
cd jira-ai-testcase-generator
npm install
```

### 3. Setup Google Service Account

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. Tạo project mới hoặc dùng project có sẵn
3. Enable **Google Sheets API** và **Google Drive API**
4. Tạo **Service Account**: IAM & Admin → Service Accounts → Create
5. Tạo key JSON: Service Account → Keys → Add Key → JSON
6. Lưu file JSON key (sẽ dùng ở bước config env vars)

### 4. Config Environment Variables

```bash
# AI API Key (chọn Claude hoặc OpenAI)
forge variables set AI_API_KEY --encrypt
# → Nhập API key của Claude (Anthropic) hoặc OpenAI

# AI Provider (mặc định: claude)
forge variables set AI_PROVIDER
# → Nhập: claude  hoặc  openai

# Google Service Account JSON (paste toàn bộ nội dung file JSON key)
forge variables set GOOGLE_SERVICE_ACCOUNT_JSON --encrypt
# → Paste toàn bộ nội dung file JSON key của Service Account

# Google Spreadsheet ID (optional — nếu muốn dùng sheet có sẵn)
forge variables set SPREADSHEET_ID
# → Lấy từ URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit

# Figma Personal Access Token (tạo tại figma.com/settings → Personal access tokens)
forge variables set FIGMA_ACCESS_TOKEN --encrypt
# → Nhập Figma Personal Access Token

# Danh sách email để auto-share sheet (phân cách bằng dấu phẩy)
forge variables set SHARE_EMAILS
# → Ví dụ: qa1@company.com,qa2@company.com,pm@company.com
```

### 5. Deploy lên Jira Cloud

```bash
# Tạo app mới (lần đầu)
forge create
# → Chọn template: Basic trigger
# → Đặt tên app

# Deploy
forge deploy

# Install vào Jira site
forge install
# → Chọn: Jira
# → Nhập URL site: castalk.atlassian.net
# → Chọn project: AIEDU (hoặc All projects)
```

---

## Test

### Chạy unit tests

```bash
npm test
```

### Test trên local với forge tunnel

```bash
# Mở tunnel để nhận webhook từ Jira
forge tunnel

# Sau đó vào Jira và chuyển trạng thái 1 task từ Open → In Progress
# Xem logs trực tiếp trong terminal
```

### Xem logs trên Forge Developer Console

1. Vào [developer.atlassian.com/console/forge](https://developer.atlassian.com/console/forge)
2. Chọn app **AI TestCase Generator**
3. Chọn **Logs** → xem real-time logs

---

## Cấu trúc Project

```
jira-ai-testcase-generator/
├── manifest.yml              # Forge app config — trigger + permissions
├── package.json
├── README.md
└── src/
    ├── index.js              # Main trigger handler — kết nối tất cả modules
    ├── jiraDataFetcher.js    # Lấy dữ liệu Jira, comments task+subtasks, extract Figma links
    ├── figmaFetcher.js       # Gọi Figma API lấy screen/component/text data
    ├── aiGenerator.js        # Gọi AI API (Claude/OpenAI) với 3 nguồn context
    ├── googleSheetsExporter.js # Export test cases ra Google Sheets
    └── __tests__/
        ├── jiraDataFetcher.test.js
        ├── figmaFetcher.test.js
        ├── aiGenerator.test.js
        ├── googleSheetsExporter.test.js
        └── mockData.js       # Sample payloads: Jira event, comments, Figma data
```

---

## Troubleshooting

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `AI_API_KEY is not set` | Chưa set env var | `forge variables set AI_API_KEY --encrypt` |
| `GOOGLE_SERVICE_ACCOUNT_JSON is not set` | Chưa set env var | Set giá trị JSON key |
| `Failed to create spreadsheet` | Service Account thiếu quyền | Enable Google Sheets API + Drive API |
| `No JSON array found in AI response` | AI trả về format sai | Retry tự động (max 3 lần); kiểm tra prompt |
| App không trigger | Transition không đúng | Kiểm tra fromStatus/toStatus trong code |

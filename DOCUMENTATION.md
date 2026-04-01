# Create Test Cases With AI — Documentation

## Overview

**Create Test Cases With AI** is a Jira Forge app that automatically generates production-ready test cases using AI (Claude or GPT-4o) when a "Write Test Case" task moves to **In Progress**.

No manual input required — the app reads your Jira task, fetches Figma designs, analyzes comments, and produces a complete test case suite attached directly to your Jira issue.

---

## How It Works

1. Create a Jira subtask with a title containing **"Write Test Case"** or **"Write Testcase"**
2. Move the task to **In Progress**
3. The app automatically:
   - Reads the task description, acceptance criteria, parent task, and comments
   - Fetches Figma design screens (if a Figma link is present)
   - Calls the AI to generate test cases in multiple batches
   - Attaches a CSV file to the Jira issue
   - (Optional) Exports to Google Sheets with a clickable link in the Jira comment

---

## Platform Detection

The app detects the platform from the task title prefix:

| Title prefix | Platform |
|---|---|
| `[CMS] Write Test Case...` | Web |
| `[Android] Write Test Case...` | Mobile |
| `[iOS] Write Test Case...` | Mobile |
| No prefix | Mobile (default) |

---

## Test Case Types Generated

| Type | Description |
|---|---|
| UI | Screen layout, labels, buttons, navigation |
| Functional | Happy path, button states, API responses |
| Negative | Invalid inputs, error messages, edge cases |
| Validation | Boundary values, empty/null, format checks |
| End-to-End | Complete user flow from start to finish |
| Platform | iOS vs Android, app lifecycle, network switching (mobile only) |

---

## Configuration

Go to **Jira Settings → Apps → AI TestCase Generator** to configure:

### AI Settings (Required)
- **AI Provider** — Claude (Anthropic) or OpenAI (GPT-4o)
- **AI API Key** — Your Anthropic or OpenAI API key

### App Context (Optional)
- Additional description of your app/product to give AI better context
- The app also auto-reads your **Jira Project Description** as context

### Figma (Optional)
- **Figma Personal Access Token** — enables fetching design specs from Figma links in task descriptions
- Get token at: Figma → Settings → Security → Personal access tokens

### Google Sheets (Optional)

Google Sheets integration allows the app to export formatted test cases to a Google Sheet and post a clickable link back to the Jira issue.

#### Step 1: Create a Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. **Enable APIs** — Go to **APIs & Services → Library**, search for and enable:
   - **Google Sheets API**
   - **Google Drive API**
4. Go to **IAM & Admin → Service Accounts** (or visit `https://console.cloud.google.com/iam-admin/serviceaccounts`)
5. Click **"+ Create Service Account"**
   - Name: e.g. `testcase-sheets-writer`
   - Click **Create and Continue** → **Done**
6. Click on the service account you just created
7. Go to the **Keys** tab → **Add Key** → **Create new key** → select **JSON** → **Create**
8. A `.json` file will be downloaded — this is your **Service Account JSON**

> **Important**: The JSON file looks like this:
> ```json
> {
>   "type": "service_account",
>   "project_id": "your-project-id",
>   "private_key_id": "...",
>   "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
>   "client_email": "testcase-sheets-writer@your-project.iam.gserviceaccount.com",
>   ...
> }
> ```
> Copy the **entire contents** of this file and paste it into the **"Google Service Account JSON"** field in the app settings.

#### Step 2: Set Up the Spreadsheet ID

You have two options:

**Option A: Use an existing spreadsheet (Recommended)**
1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet
2. Click **Share** → add the service account email (the `client_email` from your JSON file, e.g. `testcase-sheets-writer@your-project.iam.gserviceaccount.com`) → set permission to **Editor**
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_IS_THE_SPREADSHEET_ID]/edit
   ```
4. Paste this ID into the **"Google Spreadsheet ID"** field in the app settings

**Option B: Auto-create**
- Leave the **Spreadsheet ID** field empty
- The app will automatically create a new spreadsheet on the first run
- **Note**: This requires the Google Cloud project to have billing enabled

> **Tip**: Option A is recommended because it gives you full control over sharing and avoids potential permission issues.

#### Step 3: Auto-Share Emails (Optional)

Enter a comma-separated list of email addresses to automatically share the spreadsheet with after export:

```
qa-team@company.com, pm@company.com, tech-lead@company.com
```

Each email will be granted **Editor** access to the spreadsheet.

#### How It Works

- Each Jira issue gets its own **tab** (sheet) within the spreadsheet, named after the issue key (e.g. `PROJ-123`)
- The spreadsheet ID is saved after the first run, so all subsequent test cases are consolidated in the same spreadsheet
- A **clickable smart link** to the Google Sheet is posted as a comment on the Jira issue
- Headers are formatted with colors, frozen rows, and merged cells matching your platform (Web or Mobile)

---

## Figma Integration

Add a Figma link anywhere in the task description or parent task description:

```
https://www.figma.com/design/ABC123/My-App?node-id=1-2
```

The app will fetch all screens from that frame and use exact UI text in test case steps and expected results.

---

## Output Format

Each test case includes:

| Field | Description |
|---|---|
| ID | Unique identifier (e.g. TC_LOGIN_001) |
| No | Sequential number |
| Test Case | What is being tested |
| Pre-condition | App state before the test |
| Steps | Numbered action steps |
| Expected Result | Specific, verifiable outcome |
| Priority | High / Medium / Low |
| Type | UI / Functional / Negative / Validation / E2E / Platform |
| Status | New (default) |

---

## Trigger Conditions

The app triggers in two scenarios:

**1. Status transition**
- Task title contains "write test case" or "write testcase"
- Status changes from **To Do / Backlog / Open → In Progress**

**2. New comment**
- A new comment is added to the task (or its parent)
- Task status is **In Progress**
- This allows re-generating test cases after requirement updates in comments

---

## Supported AI Models

| Provider | Model |
|---|---|
| Anthropic (Claude) | claude-sonnet-4-6 |
| OpenAI | gpt-4o |

---

## Requirements

- Jira Cloud (any plan)
- API key from Anthropic (console.anthropic.com) or OpenAI (platform.openai.com)
- (Optional) Google Cloud project with Sheets API & Drive API enabled for Google Sheets export

---

## Privacy & Security

- API keys and Service Account credentials are stored securely using Forge encrypted storage
- No personal user data is collected or stored
- Task data is sent to your chosen AI provider (Anthropic or OpenAI) for processing
- Google Sheets data is managed through your own Google Cloud service account
- See full privacy statement: https://gist.github.com/Aidan-castalk/b1500c80966782d72bef1c7632d71dc8

---

## Support

For questions or issues, contact: **aidan@torilab.ai**

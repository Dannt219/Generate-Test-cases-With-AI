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
   - (Optional) Exports to Google Sheets

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
- **Service Account JSON** — Google Cloud service account credentials
- **Spreadsheet ID** — existing sheet to export to (leave empty to auto-create)
- **Auto-share emails** — emails to share the sheet with after export

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

---

## Privacy & Security

- API keys are stored securely using Forge encrypted storage
- No personal user data is collected or stored
- Task data is sent to your chosen AI provider (Anthropic or OpenAI) for processing
- See full privacy statement: https://gist.github.com/Aidan-castalk/b1500c80966782d72bef1c7632d71dc8

---

## Support

For questions or issues, contact: **aidan@torilab.ai**

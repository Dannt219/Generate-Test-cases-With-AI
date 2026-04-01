import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

document.getElementById('status').style.display = 'none';

const invokeBridge = async (name, payload) => {
  const { invoke } = await import('@forge/bridge');
  return invoke(name, payload);
};

const Badge = ({ ok, label }) => (
  <span style={{
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: ok ? '#e3fcef' : '#ffecd2',
    color: ok ? '#006644' : '#974f0c',
    marginLeft: 8,
    verticalAlign: 'middle',
  }}>
    {ok ? '✓ Saved' : '⚠ Not configured'}
  </span>
);

const App = () => {
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    aiProvider: 'claude', appsScriptUrl: '', folderId: '', appContext: '',
    hasAiApiKey: false, hasFigmaToken: false, hasAppsScriptUrl: false,
  });

  const loadConfig = () => {
    setLoading(true);
    invokeBridge('getConfig')
      .then(data => { if (data) setConfig(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadConfig(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.target);
      await invokeBridge('saveConfig', {
        aiProvider:    fd.get('aiProvider'),
        aiApiKey:      fd.get('aiApiKey'),
        figmaToken:    fd.get('figmaToken'),
        appsScriptUrl: fd.get('appsScriptUrl'),
        folderId:      fd.get('folderId'),
        appContext:    fd.get('appContext'),
      });
      await loadConfig();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      e.target.reset();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
    setSaving(false);
  };

  if (loading) return <div style={s.loading}>⏳ Loading configuration...</div>;

  return (
    <div style={s.container}>
      <h1 style={s.h1}>AI TestCase Generator — Configuration</h1>
      <p style={s.desc}>
        When a task/subtask with <b>"write testcase"</b> in the title transitions <b>To Do → In Progress</b>, the app automatically generates test cases using AI and exports to Google Sheets.
      </p>

      {saved && <div style={s.success}>✅ Saved successfully! Configuration has been updated.</div>}

      {/* Status overview */}
      <div style={s.statusBox}>
        <b style={{ fontSize: 13 }}>Configuration Status:</b>
        <div style={s.statusRow}>
          <span style={s.statusLabel}>AI API Key</span>
          <Badge ok={config.hasAiApiKey} />
        </div>
        <div style={s.statusRow}>
          <span style={s.statusLabel}>Apps Script URL</span>
          <Badge ok={config.hasAppsScriptUrl} />
          {!config.hasAppsScriptUrl && <span style={s.optional}>(optional)</span>}
        </div>
        <div style={s.statusRow}>
          <span style={s.statusLabel}>Figma Token</span>
          <Badge ok={config.hasFigmaToken} />
          {!config.hasFigmaToken && <span style={s.optional}>(optional)</span>}
        </div>
        <div style={s.statusRow}>
          <span style={s.statusLabel}>AI Provider</span>
          <span style={s.value}>{config.aiProvider === 'claude' ? 'Claude (Anthropic)' : 'OpenAI (GPT-4o)'}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* App Context */}
        <section style={s.section}>
          <h2 style={s.h2}>App Context <span style={s.optTag}>Optional</span></h2>
          <p style={{ fontSize: 12, color: '#6b778c', margin: '0 0 8px' }}>
            The app automatically reads from <b>Jira Project Description</b>. Add additional context here to improve AI accuracy.
          </p>
          <label style={s.label}>Additional App Context</label>
          <textarea name="appContext" rows={3} style={{ ...s.input, fontFamily: 'inherit', fontSize: 13 }}
            defaultValue={config.appContext}
            placeholder="e.g. EdTech app for Japanese students and parents, features: login, grade selection, lesson booking..." />
        </section>

        {/* AI Settings */}
        <section style={s.section}>
          <h2 style={s.h2}>AI Settings</h2>

          <label style={s.label}>AI Provider</label>
          <select name="aiProvider" defaultValue={config.aiProvider} style={s.input}>
            <option value="claude">Claude (Anthropic) — Recommended</option>
            <option value="openai">OpenAI (GPT-4o)</option>
          </select>

          <label style={s.label}>
            AI API Key
            <Badge ok={config.hasAiApiKey} />
          </label>
          <input type="password" name="aiApiKey" style={s.input}
            placeholder={config.hasAiApiKey ? '••••••••••••••• (leave blank to keep existing key)' : 'sk-ant-... or sk-...'} />
          <div style={s.hint}>
            Claude: <code>console.anthropic.com</code> → API Keys &nbsp;|&nbsp;
            OpenAI: <code>platform.openai.com/api-keys</code>
          </div>
        </section>

        {/* Figma */}
        <section style={s.section}>
          <h2 style={s.h2}>Figma <span style={s.optTag}>Optional</span></h2>
          <label style={s.label}>
            Personal Access Token
            <Badge ok={config.hasFigmaToken} />
          </label>
          <input type="password" name="figmaToken" style={s.input}
            placeholder={config.hasFigmaToken ? '••••• (leave blank to keep existing token)' : 'figd_... (leave blank if not using Figma)'} />
          <div style={s.hint}>Figma → Settings → Security → Personal access tokens</div>
        </section>

        {/* Google Sheets */}
        <section style={s.section}>
          <h2 style={s.h2}>Google Sheets <span style={s.optTag}>Optional</span></h2>
          <p style={{ fontSize: 12, color: '#6b778c', margin: '0 0 8px' }}>
            Create a Google Apps Script Web App and paste the URL here. The app will automatically create a new Google Sheet for each task.
          </p>

          <label style={s.label}>
            Apps Script URL
            <Badge ok={config.hasAppsScriptUrl} />
          </label>
          <input type="text" name="appsScriptUrl" defaultValue={config.appsScriptUrl} style={s.input}
            placeholder="https://script.google.com/macros/s/.../exec" />
          <div style={s.hint}>
            script.google.com → New project → paste <code>TestCaseSheetGenerator.gs</code> → Deploy as Web App (Execute as: Me, Access: Anyone)
          </div>

          <label style={s.label}>Google Drive Folder ID <span style={s.optTag}>Optional</span></label>
          <input type="text" name="folderId" defaultValue={config.folderId} style={s.input}
            placeholder="e.g. 1ABC123xyzFOLDERID (from Drive URL)" />
          <div style={s.hint}>
            Leave blank → sheet saved to My Drive. Get ID from: drive.google.com/drive/folders/<b>[FOLDER_ID]</b>
          </div>
        </section>

        <button type="submit" disabled={saving} style={saving ? { ...s.button, opacity: 0.7 } : s.button}>
          {saving ? '⏳ Saving...' : '💾 Save Configuration'}
        </button>
      </form>
    </div>
  );
};

const s = {
  container:  { maxWidth: 640, margin: '0 auto', padding: '20px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: '#172b4d' },
  h1:         { fontSize: 20, fontWeight: 700, margin: '0 0 6px' },
  h2:         { fontSize: 14, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#5e6c84' },
  desc:       { color: '#6b778c', marginBottom: 16, fontSize: 13 },
  section:    { background: '#f4f5f7', border: '1px solid #dfe1e6', borderRadius: 6, padding: '14px 16px', marginBottom: 12 },
  label:      { display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, marginTop: 12 },
  input:      { display: 'block', width: '100%', padding: '7px 10px', border: '2px solid #dfe1e6', borderRadius: 4, fontSize: 13, boxSizing: 'border-box', background: '#fff' },
  hint:       { fontSize: 11, color: '#8993a4', marginTop: 4 },
  button:     { background: '#0052cc', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 24px', fontSize: 14, cursor: 'pointer', marginTop: 8, fontWeight: 600 },
  success:    { background: '#e3fcef', border: '1px solid #00875a', borderRadius: 4, padding: '10px 14px', marginBottom: 12, color: '#006644', fontSize: 13 },
  loading:    { padding: 32, textAlign: 'center', color: '#6b778c', fontSize: 14 },
  statusBox:  { background: '#fff', border: '2px solid #0052cc22', borderRadius: 6, padding: '12px 16px', marginBottom: 16 },
  statusRow:  { display: 'flex', alignItems: 'center', marginTop: 6 },
  statusLabel:{ fontSize: 13, color: '#5e6c84', width: 180, flexShrink: 0 },
  value:      { fontSize: 13, color: '#172b4d', fontWeight: 500, marginLeft: 8 },
  optional:   { fontSize: 11, color: '#8993a4', marginLeft: 6 },
  optTag:     { fontSize: 10, fontWeight: 600, background: '#dfe1e6', color: '#6b778c', borderRadius: 3, padding: '1px 5px', marginLeft: 6, verticalAlign: 'middle' },
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

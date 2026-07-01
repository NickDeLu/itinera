<script>
  import { clearTokens, getTokens } from '../lib/api.js';

  let { user, onLogout } = $props();

  let tokens = getTokens();
</script>

<div class="view">
  <header class="view-header">
    <h1>⚙️ Settings</h1>
    <p class="view-subtitle">Manage your account</p>
  </header>

  <div class="view-body">
    <div class="settings-section">
      <h2>Account</h2>
      <div class="setting-row">
        <span class="setting-label">Email</span>
        <span class="setting-value">{user?.email || 'Unknown'}</span>
      </div>
      <div class="setting-row">
        <span class="setting-label">User ID</span>
        <span class="setting-value mono">{user?.id || 'Unknown'}</span>
      </div>
    </div>

    <div class="settings-section">
      <h2>Session</h2>
      <div class="setting-row">
        <span class="setting-label">Access Token</span>
        <span class="setting-value mono small">{tokens.accessToken ? `${tokens.accessToken.slice(0, 20)}...` : 'None'}</span>
      </div>
      <div class="setting-row">
        <span class="setting-label">Refresh Token</span>
        <span class="setting-value mono small">{tokens.refreshToken ? `${tokens.refreshToken.slice(0, 20)}...` : 'None'}</span>
      </div>
    </div>

    <button class="btn-logout" onclick={onLogout}>
      Sign Out
    </button>
  </div>
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .view-header {
    padding: 20px;
    padding-top: max(20px, env(safe-area-inset-top));
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }

  .view-header h1 {
    font-size: 22px;
    font-weight: 700;
  }

  .view-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .view-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    -webkit-overflow-scrolling: touch;
  }

  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }

  .setting-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .setting-value {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 60%;
    text-align: right;
    word-break: break-all;
  }

  .setting-value.mono {
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .setting-value.small {
    font-size: 11px;
  }

  .btn-logout {
    width: 100%;
    padding: 14px;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #ef4444;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 12px;
  }

  .btn-logout:active {
    background: #fecaca;
  }
</style>
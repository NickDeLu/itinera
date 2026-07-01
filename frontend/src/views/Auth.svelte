<script>
  import { login, signup } from '../lib/api.js';

  let { onLogin } = $props();

  let tab = $state('login');
  let loading = $state(false);
  let error = $state('');

  // Login fields
  let loginEmail = $state('');
  let loginPassword = $state('');

  // Signup fields
  let signupName = $state('');
  let signupEmail = $state('');
  let signupPassword = $state('');
  let signupSuccess = $state('');

  function switchTab(t) {
    tab = t;
    error = '';
    signupSuccess = '';
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      error = 'Please fill in all fields.';
      return;
    }
    loading = true;
    error = '';
    try {
      await login(loginEmail, loginPassword);
      onLogin();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!signupEmail || !signupPassword) {
      error = 'Email and password are required.';
      return;
    }
    if (signupPassword.length < 6) {
      error = 'Password must be at least 6 characters.';
      return;
    }
    loading = true;
    error = '';
    signupSuccess = '';
    try {
      await signup(signupEmail, signupPassword, signupName || undefined);
      signupSuccess = 'Account created! Please sign in.';
      signupName = '';
      signupEmail = '';
      signupPassword = '';
      setTimeout(() => {
        switchTab('login');
        loginEmail = signupEmail;
        loginPassword = '';
      }, 1200);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-screen">
  <div class="auth-container">
    <div class="auth-header">
      <div class="logo">🧳</div>
      <h1>Itinera</h1>
      <p>Your AI travel planning assistant</p>
    </div>
    <div class="auth-body">
      <div class="auth-tabs">
        <button class="auth-tab" class:active={tab === 'login'} onclick={() => switchTab('login')}>Sign In</button>
        <button class="auth-tab" class:active={tab === 'signup'} onclick={() => switchTab('signup')}>Sign Up</button>
      </div>

      {#if tab === 'login'}
        <form onsubmit={handleLogin}>
          <div class="form-group">
            <label for="login-email">Email</label>
            <input type="email" id="login-email" bind:value={loginEmail} placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" bind:value={loginPassword} placeholder="Enter your password" autocomplete="current-password" required />
          </div>
          <button type="submit" class="btn-primary" disabled={loading}>
            {#if loading}
              <span class="spinner"></span>
            {:else}
              Sign In
            {/if}
          </button>
        </form>
      {:else}
        <form onsubmit={handleSignup}>
          <div class="form-group">
            <label for="signup-name">Full Name</label>
            <input type="text" id="signup-name" bind:value={signupName} placeholder="John Doe" autocomplete="name" />
          </div>
          <div class="form-group">
            <label for="signup-email">Email</label>
            <input type="email" id="signup-email" bind:value={signupEmail} placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label for="signup-password">Password</label>
            <input type="password" id="signup-password" bind:value={signupPassword} placeholder="At least 6 characters" autocomplete="new-password" required minlength="6" />
          </div>
          <button type="submit" class="btn-primary" disabled={loading}>
            {#if loading}
              <span class="spinner"></span>
            {:else}
              Create Account
            {/if}
          </button>
        </form>
      {/if}

      {#if error}
        <div class="msg error">{error}</div>
      {/if}
      {#if signupSuccess}
        <div class="msg success">{signupSuccess}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .auth-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 24px;
  }

  .auth-container {
    background: var(--surface);
    border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
    width: 100%;
    max-width: 400px;
    overflow: hidden;
    animation: slideUp 0.4s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .auth-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 32px 24px 24px;
    text-align: center;
  }

  .logo {
    font-size: 40px;
    margin-bottom: 8px;
  }

  .auth-header h1 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .auth-header p {
    font-size: 14px;
    opacity: 0.85;
    margin-top: 4px;
  }

  .auth-body {
    padding: 24px;
  }

  .auth-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 24px;
    background: var(--bg-light);
    border-radius: 8px;
    padding: 4px;
  }

  .auth-tab {
    flex: 1;
    padding: 10px;
    text-align: center;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .auth-tab.active {
    background: var(--surface);
    color: var(--primary);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .form-group input {
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    font-size: 15px;
    color: var(--text);
    background: var(--surface);
    transition: border-color 0.2s, box-shadow 0.2s;
    -webkit-appearance: none;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
  }

  .btn-primary {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
  }

  .btn-primary:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .msg {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-top: 12px;
    line-height: 1.4;
  }

  .msg.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #ef4444;
  }

  .msg.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
  }
</style>
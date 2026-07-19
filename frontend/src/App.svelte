<script>
  import { onMount } from 'svelte';
  import { getMe, clearTokens, getTokens, fetchReviewCount } from './lib/api.js';
  import Auth from './views/Auth.svelte';
  import Chat from './views/Chat.svelte';
  import Trips from './views/Trips.svelte';
  import Settings from './views/Settings.svelte';
  import Review from './views/Review.svelte';
  import NavBar from './lib/NavBar.svelte';

  let authenticated = $state(!!getTokens().accessToken);
  let user = $state(null);
  let route = $state('chat');
  let loading = $state(true);
  let reviewCount = $state(0);

  async function refreshReviewCount() {
    try {
      reviewCount = await fetchReviewCount();
    } catch {
      // silent fail — badge just won't update
    }
  }

  onMount(async () => {
    if (authenticated) {
      try {
        user = await getMe();
        refreshReviewCount();
      } catch {
        clearTokens();
        authenticated = false;
      }
    }
    loading = false;

    // Listen for session expiry from api.js
    window.addEventListener('auth:expired', () => {
      authenticated = false;
      user = null;
    });
  });

  function handleLogin() {
    authenticated = true;
    getMe().then(u => {
      user = u;
      refreshReviewCount();
    }).catch(() => {
      clearTokens();
      authenticated = false;
    });
  }

  function handleLogout() {
    clearTokens();
    authenticated = false;
    user = null;
  }

  function handleNavigate(r) {
    route = r;
    if (r === 'review') refreshReviewCount();
  }

  function handleReviewConfirm(tripId) {
    refreshReviewCount();
    route = 'trips';
  }
</script>

{#if loading}
  <div class="loading-screen">
    <div class="loading-spinner"></div>
  </div>
{:else if !authenticated}
  <Auth onLogin={handleLogin} />
{:else}
  <div class="app-layout">
    <NavBar activeRoute={route} onNavigate={handleNavigate} {reviewCount} />
    <main class="main-content">
      {#if route === 'chat'}
        <Chat {user} />
      {:else if route === 'trips'}
        <Trips {user} />
      {:else if route === 'review'}
        <Review {user} onConfirm={handleReviewConfirm} />
      {:else if route === 'settings'}
        <Settings user={user} onLogout={handleLogout} />
      {/if}
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .app-layout {
    display: flex;
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 60px; /* space for mobile bottom nav */
  }

  @media (min-width: 768px) {
    .main-content {
      padding-bottom: 0;
    }
  }
</style>

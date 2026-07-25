<script>
  import { onMount } from 'svelte';
  import { getMe, clearTokens, getTokens, fetchReviewCount } from './lib/api.js';
  import Auth from './views/Auth.svelte';
  import Chat from './views/Chat.svelte';
  import Trips from './views/Trips.svelte';
  import Settings from './views/Settings.svelte';
  import Review from './views/Review.svelte';
  import NavBar from './lib/NavBar.svelte';
  import Onboarding from './views/Onboarding.svelte';

  let authenticated = $state(!!getTokens().accessToken);
  let user = $state(null);
  let route = $state('chat');
  let loading = $state(true);
  let reviewCount = $state(0);
  let showOnboarding = $state(false);
  let authDefaultTab = $state('login');

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

    // Check for onboarding query param
    checkOnboarding();

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

  function handleOnboardingComplete() {
    showOnboarding = false;
    // Remove query param from URL
    if (window.history && window.history.replaceState) {
      const url = new URL(window.location);
      url.searchParams.delete('onboarding');
      window.history.replaceState({}, '', url);
    }
    // Set auth to signup tab since user just completed onboarding
    authDefaultTab = 'signup';
  }

  function checkOnboarding() {
    // Check if user has completed onboarding before
    const onboardingComplete = localStorage.getItem('itinera_onboarding_complete');
    
    // Check for query param
    const urlParams = new URLSearchParams(window.location.search);
    const showOnboardingParam = urlParams.get('onboarding') === 'true';
    
    // Show onboarding if query param is present, OR if it's the user's first visit
    if (showOnboardingParam || !onboardingComplete) {
      showOnboarding = true;
    }
  }
</script>

{#if loading}
  <div class="loading-screen">
    <div class="loading-spinner"></div>
  </div>
{:else if showOnboarding}
  <Onboarding onComplete={handleOnboardingComplete} />
{:else if !authenticated}
  <Auth onLogin={handleLogin} defaultTab={authDefaultTab} />
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
    height: 100dvh;
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
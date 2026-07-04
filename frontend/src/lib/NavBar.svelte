<script>
  import Icon from './Icon.svelte';

  let { activeRoute = 'chat', onNavigate, reviewCount = 0 } = $props();

  const routes = [
    { id: 'chat', label: 'Chat', icon: 'chat' },
    { id: 'trips', label: 'Trips', icon: 'trips' },
    { id: 'review', label: 'Review', icon: 'review' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
</script>

<!-- Mobile Bottom Nav -->
<nav class="bottom-nav">
  {#each routes as route}
    <button
      class="nav-item"
      class:active={activeRoute === route.id}
      onclick={() => onNavigate(route.id)}
    >
      <span class="nav-icon-wrap">
        <Icon name={route.icon} size={20} class="nav-icon" />
        {#if route.id === 'review' && reviewCount > 0}
          <span class="badge">{reviewCount > 99 ? '99+' : reviewCount}</span>
        {/if}
      </span>
      <span class="nav-label">{route.label}</span>
    </button>
  {/each}
</nav>

<!-- Desktop Sidebar -->
<aside class="sidebar">
  <div class="sidebar-header">
    <Icon name="logo" size={28} class="sidebar-logo" />
    <span class="sidebar-title">Itinera</span>
  </div>
  <nav class="sidebar-nav">
    {#each routes as route}
      <button
        class="sidebar-item"
        class:active={activeRoute === route.id}
        onclick={() => onNavigate(route.id)}
      >
        <span class="sidebar-icon-wrap">
          <Icon name={route.icon} size={18} class="sidebar-icon" />
          {#if route.id === 'review' && reviewCount > 0}
            <span class="badge">{reviewCount > 99 ? '99+' : reviewCount}</span>
          {/if}
        </span>
        <span class="sidebar-label">{route.label}</span>
      </button>
    {/each}
  </nav>
</aside>

<style>
  /* ===== Bottom Nav (Mobile) ===== */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom, 0);
    z-index: 100;
  }

  @media (min-width: 768px) {
    .bottom-nav {
      display: none;
    }
  }

  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.2s;
    font-size: 11px;
  }

  .nav-item.active {
    color: var(--primary);
  }

  .nav-item:active {
    opacity: 0.7;
  }

  .nav-icon-wrap {
    position: relative;
    display: inline-flex;
  }

  .nav-label {
    font-weight: 600;
  }

  /* ===== Sidebar (Desktop) ===== */
  .sidebar {
    display: none;
    width: 220px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    flex-direction: column;
    flex-shrink: 0;
  }

  @media (min-width: 768px) {
    .sidebar {
      display: flex;
    }
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
  }

  .sidebar-nav {
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s;
    text-align: left;
    width: 100%;
  }

  .sidebar-item:hover {
    background: var(--bg-light);
    color: var(--text);
  }

  .sidebar-item.active {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary);
    font-weight: 600;
  }

  .sidebar-icon-wrap {
    position: relative;
    display: inline-flex;
    width: 24px;
    text-align: center;
  }

  .badge {
    position: absolute;
    top: -4px;
    right: -6px;
    background: #ef4444;
    color: white;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 8px;
    min-width: 14px;
    text-align: center;
    line-height: 1.4;
  }
</style>
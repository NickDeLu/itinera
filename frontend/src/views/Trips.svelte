<script>
  import { onMount } from 'svelte';
  import { fetchTrips, deleteTrip } from '../lib/api.js';
  import Icon from '../lib/Icon.svelte';
  import Timeline from './Timeline.svelte';

  let { user } = $props();

  let trips = $state([]);
  let loading = $state(true);
  let error = $state('');
  let selectedTrip = $state(null);

  onMount(() => {
    loadTrips();
  });

  async function loadTrips() {
    loading = true;
    error = '';
    try {
      trips = await fetchTrips();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleDelete(tripId) {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    try {
      await deleteTrip(tripId);
      trips = trips.filter(t => t.id !== tripId);
    } catch (err) {
      error = err.message;
    }
  }

  function viewTrip(trip) {
    selectedTrip = trip;
  }

  function backToList() {
    selectedTrip = null;
  }
</script>

{#if selectedTrip}
  <Timeline trip={selectedTrip} onBack={backToList} />
{:else}
  <div class="view">
    <header class="view-header">
      <div class="view-header-row">
        <Icon name="trips" size={22} class="view-header-icon" />
        <h1>My Trips</h1>
      </div>
      <p class="view-subtitle">Tap a trip to view its itinerary timeline</p>
    </header>

    <div class="view-body">
      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading your trips...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <button class="btn-retry" onclick={loadTrips}>Retry</button>
        </div>
      {:else if trips.length === 0}
        <div class="empty-state">
          <Icon name="globe" size={48} class="empty-icon" />
          <h2>No trips yet</h2>
          <p>Start planning your next adventure by chatting with Itinera! Ask it to create a trip itinerary and it will appear here.</p>
          <div class="tips">
            <h3>Try asking:</h3>
            <ul>
              <li>"Plan a 5-day trip to Paris"</li>
              <li>"Create an itinerary for Tokyo"</li>
              <li>"Help me plan a weekend in New York"</li>
            </ul>
          </div>
        </div>
      {:else}
        <div class="trip-grid">
          {#each trips as trip}
            <div class="trip-card" onclick={() => viewTrip(trip)} onkeydown={(e) => e.key === 'Enter' && viewTrip(trip)} role="button" tabindex="0">
              <div class="trip-header">
                <h3>{trip.name || 'Untitled Trip'}</h3>
                {#if trip.destination}
                  <span class="trip-dest">
                    <Icon name="pin" size={12} class="pin-icon" /> {trip.destination}
                  </span>
                {/if}
                {#if trip.start_date || trip.end_date}
                  <span class="trip-dates">
                    {trip.start_date || '?'} — {trip.end_date || '?'}
                  </span>
                {/if}
              </div>
              {#if trip.description}
                <div class="trip-body">
                  <p>{trip.description}</p>
                </div>
              {/if}
              <div class="trip-footer" onclick={(e) => e.stopPropagation()}>
                <span class="trip-status" class:active={trip.status === 'active'}>
                  {trip.status || 'unknown'}
                </span>
                <span class="trip-created">
                  Created {new Date(trip.created_at).toLocaleDateString()}
                </span>
                <button class="btn-delete" onclick={() => handleDelete(trip.id)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
              </div>
            {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

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

  .view-header-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .view-header h1 {
    font-size: 22px;
    font-weight: 700;
  }

  .view-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
    margin-left: 32px;
  }

  .view-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    -webkit-overflow-scrolling: touch;
  }

  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 20px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .btn-retry {
    padding: 8px 20px;
    border: 1px solid var(--primary);
    background: transparent;
    color: var(--primary);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    max-width: 400px;
    margin: 0 auto;
  }

  .empty-state h2 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 24px;
  }

  .tips {
    text-align: left;
    background: var(--bg-light);
    padding: 16px 20px;
    border-radius: 12px;
  }

  .tips h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .tips ul {
    list-style: none;
    padding: 0;
  }

  .tips li {
    padding: 6px 0;
    font-size: 14px;
    color: var(--primary);
    font-weight: 500;
  }

  .tips li::before {
    content: '→ ';
  }

  .trip-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .trip-card {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.15s;
    padding: 0;
    font-family: inherit;
    color: inherit;
  }

  .trip-card:active {
    transform: scale(0.99);
  }

  .trip-card:hover {
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }

  .trip-header {
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  .trip-header h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .trip-dest {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--primary);
    margin-bottom: 2px;
  }

  .trip-dates {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .trip-body {
    padding: 12px 16px;
  }

  .trip-body p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .trip-footer {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-light);
    gap: 8px;
    flex-wrap: wrap;
  }

  .trip-status {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--border);
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .trip-status.active {
    background: #dcfce7;
    color: #16a34a;
  }

  .trip-created {
    font-size: 11px;
    color: var(--text-secondary);
    flex: 1;
  }

  .btn-delete {
    padding: 6px;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #ef4444;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .btn-delete:active {
    background: #fecaca;
  }
</style>
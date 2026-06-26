<script>
  import { onMount } from 'svelte';
  import { fetchTripWithItems } from '../lib/api.js';

  let { trip, onBack } = $props();

  let items = $state([]);
  let loading = $state(true);
  let error = $state('');

  onMount(() => {
    loadItems();
  });

  async function loadItems() {
    loading = true;
    error = '';
    try {
      const detail = await fetchTripWithItems(trip.id);
      items = (detail.items || []).sort((a, b) => {
        if (!a.start_timestamp && !b.start_timestamp) return (a.ordinal || 0) - (b.ordinal || 0);
        if (!a.start_timestamp) return 1;
        if (!b.start_timestamp) return -1;
        return parseLocalTimestamp(a.start_timestamp) - parseLocalTimestamp(b.start_timestamp);
      });
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function parseLocalTimestamp(ts) {
    if (!ts) return null;
    // Timestamps from the AI are naive (no timezone), e.g. "2026-08-14T19:00:00"
    // Treat them as local time to avoid UTC conversion shifting the display
    const [datePart, timePart] = ts.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = (timePart || '00:00:00').split(':').map(Number);
    return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = parseLocalTimestamp(ts);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = parseLocalTimestamp(ts);
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function getActivityIcon(type) {
    const icons = {
      flight: '✈️',
      hotel: '🏨',
      restaurant: '🍽️',
      transportation: '🚗',
      sightseeing: '🏛️',
      activity: '🎯',
    };
    return icons[type] || '📍';
  }
</script>

<div class="detail-view">
  <!-- Header -->
  <header class="detail-header">
    <button class="btn-back" onclick={onBack}>← Back to Trips</button>
    <div class="detail-info">
      <h1>{trip.name || 'Trip Details'}</h1>
      {#if trip.destination}
        <span class="detail-dest">📍 {trip.destination}</span>
      {/if}
      {#if trip.start_date || trip.end_date}
        <span class="detail-dates">
          {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
        </span>
      {/if}
      {#if trip.description}
        <p class="detail-desc">{trip.description}</p>
      {/if}
    </div>
  </header>

  <div class="detail-body">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading itinerary...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p>{error}</p>
        <button class="btn-retry" onclick={loadItems}>Retry</button>
      </div>
    {:else if items.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🗓️</div>
        <h2>No activities yet</h2>
        <p>Ask Itinera to add activities to this trip through the chat.</p>
      </div>
    {:else}
      <div class="timeline">
        {#each items as item, i}
          <div class="timeline-item">
            <div class="timeline-line"></div>
            <div class="timeline-dot">●</div>
            <div class="timeline-card">
              <div class="timeline-meta">
                {#if item.start_timestamp}
                  <span class="tl-date">{formatDate(item.start_timestamp)}</span>
                  <span class="tl-time">{formatTime(item.start_timestamp)}</span>
                {/if}
                {#if item.activity_type}
                  <span class="tl-badge">{item.activity_type_label || item.activity_type}</span>
                {/if}
              </div>
              <h3 class="tl-title">{item.title}</h3>
              {#if item.description}
                <p class="tl-desc">{item.description}</p>
              {/if}
              {#if item.location}
                <span class="tl-location">📍 {item.location}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .detail-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .detail-header {
    padding: 16px 20px;
    padding-top: max(16px, env(safe-area-inset-top));
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }

  .btn-back {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 0;
    margin-bottom: 8px;
  }

  .btn-back:active {
    opacity: 0.7;
  }

  .detail-info h1 {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .detail-dest {
    display: block;
    font-size: 14px;
    color: var(--primary);
    margin-bottom: 2px;
  }

  .detail-dates {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .detail-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-top: 4px;
  }

  .detail-body {
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
    padding: 60px 20px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .timeline {
    position: relative;
    padding-left: 28px;
  }

  .timeline-item {
    position: relative;
    padding-bottom: 20px;
  }

  .timeline-item:last-child {
    padding-bottom: 0;
  }

  .timeline-line {
    position: absolute;
    left: -12px;
    top: 18px;
    bottom: 0;
    width: 2px;
    background: var(--border);
  }

  .timeline-item:last-child .timeline-line {
    display: none;
  }

  .timeline-dot {
    position: absolute;
    left: -16px;
    top: 2px;
    font-size: 10px;
    color: var(--primary);
    z-index: 1;
  }

  .timeline-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
    transition: box-shadow 0.2s;
  }

  .timeline-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .tl-date {
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
  }

  .tl-time {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .tl-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--bg-light);
    color: var(--text-secondary);
    text-transform: capitalize;
    margin-left: auto;
  }

  .tl-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .tl-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .tl-location {
    display: inline-block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 6px;
  }
</style>
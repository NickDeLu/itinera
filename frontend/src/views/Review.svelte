<script>
  import { onMount } from 'svelte';
  import { fetchReviewQueue, fetchTrips, confirmReviewEmail } from '../lib/api.js';
  import Icon from '../lib/Icon.svelte';

  let { user, onConfirm } = $props();

  // List state
  let emails = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Modal state
  let selectedEmail = $state(null);
  let editedItems = $state([]);
  let itemDates = $state([]);   // parallel array: [{ startDate, startTime, endDate, endTime }]
  let trips = $state([]);
  let selectedTripId = $state('');
  let newTripName = $state('');
  let newTripDestination = $state('');
  let confirming = $state(false);
  let confirmError = $state('');

  const ACTIVITY_TYPES = ['flight', 'hotel', 'restaurant', 'event', 'transportation'];

  onMount(loadReviewQueue);

  async function loadReviewQueue() {
    loading = true;
    error = '';
    try {
      emails = await fetchReviewQueue();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function splitTimestamp(ts) {
    if (!ts) return { date: '', time: '' };
    const [d, t] = ts.split('T');
    return { date: d || '', time: t ? t.slice(0, 5) : '' };
  }

  function toTimestamp(date, time) {
    if (!date) return null;
    return time ? `${date}T${time}:00` : `${date}T00:00:00`;
  }

  async function openEmail(email) {
    selectedEmail = email;
    confirmError = '';

    const parsedItems = email.parsed_data?.items || [];
    editedItems = parsedItems.map(item => ({ ...item }));
    itemDates = parsedItems.map(item => ({
      startDate: splitTimestamp(item.start_timestamp).date,
      startTime: splitTimestamp(item.start_timestamp).time,
      endDate: splitTimestamp(item.end_timestamp).date,
      endTime: splitTimestamp(item.end_timestamp).time,
    }));

    selectedTripId = email.parsed_data?.trip_id || '';
    newTripName = email.parsed_data?.trip?.name || '';
    newTripDestination = email.parsed_data?.trip?.destination || '';

    try {
      trips = await fetchTrips();
    } catch {
      trips = [];
    }
  }

  function closeModal() {
    selectedEmail = null;
    confirmError = '';
  }

  async function handleConfirm() {
    confirming = true;
    confirmError = '';
    try {
      const items = editedItems.map((item, i) => ({
        ...item,
        start_timestamp: toTimestamp(itemDates[i].startDate, itemDates[i].startTime),
        end_timestamp: toTimestamp(itemDates[i].endDate, itemDates[i].endTime),
      }));

      const payload = {
        trip_id: selectedTripId || null,
        items,
      };

      if (!selectedTripId) {
        payload.trip = {
          name: newTripName || selectedEmail.parsed_data?.trip?.name || 'Untitled Trip',
          destination: newTripDestination || selectedEmail.parsed_data?.trip?.destination || undefined,
          start_date: selectedEmail.parsed_data?.trip?.start_date || undefined,
          end_date: selectedEmail.parsed_data?.trip?.end_date || undefined,
        };
      }

      const result = await confirmReviewEmail(selectedEmail.id, payload);
      emails = emails.filter(e => e.id !== selectedEmail.id);
      selectedEmail = null;
      onConfirm(result.trip_id);
    } catch (err) {
      confirmError = err.message;
    } finally {
      confirming = false;
    }
  }

  function formatDate(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return ts;
    }
  }

  function activitySummary(email) {
    const items = email.parsed_data?.items || [];
    if (items.length === 0) return 'No activities extracted';
    const types = items.map(i => i.activity_type.charAt(0).toUpperCase() + i.activity_type.slice(1));
    return `${items.length} activit${items.length === 1 ? 'y' : 'ies'}: ${types.join(', ')}`;
  }
</script>

{#if selectedEmail}
  <!-- Review Modal -->
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div>
          <h2 class="modal-title">Review Email</h2>
          <p class="modal-subtitle">{selectedEmail.subject || '(no subject)'}</p>
        </div>
        <button class="close-btn" onclick={closeModal}>
          <Icon name="close" size={18} />
        </button>
      </div>

      <div class="modal-body">
        <!-- Trip assignment -->
        <section class="section">
          <h3 class="section-title">Trip Assignment</h3>
          <select class="input" bind:value={selectedTripId}>
            <option value="">Create new trip</option>
            {#each trips as trip}
              <option value={trip.id}>{trip.name}{trip.destination ? ` — ${trip.destination}` : ''}</option>
            {/each}
          </select>

          {#if !selectedTripId}
            <div class="new-trip-fields">
              <input class="input" type="text" placeholder="Trip name" bind:value={newTripName} />
              <input class="input" type="text" placeholder="Destination (optional)" bind:value={newTripDestination} />
            </div>
          {/if}
        </section>

        <!-- Parsed activities -->
        {#each editedItems as item, i}
          <section class="section">
            <h3 class="section-title">Activity {i + 1}</h3>

            <div class="field-row">
              <div class="field">
                <label class="label">Title</label>
                <input class="input" type="text" bind:value={editedItems[i].title} />
              </div>
              <div class="field field-sm">
                <label class="label">Type</label>
                <select class="input" bind:value={editedItems[i].activity_type}>
                  {#each ACTIVITY_TYPES as type}
                    <option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label class="label">Start date</label>
                <input class="input" type="date" bind:value={itemDates[i].startDate} />
              </div>
              <div class="field">
                <label class="label">Start time</label>
                <input class="input" type="time" bind:value={itemDates[i].startTime} />
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label class="label">End date</label>
                <input class="input" type="date" bind:value={itemDates[i].endDate} />
              </div>
              <div class="field">
                <label class="label">End time</label>
                <input class="input" type="time" bind:value={itemDates[i].endTime} />
              </div>
            </div>

            <div class="field">
              <label class="label">Location</label>
              <input class="input" type="text" bind:value={editedItems[i].location} />
            </div>

            <div class="field">
              <label class="label">Description</label>
              <textarea class="input textarea" bind:value={editedItems[i].description}></textarea>
            </div>
          </section>
        {/each}

        {#if confirmError}
          <p class="error-msg">{confirmError}</p>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeModal} disabled={confirming}>Cancel</button>
        <button class="btn-primary" onclick={handleConfirm} disabled={confirming}>
          {confirming ? 'Confirming…' : 'Confirm'}
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- Review Queue List -->
  <div class="review-page">
    <div class="page-header">
      <div class="page-header-row">
        <Icon name="review" size={22} class="page-header-icon" />
        <h1 class="page-title">Review Queue</h1>
      </div>
      <p class="page-subtitle">Emails that need your attention before activities are created.</p>
    </div>

    {#if loading}
      <div class="state-msg">Loading…</div>
    {:else if error}
      <div class="state-msg error">{error}</div>
    {:else if emails.length === 0}
      <div class="empty-state">
        <Icon name="review" size={48} class="empty-icon" />
        <p>No emails need review.</p>
        <p class="empty-hint">Keep forwarding your booking confirmations!</p>
      </div>
    {:else}
      <div class="email-list">
        {#each emails as email}
          <button class="email-card" onclick={() => openEmail(email)}>
            <div class="card-top">
              <span class="card-subject">{email.subject || '(no subject)'}</span>
              <span class="card-date">{formatDate(email.received_at)}</span>
            </div>
            <p class="card-summary">{activitySummary(email)}</p>
            <div class="reasons">
              {#each (email.parsed_data?.review_reasons || []) as reason}
                <span class="reason-pill">{reason}</span>
              {/each}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ===== List view ===== */
  .review-page {
    padding: 24px 20px;
    max-width: 680px;
    margin: 0 auto;
    overflow-y: auto;
    height: 100%;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .page-header-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 4px;
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    margin-left: 32px;
  }

  .state-msg {
    text-align: center;
    padding: 48px 0;
    color: var(--text-secondary);
  }

  .state-msg.error {
    color: var(--error);
  }

  .empty-state {
    text-align: center;
    padding: 64px 0;
    color: var(--text-secondary);
  }

  .empty-state p {
    margin: 4px 0;
    font-size: 16px;
  }

  .empty-hint {
    font-size: 13px !important;
  }

  .email-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .email-card {
    width: 100%;
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .email-card:hover {
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.12);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 6px;
  }

  .card-subject {
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
  }

  .card-date {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-summary {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 10px;
  }

  .reasons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .reason-pill {
    font-size: 11px;
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 20px;
    padding: 2px 10px;
  }

  /* ===== Modal ===== */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 200;
    padding: 0;
  }

  @media (min-width: 640px) {
    .modal-overlay {
      align-items: center;
      padding: 24px;
    }
  }

  .modal {
    background: var(--surface);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (min-width: 640px) {
    .modal {
      border-radius: 16px;
      max-width: 600px;
      max-height: 85vh;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 4px;
  }

  .modal-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-secondary);
    line-height: 1;
  }

  .modal-body {
    overflow-y: auto;
    padding: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-shrink: 0;
  }

  /* ===== Form elements ===== */
  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .field-sm {
    flex: 0 0 140px;
  }

  .field-row {
    display: flex;
    gap: 10px;
  }

  .label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .input {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text);
    background: var(--surface);
    width: 100%;
    box-sizing: border-box;
  }

  .input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .textarea {
    resize: vertical;
    min-height: 64px;
    font-family: inherit;
  }

  .new-trip-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .error-msg {
    color: var(--error);
    font-size: 13px;
    margin: 0;
  }

  .btn-primary {
    padding: 10px 20px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 10px 20px;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
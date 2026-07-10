const BASE = '';

let accessToken = localStorage.getItem('itinera_access_token') || null;
let refreshToken = localStorage.getItem('itinera_refresh_token') || null;

export function getTokens() {
  return { accessToken, refreshToken };
}

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('itinera_access_token', access);
  else localStorage.removeItem('itinera_access_token');
  if (refresh) localStorage.setItem('itinera_refresh_token', refresh);
  else localStorage.removeItem('itinera_refresh_token');
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('itinera_access_token');
  localStorage.removeItem('itinera_refresh_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setTokens(data.session.access_token, data.session.refresh_token);
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    } else {
      clearTokens();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Session expired');
    }
  }

  return res;
}

export async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  setTokens(data.session.access_token, data.session.refresh_token);
  return data.user;
}

export async function signup(email, password, full_name) {
  const res = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  return data;
}

export async function getMe() {
  const res = await request('/auth/me');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get user');
  return data;
}

export async function fetchTrips() {
  const res = await request('/trips');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch trips');
  return data.trips || [];
}

export async function fetchTripWithItems(tripId) {
  const res = await request(`/trips/${tripId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch trip');
  return data;
}

export async function deleteTrip(tripId) {
  const res = await request(`/trips/${tripId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete trip');
  return data;
}

export async function fetchReviewQueue() {
  const res = await request('/emails/review');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch review queue');
  return data.emails || [];
}

export async function fetchReviewCount() {
  const res = await request('/emails/review/count');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch review count');
  return data.count || 0;
}

export async function confirmReviewEmail(emailId, payload) {
  const res = await request(`/emails/${emailId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to confirm email');
  return data;
}

export function streamChat(message, history, callbacks) {
  if (!accessToken) throw new Error('Not authenticated');

  const controller = new AbortController();

  const doFetch = () =>
    fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message, history }),
      signal: controller.signal,
    });

  doFetch()
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 401 && refreshToken) {
          // Reuse the request helper's refresh logic
          const refreshRes = await request('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setTokens(data.session.access_token, data.session.refresh_token);
            const retryRes = await doFetch();
            if (!retryRes.ok) {
              const errData = await retryRes.json().catch(() => ({}));
              callbacks.onError?.(errData.error || 'Chat failed');
              return;
            }
            await readStream(retryRes, callbacks);
            return;
          }
          clearTokens();
          window.dispatchEvent(new CustomEvent('auth:expired'));
          callbacks.onError?.('Session expired');
          return;
        }
        const errData = await res.json().catch(() => ({}));
        callbacks.onError?.(errData.error || 'Chat failed');
        return;
      }
      await readStream(res, callbacks);
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err.message);
      }
    });

  return controller;
}

async function readStream(response, callbacks) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (done) break;

    buffer += decoder.decode(result.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
      else if (line.startsWith('data: ')) currentData = line.slice(6);
      else if (line === '') {
        if (currentEvent && currentData) {
          let data;
          try { data = JSON.parse(currentData); } catch { data = {}; }
          callbacks.onEvent?.(currentEvent, data);
        }
        currentEvent = '';
        currentData = '';
      }
    }
  }

  if (currentEvent && currentData) {
    let data;
    try { data = JSON.parse(currentData); } catch { data = {}; }
    callbacks.onEvent?.(currentEvent, data);
  }
}

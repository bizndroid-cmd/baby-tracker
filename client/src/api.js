const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function request(url, options = {}) {
  try {
    const res = await fetch(url, options);
    return handleResponse(res);
  } catch (err) {
    if (err.message.includes('Session expired') || err.message.includes('Unable to connect')) {
      throw err;
    }
    throw new Error('Unable to connect to server. Make sure the backend is running.');
  }
}

async function handleResponse(res) {
  let data;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Unable to connect to server. Make sure the backend is running.');
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(data?.error || `Server error (${res.status})`);
  }
  return data;
}

// Auth
export async function login(email, password) {
  return request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email, password, name) {
  return request(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
}

export async function getMe() {
  return request(`${API_BASE}/auth/me`, { headers: authHeaders() });
}

// Babies
export async function getBabies() {
  return request(`${API_BASE}/babies`, { headers: authHeaders() });
}

export async function createBaby(name, date_of_birth) {
  return request(`${API_BASE}/babies`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, date_of_birth }),
  });
}

export async function deleteBaby(id) {
  return request(`${API_BASE}/babies/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export async function updateBaby(id, data) {
  return request(`${API_BASE}/babies/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

// Feedings
export async function getFeedings(babyId) {
  return request(`${API_BASE}/feedings/${babyId}`, { headers: authHeaders() });
}

export async function addFeeding(babyId, data) {
  return request(`${API_BASE}/feedings/${babyId}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function deleteFeeding(babyId, feedingId) {
  return request(`${API_BASE}/feedings/${babyId}/${feedingId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export async function updateFeeding(babyId, feedingId, data) {
  return request(`${API_BASE}/feedings/${babyId}/${feedingId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

// Diapers
export async function getDiapers(babyId) {
  return request(`${API_BASE}/diapers/${babyId}`, { headers: authHeaders() });
}

export async function addDiaper(babyId, data) {
  return request(`${API_BASE}/diapers/${babyId}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function deleteDiaper(babyId, diaperId) {
  return request(`${API_BASE}/diapers/${babyId}/${diaperId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export async function updateDiaper(babyId, diaperId, data) {
  return request(`${API_BASE}/diapers/${babyId}/${diaperId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

// Stats
export async function getFeedingStats(babyId, { days, from, to } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', days);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request(`${API_BASE}/stats/feedings/${babyId}?${params}`, { headers: authHeaders() });
}

export async function getDiaperStats(babyId, { days, from, to } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', days);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request(`${API_BASE}/stats/diapers/${babyId}?${params}`, { headers: authHeaders() });
}

export async function getSleepStats(babyId, { days, from, to } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', days);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request(`${API_BASE}/stats/sleep/${babyId}?${params}`, { headers: authHeaders() });
}

// Sleep
export async function getSleepRecords(babyId) {
  return request(`${API_BASE}/sleep/${babyId}`, { headers: authHeaders() });
}

export async function addSleepRecord(babyId, data) {
  return request(`${API_BASE}/sleep/${babyId}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function updateSleepRecord(babyId, sleepId, data) {
  return request(`${API_BASE}/sleep/${babyId}/${sleepId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function deleteSleepRecord(babyId, sleepId) {
  return request(`${API_BASE}/sleep/${babyId}/${sleepId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

// Reports
export async function downloadReport(babyId, { days } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', days);
  const url = `${API_BASE}/reports/${babyId}?${params}`;

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    let error;
    try { error = JSON.parse(text).error; } catch { error = 'Download failed'; }
    throw new Error(error);
  }
  const blob = await res.blob();
  const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'report.csv';

  // Trigger download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

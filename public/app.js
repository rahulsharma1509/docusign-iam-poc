const HISTORY_KEY = 'docusign_iam_poc_history';

const state = {
  config: null,
  documentMode: 'generated',
  activeEnvelope: null,
  history: loadHistory(),
  poller: null
};

const $ = (selector) => document.querySelector(selector);
const els = {
  activeDocument: $('#activeDocument'),
  activeEnvelope: $('#activeEnvelope'),
  activeSigner: $('#activeSigner'),
  activeUpdated: $('#activeUpdated'),
  clearHistory: $('#clearHistory'),
  configBadge: $('#configBadge'),
  configPanel: $('#configPanel'),
  consentLink: $('#consentLink'),
  createButton: $('#createButton'),
  dealName: $('#dealName'),
  downloadButton: $('#downloadButton'),
  embeddedSigning: $('#embeddedSigning'),
  emptyState: $('#emptyState'),
  envelopeForm: $('#envelopeForm'),
  envelopeId: $('#envelopeId'),
  fileField: $('#fileField'),
  historyList: $('#historyList'),
  openSigningTab: $('#openSigningTab'),
  pdfFile: $('#pdfFile'),
  refreshButton: $('#refreshButton'),
  signButton: $('#signButton'),
  signerEmail: $('#signerEmail'),
  signerName: $('#signerName'),
  signingDrawer: $('#signingDrawer'),
  signingFrame: $('#signingFrame'),
  statusBadge: $('#statusBadge'),
  timeline: $('#timeline'),
  toast: $('#toast')
};

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 20)));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 4200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = payload?.error || payload || 'Request failed';
    const details = payload?.details ? ` ${JSON.stringify(payload.details)}` : '';
    throw new Error(`${message}${details}`);
  }

  return payload;
}

function statusClass(status = '') {
  const normalized = status.toLowerCase();
  if (['completed', 'declined', 'voided', 'delivered', 'sent'].includes(normalized)) return normalized;
  return '';
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isTerminal(status = '') {
  return ['completed', 'declined', 'voided'].includes(status.toLowerCase());
}

function upsertHistory(envelope) {
  state.history = [
    {
      envelopeId: envelope.envelopeId,
      status: envelope.status,
      signerName: envelope.signerName,
      signerEmail: envelope.signerEmail,
      clientUserId: envelope.clientUserId,
      documentName: envelope.documentName,
      dealName: envelope.dealName,
      updatedAt: envelope.updatedAt || new Date().toISOString(),
      embeddedSigning: envelope.embeddedSigning !== false
    },
    ...state.history.filter((item) => item.envelopeId !== envelope.envelopeId)
  ].slice(0, 20);

  saveHistory();
  renderHistory();
}

function renderConfig() {
  const config = state.config;
  if (!config) return;

  els.consentLink.href = config.consentUrl;

  if (config.configured) {
    els.configBadge.textContent = 'Configured';
    els.configBadge.className = 'status-pill completed';
    els.configPanel.classList.add('hidden');
    return;
  }

  els.configBadge.textContent = 'Config needed';
  els.configBadge.className = 'status-pill warning';
  els.configPanel.classList.remove('hidden');
  els.configPanel.textContent = `Missing: ${config.missing.join(', ')}`;
}

function renderActiveEnvelope() {
  const envelope = state.activeEnvelope;
  const hasEnvelope = Boolean(envelope?.envelopeId);

  els.emptyState.classList.toggle('hidden', hasEnvelope);
  els.activeEnvelope.classList.toggle('hidden', !hasEnvelope);
  if (!hasEnvelope) return;

  const status = envelope.status || 'sent';
  els.statusBadge.textContent = status;
  els.statusBadge.className = `status-pill ${statusClass(status)}`;
  els.envelopeId.textContent = envelope.envelopeId;
  els.activeSigner.textContent = `${envelope.signerName || 'Signer'} (${envelope.signerEmail || 'email not available'})`;
  els.activeDocument.textContent = envelope.documentName || envelope.dealName || 'Agreement';
  els.activeUpdated.textContent = formatDate(envelope.updatedAt || envelope.statusChangedDateTime || envelope.createdAt);
  els.signButton.disabled = envelope.embeddedSigning === false || isTerminal(status);
  els.downloadButton.disabled = status.toLowerCase() !== 'completed';

  const events = envelope.events?.length ? envelope.events : [{
    status,
    receivedAt: envelope.updatedAt || envelope.createdAt || new Date().toISOString(),
    eventType: 'local-state'
  }];

  els.timeline.innerHTML = events.slice(0, 6).map((event) => `
    <li>
      <span>${event.eventType || 'status'}: ${event.status || 'event-received'}</span>
      <time>${formatDate(event.receivedAt)}</time>
    </li>
  `).join('');
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = '<p class="history-meta">No envelopes yet.</p>';
    return;
  }

  els.historyList.innerHTML = state.history.map((item) => `
    <article class="history-item">
      <div>
        <strong>${item.dealName || item.documentName || 'Envelope'}</strong>
        <p class="history-meta">${item.signerName || 'Signer'} - ${item.signerEmail || 'email not available'}</p>
      </div>
      <span class="status-pill ${statusClass(item.status)}">${item.status || 'sent'}</span>
      <p class="history-meta mono">${item.envelopeId}</p>
      <div class="history-actions">
        <button class="ghost-button" type="button" data-load-envelope="${item.envelopeId}">Load</button>
        <button class="ghost-button" type="button" data-refresh-envelope="${item.envelopeId}">Refresh</button>
      </div>
    </article>
  `).join('');
}

function setDocumentMode(mode) {
  state.documentMode = mode;
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  els.fileField.classList.toggle('hidden', mode !== 'upload');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function createEnvelope(event) {
  event.preventDefault();

  els.createButton.disabled = true;
  els.createButton.textContent = 'Creating...';

  try {
    const body = {
      dealName: els.dealName.value.trim(),
      signerName: els.signerName.value.trim(),
      signerEmail: els.signerEmail.value.trim(),
      embeddedSigning: els.embeddedSigning.checked
    };

    if (state.documentMode === 'upload') {
      const file = els.pdfFile.files[0];
      if (!file) throw new Error('Choose a PDF or switch to generated PDF.');
      body.fileName = file.name;
      body.documentBase64 = await readFileAsDataUrl(file);
    }

    const envelope = await api('/api/envelopes', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    state.activeEnvelope = envelope;
    upsertHistory(envelope);
    renderActiveEnvelope();
    startPolling();
    showToast('Envelope created and sent.');
  } catch (error) {
    showToast(error.message);
  } finally {
    els.createButton.disabled = false;
    els.createButton.textContent = 'Create envelope';
  }
}

async function refreshEnvelope(envelopeId = state.activeEnvelope?.envelopeId) {
  if (!envelopeId) return;

  try {
    const local = state.history.find((item) => item.envelopeId === envelopeId) || state.activeEnvelope || {};
    const remote = await api(`/api/envelopes/${encodeURIComponent(envelopeId)}`);
    const merged = { ...local, ...remote };
    state.activeEnvelope = merged;
    upsertHistory(merged);
    renderActiveEnvelope();
    if (isTerminal(merged.status)) stopPolling();
  } catch (error) {
    showToast(error.message);
  }
}

async function startSigning() {
  const envelope = state.activeEnvelope;
  if (!envelope?.envelopeId) return;

  els.signButton.disabled = true;
  els.signButton.textContent = 'Opening...';

  try {
    const result = await api(`/api/envelopes/${encodeURIComponent(envelope.envelopeId)}/signing-url`, {
      method: 'POST',
      body: JSON.stringify({
        signerName: envelope.signerName,
        signerEmail: envelope.signerEmail,
        clientUserId: envelope.clientUserId
      })
    });

    els.signingFrame.src = result.url;
    els.openSigningTab.href = result.url;
    els.signingDrawer.classList.remove('hidden');
    els.signingDrawer.setAttribute('aria-hidden', 'false');
  } catch (error) {
    showToast(error.message);
  } finally {
    els.signButton.disabled = false;
    els.signButton.textContent = 'Focused signing';
  }
}

function closeSigningDrawer() {
  els.signingDrawer.classList.add('hidden');
  els.signingDrawer.setAttribute('aria-hidden', 'true');
  els.signingFrame.src = 'about:blank';
  refreshEnvelope();
}

function downloadEnvelope() {
  const envelopeId = state.activeEnvelope?.envelopeId;
  if (!envelopeId) return;
  window.open(`/api/envelopes/${encodeURIComponent(envelopeId)}/documents`, '_blank');
}

function loadEnvelopeFromHistory(envelopeId) {
  const envelope = state.history.find((item) => item.envelopeId === envelopeId);
  if (!envelope) return;
  state.activeEnvelope = envelope;
  renderActiveEnvelope();
  refreshEnvelope(envelopeId);
  startPolling();
}

function startPolling() {
  stopPolling();
  if (!state.activeEnvelope?.envelopeId || isTerminal(state.activeEnvelope.status)) return;
  state.poller = setInterval(() => refreshEnvelope(), 12000);
}

function stopPolling() {
  if (state.poller) clearInterval(state.poller);
  state.poller = null;
}

function bindEvents() {
  els.envelopeForm.addEventListener('submit', createEnvelope);
  els.refreshButton.addEventListener('click', () => refreshEnvelope());
  els.signButton.addEventListener('click', startSigning);
  els.downloadButton.addEventListener('click', downloadEnvelope);
  els.clearHistory.addEventListener('click', () => {
    state.history = [];
    saveHistory();
    renderHistory();
  });

  document.querySelectorAll('.mode-button').forEach((button) => {
    button.addEventListener('click', () => setDocumentMode(button.dataset.mode));
  });

  document.addEventListener('click', (event) => {
    const loadId = event.target.closest('[data-load-envelope]')?.dataset.loadEnvelope;
    const refreshId = event.target.closest('[data-refresh-envelope]')?.dataset.refreshEnvelope;
    if (loadId) loadEnvelopeFromHistory(loadId);
    if (refreshId) refreshEnvelope(refreshId);
    if (event.target.closest('[data-close-drawer]')) closeSigningDrawer();
  });
}

async function boot() {
  bindEvents();
  renderHistory();

  try {
    state.config = await api('/api/health');
    renderConfig();
  } catch (error) {
    showToast(error.message);
  }

  const params = new URLSearchParams(window.location.search);
  const returnedEnvelopeId = params.get('envelopeId');
  if (returnedEnvelopeId) {
    loadEnvelopeFromHistory(returnedEnvelopeId);
    window.history.replaceState({}, document.title, '/');
  }
}

boot();

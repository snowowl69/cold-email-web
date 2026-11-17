// ===== STATE =====
const state = {
  contacts: [],
  attachments: [],
  isHtml: false,
  isSending: false,
  eventSource: null
};

// ===== DOM READY =====
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSetup();
  initContacts();
  initTemplate();
  initAttachments();
  initSend();
  loadFromLocalStorage();
});

// ===== TAB NAVIGATION =====
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      // Update buttons
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Update panels
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('tab-' + tabId).classList.add('active');
      // Update send summary when switching to send tab
      if (tabId === 'send') updateSendSummary();
    });
  });
}

// ===== SETUP =====
function initSetup() {
  const toggleBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('app-password-input');

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = isPassword
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  });

  document.getElementById('save-setup-btn').addEventListener('click', () => {
    const gmail = document.getElementById('gmail-input').value.trim();
    const appPassword = document.getElementById('app-password-input').value.trim();
    const senderName = document.getElementById('sender-name-input').value.trim();

    if (!gmail || !appPassword) {
      showStatus('setup-status', 'Please fill in Gmail and App Password', 'error');
      return;
    }

    localStorage.setItem('pb_gmail', gmail);
    localStorage.setItem('pb_appPassword', appPassword);
    localStorage.setItem('pb_senderName', senderName);
    showStatus('setup-status', '✅ Configuration saved successfully!', 'success');
  });
}

function loadFromLocalStorage() {
  const gmail = localStorage.getItem('pb_gmail');
  const appPassword = localStorage.getItem('pb_appPassword');
  const senderName = localStorage.getItem('pb_senderName');

  if (gmail) document.getElementById('gmail-input').value = gmail;
  if (appPassword) document.getElementById('app-password-input').value = appPassword;
  if (senderName) document.getElementById('sender-name-input').value = senderName;
}

function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = 'status-msg ' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ===== CONTACTS =====
function initContacts() {
  const dropZone = document.getElementById('contacts-drop-zone');
  const fileInput = document.getElementById('contacts-file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) uploadContacts(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadContacts(fileInput.files[0]);
    fileInput.value = '';
  });

  document.getElementById('clear-contacts-btn').addEventListener('click', () => {
    state.contacts = [];
    renderContacts();
  });
}

async function uploadContacts(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload-contacts', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.contacts = data.contacts;
    renderContacts();
  } catch (err) {
    alert('Failed to upload contacts: ' + err.message);
  }
}

function renderContacts() {
  const card = document.getElementById('contacts-table-card');
  const tbody = document.getElementById('contacts-tbody');
  const count = document.getElementById('contacts-count');

  if (state.contacts.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  count.textContent = state.contacts.length + ' Contact' + (state.contacts.length !== 1 ? 's' : '') + ' Loaded';

  tbody.innerHTML = state.contacts.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.email)}</td>
      <td>${escapeHtml(c.company)}</td>
      <td>${escapeHtml(c.position)}</td>
      <td><button class="btn-remove" onclick="removeContact(${i})" title="Remove">✕</button></td>
    </tr>
  `).join('');

  updatePreview();
}

function removeContact(index) {
  state.contacts.splice(index, 1);
  renderContacts();
}

// ===== TEMPLATE =====
function initTemplate() {
  // Placeholder buttons
  document.querySelectorAll('.placeholder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.closest('.placeholder-buttons').dataset.target;
      const input = document.getElementById(target);
      const placeholder = btn.dataset.placeholder;

      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = input.value;
      input.value = text.substring(0, start) + placeholder + text.substring(end);
      input.focus();
      input.setSelectionRange(start + placeholder.length, start + placeholder.length);
      updatePreview();
    });
  });

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.isHtml = btn.dataset.mode === 'html';
      updatePreview();
    });
  });

  // Live preview on input
  document.getElementById('subject-input').addEventListener('input', updatePreview);
  document.getElementById('body-input').addEventListener('input', updatePreview);
}

function updatePreview() {
  const subject = document.getElementById('subject-input').value;
  const body = document.getElementById('body-input').value;
  const senderName = document.getElementById('sender-name-input').value || 'Your Name';

  const contact = state.contacts.length > 0
    ? state.contacts[0]
    : { name: 'John Doe', email: 'john@example.com', company: 'Acme Corp', position: 'Software Engineer' };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const replacePlaceholders = (text) => {
    return text
      .replace(/\{name\}/gi, contact.name)
      .replace(/\{company\}/gi, contact.company)
      .replace(/\{position\}/gi, contact.position)
      .replace(/\{date\}/gi, dateStr)
      .replace(/\{sender_name\}/gi, senderName);
  };

  const previewSubject = document.getElementById('preview-subject');
  const previewBody = document.getElementById('preview-body');
  const previewHint = document.getElementById('preview-hint');

  previewSubject.textContent = replacePlaceholders(subject) || 'Subject will appear here...';

  if (state.isHtml) {
    previewBody.innerHTML = replacePlaceholders(body) || 'Email body will appear here...';
  } else {
    previewBody.textContent = replacePlaceholders(body) || 'Email body will appear here...';
  }

  if (state.contacts.length > 0) {
    previewHint.textContent = `Previewing for: ${contact.name} (${contact.email})`;
  } else {
    previewHint.textContent = 'Preview shows sample data. Upload contacts for real preview.';
  }
}

// ===== ATTACHMENTS =====
function initAttachments() {
  const dropZone = document.getElementById('attachments-drop-zone');
  const fileInput = document.getElementById('attachments-file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) uploadAttachments(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadAttachments(fileInput.files);
    fileInput.value = '';
  });
}

async function uploadAttachments(files) {
  const formData = new FormData();
  Array.from(files).forEach(f => formData.append('files', f));

  try {
    const res = await fetch('/api/upload-attachments', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.attachments = [...state.attachments, ...data.files];
    renderAttachments();
  } catch (err) {
    alert('Failed to upload attachments: ' + err.message);
  }
}

function renderAttachments() {
  const list = document.getElementById('attachments-list');
  if (state.attachments.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = state.attachments.map((f, i) => `
    <div class="file-item">
      <div class="file-info">
        <span class="file-icon">📄</span>
        <span class="file-name">${escapeHtml(f.originalName)}</span>
        <span class="file-size">${formatSize(f.size)}</span>
      </div>
      <button class="btn-remove" onclick="removeAttachment(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

async function removeAttachment(index) {
  const file = state.attachments[index];
  try {
    await fetch('/api/attachments/' + file.filename, { method: 'DELETE' });
  } catch (e) { /* ignore */ }
  state.attachments.splice(index, 1);
  renderAttachments();
}

// ===== SEND =====
function initSend() {
  const delaySlider = document.getElementById('delay-slider');
  const delayValue = document.getElementById('delay-value');

  delaySlider.addEventListener('input', () => {
    delayValue.textContent = delaySlider.value;
  });

  document.getElementById('dry-run-toggle').addEventListener('change', updateSendSummary);
  document.getElementById('start-send-btn').addEventListener('click', startSending);
  document.getElementById('stop-send-btn').addEventListener('click', stopSending);
}

function updateSendSummary() {
  document.getElementById('summary-recipients').textContent = state.contacts.length;
  document.getElementById('summary-attachments').textContent = state.attachments.length;
  document.getElementById('summary-mode').textContent =
    document.getElementById('dry-run-toggle').checked ? '🔍 Dry Run' : '🟢 Live';
  document.getElementById('stat-pending').textContent = state.contacts.length;
}

async function startSending() {
  const gmail = localStorage.getItem('pb_gmail');
  const appPassword = localStorage.getItem('pb_appPassword');
  const senderName = localStorage.getItem('pb_senderName') || '';

  if (!gmail || !appPassword) {
    alert('Please configure Gmail credentials in the Setup tab first.');
    return;
  }
  if (state.contacts.length === 0) {
    alert('Please upload contacts first.');
    return;
  }

  const subject = document.getElementById('subject-input').value;
  const body = document.getElementById('body-input').value;

  if (!subject || !body) {
    alert('Please fill in the email subject and body in the Template tab.');
    return;
  }

  // Parse CC/BCC
  const ccRaw = document.getElementById('cc-input').value.trim();
  const bccRaw = document.getElementById('bcc-input').value.trim();
  const cc = ccRaw ? ccRaw.split(',').map(e => e.trim()).filter(Boolean) : [];
  const bcc = bccRaw ? bccRaw.split(',').map(e => e.trim()).filter(Boolean) : [];

  const delay = parseInt(document.getElementById('delay-slider').value) || 10;
  const limit = parseInt(document.getElementById('limit-input').value) || 0;
  const dryRun = document.getElementById('dry-run-toggle').checked;

  // Reset UI
  resetSendUI();
  state.isSending = true;
  document.getElementById('start-send-btn').style.display = 'none';
  document.getElementById('stop-send-btn').style.display = 'flex';

  // Connect SSE
  connectSSE();

  // Send request
  try {
    const res = await fetch('/api/send-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gmail,
        appPassword,
        senderName,
        subject,
        body,
        isHtml: state.isHtml,
        contacts: state.contacts,
        cc,
        bcc,
        attachments: state.attachments,
        delay,
        limit,
        dryRun
      })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      onSendComplete();
    }
  } catch (err) {
    alert('Failed to start sending: ' + err.message);
    onSendComplete();
  }
}

function connectSSE() {
  if (state.eventSource) state.eventSource.close();

  state.eventSource = new EventSource('/api/send-status');

  state.eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleSSEMessage(data);
  };

  state.eventSource.onerror = () => {
    // Connection lost, will auto-reconnect
  };
}

function handleSSEMessage(data) {
  const total = state.contacts.length;

  switch (data.type) {
    case 'connected':
      addLog('Connected to server', 'info');
      break;
    case 'info':
      addLog(data.message, 'info');
      break;
    case 'start':
      addLog(`Starting ${data.dryRun ? 'dry run' : 'sending'} for ${data.total} contacts...`, 'info');
      break;
    case 'sent':
    case 'dry-run':
      document.getElementById('stat-sent').textContent = data.sent;
      document.getElementById('stat-failed').textContent = data.failed;
      document.getElementById('stat-skipped').textContent = data.skipped;
      document.getElementById('stat-pending').textContent = Math.max(0, total - data.sent - data.failed - data.skipped);
      updateProgress(data.sent + data.failed + data.skipped, total);
      addLog(
        data.type === 'dry-run'
          ? `[DRY RUN] ${data.name} <${data.email}>`
          : `✅ Sent to ${data.name} <${data.email}>`,
        'sent'
      );
      break;
    case 'failed':
      document.getElementById('stat-sent').textContent = data.sent;
      document.getElementById('stat-failed').textContent = data.failed;
      document.getElementById('stat-skipped').textContent = data.skipped;
      document.getElementById('stat-pending').textContent = Math.max(0, total - data.sent - data.failed - data.skipped);
      updateProgress(data.sent + data.failed + data.skipped, total);
      addLog(`❌ Failed: ${data.name} <${data.email}> — ${data.error}`, 'failed');
      break;
    case 'skipped':
      document.getElementById('stat-sent').textContent = data.sent;
      document.getElementById('stat-failed').textContent = data.failed;
      document.getElementById('stat-skipped').textContent = data.skipped;
      document.getElementById('stat-pending').textContent = Math.max(0, total - data.sent - data.failed - data.skipped);
      updateProgress(data.sent + data.failed + data.skipped, total);
      addLog(`⏭️ Skipped: ${data.name} <${data.email}> — ${data.reason}`, 'skipped');
      break;
    case 'stopped':
      addLog(data.message, 'failed');
      onSendComplete();
      break;
    case 'complete':
      addLog(data.message, 'info');
      onSendComplete();
      break;
    case 'error':
      addLog(data.message, 'failed');
      onSendComplete();
      break;
  }
}

function updateProgress(current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('progress-bar').style.width = percent + '%';
  document.getElementById('progress-percent').textContent = percent + '%';
}

function addLog(message, type) {
  const container = document.getElementById('log-container');
  const empty = container.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'log-entry log-' + type;
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-msg">${escapeHtml(message)}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function resetSendUI() {
  document.getElementById('stat-sent').textContent = '0';
  document.getElementById('stat-failed').textContent = '0';
  document.getElementById('stat-pending').textContent = state.contacts.length;
  document.getElementById('stat-skipped').textContent = '0';
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-percent').textContent = '0%';
  document.getElementById('log-container').innerHTML = '<div class="log-empty">Starting...</div>';
}

function onSendComplete() {
  state.isSending = false;
  document.getElementById('start-send-btn').style.display = 'flex';
  document.getElementById('stop-send-btn').style.display = 'none';
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

async function stopSending() {
  try {
    await fetch('/api/stop', { method: 'POST' });
    addLog('⛔ Stop signal sent...', 'failed');
  } catch (err) {
    alert('Failed to stop: ' + err.message);
  }
}

// ===== UTILITIES =====
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

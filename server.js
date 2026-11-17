const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Upload directories
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const ATTACHMENTS_DIR = path.join(__dirname, 'uploads', 'attachments');
const SENT_LOG_FILE = path.join(__dirname, 'sent_log.json');

[UPLOAD_DIR, ATTACHMENTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer config for contacts
const contactsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, 'contacts_' + Date.now() + path.extname(file.originalname))
});
const uploadContacts = multer({
  storage: contactsStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only CSV and Excel files are allowed'));
  }
});

// Multer config for attachments
const attachmentsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ATTACHMENTS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const uploadAttachments = multer({ storage: attachmentsStorage });

// Sent log helpers
function loadSentLog() {
  try {
    if (fs.existsSync(SENT_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(SENT_LOG_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return [];
}

function saveSentLog(log) {
  fs.writeFileSync(SENT_LOG_FILE, JSON.stringify(log, null, 2));
}

// SSE clients
let sseClients = [];

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => res.write(msg));
}

// Sending state
let isSending = false;
let shouldStop = false;

// ===== ROUTES =====

// Upload contacts
app.post('/api/upload-contacts', uploadContacts.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Normalize column names
    const contacts = rawData.map((row, index) => {
      const normalized = {};
      Object.keys(row).forEach(key => {
        normalized[key.trim().toLowerCase()] = String(row[key]).trim();
      });
      return {
        id: index + 1,
        name: normalized.name || normalized['full name'] || normalized['contact name'] || '',
        email: normalized.email || normalized['email address'] || normalized['e-mail'] || '',
        company: normalized.company || normalized['company name'] || normalized.organization || '',
        position: normalized.position || normalized['job title'] || normalized.role || normalized.designation || ''
      };
    }).filter(c => c.email); // Filter out rows without email

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ contacts, total: contacts.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
});

// Upload attachments
app.post('/api/upload-attachments', uploadAttachments.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files.map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      path: f.path,
      size: f.size
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload attachments: ' + err.message });
  }
});

// Delete attachment
app.delete('/api/attachments/:filename', (req, res) => {
  const filePath = path.join(ATTACHMENTS_DIR, req.params.filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// SSE endpoint for real-time status
app.get('/api/send-status', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// Stop sending
app.post('/api/stop', (req, res) => {
  shouldStop = true;
  res.json({ success: true, message: 'Stop signal sent' });
});

// Placeholder replacement function
function replacePlaceholders(text, contact, senderName) {
  if (!text) return text;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return text
    .replace(/\{name\}/gi, contact.name || '')
    .replace(/\{company\}/gi, contact.company || '')
    .replace(/\{position\}/gi, contact.position || '')
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{sender_name\}/gi, senderName || '');
}

// Send emails
app.post('/api/send-emails', async (req, res) => {
  if (isSending) {
    return res.status(409).json({ error: 'Already sending emails. Please wait or stop the current batch.' });
  }

  const {
    gmail,
    appPassword,
    senderName,
    subject,
    body,
    isHtml,
    contacts,
    cc,
    bcc,
    attachments,
    delay,
    limit,
    dryRun
  } = req.body;

  // Validation
  if (!gmail || !appPassword) {
    return res.status(400).json({ error: 'Gmail and App Password are required' });
  }
  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'No contacts provided' });
  }
  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and body are required' });
  }

  isSending = true;
  shouldStop = false;

  // Respond immediately
  res.json({ success: true, message: dryRun ? 'Dry run started' : 'Sending started', total: contacts.length });

  // Send emails in background
  const sentLog = loadSentLog();
  const sentEmails = new Set(sentLog.map(e => e.email));
  const delayMs = (delay || 10) * 1000;
  const sendLimit = limit && limit > 0 ? limit : contacts.length;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Create transporter
  let transporter = null;
  if (!dryRun) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmail,
        pass: appPassword
      }
    });

    // Verify connection
    try {
      await transporter.verify();
      broadcastSSE({ type: 'info', message: '✅ SMTP connection verified successfully' });
    } catch (err) {
      broadcastSSE({ type: 'error', message: '❌ SMTP connection failed: ' + err.message });
      isSending = false;
      return;
    }
  }

  // Prepare attachment list
  const mailAttachments = (attachments || []).map(a => ({
    filename: a.originalName,
    path: a.path
  })).filter(a => fs.existsSync(a.path));

  broadcastSSE({
    type: 'start',
    total: Math.min(contacts.length, sendLimit),
    dryRun: !!dryRun
  });

  for (let i = 0; i < contacts.length && sent + failed + skipped < sendLimit; i++) {
    if (shouldStop) {
      broadcastSSE({ type: 'stopped', message: '⛔ Sending stopped by user', sent, failed, skipped });
      break;
    }

    const contact = contacts[i];

    // Check duplicate
    if (sentEmails.has(contact.email)) {
      skipped++;
      broadcastSSE({
        type: 'skipped',
        index: i + 1,
        email: contact.email,
        name: contact.name,
        reason: 'Already sent (duplicate)',
        sent, failed, skipped
      });
      continue;
    }

    const personalizedSubject = replacePlaceholders(subject, contact, senderName);
    const personalizedBody = replacePlaceholders(body, contact, senderName);

    if (dryRun) {
      sent++;
      broadcastSSE({
        type: 'dry-run',
        index: i + 1,
        email: contact.email,
        name: contact.name,
        subject: personalizedSubject,
        bodyPreview: personalizedBody.substring(0, 200),
        sent, failed, skipped
      });
    } else {
      try {
        const mailOptions = {
          from: `"${senderName || 'Placement Bot'}" <${gmail}>`,
          to: contact.email,
          subject: personalizedSubject,
          ...(isHtml ? { html: personalizedBody } : { text: personalizedBody }),
          ...(cc && cc.length > 0 ? { cc: cc.join(', ') } : {}),
          ...(bcc && bcc.length > 0 ? { bcc: bcc.join(', ') } : {}),
          ...(mailAttachments.length > 0 ? { attachments: mailAttachments } : {})
        };

        await transporter.sendMail(mailOptions);
        sent++;

        // Log to sent_log
        const logEntry = {
          email: contact.email,
          name: contact.name,
          company: contact.company,
          subject: personalizedSubject,
          sentAt: new Date().toISOString()
        };
        sentLog.push(logEntry);
        sentEmails.add(contact.email);
        saveSentLog(sentLog);

        broadcastSSE({
          type: 'sent',
          index: i + 1,
          email: contact.email,
          name: contact.name,
          sent, failed, skipped
        });
      } catch (err) {
        failed++;
        broadcastSSE({
          type: 'failed',
          index: i + 1,
          email: contact.email,
          name: contact.name,
          error: err.message,
          sent, failed, skipped
        });
      }
    }

    // Delay between emails (except after last one)
    if (i < contacts.length - 1 && sent + failed + skipped < sendLimit && !shouldStop) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  broadcastSSE({
    type: 'complete',
    message: dryRun ? '✅ Dry run complete' : '✅ All emails processed',
    sent, failed, skipped
  });

  isSending = false;
  shouldStop = false;
});

// Clear sent log
app.delete('/api/sent-log', (req, res) => {
  saveSentLog([]);
  res.json({ success: true });
});

// Get sent log
app.get('/api/sent-log', (req, res) => {
  res.json(loadSentLog());
});

app.listen(PORT, () => {
  console.log(`\n  🚀 Placement Email Bot running at http://localhost:${PORT}\n`);
});

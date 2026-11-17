# 🌐 Cold Email & Placement Bot — Web Application & Dispatcher

A full-stack Node.js and Express web application featuring a multi-tab outreach workspace, dynamic template engine, CSV contact importer, live throttled dispatching, and campaign analytics.

---

## ✨ Features

- **Multi-Tab Dashboard**:
  - **Setup**: Configure SMTP credentials (e.g. Gmail App Password, Custom SMTP), sender name, and batch throttle delays.
  - **Contacts**: Import contacts via CSV or Excel (`sample-data/`), with real-time table preview, search, and validation.
  - **Template**: Rich email editor supporting dynamic placeholders (`{{name}}`, `{{company}}`, `{{role}}`).
  - **Attachments**: Attach resumes (PDF), portfolios, and cover letters.
  - **Send**: Controlled batch sending with delay pacing to avoid spam triggers, live progress bars, and real-time logs.
- **Visual Analytics**: Interactive campaign dashboard (`project-visualization.html`) visualizing delivery status, response tracking, and campaign timelines.
- **Offline Safe**: Generates local delivery logs (`sent_log.json`) without leaking data to third parties.

---

## 🛠️ Project Structure

```text
cold-email-web/
├── server.js                   # Express backend handling SMTP & file uploads
├── index.html                  # Multi-tab single page application interface
├── index.css                   # Custom dark-mode UI design system
├── app.js                      # Client-side state, form handling, and API integration
├── templates/                  # Pre-built email templates (HTML & text)
│   ├── default.html
│   └── default.txt
├── sample-data/                # Sample recruiter lists for testing (CSV/XLSX)
├── project-visualization.html  # Interactive campaign analytics report
└── package.json                # Server dependencies (Express, Nodemailer, Multer)
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **npm**

### 2. Installation
```bash
cd cold-email-web
npm install
```

### 3. Running the Server
```bash
npm start
```
By default, the server starts at: **`http://localhost:3000`**

### 4. Configuration (Gmail SMTP)
1. Go to your Google Account > **Security** > **2-Step Verification** > **App passwords**.
2. Generate an App Password for "Mail".
3. Enter your Gmail address and 16-character App Password in the **Setup** tab of the dashboard.

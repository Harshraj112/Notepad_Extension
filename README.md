# 📚 StudyNotes Pro – A Smart Notepad for Students

> **Built by a student, for students.**  
> Take notes while watching YouTube, Udemy lectures, or reading blog articles — without switching tabs.

---

## 🎯 Problem

While learning from platforms like **YouTube** or **Udemy**, it's easy to lose focus when switching between tabs or trying to note things down in Google Docs or a physical notebook.

So, I built **StudyNotes Pro** — a Chrome extension that keeps your notes right on the page, always in context.

---

## 🚀 Features

### ✅ 1. Auto-Detect & Smart Heading
- Automatically fetches `<title>`, `<h1>`, or `<h2>` from the page.
- Users can manually edit the heading.
- Toggle: “Auto-Detect Title” ON/OFF.
- Prompts: “Start a new note for this page?”

### 📝 2. Persistent Notes per Page
- Notes are stored per page URL or heading.
- Supports `chrome.storage.sync` or `localStorage`.
- Auto-load notes when revisiting the same page.
- “Last 5 Notes” history panel (with date & title).

### 🧠 3. Keyword Highlighter & AI Suggestions
- Highlights keywords like `summary`, `important`, `definition`, `formula`.
- Click to instantly copy them into your note.
- Smart Summary (AI-generated bullet points) *(future scope)*

### 🖼️ 4. Floating Notepad UI
- 1/4 screen draggable and resizable notepad.
- Controls:
  - 🖉 Edit Heading
  - 📁 Save / Auto Save
  - ⬆ Collapse / ⬇ Expand
  - 🌙 Dark Mode
  - 🔖 Pin (Always on Top)
- Position anywhere: left, right, bottom.
- Slim version: heading + icon only.

### 🔒 5. Privacy / Ephemeral Mode
- Disable saving notes on selected domains.
- Auto-delete notes after tab closes (temporary mode).

### ☁️ 6. Export & Backup
- Export all notes as:
  - 📄 PDF
  - 📜 Plain text
  - 🧠 Markdown
- *(Optional: Google Drive / Notion integration)*

### 🔍 7. Tags & Search
- Use `#tags` like `#DSA`, `#Lecture3`, `#Physics`
- Search bar filters notes by title, tag, or content.

### 🎨 8. Themes / Custom UI
- Light / Dark / High Contrast modes.
- Font size control.
- Student-friendly fonts: JetBrains Mono, Inter.

### 🚨 9. Focus Mode (Distraction-Free)
- Dims everything except video/notes.
- Optional block on social media: “You're in focus mode 🚫”

---

## 🔧 Tech Stack

- JavaScript (ES6+)
- HTML5, CSS3 (Resizable, draggable UI)
- Chrome Extensions API (`manifest v3`)
- `chrome.storage.sync` & `localStorage`
- *(Optional integrations planned: GPT API, Notion API)*

---

## 📥 Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/studynotes-pro.git

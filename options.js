// StudyNotes Pro - Options Page Script

class StudyNotesOptions {
  constructor() {
    this.settings = {};
    this.stats = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadStats();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['studyNotesSettings']);
      this.settings = result.studyNotesSettings || this.getDefaultSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
    }
  }

  getDefaultSettings() {
    return {
      autoDetect: true,
      keywordHighlight: true,
      autoSave: true,
      newPageNotifications: true,
      autosaveInterval: 2,
      darkMode: false,
      pinned: false,
      fontSize: 14,
      fontFamily: 'Inter',
      primaryColor: '#667eea',
      accentColor: '#764ba2',
      focusMode: true,
      dimBackground: false,
      blockedSites: ['facebook.com', 'twitter.com', 'instagram.com', 'reddit.com'],
      focusDuration: 25,
      globalShortcuts: true,
      developerMode: false,
      privacyMode: true,
      maxNotes: 500,
      cleanupDays: 90,
      youtubeIntegration: true,
      udemyIntegration: true
    };
  }

  async loadStats() {
    try {
      const result = await chrome.storage.sync.get(['studyNotesData']);
      const notesData = result.studyNotesData || {};
      this.stats = {
        totalNotes: Object.keys(notesData).length,
        totalWords: this.calculateTotalWords(notesData),
        studySessions: this.calculateStudySessions(notesData),
        platformsUsed: this.calculateUniquePlatforms(notesData)
      };
    } catch (error) {
      console.error('Failed to load stats:', error);
      this.stats = { totalNotes: 0, totalWords: 0, studySessions: 0, platformsUsed: 0 };
    }
  }

  calculateTotalWords(notesData) {
    return Object.values(notesData).reduce((total, note) => {
      if (!note.content) return total;
      const words = note.content.trim().split(/\s+/).length;
      return total + (note.content.trim() ? words : 0);
    }, 0);
  }

  calculateStudySessions(notesData) {
    const uniqueDays = new Set();
    Object.values(notesData).forEach(note => {
      if (note.timestamp) {
        const day = new Date(note.timestamp).toDateString();
        uniqueDays.add(day);
      }
    });
    return uniqueDays.size;
  }

  calculateUniquePlatforms(notesData) {
    const platforms = new Set();
    Object.values(notesData).forEach(note => {
      if (note.platform) {
        platforms.add(note.platform);
      }
    });
    return platforms.size;
  }

  setupEventListeners() {
    // Toggle switches
    this.setupToggle('auto-detect-toggle', 'autoDetect');
    this.setupToggle('keyword-highlight-toggle', 'keywordHighlight');
    this.setupToggle('auto-save-toggle', 'autoSave');
    this.setupToggle('new-page-notifications-toggle', 'newPageNotifications');
    this.setupToggle('dark-mode-toggle', 'darkMode');
    this.setupToggle('pin-toggle', 'pinned');
    this.setupToggle('focus-mode-toggle', 'focusMode');
    this.setupToggle('dim-background-toggle', 'dimBackground');
    this.setupToggle('global-shortcuts-toggle', 'globalShortcuts');
    this.setupToggle('developer-mode-toggle', 'developerMode');
    this.setupToggle('privacy-mode-toggle', 'privacyMode');
    this.setupToggle('youtube-integration-toggle', 'youtubeIntegration');
    this.setupToggle('udemy-integration-toggle', 'udemyIntegration');

    // Input fields
    this.setupInput('autosave-interval', 'autosaveInterval', 'number');
    this.setupInput('font-size-select', 'fontSize', 'select');
    this.setupInput('font-family-select', 'fontFamily', 'select');
    this.setupInput('primary-color', 'primaryColor', 'color');
    this.setupInput('accent-color', 'accentColor', 'color');
    this.setupInput('blocked-sites', 'blockedSites', 'textarea');
    this.setupInput('focus-duration', 'focusDuration', 'number');
    this.setupInput('max-notes', 'maxNotes', 'number');
    this.setupInput('cleanup-days', 'cleanupDays', 'number');

    // Action buttons
    document.getElementById('export-json').addEventListener('click', () => this.exportData('json'));
    document.getElementById('export-csv').addEventListener('click', () => this.exportData('csv'));
    document.getElementById('export-pdf').addEventListener('click', () => this.exportData('pdf'));
    document.getElementById('import-file').addEventListener('change', (e) => this.importData(e));
    document.getElementById('clear-all-data').addEventListener('click', () => this.clearAllData());
    document.getElementById('reset-settings').addEventListener('click', () => this.resetSettings());
    document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('reset-to-defaults').addEventListener('click', () => this.resetToDefaults());

    // If options.html has tab navigation, handle tab switching
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabLinks.length && tabContents.length) {
      tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = link.getAttribute('data-tab');
          tabLinks.forEach(l => l.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));
          link.classList.add('active');
          const content = document.getElementById(target);
          if (content) content.classList.add('active');
        });
      });
    }
  }

  setupToggle(elementId, settingKey) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.addEventListener('click', () => {
      this.settings[settingKey] = !this.settings[settingKey];
      this.updateToggleUI(element, this.settings[settingKey]);
      this.saveSettings();
    });
  }

  setupInput(elementId, settingKey, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.addEventListener('change', () => {
      let value = element.value;
      if (type === 'number') {
        value = parseInt(value);
      } else if (type === 'textarea' && settingKey === 'blockedSites') {
        value = value.split('\n').map(site => site.trim()).filter(site => site);
      }
      this.settings[settingKey] = value;
      this.saveSettings();
    });
  }

  updateUI() {
    this.updateStatsUI();
    this.updateSettingsUI();
    // If options.html has a preview area for theme, update it
    this.updateThemePreview();
  }

  updateStatsUI() {
    const totalNotes = document.getElementById('total-notes-stat');
    const totalWords = document.getElementById('total-words-stat');
    const studySessions = document.getElementById('study-sessions-stat');
    const platforms = document.getElementById('platforms-stat');
    if (totalNotes) totalNotes.textContent = this.stats.totalNotes;
    if (totalWords) totalWords.textContent = this.formatNumber(this.stats.totalWords);
    if (studySessions) studySessions.textContent = this.stats.studySessions;
    if (platforms) platforms.textContent = this.stats.platformsUsed;
  }

  updateSettingsUI() {
    // Update toggle switches
    Object.keys(this.settings).forEach(key => {
      const element = document.getElementById(`${this.camelToKebab(key)}-toggle`);
      if (element && typeof this.settings[key] === 'boolean') {
        this.updateToggleUI(element, this.settings[key]);
      }
    });

    // Update input fields
    const inputs = {
      'autosave-interval': this.settings.autosaveInterval,
      'font-size-select': this.settings.fontSize,
      'font-family-select': this.settings.fontFamily,
      'primary-color': this.settings.primaryColor,
      'accent-color': this.settings.accentColor,
      'blocked-sites': Array.isArray(this.settings.blockedSites) ? this.settings.blockedSites.join('\n') : '',
      'focus-duration': this.settings.focusDuration,
      'max-notes': this.settings.maxNotes,
      'cleanup-days': this.settings.cleanupDays
    };

    Object.entries(inputs).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = value;
      }
    });
  }

  updateToggleUI(element, isActive) {
    element.classList.toggle('active', isActive);
    // If options.html uses aria-pressed for accessibility
    element.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }

  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({ studyNotesSettings: this.settings });
      this.showNotification('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showNotification('Failed to save settings', 'error');
    }
  }

  async exportData(format) {
    try {
      const result = await chrome.storage.sync.get(['studyNotesData']);
      const notesData = result.studyNotesData || {};
      if (Object.keys(notesData).length === 0) {
        this.showNotification('No notes to export', 'error');
        return;
      }
      let exportContent, fileName, mimeType;
      switch (format) {
        case 'json':
          exportContent = JSON.stringify(notesData, null, 2);
          fileName = `studynotes-backup-${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;
        case 'csv':
          exportContent = this.convertToCSV(notesData);
          fileName = `studynotes-export-${new Date().toISOString().split('T')[0]}.csv`;
          mimeType = 'text/csv';
          break;
        case 'pdf':
          this.exportAsPDF(notesData);
          return;
      }
      this.downloadFile(exportContent, fileName, mimeType);
      this.showNotification(`Notes exported as ${format.toUpperCase()}!`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed', 'error');
    }
  }

  convertToCSV(notesData) {
    const notes = Object.values(notesData);
    const headers = ['Title', 'URL', 'Platform', 'Content', 'Tags', 'Date', 'Word Count'];
    const csvRows = [headers.join(',')];
    notes.forEach(note => {
      const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;
      const row = [
        this.escapeCSV(note.title || ''),
        this.escapeCSV(note.url || ''),
        this.escapeCSV(note.platform || ''),
        this.escapeCSV(note.content || ''),
        this.escapeCSV((note.tags || []).join('; ')),
        this.escapeCSV(new Date(note.timestamp).toLocaleString()),
        wordCount
      ];
      csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
  }

  escapeCSV(text) {
    if (typeof text !== 'string') return text;
    return `"${text.replace(/"/g, '""')}"`;
  }

  exportAsPDF(notesData) {
    const htmlContent = this.generatePDFHTML(notesData);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studynotes-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => {
      this.showNotification('HTML file downloaded. Open in browser and print to PDF.', 'success');
    }, 500);
  }

  generatePDFHTML(notesData) {
    const notes = Object.values(notesData);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>StudyNotes Pro Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 40px; }
          .note { page-break-after: always; margin-bottom: 40px; }
          .note:last-child { page-break-after: auto; }
          .note-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #667eea; }
          .note-meta { font-size: 12px; color: #666; margin-bottom: 20px; }
          .note-content { white-space: pre-wrap; }
          .tags { margin: 10px 0; }
          .tag { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; margin-right: 5px; }
          @media print {
            body { margin: 20px; }
            .note { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 StudyNotes Pro Export</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>Total Notes: ${notes.length}</p>
        </div>
        ${notes.map(note => `
          <div class="note">
            <div class="note-title">${note.title || 'Untitled'}</div>
            <div class="note-meta">
              <strong>Platform:</strong> ${note.platform || 'Unknown'} | 
              <strong>Date:</strong> ${new Date(note.timestamp).toLocaleString()} |
              <strong>Words:</strong> ${note.content ? note.content.trim().split(/\s+/).length : 0}
              <br><strong>URL:</strong> ${note.url || 'No URL'}
            </div>
            ${note.tags && note.tags.length > 0 ? 
              `<div class="tags">
                ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
              </div>` : ''
            }
            <div class="note-content">${note.content || 'No content'}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
  }

  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const content = await this.readFileContent(file);
      const importData = JSON.parse(content);
      if (typeof importData !== 'object') {
        throw new Error('Invalid file format');
      }
      const result = await chrome.storage.sync.get(['studyNotesData']);
      const existingData = result.studyNotesData || {};
      const mergedData = { ...existingData, ...importData };
      await chrome.storage.sync.set({ studyNotesData: mergedData });
      const importCount = Object.keys(importData).length;
      this.showNotification(`Successfully imported ${importCount} notes!`, 'success');
      // Refresh stats
      await this.loadStats();
      this.updateStatsUI();
    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('Import failed: Invalid file format', 'error');
    }
    // Reset file input
    event.target.value = '';
  }

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(e);
      reader.readAsText(file);
    });
  }

  async clearAllData() {
    if (confirm('Are you sure you want to delete all notes? This cannot be undone.')) {
      await chrome.storage.sync.remove(['studyNotesData']);
      await chrome.storage.sync.remove(['studyNotesSettings']);
      this.showNotification('All notes and settings cleared!', 'success');
      await this.loadStats();
      this.updateUI();
    }
  }

  async resetSettings() {
    if (confirm('Are you sure you want to reset all settings?')) {
      this.settings = this.getDefaultSettings();
      await chrome.storage.sync.set({ studyNotesSettings: this.settings });
      this.showNotification('Settings reset to defaults!', 'success');
      this.updateUI();
    }
  }

  async resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      this.settings = this.getDefaultSettings();
      await chrome.storage.sync.set({ studyNotesSettings: this.settings });
      this.showNotification('Settings reset to defaults!', 'success');
      this.updateUI();
    }
  }

  showNotification(message, type) {
    // Remove any existing notification
    const old = document.querySelector('.notification');
    if (old) old.remove();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade');
      setTimeout(() => notification.remove(), 500);
    }, 2500);
  }

  // If options.html has a live theme preview, update it
  updateThemePreview() {
    const preview = document.getElementById('theme-preview');
    if (!preview) return;
    preview.style.backgroundColor = this.settings.primaryColor;
    preview.style.color = this.settings.darkMode ? '#fff' : '#222';
    preview.style.fontFamily = this.settings.fontFamily;
    preview.style.fontSize = this.settings.fontSize + 'px';
    // Accent color example
    const accent = preview.querySelector('.accent');
    if (accent) accent.style.color = this.settings.accentColor;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.studyNotesOptions = new StudyNotesOptions();
});
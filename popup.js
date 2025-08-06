// StudyNotes Pro - Popup Script

class StudyNotesPopup {
  constructor() {
    this.currentTab = null;
    this.settings = {};
    this.stats = {};
    this.init();
  }

  async init() {
    await this.getCurrentTab();
    await this.loadSettings();
    await this.loadStats();
    this.setupEventListeners();
    this.updateUI();
    this.hideLoading();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      this.showError('Failed to get current tab');
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['studyNotesSettings']);
      this.settings = result.studyNotesSettings || {
        autoDetect: true,
        darkMode: false,
        pinned: false
      };
    } catch (error) {
      this.showError('Failed to load settings');
    }
  }

  async loadStats() {
    try {
      const result = await chrome.storage.sync.get(['studyNotesData']);
      const notesData = result.studyNotesData || {};
      
      this.stats = {
        totalNotes: Object.keys(notesData).length,
        wordsWritten: this.calculateTotalWords(notesData),
        studySessions: this.calculateStudySessions(notesData),
        platformsUsed: this.calculateUniquePlatforms(notesData)
      };
    } catch (error) {
      this.showError('Failed to load statistics');
    }
  }

  calculateTotalWords(notesData) {
    return Object.values(notesData).reduce((total, note) => {
      const words = note.content ? note.content.trim().split(/\s+/).length : 0;
      return total + (note.content.trim() ? words : 0);
    }, 0);
  }

  calculateStudySessions(notesData) {
    // Count unique days with notes
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
    // Main toggle button
    document.getElementById('toggle-notepad').addEventListener('click', () => {
      this.toggleNotepad();
    });

    // Quick action buttons
    document.getElementById('smart-summary').addEventListener('click', () => {
      this.sendMessageToTab('generateSmartSummary');
    });

    document.getElementById('extract-keywords').addEventListener('click', () => {
      this.sendMessageToTab('extractKeywords');
    });

    document.getElementById('focus-mode').addEventListener('click', () => {
      this.sendMessageToTab('toggleFocusMode');
    });

    document.getElementById('export-notes').addEventListener('click', () => {
      this.exportNotes();
    });

    // Settings toggles
    document.getElementById('auto-detect-toggle').addEventListener('click', () => {
      this.toggleSetting('autoDetect');
    });

    document.getElementById('dark-mode-toggle').addEventListener('click', () => {
      this.toggleSetting('darkMode');
    });

    document.getElementById('pin-toggle').addEventListener('click', () => {
      this.toggleSetting('pinned');
    });

    // Options page
    document.getElementById('open-options').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  async toggleNotepad() {
    try {
      // First, try to send message to existing content script
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'toggleNotepad'
      });
      
      // Update UI based on response
      setTimeout(() => {
        this.checkNotepadStatus();
      }, 500);
      
    } catch (error) {
      // Content script not loaded, inject it first
      try {
        await chrome.scripting.executeScript({
          target: { tabId: this.currentTab.id },
          files: ['content.js']
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: this.currentTab.id },
          files: ['styles.css']
        });
        
        // Wait a bit for injection to complete
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
              action: 'toggleNotepad'
            });
            
            setTimeout(() => {
              this.checkNotepadStatus();
            }, 500);
            
          } catch (retryError) {
            this.showError('Failed to activate notepad. Please try again.');
          }
        }, 100);
        
      } catch (injectionError) {
        console.error('Injection failed:', injectionError);
        this.showError('Cannot run on this page type. Try a regular webpage.');
      }
    }
  }

  async checkNotepadStatus() {
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getStatus'
      });
      
      if (response) {
        const toggleBtn = document.getElementById('toggle-notepad');
        const toggleText = document.getElementById('toggle-text');
        
        if (response.active) {
          toggleText.textContent = 'Close Notepad';
          toggleBtn.style.background = 'rgba(255, 255, 255, 0.7)';
        } else {
          toggleText.textContent = 'Open Notepad';
          toggleBtn.style.background = 'rgba(255, 255, 255, 0.9)';
        }
        
        // Update page info
        if (response.title) {
          document.getElementById('page-title').textContent = response.title;
        }
      }
    } catch (error) {
      // Notepad not active or page needs refresh
    }
  }

  async sendMessageToTab(action) {
    try {
      // First, try to send message to existing content script
      await chrome.tabs.sendMessage(this.currentTab.id, { action });
      this.showSuccess(`${action} activated!`);
      
    } catch (error) {
      // Content script not loaded, inject it first
      try {
        await chrome.scripting.executeScript({
          target: { tabId: this.currentTab.id },
          files: ['content.js']
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: this.currentTab.id },
          files: ['styles.css']
        });
        
        // Wait for injection to complete
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(this.currentTab.id, { action });
            this.showSuccess(`${action} activated!`);
          } catch (retryError) {
            this.showError('Failed to activate feature. Please try again.');
          }
        }, 100);
        
      } catch (injectionError) {
        this.showError('Cannot run on this page type. Try a regular webpage.');
      }
    }
  }

  async toggleSetting(settingName) {
    this.settings[settingName] = !this.settings[settingName];
    
    try {
      await chrome.storage.sync.set({ studyNotesSettings: this.settings });
      this.updateSettingsUI();
      
      // Send update to content script
      if (this.currentTab) {
        chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'updateSettings',
          settings: this.settings
        }).catch(() => {
          // Ignore if content script not loaded
        });
      }
      
    } catch (error) {
      this.showError('Failed to save settings');
      // Revert the change
      this.settings[settingName] = !this.settings[settingName];
    }
  }

  async exportNotes() {
    try {
      const result = await chrome.storage.sync.get(['studyNotesData']);
      const notesData = result.studyNotesData || {};
      
      if (Object.keys(notesData).length === 0) {
        this.showError('No notes to export');
        return;
      }
      
      // Simple JSON export
      const dataStr = JSON.stringify(notesData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `studynotes-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showSuccess('Notes exported successfully!');
      
    } catch (error) {
      this.showError('Failed to export notes');
    }
  }

  updateUI() {
    this.updateSettingsUI();
    this.updateStatsUI();
    this.updatePageInfo();
    this.checkNotepadStatus();
  }

  updateSettingsUI() {
    // Update toggle switches
    const autoDetectToggle = document.getElementById('auto-detect-toggle');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const pinToggle = document.getElementById('pin-toggle');
    
    autoDetectToggle.classList.toggle('active', this.settings.autoDetect);
    darkModeToggle.classList.toggle('active', this.settings.darkMode);
    pinToggle.classList.toggle('active', this.settings.pinned);
  }

  updateStatsUI() {
    document.getElementById('total-notes').textContent = this.stats.totalNotes;
    document.getElementById('words-written').textContent = this.formatNumber(this.stats.wordsWritten);
    document.getElementById('study-sessions').textContent = this.stats.studySessions;
    document.getElementById('platforms-used').textContent = this.stats.platformsUsed;
  }

  updatePageInfo() {
    if (this.currentTab) {
      const title = this.currentTab.title || 'Unknown Page';
      const url = this.currentTab.url || '';
      
      // Detect platform
      let platform = 'Web';
      if (url.includes('youtube.com')) platform = '📺 YouTube';
      else if (url.includes('udemy.com')) platform = '🎓 Udemy';
      else if (url.includes('coursera.org')) platform = '🎓 Coursera';
      else if (url.includes('edx.org')) platform = '🎓 edX';
      else if (url.includes('khanacademy.org')) platform = '🎓 Khan Academy';
      else if (url.includes('medium.com')) platform = '📖 Medium';
      
      document.getElementById('page-title').textContent = title.length > 40 ? 
        title.substring(0, 40) + '...' : title;
      document.getElementById('page-platform').textContent = platform;
    }
  }

  formatNumber(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    setTimeout(() => {
      errorDiv.classList.add('hidden');
    }, 3000);
  }

  showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
    
    setTimeout(() => {
      successDiv.classList.add('hidden');
    }, 2000);
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StudyNotesPopup();
});

// Handle keyboard shortcuts in popup
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
});

// Auto-refresh stats periodically
setInterval(async () => {
  try {
    const popup = window.studyNotesPopup;
    if (popup) {
      await popup.loadStats();
      popup.updateStatsUI();
    }
  } catch (error) {
    // Ignore errors in auto-refresh
  }
}, 30000); // Refresh every 30 seconds
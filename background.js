// StudyNotes Pro - Background Script

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.sync.set({
      studyNotesSettings: {
        autoDetect: true,
        darkMode: false,
        pinned: false,
        position: { x: 20, y: 20 },
        size: { width: 400, height: 500 }
      },
      studyNotesData: {},
      studyNotesTags: ['Study', 'Important', 'Review', 'Exam']
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // Skip if it's a special Chrome page
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
    return;
  }

  try {
    // Try to send message first to see if content script is already loaded
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
    
  } catch (error) {
    // Content script not loaded, inject it first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });
      
      // Wait a bit for injection to complete, then send message
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
        } catch (retryError) {
          console.error('Failed to toggle notepad after injection:', retryError);
        }
      }, 100);
      
    } catch (injectionError) {
      console.error('Failed to inject content script:', injectionError);
    }
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  // Skip if it's a special Chrome page
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
    return;
  }

  if (command === 'toggle-notepad') {
    try {
      // Try to send message first
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
      
    } catch (error) {
      // Inject scripts first if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['styles.css']
        });
        
        // Wait for injection, then toggle notepad
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
          } catch (retryError) {
            console.error('Failed to toggle notepad:', retryError);
          }
        }, 100);
        
      } catch (injectionError) {
        console.error('Failed to inject content script:', injectionError);
      }
    }
  } else if (command === 'focus-mode') {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleFocusMode' });
    } catch (error) {
      // Try to inject first, then activate focus mode
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['styles.css']
        });
        
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'toggleFocusMode' });
          } catch (retryError) {
            console.error('Failed to toggle focus mode:', retryError);
          }
        }, 100);
        
      } catch (injectionError) {
        console.error('Failed to inject content script for focus mode:', injectionError);
      }
    }
  }
});

// Context menu for right-click functionality
chrome.contextMenus.create({
  id: 'study-notes-add-selection',
  title: 'Add to StudyNotes',
  contexts: ['selection']
});

chrome.contextMenus.create({
  id: 'study-notes-highlight-keywords',
  title: 'Highlight Keywords',
  contexts: ['page']
});

chrome.contextMenus.create({
  id: 'study-notes-smart-summary',
  title: 'Generate Smart Summary',
  contexts: ['page']
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    // Ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['styles.css']
    });
    
    // Send appropriate message based on context menu item
    switch (info.menuItemId) {
      case 'study-notes-add-selection':
        await chrome.tabs.sendMessage(tab.id, {
          action: 'addSelection',
          text: info.selectionText
        });
        break;
      case 'study-notes-highlight-keywords':
        await chrome.tabs.sendMessage(tab.id, {
          action: 'highlightKeywords'
        });
        break;
      case 'study-notes-smart-summary':
        await chrome.tabs.sendMessage(tab.id, {
          action: 'generateSummary'
        });
        break;
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
  } else if (request.action === 'exportData') {
    handleDataExport(request.format, sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === 'importData') {
    handleDataImport(request.data, sendResponse);
    return true;
  } else if (request.action === 'syncToCloud') {
    handleCloudSync(request.provider, sendResponse);
    return true;
  }
});

// Data export functionality
function handleDataExport(format, sendResponse) {
  chrome.storage.sync.get(['studyNotesData'], (result) => {
    const data = result.studyNotesData || {};
    
    let exportData;
    let filename;
    let mimeType;
    
    switch (format) {
      case 'json':
        exportData = JSON.stringify(data, null, 2);
        filename = 'studynotes-backup.json';
        mimeType = 'application/json';
        break;
      case 'csv':
        exportData = convertToCSV(data);
        filename = 'studynotes-export.csv';
        mimeType = 'text/csv';
        break;
      default:
        sendResponse({ success: false, error: 'Unsupported format' });
        return;
    }
    
    sendResponse({
      success: true,
      data: exportData,
      filename: filename,
      mimeType: mimeType
    });
  });
}

// Convert notes data to CSV format
function convertToCSV(data) {
  const notes = Object.values(data);
  if (notes.length === 0) return '';
  
  const headers = ['Title', 'URL', 'Platform', 'Content', 'Tags', 'Date'];
  const csvRows = [headers.join(',')];
  
  notes.forEach(note => {
    const row = [
      escapeCSV(note.title || ''),
      escapeCSV(note.url || ''),
      escapeCSV(note.platform || ''),
      escapeCSV(note.content || ''),
      escapeCSV((note.tags || []).join('; ')),
      escapeCSV(new Date(note.timestamp).toLocaleString())
    ];
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

function escapeCSV(text) {
  if (typeof text !== 'string') return '';
  return `"${text.replace(/"/g, '""')}"`;
}

// Data import functionality
function handleDataImport(importData, sendResponse) {
  try {
    const data = JSON.parse(importData);
    
    // Validate data structure
    if (typeof data !== 'object') {
      throw new Error('Invalid data format');
    }
    
    // Merge with existing data
    chrome.storage.sync.get(['studyNotesData'], (result) => {
      const existingData = result.studyNotesData || {};
      const mergedData = { ...existingData, ...data };
      
      chrome.storage.sync.set({ studyNotesData: mergedData }, () => {
        sendResponse({ success: true, count: Object.keys(data).length });
      });
    });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Cloud sync functionality (placeholder for future implementation)
function handleCloudSync(provider, sendResponse) {
  // This would implement actual cloud sync with services like Google Drive
  // For now, just return a placeholder response
  sendResponse({
    success: false,
    error: 'Cloud sync feature coming soon! Use export/import for now.'
  });
}

// Cleanup old data periodically
chrome.alarms.create('cleanup-old-data', { periodInMinutes: 60 * 24 }); // Daily

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup-old-data') {
    cleanupOldData();
  }
});

function cleanupOldData() {
  chrome.storage.sync.get(['studyNotesData'], (result) => {
    const data = result.studyNotesData || {};
    const cutoffDate = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days ago
    
    let cleanedCount = 0;
    const cleanedData = {};
    
    Object.entries(data).forEach(([key, note]) => {
      if (note.timestamp && note.timestamp > cutoffDate) {
        cleanedData[key] = note;
      } else {
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      chrome.storage.sync.set({ studyNotesData: cleanedData });
      console.log(`Cleaned up ${cleanedCount} old notes`);
    }
  });
}

// Badge management
function updateBadge(tabId, noteCount) {
  if (noteCount > 0) {
    chrome.action.setBadgeText({
      text: noteCount.toString(),
      tabId: tabId
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#667eea',
      tabId: tabId
    });
  } else {
    chrome.action.setBadgeText({
      text: '',
      tabId: tabId
    });
  }
}
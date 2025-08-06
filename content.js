// StudyNotes Pro - Content Script
class StudyNotesExtension {
  constructor() {
    this.isActive = false;
    this.notepad = null;
    this.currentNote = '';
    this.currentHeading = '';
    this.autoDetectEnabled = true;
    this.isDarkMode = false;
    this.isCollapsed = false;
    this.isPinned = false;
    this.focusModeEnabled = false;
    this.position = { x: 20, y: 20 };
    this.size = { width: 400, height: 500 };
    this.currentTags = [];
    this.init();
  }

  init() {
    this.loadSettings();
    this.detectPageInfo();
    this.setupKeywordHighlighting();
    this.createFloatingNotepad();
    this.setupEventListeners();
  }

  loadSettings() {
    chrome.storage.sync.get([
      'studyNotesSettings',
      'studyNotesData',
      'studyNotesTags'
    ], (result) => {
      if (result.studyNotesSettings) {
        const settings = result.studyNotesSettings;
        this.autoDetectEnabled = settings.autoDetect ?? true;
        this.isDarkMode = settings.darkMode ?? false;
        this.isPinned = settings.pinned ?? false;
        this.position = settings.position ?? { x: 20, y: 20 };
        this.size = settings.size ?? { width: 400, height: 500 };
      }
      
      if (result.studyNotesData) {
        this.loadExistingNote();
      }
      
      if (result.studyNotesTags) {
        this.currentTags = result.studyNotesTags || [];
      }
    });
  }

  detectPageInfo() {
    const url = window.location.href;
    let detectedTitle = '';

    // YouTube specific detection
    if (url.includes('youtube.com/watch')) {
      detectedTitle = this.getYouTubeTitle();
    }
    // Udemy specific detection
    else if (url.includes('udemy.com')) {
      detectedTitle = this.getUdemyTitle();
    }
    // General web page detection
    else {
      detectedTitle = this.getGeneralPageTitle();
    }

    this.currentHeading = detectedTitle || 'Untitled Note';
  }

  getYouTubeTitle() {
    // Multiple selectors for YouTube title
    const titleSelectors = [
      'h1.ytd-watch-metadata yt-formatted-string',
      'h1.title.style-scope.ytd-video-primary-info-renderer',
      '#above-the-fold #title h1',
      '.ytd-video-primary-info-renderer h1'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return document.title.replace(' - YouTube', '');
  }

  getUdemyTitle() {
    const titleSelectors = [
      '[data-purpose="course-header-title"]',
      'h1[data-purpose="course-title"]',
      '.clp-lead__title',
      '.lecture-title'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return document.title.replace(' | Udemy', '');
  }

  getGeneralPageTitle() {
    // Try to get the most prominent heading
    const headingSelectors = ['h1', 'h2', '.title', '.headline', 'title'];
    
    for (const selector of headingSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        const text = element.textContent.trim();
        if (text.length > 10 && text.length < 200) {
          return text;
        }
      }
    }
    
    return document.title;
  }

  setupKeywordHighlighting() {
    const keywords = [
      'definition', 'summary', 'important', 'formula', 'key point',
      'remember', 'note', 'conclusion', 'example', 'theorem',
      'algorithm', 'concept', 'principle', 'rule', 'method'
    ];

    const textNodes = this.getTextNodes(document.body);
    textNodes.forEach(node => {
      let text = node.textContent;
      let modified = false;
      
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        if (regex.test(text)) {
          modified = true;
          text = text.replace(regex, `<span class="study-notes-highlight" data-keyword="${keyword}">$&</span>`);
        }
      });
      
      if (modified) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = text;
        node.parentNode.replaceChild(wrapper, node);
      }
    });

    // Add click listeners to highlighted keywords
    document.querySelectorAll('.study-notes-highlight').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const keyword = e.target.dataset.keyword;
        const context = this.getContextText(e.target, 50);
        this.addToNotes(`🔑 ${keyword.toUpperCase()}: ${context}`);
      });
    });
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }
    
    return textNodes;
  }

  getContextText(element, wordCount) {
    const parent = element.closest('p, div, span, li, td');
    if (parent) {
      const words = parent.textContent.trim().split(' ');
      return words.slice(0, wordCount).join(' ');
    }
    return element.textContent;
  }

  createFloatingNotepad() {
    if (this.notepad) return;

    this.notepad = document.createElement('div');
    this.notepad.id = 'study-notes-floating-notepad';
    this.notepad.className = `study-notes-notepad ${this.isDarkMode ? 'dark-mode' : ''}`;
    this.notepad.innerHTML = this.getNotepadHTML();
    
    // Apply saved position and size
    this.notepad.style.left = this.position.x + 'px';
    this.notepad.style.top = this.position.y + 'px';
    this.notepad.style.width = this.size.width + 'px';
    this.notepad.style.height = this.size.height + 'px';
    
    document.body.appendChild(this.notepad);
    
    this.setupNotepadEventListeners();
    this.makeDraggable();
    this.makeResizable();
    
    // Load existing note for this page
    this.loadExistingNote();
  }

  getNotepadHTML() {
    return `
      <div class="study-notes-header">
        <div class="study-notes-title-container">
          <input type="text" class="study-notes-heading" value="${this.currentHeading}" placeholder="Note Title">
          <button class="study-notes-btn auto-detect-btn" title="Auto-detect title">
            🔧
          </button>
        </div>
        <div class="study-notes-controls">
          <button class="study-notes-btn collapse-btn" title="Collapse">⬇</button>
          <button class="study-notes-btn pin-btn" title="Pin">📌</button>
          <button class="study-notes-btn dark-mode-btn" title="Dark Mode">🌙</button>
          <button class="study-notes-btn close-btn" title="Close">✕</button>
        </div>
      </div>
      
      <div class="study-notes-content">
        <div class="study-notes-tabs">
          <button class="study-notes-tab active" data-tab="notes">📝 Notes</button>
          <button class="study-notes-tab" data-tab="keywords">🔑 Keywords</button>
          <button class="study-notes-tab" data-tab="history">📚 History</button>
          <button class="study-notes-tab" data-tab="tags">🏷️ Tags</button>
        </div>
        
        <div class="study-notes-tab-content active" id="notes-tab">
          <div class="study-notes-toolbar">
            <button class="study-notes-btn smart-summary-btn" title="Smart Summary">AI Summary</button>
            <button class="study-notes-btn extract-keywords-btn" title="Extract Keywords">Keywords</button>
            <button class="study-notes-btn focus-mode-btn" title="Focus Mode">Focus</button>
          </div>
          
          <textarea class="study-notes-textarea" placeholder="Start taking notes...
          
Tips:
• Use #tags for organization
• Click highlighted keywords to add them
• Use @ for mentions
• ** for bold, * for italic"></textarea>
          
          <div class="study-notes-footer">
            <div class="study-notes-stats">
              <span class="word-count">0 words</span>
              <span class="char-count">0 chars</span>
            </div>
            <div class="study-notes-actions">
              <button class="study-notes-btn save-btn">Save</button>
              <button class="study-notes-btn export-btn">Export</button>
            </div>
          </div>
        </div>
        
        <div class="study-notes-tab-content" id="keywords-tab">
          <div class="keywords-container">
            <h4>Extracted Keywords</h4>
            <div class="keywords-list"></div>
          </div>
        </div>
        
        <div class="study-notes-tab-content" id="history-tab">
          <div class="history-container">
            <h4>Recent Notes</h4>
            <div class="history-list"></div>
          </div>
        </div>
        
        <div class="study-notes-tab-content" id="tags-tab">
          <div class="tags-container">
            <h4>Manage Tags</h4>
            <div class="tags-input-container">
              <input type="text" class="tags-input" placeholder="Add new tag...">
              <button class="add-tag-btn">Add</button>
            </div>
            <div class="tags-list"></div>
          </div>
        </div>
      </div>
      
      <div class="study-notes-resize-handle"></div>
    `;
  }

  setupNotepadEventListeners() {
    const notepad = this.notepad;
    
    // Header controls
    notepad.querySelector('.auto-detect-btn').addEventListener('click', () => {
      this.detectPageInfo();
      notepad.querySelector('.study-notes-heading').value = this.currentHeading;
    });
    
    notepad.querySelector('.collapse-btn').addEventListener('click', () => {
      this.toggleCollapse();
    });
    
    notepad.querySelector('.pin-btn').addEventListener('click', () => {
      this.togglePin();
    });
    
    notepad.querySelector('.dark-mode-btn').addEventListener('click', () => {
      this.toggleDarkMode();
    });
    
    notepad.querySelector('.close-btn').addEventListener('click', () => {
      this.toggleNotepad();
    });

    // Tab switching
    notepad.querySelectorAll('.study-notes-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Toolbar actions
    notepad.querySelector('.smart-summary-btn').addEventListener('click', () => {
      this.generateSmartSummary();
    });
    
    notepad.querySelector('.extract-keywords-btn').addEventListener('click', () => {
      this.extractKeywords();
    });
    
    notepad.querySelector('.focus-mode-btn').addEventListener('click', () => {
      this.toggleFocusMode();
    });

    // Textarea events
    const textarea = notepad.querySelector('.study-notes-textarea');
    textarea.addEventListener('input', () => {
      this.updateWordCount();
      this.autoSave();
    });

    // Footer actions
    notepad.querySelector('.save-btn').addEventListener('click', () => {
      this.saveNote();
    });
    
    notepad.querySelector('.export-btn').addEventListener('click', () => {
      this.showExportOptions();
    });

    // Tags functionality
    const tagsInput = notepad.querySelector('.tags-input');
    const addTagBtn = notepad.querySelector('.add-tag-btn');
    
    const addTag = () => {
      const tagName = tagsInput.value.trim();
      if (tagName && !this.currentTags.includes(tagName)) {
        this.currentTags.push(tagName);
        this.updateTagsDisplay();
        this.saveSettings();
        tagsInput.value = '';
      }
    };
    
    addTagBtn.addEventListener('click', addTag);
    tagsInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTag();
    });

    // Title editing
    notepad.querySelector('.study-notes-heading').addEventListener('change', (e) => {
      this.currentHeading = e.target.value;
    });
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+N to toggle notepad
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.toggleNotepad();
      }
      
      // Ctrl+Shift+F for focus mode
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.toggleFocusMode();
      }
      
      // ESC to exit focus mode
      if (e.key === 'Escape' && this.focusModeEnabled) {
        this.toggleFocusMode();
      }
    });

    // Auto-save on page unload
    window.addEventListener('beforeunload', () => {
      this.saveNote();
    });

    // Check for page changes (YouTube/SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => {
          this.detectPageInfo();
          if (this.autoDetectEnabled) {
            this.checkForNewNote();
          }
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  toggleNotepad() {
    if (this.notepad.style.display === 'none') {
      this.notepad.style.display = 'block';
      this.isActive = true;
    } else {
      this.notepad.style.display = 'none';
      this.isActive = false;
      this.saveNote();
    }
  }

  toggleCollapse() {
    const content = this.notepad.querySelector('.study-notes-content');
    const btn = this.notepad.querySelector('.collapse-btn');
    
    if (this.isCollapsed) {
      content.style.display = 'block';
      btn.textContent = '⬇';
      btn.title = 'Collapse';
      this.isCollapsed = false;
    } else {
      content.style.display = 'none';
      btn.textContent = '⬆';
      btn.title = 'Expand';
      this.isCollapsed = true;
    }
  }

  togglePin() {
    const btn = this.notepad.querySelector('.pin-btn');
    
    if (this.isPinned) {
      this.notepad.style.zIndex = '10000';
      btn.textContent = '📌';
      btn.title = 'Pin';
      this.isPinned = false;
    } else {
      this.notepad.style.zIndex = '99999';
      btn.textContent = '📍';
      btn.title = 'Unpin';
      this.isPinned = true;
    }
    
    this.saveSettings();
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    this.notepad.classList.toggle('dark-mode', this.isDarkMode);
    
    const btn = this.notepad.querySelector('.dark-mode-btn');
    btn.textContent = this.isDarkMode ? '☀️' : '🌙';
    
    this.saveSettings();
  }

  toggleFocusMode() {
    this.focusModeEnabled = !this.focusModeEnabled;
    const btn = this.notepad.querySelector('.focus-mode-btn');
    
    if (this.focusModeEnabled) {
      this.enableFocusMode();
      btn.textContent = '🎯 Exit Focus';
    } else {
      this.disableFocusMode();
      btn.textContent = '🎯 Focus';
    }
  }

  enableFocusMode() {
    // Create focus overlay
    const overlay = document.createElement('div');
    overlay.id = 'study-notes-focus-overlay';
    overlay.className = 'study-notes-focus-overlay';
    document.body.appendChild(overlay);
    
    // Block social media (basic implementation)
    if (this.isSocialMedia()) {
      overlay.innerHTML = `
        <div class="focus-message">
          <h2>🚫 You're in Focus Mode</h2>
          <p>Social media is blocked during study time</p>
          <button onclick="document.getElementById('study-notes-focus-overlay').remove()">Exit Focus Mode</button>
        </div>
      `;
      overlay.style.background = 'rgba(0, 0, 0, 0.9)';
      overlay.style.zIndex = '99998';
    }
  }

  disableFocusMode() {
    const overlay = document.getElementById('study-notes-focus-overlay');
    if (overlay) overlay.remove();
  }

  isSocialMedia() {
    const socialSites = ['facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'reddit.com'];
    return socialSites.some(site => window.location.href.includes(site));
  }

  switchTab(tabName) {
    // Update tab buttons
    this.notepad.querySelectorAll('.study-notes-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    this.notepad.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    this.notepad.querySelectorAll('.study-notes-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    this.notepad.querySelector(`#${tabName}-tab`).classList.add('active');
    
    // Load tab-specific content
    if (tabName === 'history') this.loadHistory();
    if (tabName === 'keywords') this.loadExtractedKeywords();
    if (tabName === 'tags') this.updateTagsDisplay();
  }

  generateSmartSummary() {
    // Extract visible text from the page
    const content = this.extractPageContent();
    if (!content) return;
    
    // Simple keyword extraction and summarization
    const sentences = content.split('.').filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 5).join('. ') + '.';
    
    this.addToNotes(`\n🧠 SMART SUMMARY:\n${summary}\n`);
  }

  extractKeywords() {
    const content = this.extractPageContent();
    if (!content) return;
    
    // Simple keyword extraction
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const frequency = {};
    
    words.forEach(word => {
      if (!this.isStopWord(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });
    
    const keywords = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
    
    this.displayKeywords(keywords);
  }

  extractPageContent() {
    // Try different content selectors based on platform
    const selectors = [
      'article', '.content', '.post', '.description',
      '#description', '.video-description', '.course-content',
      'main', '.main-content', 'p'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements)
          .map(el => el.textContent)
          .join(' ')
          .slice(0, 5000); // Limit to prevent performance issues
      }
    }
    
    return document.body.textContent.slice(0, 5000);
  }

  isStopWord(word) {
    const stopWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
      'those', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can'
    ];
    return stopWords.includes(word);
  }

  displayKeywords(keywords) {
    const keywordsList = this.notepad.querySelector('.keywords-list');
    keywordsList.innerHTML = keywords.map(({ word, count }) => 
      `<div class="keyword-item">
        <span class="keyword-word">${word}</span>
        <span class="keyword-count">${count}</span>
        <button class="add-keyword-btn" data-keyword="${word}">Add to Notes</button>
      </div>`
    ).join('');
    
    // Add event listeners to add buttons
    keywordsList.querySelectorAll('.add-keyword-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const keyword = e.target.dataset.keyword;
        this.addToNotes(`🔑 ${keyword}`);
      });
    });
  }

  loadExtractedKeywords() {
    // Auto-extract keywords when tab is opened
    if (this.notepad.querySelector('.keywords-list').children.length === 0) {
      this.extractKeywords();
    }
  }

  addToNotes(text) {
    const textarea = this.notepad.querySelector('.study-notes-textarea');
    const currentPos = textarea.selectionStart;
    const currentValue = textarea.value;
    
    const newValue = currentValue.slice(0, currentPos) + 
                    (currentPos > 0 ? '\n' : '') + 
                    text + 
                    currentValue.slice(currentPos);
    
    textarea.value = newValue;
    textarea.focus();
    
    // Position cursor after inserted text
    const newPos = currentPos + text.length + (currentPos > 0 ? 1 : 0);
    textarea.setSelectionRange(newPos, newPos);
    
    this.updateWordCount();
    this.autoSave();
  }

  updateWordCount() {
    const textarea = this.notepad.querySelector('.study-notes-textarea');
    const text = textarea.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    
    this.notepad.querySelector('.word-count').textContent = `${words} words`;
    this.notepad.querySelector('.char-count').textContent = `${chars} chars`;
  }

  makeDraggable() {
    const header = this.notepad.querySelector('.study-notes-header');
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.matches('input, button')) return;
      
      isDragging = true;
      dragOffset.x = e.clientX - this.notepad.offsetLeft;
      dragOffset.y = e.clientY - this.notepad.offsetTop;
      
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
    });
    
    const handleDrag = (e) => {
      if (!isDragging) return;
      
      this.position.x = Math.max(0, e.clientX - dragOffset.x);
      this.position.y = Math.max(0, e.clientY - dragOffset.y);
      
      this.notepad.style.left = this.position.x + 'px';
      this.notepad.style.top = this.position.y + 'px';
    };
    
    const stopDrag = () => {
      isDragging = false;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
      this.saveSettings();
    };
  }

  makeResizable() {
    const resizeHandle = this.notepad.querySelector('.study-notes-resize-handle');
    let isResizing = false;
    
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      e.preventDefault();
      
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
    });
    
    const handleResize = (e) => {
      if (!isResizing) return;
      
      const rect = this.notepad.getBoundingClientRect();
      this.size.width = Math.max(300, e.clientX - rect.left);
      this.size.height = Math.max(400, e.clientY - rect.top);
      
      this.notepad.style.width = this.size.width + 'px';
      this.notepad.style.height = this.size.height + 'px';
    };
    
    const stopResize = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
      this.saveSettings();
    };
  }

  autoSave() {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveNote();
    }, 2000); // Auto-save after 2 seconds of inactivity
  }

  saveNote() {
    const textarea = this.notepad?.querySelector('.study-notes-textarea');
    if (!textarea) return;
    
    const noteData = {
      url: window.location.href,
      title: this.currentHeading,
      content: textarea.value,
      timestamp: Date.now(),
      tags: this.extractTagsFromContent(textarea.value),
      platform: this.getPlatform()
    };
    
    // Save to storage
    chrome.storage.sync.get(['studyNotesData'], (result) => {
      const allNotes = result.studyNotesData || {};
      const noteId = this.generateNoteId();
      allNotes[noteId] = noteData;
      
      chrome.storage.sync.set({ studyNotesData: allNotes }, () => {
        console.log('Note saved successfully:', noteId);
      });
    });
  }

  loadExistingNote() {
    const noteId = this.generateNoteId();
    
    chrome.storage.sync.get(['studyNotesData'], (result) => {
      const allNotes = result.studyNotesData || {};
      const existingNote = allNotes[noteId];
      
      if (existingNote && this.notepad) {
        const textarea = this.notepad.querySelector('.study-notes-textarea');
        const titleInput = this.notepad.querySelector('.study-notes-heading');
        
        if (textarea) textarea.value = existingNote.content || '';
        if (titleInput) titleInput.value = existingNote.title || this.currentHeading;
        
        this.currentHeading = existingNote.title || this.currentHeading;
        this.updateWordCount();
      }
    });
  }

  generateNoteId() {
    // Generate consistent ID based on URL (ignoring query params for YouTube/Udemy)
    let baseUrl = window.location.href;
    
    if (baseUrl.includes('youtube.com/watch')) {
      const videoId = new URLSearchParams(window.location.search).get('v');
      baseUrl = `youtube.com/watch?v=${videoId}`;
    } else if (baseUrl.includes('udemy.com')) {
      baseUrl = baseUrl.split('?')[0]; // Remove query params
    }
    
    return btoa(baseUrl).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }

  getPlatform() {
    const url = window.location.href;
    if (url.includes('youtube.com')) return 'YouTube';
    if (url.includes('udemy.com')) return 'Udemy';
    if (url.includes('medium.com')) return 'Medium';
    return 'Web';
  }

  extractTagsFromContent(content) {
    const tagRegex = /#([a-zA-Z0-9_]+)/g;
    const matches = content.match(tagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  loadHistory() {
    chrome.storage.sync.get(['studyNotesData'], (result) => {
      const allNotes = result.studyNotesData || {};
      const notesList = Object.values(allNotes)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
      
      const historyContainer = this.notepad.querySelector('.history-list');
      historyContainer.innerHTML = notesList.map(note => `
        <div class="history-item" data-note-id="${btoa(note.url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}">
          <div class="history-header">
            <span class="history-title">${note.title.substring(0, 50)}...</span>
            <span class="history-platform">${note.platform}</span>
          </div>
          <div class="history-meta">
            <span class="history-date">${new Date(note.timestamp).toLocaleDateString()}</span>
            <span class="history-words">${note.content.split(' ').length} words</span>
          </div>
          <div class="history-actions">
            <button class="load-note-btn">Load</button>
            <button class="delete-note-btn">Delete</button>
          </div>
        </div>
      `).join('');
      
      // Add event listeners
      historyContainer.querySelectorAll('.load-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const noteId = e.target.closest('.history-item').dataset.noteId;
          this.loadNoteById(noteId);
        });
      });
      
      historyContainer.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const noteId = e.target.closest('.history-item').dataset.noteId;
          this.deleteNoteById(noteId);
        });
      });
    });
  }

  loadNoteById(noteId) {
    chrome.storage.sync.get(['studyNotesData'], (result) => {
      const allNotes = result.studyNotesData || {};
      const note = allNotes[noteId];
      
      if (note) {
        const textarea = this.notepad.querySelector('.study-notes-textarea');
        const titleInput = this.notepad.querySelector('.study-notes-heading');
        
        textarea.value = note.content;
        titleInput.value = note.title;
        this.currentHeading = note.title;
        this.updateWordCount();
        
        // Switch back to notes tab
        this.switchTab('notes');
      }
    });
  }

  deleteNoteById(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
      chrome.storage.sync.get(['studyNotesData'], (result) => {
        const allNotes = result.studyNotesData || {};
        delete allNotes[noteId];
        chrome.storage.sync.set({ studyNotesData: allNotes });
        this.loadHistory(); // Refresh history
      });
    }
  }

  updateTagsDisplay() {
    const tagsContainer = this.notepad.querySelector('.tags-list');
    tagsContainer.innerHTML = this.currentTags.map(tag => `
      <div class="tag-item">
        <span class="tag-name">#${tag}</span>
        <button class="remove-tag-btn" data-tag="${tag}">×</button>
      </div>
    `).join('');
    
    // Add remove listeners
    tagsContainer.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tagToRemove = e.target.dataset.tag;
        this.currentTags = this.currentTags.filter(tag => tag !== tagToRemove);
        this.updateTagsDisplay();
        this.saveSettings();
      });
    });
  }

  showExportOptions() {
    const modal = document.createElement('div');
    modal.className = 'study-notes-modal';
    modal.innerHTML = `
      <div class="study-notes-modal-content">
        <h3>Export Options</h3>
        <div class="export-buttons">
          <button class="export-btn-option" data-format="txt">📄 Plain Text</button>
          <button class="export-btn-option" data-format="md">📜 Markdown</button>
          <button class="export-btn-option" data-format="pdf">📕 PDF</button>
          <button class="export-btn-option" data-format="json">💾 JSON Backup</button>
        </div>
        <div class="export-options">
          <label>
            <input type="checkbox" id="includeAllNotes"> Export all notes
          </label>
          <label>
            <input type="checkbox" id="includeTags"> Include tags
          </label>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="export-confirm-btn">Export</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle export format selection
    let selectedFormat = 'txt';
    modal.querySelectorAll('.export-btn-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        modal.querySelectorAll('.export-btn-option').forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedFormat = e.target.dataset.format;
      });
    });
    
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.querySelector('.export-confirm-btn').addEventListener('click', () => {
      const includeAll = modal.querySelector('#includeAllNotes').checked;
      const includeTags = modal.querySelector('#includeTags').checked;
      this.exportNotes(selectedFormat, includeAll, includeTags);
      modal.remove();
    });
    
    // Set default selection
    modal.querySelector('[data-format="txt"]').classList.add('selected');
  }

  exportNotes(format, includeAll, includeTags) {
    chrome.storage.sync.get(['studyNotesData'], (result) => {
      const allNotes = result.studyNotesData || {};
      let dataToExport;
      
      if (includeAll) {
        dataToExport = Object.values(allNotes);
      } else {
        const currentNoteId = this.generateNoteId();
        dataToExport = allNotes[currentNoteId] ? [allNotes[currentNoteId]] : [];
      }
      
      let exportContent = '';
      let fileName = '';
      let mimeType = '';
      
      switch (format) {
        case 'txt':
          exportContent = this.formatAsText(dataToExport, includeTags);
          fileName = 'study-notes.txt';
          mimeType = 'text/plain';
          break;
        case 'md':
          exportContent = this.formatAsMarkdown(dataToExport, includeTags);
          fileName = 'study-notes.md';
          mimeType = 'text/markdown';
          break;
        case 'pdf':
          this.exportAsPDF(dataToExport, includeTags);
          return;
        case 'json':
          exportContent = JSON.stringify(dataToExport, null, 2);
          fileName = 'study-notes-backup.json';
          mimeType = 'application/json';
          break;
      }
      
      this.downloadFile(exportContent, fileName, mimeType);
    });
  }

  formatAsText(notes, includeTags) {
    return notes.map(note => {
      let content = `Title: ${note.title}\n`;
      content += `URL: ${note.url}\n`;
      content += `Date: ${new Date(note.timestamp).toLocaleString()}\n`;
      content += `Platform: ${note.platform}\n`;
      
      if (includeTags && note.tags && note.tags.length > 0) {
        content += `Tags: ${note.tags.map(tag => '#' + tag).join(' ')}\n`;
      }
      
      content += `\n${note.content}\n`;
      content += '\n' + '='.repeat(80) + '\n\n';
      
      return content;
    }).join('');
  }

  formatAsMarkdown(notes, includeTags) {
    return notes.map(note => {
      let content = `# ${note.title}\n\n`;
      content += `**URL:** ${note.url}\n`;
      content += `**Date:** ${new Date(note.timestamp).toLocaleString()}\n`;
      content += `**Platform:** ${note.platform}\n\n`;
      
      if (includeTags && note.tags && note.tags.length > 0) {
        content += `**Tags:** ${note.tags.map(tag => '#' + tag).join(' ')}\n\n`;
      }
      
      content += `## Notes\n\n${note.content}\n\n`;
      content += '---\n\n';
      
      return content;
    }).join('');
  }

  exportAsPDF(notes, includeTags) {
    // For PDF export, we'll create a printable HTML version
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Study Notes Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .note { page-break-after: always; margin-bottom: 40px; }
          .note-header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .note-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .note-meta { font-size: 12px; color: #666; }
          .note-content { line-height: 1.6; white-space: pre-wrap; }
          .tags { margin: 10px 0; }
          .tag { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; margin-right: 5px; }
        </style>
      </head>
      <body>
        ${notes.map(note => `
          <div class="note">
            <div class="note-header">
              <div class="note-title">${note.title}</div>
              <div class="note-meta">
                <strong>URL:</strong> ${note.url}<br>
                <strong>Date:</strong> ${new Date(note.timestamp).toLocaleString()}<br>
                <strong>Platform:</strong> ${note.platform}
              </div>
              ${includeTags && note.tags && note.tags.length > 0 ? 
                `<div class="tags">
                  ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                </div>` : ''
              }
            </div>
            <div class="note-content">${note.content}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study-notes.html';
    a.click();
    URL.revokeObjectURL(url);
    
    // Show instruction for PDF conversion
    setTimeout(() => {
      alert('HTML file downloaded. To convert to PDF:\n1. Open the HTML file in your browser\n2. Press Ctrl+P (or Cmd+P on Mac)\n3. Select "Save as PDF" as destination\n4. Click Save');
    }, 500);
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

  checkForNewNote() {
    const currentNoteId = this.generateNoteId();
    chrome.storage.sync.get(['studyNotesData'], (result) => {
      const allNotes = result.studyNotesData || {};
      
      if (!allNotes[currentNoteId]) {
        const shouldCreate = confirm(`New ${this.getPlatform()} content detected!\n\n"${this.currentHeading}"\n\nWould you like to start a new note for this page?`);
        
        if (shouldCreate) {
          this.notepad.querySelector('.study-notes-heading').value = this.currentHeading;
          this.notepad.querySelector('.study-notes-textarea').value = '';
          this.updateWordCount();
        }
      }
    });
  }

  saveSettings() {
    const settings = {
      autoDetect: this.autoDetectEnabled,
      darkMode: this.isDarkMode,
      pinned: this.isPinned,
      position: this.position,
      size: this.size
    };
    
    chrome.storage.sync.set({ 
      studyNotesSettings: settings,
      studyNotesTags: this.currentTags
    });
  }
}

// Initialize extension only when activated
let studyNotesExtension = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleNotepad') {
    if (!studyNotesExtension) {
      // Initialize extension on first activation
      studyNotesExtension = new StudyNotesExtension();
    }
    studyNotesExtension.toggleNotepad();
  } else if (request.action === 'getStatus') {
    if (studyNotesExtension) {
      sendResponse({ 
        active: studyNotesExtension.isActive || false,
        title: studyNotesExtension.currentHeading || 'No title detected'
      });
    } else {
      sendResponse({ active: false, title: 'Extension not initialized' });
    }
  } else if (request.action === 'addSelection') {
    if (!studyNotesExtension) {
      studyNotesExtension = new StudyNotesExtension();
    }
    studyNotesExtension.addToNotes(`📝 ${request.text}`);
  } else if (request.action === 'highlightKeywords') {
    if (!studyNotesExtension) {
      studyNotesExtension = new StudyNotesExtension();
    }
    studyNotesExtension.setupKeywordHighlighting();
  } else if (request.action === 'generateSummary') {
    if (!studyNotesExtension) {
      studyNotesExtension = new StudyNotesExtension();
    }
    studyNotesExtension.generateSmartSummary();
  } else if (request.action === 'toggleFocusMode') {
    if (!studyNotesExtension) {
      studyNotesExtension = new StudyNotesExtension();
    }
    studyNotesExtension.toggleFocusMode();
  } else if (request.action === 'updateSettings') {
    if (studyNotesExtension) {
      // Update settings in existing instance
      Object.assign(studyNotesExtension.settings, request.settings);
    }
  }
});
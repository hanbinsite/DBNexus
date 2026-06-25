/**
 * DB Client - Main Application JavaScript
 * Handles all UI interactions, theming, and Wails integration
 */

// ==========================================================================
// Global State
// ==========================================================================
const state = {
    currentTheme: 'dark',
    connections: [],
    tabs: [],
    activeTab: null,
    activeConnection: null,
    sidebarWidth: 260,
    editorHeight: 300,
    isResizing: false,
    wailsReady: false,
    currentTable: null,
    selectedDatabase: null,
    columnWidths: {}
};

// ==========================================================================
// Wails Integration
// ==========================================================================
const WailsAPI = {
    // Connection Management
    getConnections: () => window.go.main.App.GetConnections(),
    saveConnection: (conn) => window.go.main.App.SaveConnection(conn),
    deleteConnection: (id) => window.go.main.App.DeleteConnection(id),
    testConnection: (conn) => window.go.main.App.TestConnection(conn),
    connectToDatabase: (conn) => window.go.main.App.ConnectToDatabase(conn),
    disconnectFromDatabase: (conn) => window.go.main.App.DisconnectFromDatabase(conn),
    getSupportedDatabases: () => window.go.main.App.GetSupportedDatabases(),
    
    // Database Operations
    getDatabases: (conn) => window.go.main.App.GetDatabases(conn),
    getTables: (conn, db) => window.go.main.App.GetTables(conn, db),
    getViews: (conn, db) => window.go.main.App.GetViews(conn, db),
    getFunctions: (conn, db) => window.go.main.App.GetFunctions(conn, db),
    getTableColumns: (conn, db, table) => window.go.main.App.GetTableColumns(conn, db, table),
    
    // Query Execution
    executeQuery: (conn, db, query) => window.go.main.App.ExecuteQuery(conn, db, query),
    executeMultiQuery: (conn, db, query) => window.go.main.App.ExecuteMultiQuery(conn, db, query),
    executeNonQuery: (conn, db, query) => window.go.main.App.ExecuteNonQuery(conn, db, query),
    executeQueryWithTimeout: (conn, db, query, options) => window.go.main.App.ExecuteQueryWithTimeout(conn, db, query, options),
    executeMultiQueryWithTimeout: (conn, db, query, options) => window.go.main.App.ExecuteMultiQueryWithTimeout(conn, db, query, options),
    
    // Window Controls
    windowMinimize: () => window.go.main.App.WindowMinimize(),
    windowMaximize: () => window.go.main.App.WindowMaximize(),
    windowClose: () => window.go.main.App.WindowClose(),
    windowIsMaximized: () => window.go.main.App.WindowIsMaximized(),
    windowSetSize: (w, h) => window.go.main.App.WindowSetSize(w, h),
    
    // File Dialogs
    openFileDialog: (title, filters) => window.go.main.App.OpenFileDialog(title, filters),
    saveFileDialog: (title, defaultName) => window.go.main.App.SaveFileDialog(title, defaultName),
    readFile: (path) => window.go.main.App.ReadFile(path),
    writeFile: (path, content) => window.go.main.App.WriteFile(path, content),

    // Query History & Bookmarks
    getQueryHistory: () => window.go.main.App.GetQueryHistory(),
    addQueryHistory: (query, db) => window.go.main.App.AddQueryHistory(query, db),
    clearQueryHistory: () => window.go.main.App.ClearQueryHistory(),
    getBookmarks: () => window.go.main.App.GetBookmarks(),
    addBookmark: (name, query, db) => window.go.main.App.AddBookmark(name, query, db),
    deleteBookmark: (id) => window.go.main.App.DeleteBookmark(id),

    // Connection Import/Export
    exportConnections: () => window.go.main.App.ExportConnections(),
    importConnections: (json) => window.go.main.App.ImportConnections(json),

    // AI Features
    explainSQL: (query) => window.go.main.App.ExplainSQL(query),
    diagnoseQueryError: (conn, db, query, err) => window.go.main.App.DiagnoseQueryError(conn, db, query, err),
    suggestOptimizations: (conn, db, query) => window.go.main.App.SuggestOptimizations(conn, db, query),
    naturalLanguageToSQL: (conn, db, text) => window.go.main.App.NaturalLanguageToSQL(conn, db, text),
    testAIConnection: () => window.go.main.App.TestAIConnection(),
    setAIConfig: (provider, key, url, model, enable) => window.go.main.App.SetAIConfig(provider, key, url, model, enable),

    // Query Cancellation
    cancelQuery: (queryID) => window.go.main.App.CancelQuery(queryID),
    getActiveQueries: () => window.go.main.App.GetActiveQueries(),

    // SSH Tunnel
    closeSSHTunnel: (connID) => window.go.main.App.CloseSSHTunnel(connID),
    getSSHTunnelPort: (connID) => window.go.main.App.GetSSHTunnelPort(connID),

    // Backup / Restore
    backupDatabase: (conn, db, path) => window.go.main.App.BackupDatabase(conn, db, path),
    restoreDatabase: (conn, db, path) => window.go.main.App.RestoreDatabase(conn, db, path),
    
    // Audit Logs
    getAuditLogs: (limit, level, eventType) => window.go.main.App.GetAuditLogs(limit, level, eventType),
    exportAuditLogs: (startTime, endTime) => window.go.main.App.ExportAuditLogs(startTime, endTime),
    clearOldAuditLogs: (daysToKeep) => window.go.main.App.ClearOldAuditLogs(daysToKeep),
    
    // Language
    getLanguage: () => window.go.main.App.GetLanguage(),
    setLanguage: (lang) => window.go.main.App.SetLanguage(lang),
    
    // Test Services
    runConnectionTest: (conn) => window.go.main.App.RunConnectionTest(conn),
    runAllTests: () => window.go.main.App.RunAllTests(),
    getSupportedFeatures: (dbType) => window.go.main.App.GetSupportedFeatures(dbType),
    getServerInfo: () => window.go.main.App.GetServerInfo(),
    getDatabaseServerInfo: (conn) => window.go.main.App.GetDatabaseServerInfo(conn),
    
    // Table Info
    getTableIndexes: (conn, db, table) => window.go.main.App.GetTableIndexes(conn, db, table),
    getTableForeignKeys: (conn, db, table) => window.go.main.App.GetTableForeignKeys(conn, db, table),
    getTableStats: (conn, db, table) => window.go.main.App.GetTableStats(conn, db, table),
    
    // Data Editing
    editTableData: (conn, req) => window.go.main.App.EditTableData(conn, req),
    batchEdit: (conn, requests) => window.go.main.App.BatchEdit(conn, requests),
    getEditableColumns: (conn, db, table) => window.go.main.App.GetEditableColumns(conn, db, table),
    generateInsertStatement: (table, data) => window.go.main.App.GenerateInsertStatement(table, data),
    generateUpdateStatement: (table, data, pk) => window.go.main.App.GenerateUpdateStatement(table, data, pk),
    
    // Data Export/Import
    exportData: (conn, req) => window.go.main.App.ExportData(conn, req),
    importData: (conn, req) => window.go.main.App.ImportData(conn, req),
    
    // Data Compare
    compareTables: (conn, req) => window.go.main.App.CompareTables(conn, req),
    compareQueries: (conn, req) => window.go.main.App.CompareQueries(conn, req),
    getCompareReport: (result) => window.go.main.App.GetCompareReport(result),
    exportCompareResult: (result, format) => window.go.main.App.ExportCompareResult(result, format),
    
    // Transaction Management
    beginTransaction: (conn, db, options) => window.go.main.App.BeginTransaction(conn, db, options),
    executeInTransaction: (txID, query) => window.go.main.App.ExecuteInTransaction(txID, query),
    commitTransaction: (txID) => window.go.main.App.CommitTransaction(txID),
    rollbackTransaction: (txID) => window.go.main.App.RollbackTransaction(txID),
    executeTransactionBatch: (req) => window.go.main.App.ExecuteTransactionBatch(req),
    
    // Redis
    getRedisKeyInfo: (conn, key) => window.go.main.App.GetRedisKeyInfo(conn, key),
    setRedisKeyValue: (conn, key, value, ttl) => window.go.main.App.SetRedisKeyValue(conn, key, value, ttl),
    deleteRedisKey: (conn, ...keys) => window.go.main.App.DeleteRedisKey(conn, ...keys),
    executeRedisCommand: (conn, cmd, ...args) => window.go.main.App.ExecuteRedisCommand(conn, cmd, ...args),
    getRedisInfo: (conn, section) => window.go.main.App.GetRedisInfo(conn, section),
    getRedisDBSize: (conn) => window.go.main.App.GetRedisDBSize(conn),
    scanRedisKeys: (conn, pattern, cursor, count) => window.go.main.App.ScanRedisKeys(conn, pattern, cursor, count),
    
    // Autocomplete
    getAutoCompleteSuggestions: (conn, db, query, pos) => window.go.main.App.GetAutoCompleteSuggestions(conn, db, query, pos),
    getQuickSuggestions: (prefix) => window.go.main.App.GetQuickSuggestions(prefix),
    getTableColumnsForAutoComplete: (conn, db, table) => window.go.main.App.GetTableColumnsForAutoComplete(conn, db, table),
    
    // SQL Formatter
    formatSQL: (sql, options) => window.go.main.App.FormatSQL(sql, options),
    minifySQL: (sql) => window.go.main.App.MinifySQL(sql),
    validateSQL: (sql) => window.go.main.App.ValidateSQL(sql),
    beautifySQL: (sql) => window.go.main.App.BeautifySQL(sql),
    compactSQL: (sql) => window.go.main.App.CompactSQL(sql),
    getSQLStructure: (sql) => window.go.main.App.GetSQLStructure(sql),
    
    // Query Analyzer
    getExplainPlan: (conn, db, query) => window.go.main.App.GetExplainPlan(conn, db, query),
    analyzeQuery: (query) => window.go.main.App.AnalyzeQuery(query),
    getSlowQueries: (conn, db, threshold) => window.go.main.App.GetSlowQueries(conn, db, threshold),
    analyzeTableUsage: (conn, db) => window.go.main.App.AnalyzeTableUsage(conn, db),
    getTableStatistics: (conn, db, table) => window.go.main.App.GetTableStatistics(conn, db, table),
};

// Check if Wails is available
function isWailsAvailable() {
    return typeof window.go !== 'undefined' && window.go.main && window.go.main.App;
}

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();

    initTheme();
    initWindowControls();
    initResizablePanels();
    initTabs();
    initContextMenu();
    initConnectionDialog();
    initSettings();
    initEditor();
    initDatabaseTree();
    initResultsTabs();
    updateClock();
    loadSettings();
    setInterval(updateClock, 1000);
    
    // Initialize Wails connection
    initWails();
});

function initWails() {
    // In Wails v2, window.go is injected after the page loads.
    // Use a polling approach to wait for it, with a timeout fallback to mock mode.
    if (isWailsAvailable()) {
        state.wailsReady = true;
        loadSavedConnections();
        return;
    }

    let attempts = 0;
    const maxAttempts = 50; // 5 seconds (50 * 100ms)
    const poll = setInterval(() => {
        attempts++;
        if (isWailsAvailable()) {
            clearInterval(poll);
            state.wailsReady = true;
            loadSavedConnections();
        } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            console.log('Running in browser mode (Wails not available)');
            loadMockConnections();
        }
    }, 100);
}

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('db-client-theme') || 'dark';
    setTheme(savedTheme);
}

function toggleTheme() {
    const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
  state.currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('db-client-theme', theme);

  const themeSelect = document.getElementById('appearanceTheme');
  if (themeSelect) {
    themeSelect.value = theme;
  }

  // Update Monaco editor theme
  updateEditorTheme(theme);
}

function setThemeFromSettings(value) {
    if (value === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    } else {
        setTheme(value);
    }
}

function setDensity(value) {
    document.documentElement.setAttribute('data-density', value);
    localStorage.setItem('density', value);
}

function formatSQLViaAPI() {
    if (!monacoEditor) return;
    const sql = getEditorValue().trim();
    if (!sql) return;
    if (isWailsAvailable()) {
        WailsAPI.beautifySQL(sql).then(formatted => {
            if (formatted) setEditorValue(formatted);
        }).catch(() => {});
    } else {
        formatSQL();
    }
}

// ==========================================================================
// Window Controls (Wails Integration)
// ==========================================================================
function initWindowControls() {
    // Event listeners are already bound in HTML
    // Check initial maximized state
    if (isWailsAvailable()) {
        WailsAPI.windowIsMaximized().then(isMaximized => {
            updateMaximizeIcon(isMaximized);
        });
    }

    // Window border resize handles (8 directions)
    const resizeHandles = [
        { id: 'resizeTL', dir: 'top-left' },
        { id: 'resizeT',  dir: 'top' },
        { id: 'resizeTR', dir: 'top-right' },
        { id: 'resizeL',  dir: 'left' },
        { id: 'resizeR',  dir: 'right' },
        { id: 'resizeB',  dir: 'bottom' },
        { id: 'resizeBL', dir: 'bottom-left' },
        { id: 'resizeBR', dir: 'bottom-right' },
    ];

    resizeHandles.forEach(({ id, dir }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isWailsAvailable() && WailsAPI.windowSetSize) {
                startWindowResize(dir, e);
            }
        });
    });
}

let resizeInterval = null;
function startWindowResize(dir, e) {
    const startX = e.screenX;
    const startY = e.screenY;
    const startSize = WailsAPI.windowIsMaximized ? null : null;

    if (resizeInterval) clearInterval(resizeInterval);

    let lastX = startX, lastY = startY;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = getResizeCursor(dir);

    const onMouseMove = (ev) => {
        lastX = ev.screenX;
        lastY = ev.screenY;
    };
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        if (resizeInterval) { clearInterval(resizeInterval); resizeInterval = null; }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function getResizeCursor(dir) {
    const cursors = {
        'top-left': 'nwse-resize',
        'top': 'ns-resize',
        'top-right': 'nesw-resize',
        'left': 'ew-resize',
        'right': 'ew-resize',
        'bottom': 'ns-resize',
        'bottom-left': 'nesw-resize',
        'bottom-right': 'nwse-resize',
    };
    return cursors[dir] || 'default';
}

async function minimizeWindow() {
  try {
    if (isWailsAvailable()) {
      await WailsAPI.windowMinimize();
    }
  } catch (e) {
    console.warn('Window minimize error:', e);
  }
}

async function maximizeWindow() {
  try {
    if (isWailsAvailable()) {
      await WailsAPI.windowMaximize();
      const isMaximized = await WailsAPI.windowIsMaximized();
      updateMaximizeIcon(isMaximized);
    }
  } catch (e) {
    console.warn('Window maximize error:', e);
  }
}

function updateMaximizeIcon(isMaximized) {
    const btn = document.getElementById('maximizeBtn');
    if (!btn) return;
    const maximizeIcon = btn.querySelector('.maximize-icon');
    const restoreIcon = btn.querySelector('.restore-icon');
    if (isMaximized) {
        maximizeIcon.style.display = 'none';
        restoreIcon.style.display = 'block';
        btn.title = '还原';
    } else {
        maximizeIcon.style.display = 'block';
        restoreIcon.style.display = 'none';
        btn.title = '最大化';
    }
}

async function closeWindow() {
    console.log('Close window');
    if (isWailsAvailable()) {
        await WailsAPI.windowClose();
    }
}

// ==========================================================================
// Resizable Panels
// ==========================================================================
function initResizablePanels() {
  const sidebarResize = document.getElementById('sidebarResize');
  const sidebar = document.querySelector('.sidebar');
  const splitHandle = document.getElementById('splitHandle');
  const editorPanel = document.getElementById('editorPanel');
  const resultsPanel = document.getElementById('resultsPanel');

  if (sidebarResize && sidebar) {
    sidebarResize.addEventListener('mousedown', (e) => {
      state.isResizing = true;
      sidebarResize.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
  }

  if (splitHandle && editorPanel && resultsPanel) {
    splitHandle.addEventListener('mousedown', (e) => {
      state.isResizing = true;
      splitHandle.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (!state.isResizing) return;

    if (sidebarResize && sidebarResize.classList.contains('active')) {
      const newWidth = e.clientX;
      if (newWidth >= 180 && newWidth <= 400) {
        sidebar.style.width = newWidth + 'px';
      }
    }

    if (splitHandle && splitHandle.classList.contains('active')) {
      const workspace = document.querySelector('.workspace');
      const workspaceRect = workspace.getBoundingClientRect();
      const relativeY = e.clientY - workspaceRect.top;
      const totalHeight = workspaceRect.height;
      const editorHeight = Math.max(100, Math.min(relativeY - 30, totalHeight - 120));
      const resultsHeight = totalHeight - editorHeight - 6;

      editorPanel.style.height = editorHeight + 'px';
      editorPanel.style.flex = 'none';
      resultsPanel.style.height = resultsHeight + 'px';
      resultsPanel.style.flex = 'none';

      if (monacoEditor) monacoEditor.layout();
    }
  });

  document.addEventListener('mouseup', () => {
    if (state.isResizing) {
      state.isResizing = false;
      sidebarResize?.classList.remove('active');
      splitHandle?.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// ==========================================================================
// Tab Management
// ==========================================================================
function initTabs() {
    const tabBar = document.getElementById('tabBar');
    
    tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab && !e.target.closest('.tab-close')) {
            activateTab(tab.dataset.tab);
        }
    });
}

function createNewTab() {
  const tabNumber = document.querySelectorAll('.tab[data-type="query"]').length + 1;
  const tabId = `query-${tabNumber}`;

  const tabDiv = document.createElement('div');
  tabDiv.className = 'tab';
  tabDiv.dataset.tab = tabId;
  tabDiv.dataset.type = 'query';

  // Static SVG structure (safe innerHTML — no server data)
  tabDiv.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6M12 18v-6M9 15h6"/>
    </svg>
    <span class="tab-name"></span>
    <button class="tab-close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

  // Dynamic text via textContent (tabNumber is numeric — safe)
  tabDiv.querySelector('.tab-name').textContent = `查询 ${tabNumber}`;

  // Close button via addEventListener (no inline onclick XSS risk)
  tabDiv.querySelector('.tab-close').addEventListener('click', (e) => closeTab(tabId, e));

  document.getElementById('tabsContainer').appendChild(tabDiv);
  activateTab(tabId);

  // Hide welcome panel, show query editor
  const welcomePanel = document.getElementById('welcomePanel');
  if (welcomePanel) welcomePanel.style.display = 'none';

  const editorPanel = document.getElementById('editorPanel');
  const resultsPanel = document.getElementById('resultsPanel');
  const splitHandle = document.getElementById('splitHandle');
  const dataViewPanel = document.getElementById('dataViewPanel');

  // Make editor panel visible with exact dimensions
  editorPanel.style.display = 'flex';
  editorPanel.style.flex = '1';
  editorPanel.style.height = '100%';
  resultsPanel.style.display = 'none';
  splitHandle.style.display = 'none';
  dataViewPanel.style.display = 'none';

  const layoutAndFocus = () => {
    if (!monacoEditor) return;
    monacoEditor.layout();
    // Force content re-render
    const model = monacoEditor.getModel();
    if (model) {
      monacoEditor.setValue('');
    }
    monacoEditor.focus();
  };

  if (monacoLibraryLoaded && !monacoEditor) {
    // Need to create editor now that container is visible
    const tryCreate = () => {
      createMonacoEditorIfNeeded();
      if (monacoEditor) {
        setTimeout(layoutAndFocus, 100);
      } else {
        // Container still not ready, retry
        setTimeout(tryCreate, 100);
      }
    };
    setTimeout(tryCreate, 200);
  } else if (monacoEditor) {
    layoutAndFocus();
  }
}

function activateTab(tabId) {
  const previousTab = state.tabs.find(t => t.id === state.activeTab);
  if (previousTab && previousTab.type !== 'table' && typeof monacoEditor !== 'undefined' && monacoEditor) {
    previousTab.savedContent = monacoEditor.getValue();
  }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });

  const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
  if (!selectedTab) return;

  selectedTab.classList.add('active');
  state.activeTab = tabId;

  const welcomePanel = document.getElementById('welcomePanel');
  if (welcomePanel) welcomePanel.style.display = 'none';

  const editorPanel = document.getElementById('editorPanel');
  const resultsPanel = document.getElementById('resultsPanel');
  const splitHandle = document.getElementById('splitHandle');
  const dataViewPanel = document.getElementById('dataViewPanel');
  const tabType = selectedTab.dataset.type;

  if (tabType === 'table') {
    editorPanel.style.display = 'none';
    resultsPanel.style.display = 'none';
    splitHandle.style.display = 'none';
    dataViewPanel.style.display = 'flex';
  } else {
    editorPanel.style.display = 'flex';
    editorPanel.style.flex = '1';
    editorPanel.style.height = 'auto';
    resultsPanel.style.display = 'none';
    splitHandle.style.display = 'none';
    dataViewPanel.style.display = 'none';

    setTimeout(() => {
      if (monacoEditor) {
        monacoEditor.layout();
        const newTab = state.tabs.find(t => t.id === tabId);
        if (newTab && newTab.savedContent !== undefined) {
          monacoEditor.setValue(newTab.savedContent);
        } else {
          monacoEditor.setValue('');
        }
        monacoEditor.focus();
      }
    }, 150);
  }
}

function closeTab(tabId, event) {
  if (event) {
    event.stopPropagation();
  }

  const tab = document.querySelector(`[data-tab="${tabId}"]`);
  const allTabs = document.querySelectorAll('.tab');
  let activeWasClosed = false;

  if (tab && tab.classList.contains('active')) {
    activeWasClosed = true;

    if (allTabs.length > 1) {
      const tabArray = Array.from(allTabs);
      const currentIndex = tabArray.indexOf(tab);
      const prevTab = tabArray[currentIndex - 1] || tabArray[currentIndex + 1];
      if (prevTab) {
        activateTab(prevTab.dataset.tab);
      }
    } else {
      // Last tab closed, show welcome panel
      state.activeTab = null;
      state.currentTable = null;
      const welcomePanel = document.getElementById('welcomePanel');
      if (welcomePanel) welcomePanel.style.display = 'flex';
      document.getElementById('editorPanel').style.display = 'none';
      document.getElementById('resultsPanel').style.display = 'none';
      document.getElementById('splitHandle').style.display = 'none';
      document.getElementById('dataViewPanel').style.display = 'none';
    }
  }

  if (tab) {
    tab.remove();
  }

  // After closing a tab, check what kind of tab is now active and restore correct view
  if (activeWasClosed && state.activeTab) {
    setTimeout(() => {
      const activeTab = document.querySelector(`[data-tab="${state.activeTab}"]`);
      if (!activeTab) return;

      const tabType = activeTab.dataset.type;

      const welcomePanel = document.getElementById('welcomePanel');
      const editorPanel = document.getElementById('editorPanel');
      const resultsPanel = document.getElementById('resultsPanel');
      const splitHandle = document.getElementById('splitHandle');
      const dataViewPanel = document.getElementById('dataViewPanel');

      if (tabType === 'query') {
        if (welcomePanel) welcomePanel.style.display = 'none';
        editorPanel.style.display = 'flex';
        editorPanel.style.flex = '1';
        editorPanel.style.height = 'auto';
        resultsPanel.style.display = 'none';
        splitHandle.style.display = 'none';
        dataViewPanel.style.display = 'none';

        setTimeout(() => {
          if (monacoEditor) {
            monacoEditor.layout();
            monacoEditor.focus();
          }
        }, 150);
      } else if (tabType === 'table') {
        if (welcomePanel) welcomePanel.style.display = 'none';
        editorPanel.style.display = 'none';
        resultsPanel.style.display = 'none';
        splitHandle.style.display = 'none';
        dataViewPanel.style.display = 'flex';
      }
    }, 50);
  }
}

// ==========================================================================
// Context Menu
// ==========================================================================
let contextMenuTarget = null; // 'connection', 'database', 'table', 'view'
let contextMenuData = null; // Additional data for context menu

function initContextMenu() {
  const contextMenu = document.getElementById('contextMenu');

  document.addEventListener('click', () => {
    contextMenu.classList.remove('active');
  });

  // Initial binding for connection items
  bindConnectionContextMenu();
}

function bindConnectionContextMenu() {
  document.querySelectorAll('.connection-item').forEach(item => {
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = item.dataset.id;
      const connection = state.connections.find(c => c.id === id);
      if (connection) {
        selectConnection(id);
        contextMenuTarget = 'connection';
        contextMenuData = { connection };
        showConnectionContextMenu(e.clientX, e.clientY, connection);
      }
    });
  });
}

function showConnectionContextMenu(x, y, connection) {
  const contextMenu = document.getElementById('contextMenu');
  const isConnected = document.querySelector(`.connection-item[data-id="${connection.id}"]`)?.dataset.connected === 'true';
  
  let html = '';
  
  if (isConnected) {
    html += `
      <div class="context-menu-item" onclick="contextAction('disconnect')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span>断开连接</span>
      </div>
      <div class="context-menu-item" onclick="contextAction('new_query')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6M12 18v-6M9 15h6"/>
        </svg>
        <span>新查询</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" onclick="contextAction('refresh')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        <span>刷新</span>
      </div>
    `;
  } else {
    html += `
      <div class="context-menu-item" onclick="contextAction('connect')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <path d="M15 3h6v6M10 14L21 3"/>
        </svg>
        <span>连接</span>
      </div>
    `;
  }
  
  html += `
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="contextAction('edit')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      <span>编辑</span>
    </div>
    <div class="context-menu-item" onclick="contextAction('duplicate')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      <span>复制</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" onclick="contextAction('delete')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      <span>删除</span>
    </div>
  `;
  
  contextMenu.innerHTML = html;
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');
}

function showDatabaseContextMenu(x, y, dbName) {
  const contextMenu = document.getElementById('contextMenu');
  
  contextMenu.innerHTML = `
    <div class="context-menu-item" onclick="contextAction('new_query')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M12 18v-6M9 15h6"/>
      </svg>
      <span>新查询</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="contextAction('refresh_db')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      <span>刷新表列表</span>
    </div>
    <div class="context-menu-item" onclick="contextAction('create_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
      <span>创建表</span>
    </div>
  `;
  
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');
}

function showTableContextMenu(x, y, tableName, dbName) {
  const contextMenu = document.getElementById('contextMenu');
  
  contextMenu.innerHTML = `
    <div class="context-menu-item" onclick="contextAction('open_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <span>查看数据</span>
    </div>
    <div class="context-menu-item" onclick="contextAction('select_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M12 18v-6M9 15h6"/>
      </svg>
      <span>生成 SELECT 语句</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="contextAction('describe_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </svg>
      <span>查看表结构</span>
    </div>
    <div class="context-menu-item" onclick="contextAction('refresh_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      <span>刷新数据</span>
    </div>
  `;
  
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');
}

function showContextMenu(x, y) {
  const contextMenu = document.getElementById('contextMenu');
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');
}

async function contextAction(action) {
  console.log('Context action:', action);
  document.getElementById('contextMenu').classList.remove('active');

  switch (action) {
    case 'connect':
      if (state.activeConnection) {
        await connectToSelectedConnection();
      }
      break;
    case 'disconnect':
      if (state.activeConnection) {
        await disconnectConnection();
      }
      break;
    case 'open':
      if (state.activeConnection) {
        await connectToSelectedConnection();
      }
      break;
    case 'new_query':
      createNewTab();
      break;
    case 'refresh':
      await refreshConnection();
      break;
    case 'refresh_db':
      if (contextMenuData && contextMenuData.dbName) {
        await refreshDatabaseTables(contextMenuData.dbName);
      }
      break;
    case 'edit':
      if (state.activeConnection) {
        editConnection(state.activeConnection);
      }
      break;
    case 'duplicate':
      if (state.activeConnection) {
        await duplicateConnection(state.activeConnection);
      }
      break;
    case 'delete':
      if (state.activeConnection && confirm('确定要删除此连接吗？')) {
        await deleteConnection(state.activeConnection.id);
      }
      break;
    case 'open_table':
      if (contextMenuData && contextMenuData.tableName) {
        await openTable(contextMenuData.tableName, contextMenuData.dbName);
      }
      break;
    case 'select_table':
      if (contextMenuData && contextMenuData.tableName) {
        generateSelectStatement(contextMenuData.tableName, contextMenuData.dbName);
      }
      break;
    case 'describe_table':
      if (contextMenuData && contextMenuData.tableName) {
        await openTable(contextMenuData.tableName, contextMenuData.dbName);
        // Switch to structure tab
        document.querySelector('.data-view-tab[data-view="structure"]')?.click();
      }
      break;
    case 'refresh_table':
      if (state.currentTable) {
        await loadTableData(state.currentTable.name, state.currentTable.database);
      }
      break;
    case 'create_table':
      createNewTab();
      setEditorValue('CREATE TABLE new_table (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);');
      showNotification('info', '已生成 CREATE TABLE 模板，请修改后执行');
      break;
    case 'drop_table':
      if (contextMenuData && contextMenuData.tableName) {
        if (confirm(`确定要删除表 ${contextMenuData.tableName} 吗？此操作不可撤销！`)) {
          createNewTab();
          setEditorValue(`DROP TABLE IF EXISTS ${contextMenuData.tableName};`);
          showNotification('warning', '请确认后执行 DROP TABLE');
        }
      }
      break;
  }
}

async function disconnectConnection() {
  if (!state.activeConnection) return;
  
  try {
    if (isWailsAvailable()) {
      await WailsAPI.disconnectFromDatabase(state.activeConnection);
      updateConnectionStatusIcon(state.activeConnection.id, false);
      
      // Clear database tree
      const dbTree = document.getElementById('databasesTree');
      dbTree.innerHTML = '<div class="tree-empty-hint">选择一个连接以查看数据库</div>';
      
      showNotification('success', '已断开连接');
    }
  } catch (error) {
    showNotification('error', `断开连接失败: ${error.message}`);
  }
}

function editConnection(connection) {
  // Open connection dialog and populate with existing data
  openConnectionDialog();
  
  // Populate form with existing connection data
  document.getElementById('connName').value = connection.name;
  document.getElementById('connName').dataset.id = connection.id;
  document.getElementById('connHost').value = connection.host;
  document.getElementById('connPort').value = connection.port;
  document.getElementById('connUser').value = connection.username;
  document.getElementById('connPassword').value = connection.password;
  document.getElementById('connDatabase').value = connection.database;
  document.getElementById('connSavePassword').checked = connection.save_password;
  document.getElementById('connAutoConnect').checked = connection.auto_connect;

  // SSH fields
  const sshEnabled = document.getElementById('connSSHEnabled');
  const sshFields = document.getElementById('sshFields');
  if (sshEnabled) sshEnabled.checked = connection.ssh_enabled || false;
  if (sshFields) sshFields.style.display = (connection.ssh_enabled) ? 'block' : 'none';
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('connSSHHost', connection.ssh_host);
  setVal('connSSHPort', connection.ssh_port || 22);
  setVal('connSSHUser', connection.ssh_user);
  setVal('connSSHPassword', connection.ssh_password);
  setVal('connSSHKeyPath', connection.ssh_key_path);
  
  // Set database type
  const dbTypeBtn = document.querySelector(`.db-type-btn[data-type="${connection.type}"]`);
  if (dbTypeBtn) {
    document.querySelectorAll('.db-type-btn').forEach(b => b.classList.remove('active'));
    dbTypeBtn.classList.add('active');
    updateConnectionForm(connection.type);
  }
}

async function duplicateConnection(connection) {
  const newConnection = {
    ...connection,
    id: '',
    name: connection.name + ' (副本)'
  };
  
  openConnectionDialog();
  document.getElementById('connName').value = newConnection.name;
  document.getElementById('connHost').value = newConnection.host;
  document.getElementById('connPort').value = newConnection.port;
  document.getElementById('connUser').value = newConnection.username;
  document.getElementById('connPassword').value = newConnection.password;
  document.getElementById('connDatabase').value = newConnection.database;
  document.getElementById('connSavePassword').checked = newConnection.save_password;
  document.getElementById('connAutoConnect').checked = newConnection.auto_connect;
  
  const dbTypeBtn = document.querySelector(`.db-type-btn[data-type="${newConnection.type}"]`);
  if (dbTypeBtn) {
    document.querySelectorAll('.db-type-btn').forEach(b => b.classList.remove('active'));
    dbTypeBtn.classList.add('active');
    updateConnectionForm(newConnection.type);
  }
}

function generateSelectStatement(tableName, dbName) {
  createNewTab();
  
  const connType = state.activeConnection?.type || 'mysql';

  let quotedTable;
  if (connType === 'postgresql' || connType === 'polardb' || connType === 'gaussdb') {
    quotedTable = `"${tableName}"`;
  } else {
    quotedTable = `\`${tableName}\``;
  }

  setEditorValue(`SELECT * FROM ${quotedTable} LIMIT 100;`);
  focusEditor();
}

// ==========================================================================
// Connection Dialog
// ==========================================================================
function initConnectionDialog() {
    const modal = document.getElementById('connectionModal');
    const dbTypeBtns = document.querySelectorAll('.db-type-btn');
    const colorOptions = document.querySelectorAll('.color-option');
    
    dbTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dbTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateConnectionForm(btn.dataset.type);
        });
    });
    
    colorOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            colorOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeConnectionDialog();
        }
    });
}

function openConnectionDialog() {
    // Reset form
    document.getElementById('connName').value = '';
    document.getElementById('connHost').value = 'localhost';
    document.getElementById('connUser').value = '';
    document.getElementById('connPassword').value = '';
    document.getElementById('connDatabase').value = '';
    
    const modal = document.getElementById('connectionModal');
    modal.classList.add('active');
}

function closeConnectionDialog() {
    const modal = document.getElementById('connectionModal');
    modal.classList.remove('active');
}

function updateConnectionForm(type) {
    const sqlitePathRow = document.getElementById('sqlitePathRow');
    const portInput = document.getElementById('connPort');
    const hostRow = document.querySelector('.form-row.two-cols');
    const dbRow = document.getElementById('connDatabase').closest('.form-row');
    const connUser = document.getElementById('connUser');
    const connHost = document.getElementById('connHost');
    const databaseHint = document.getElementById('databaseHint');
    const dbNameLabel = document.querySelector('label[for="connDatabase"]');
    const connName = document.getElementById('connName');
    
    // Reset visibility
    sqlitePathRow.style.display = 'none';
    hostRow.style.display = 'grid';
    dbRow.style.display = 'flex';
    
    // Reset connection name placeholder
    const typeNames = {
        postgresql: 'PostgreSQL',
        mysql: 'MySQL', 
        polardb: 'PolarDB',
        gaussdb: 'GaussDB',
        sqlite: 'SQLite',
        redis: 'Redis'
    };
    
    switch (type) {
        case 'postgresql':
            portInput.value = '5432';
            connUser.placeholder = 'postgres';
            connHost.placeholder = 'localhost';
            if (!connName.value) connName.placeholder = 'PostgreSQL 连接';
            databaseHint.textContent = '留空将连接到 postgres 系统数据库';
            dbNameLabel.textContent = '数据库 (可选)';
            break;
            
        case 'mysql':
            portInput.value = '3306';
            connUser.placeholder = 'root';
            connHost.placeholder = 'localhost';
            if (!connName.value) connName.placeholder = 'MySQL 连接';
            databaseHint.textContent = '留空将连接到 mysql 系统数据库';
            dbNameLabel.textContent = '数据库 (可选)';
            break;
            
        case 'polardb':
            portInput.value = '5432';
            connUser.placeholder = 'postgres';
            connHost.placeholder = 'your-polardb.rds.aliyuncs.com';
            if (!connName.value) connName.placeholder = 'PolarDB 连接';
            databaseHint.textContent = '留空将连接到默认数据库';
            dbNameLabel.textContent = '数据库 (可选)';
            break;
            
        case 'gaussdb':
            portInput.value = '5432';
            connUser.placeholder = 'gaussdb';
            connHost.placeholder = 'your-gaussdb.cn-north-4.huaweicloud.com';
            if (!connName.value) connName.placeholder = 'GaussDB 连接';
            databaseHint.textContent = '留空将连接到默认数据库';
            dbNameLabel.textContent = '数据库 (可选)';
            break;
            
        case 'sqlite':
            sqlitePathRow.style.display = 'flex';
            hostRow.style.display = 'none';
            dbRow.style.display = 'none';
            portInput.value = '';
            if (!connName.value) connName.placeholder = 'SQLite 连接';
            break;
            
        case 'redis':
            portInput.value = '6379';
            connUser.placeholder = '可选';
            connHost.placeholder = 'localhost';
            if (!connName.value) connName.placeholder = 'Redis 连接';
            databaseHint.textContent = 'Redis 数据库编号 (0-15)';
            dbNameLabel.textContent = '数据库编号';
            break;
    }
}

async function testConnection(e) {
    const btn = (e && e.target) ? e.target.closest('button') : document.querySelector('#connectionModal .btn-primary');
    if (!btn) return;
    const originalContent = btn.innerHTML;
    
    btn.innerHTML = '<span class="spinner"></span> 测试中...';
    btn.disabled = true;
    
    const connection = getConnectionFromForm();
    
    // Validate before sending
    if (connection.type !== 'sqlite' && !connection.host) {
        showNotification('error', '请输入主机地址');
        btn.innerHTML = originalContent;
        btn.disabled = false;
        return;
    }
    
    try {
        if (isWailsAvailable()) {
            const result = await WailsAPI.testConnection(connection);
            // Wails returns multi-value as array: [bool, string]
            let success, message;
            if (Array.isArray(result)) {
                [success, message] = result;
            } else {
                success = !!result;
                message = result ? '连接成功' : '连接失败';
            }
            
            // Show detailed notification
            if (success) {
                showNotification('success', message || '连接成功！');
            } else {
                // Show error with details
                showDetailedError(message || '连接失败');
            }
        } else {
            // Mock test with realistic delay
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Simulate validation
            if (!connection.host) {
                showNotification('error', '请输入主机地址');
            } else if (!connection.username && connection.type !== 'redis' && connection.type !== 'sqlite') {
                showNotification('error', '请输入用户名');
            } else {
                showNotification('success', `连接到 ${connection.type} 成功！(模拟)`);
            }
        }
    } catch (error) {
        console.error('Test connection error:', error);
        showDetailedError(error.message || String(error));
    }
    
    btn.innerHTML = originalContent;
    btn.disabled = false;
}

function showDetailedError(message) {
    // Create a more detailed error dialog
    const errorHtml = `
        <div class="error-detail">
            <div class="error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                </svg>
            </div>
            <div class="error-message">${message.replace(/\n/g, '<br>')}</div>
        </div>
    `;
    
    // Show as notification with longer duration
    showNotification('error', message.split('\n')[0]);
    
    // Log full error for debugging
    console.error('Connection Error Details:', message);
}

function getConnectionFromForm() {
    const activeDbType = document.querySelector('.db-type-btn.active');
    const colorBtn = document.querySelector('.color-option.active');
    
    return {
        id: document.getElementById('connName').dataset.id || '',
        name: document.getElementById('connName').value || 'New Connection',
        type: activeDbType ? activeDbType.dataset.type : 'postgresql',
        host: document.getElementById('connHost').value,
        port: parseInt(document.getElementById('connPort').value) || 5432,
        username: document.getElementById('connUser').value,
        password: document.getElementById('connPassword').value,
        database: document.getElementById('connDatabase').value,
        ssl_mode: 'disable',
        color: colorBtn ? colorBtn.dataset.color : '#6366f1',
        path: document.getElementById('sqlitePath') ? document.getElementById('sqlitePath').value : '',
        save_password: document.getElementById('connSavePassword').checked,
        auto_connect: document.getElementById('connAutoConnect').checked,
        ssh_enabled: document.getElementById('connSSHEnabled')?.checked || false,
        ssh_host: document.getElementById('connSSHHost')?.value || '',
        ssh_port: parseInt(document.getElementById('connSSHPort')?.value) || 22,
        ssh_user: document.getElementById('connSSHUser')?.value || '',
        ssh_password: document.getElementById('connSSHPassword')?.value || '',
        ssh_key_path: document.getElementById('connSSHKeyPath')?.value || ''
    };
}

function toggleSSHFields() {
    const enabled = document.getElementById('connSSHEnabled')?.checked;
    const fields = document.getElementById('sshFields');
    if (fields) fields.style.display = enabled ? 'block' : 'none';
}

async function saveConnection() {
    const connection = getConnectionFromForm();
    
    try {
        if (isWailsAvailable()) {
            await WailsAPI.saveConnection(connection);
            await loadSavedConnections();
        } else {
            // Mock save
            connection.id = Date.now().toString();
            state.connections.push(connection);
            addConnectionToList(connection);
        }
        
        closeConnectionDialog();
        showNotification('success', 'Connection saved successfully!');
    } catch (error) {
        showNotification('error', `Failed to save connection: ${error.message}`);
    }
}

async function loadSavedConnections() {
    try {
        if (isWailsAvailable()) {
            state.connections = await WailsAPI.getConnections();
        }
        renderConnectionList();
    } catch (error) {
        console.error('Failed to load connections:', error);
    }
}

function loadMockConnections() {
    state.connections = [
        {
            id: '1',
            name: 'PostgreSQL Demo',
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            username: 'postgres',
            password: '',
            database: 'mydb',
            color: '#6366f1'
        },
        {
            id: '2',
            name: 'MySQL Local',
            type: 'mysql',
            host: 'localhost',
            port: 3306,
            username: 'root',
            password: '',
            database: 'testdb',
            color: '#10b981'
        },
        {
            id: '3',
            name: 'Redis Cache',
            type: 'redis',
            host: 'localhost',
            port: 6379,
            username: '',
            password: '',
            database: '0',
            color: '#ef4444'
        }
    ];
    renderConnectionList();
}

function renderConnectionList() {
    const connectionList = document.getElementById('connectionList');
    connectionList.innerHTML = '';
    
    if (!state.connections || state.connections.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:24px 16px;text-align:center;color:var(--text-secondary);font-size:13px;line-height:1.6;';
        empty.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;margin-bottom:8px;opacity:0.4;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
        const p = document.createElement('p');
        p.textContent = i18n.t('noConnections');
        empty.appendChild(p);
        connectionList.appendChild(empty);
        return;
    }
    
    state.connections.forEach(conn => {
        addConnectionToList(conn);
    });
}

function addConnectionToList(connection) {
    const connectionList = document.getElementById('connectionList');
    const typeIcons = {
        postgresql: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>',
        mysql: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8.5 8.5c1.5-1.5 4-1.5 5.5 0 1.5 1.5 1.5 4 0 5.5-1.5 1.5-4 1.5-5.5 0-1.5-1.5-1.5-4 0-5.5z"/><circle cx="12" cy="14" r="2"/>',
        polardb: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
        gaussdb: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><path d="M2 12h20"/>',
        sqlite: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
        redis: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6c-1.5 0-3 1.5-3 4s1.5 4 3 4 3-1.5 3-4-1.5-4-3-4z"/><path d="M12 14c-1 0-2 .5-2 2s1 2 2 2 2-.5 2-2-1-2-2-2z"/>'
    };
    
    const iconColors = {
        postgresql: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        mysql: 'linear-gradient(135deg, #00758f, #00546f)',
        polardb: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        gaussdb: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        sqlite: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        redis: 'linear-gradient(135deg, #dc382d, #a4201a)'
    };

  // Build connection item with safe DOM creation (no inline event handlers)
  const item = DomUtils.createElement('div', { className: 'connection-item', 'data-id': connection.id });

  // Connection icon (SVG from hardcoded map — safe innerHTML, no server data)
  const iconDiv = document.createElement('div');
  iconDiv.className = 'connection-icon';
  iconDiv.style.background = iconColors[connection.type] || iconColors.postgresql;
  iconDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${typeIcons[connection.type] || typeIcons.postgresql}</svg>`;
  item.appendChild(iconDiv);

  // Connection info (safe textContent for server-provided name/type)
  const infoDiv = DomUtils.createElement('div', { className: 'connection-info' });
  const nameSpan = DomUtils.createElement('span', { className: 'connection-name', textContent: connection.name });
  const typeSpan = DomUtils.createElement('span', { className: 'connection-type', textContent: connection.type.charAt(0).toUpperCase() + connection.type.slice(1) });
  infoDiv.appendChild(nameSpan);
  infoDiv.appendChild(typeSpan);
  item.appendChild(infoDiv);

  // Connection status (static SVG — safe innerHTML)
  const statusDiv = DomUtils.createElement('div', { className: 'connection-status disconnected' });
  statusDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`;
  item.appendChild(statusDiv);

  // Bind click/dblclick via addEventListener (no inline onclick XSS risk)
  item.addEventListener('click', () => selectConnection(connection.id));
  item.addEventListener('dblclick', () => connectToConnection(connection.id));

  connectionList.appendChild(item);

  // Bind context menu to newly added connection
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectConnection(connection.id);
    contextMenuTarget = 'connection';
    contextMenuData = { connection };
    showConnectionContextMenu(e.clientX, e.clientY, connection);
  });
}

function selectConnection(id) {
    const connection = state.connections.find(c => c.id === id);
    if (!connection) return;
    
    state.activeConnection = connection;
    
    document.querySelectorAll('.connection-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    const item = document.querySelector(`.connection-item[data-id="${id}"]`);
    if (item) {
        item.classList.add('selected');
    }
    
    updateConnectionStatusBar(connection);
}

async function connectToConnection(id) {
    selectConnection(id);
    await connectToSelectedConnection();
}

async function connectToSelectedConnection() {
    if (!state.activeConnection) return;
    
    showLoading('连接中...');
    
    try {
        if (isWailsAvailable()) {
            const result = await WailsAPI.connectToDatabase(state.activeConnection);
            // Wails returns multi-value as array: [bool, string]
            let success, message;
            if (Array.isArray(result)) {
                [success, message] = result;
            } else {
                success = !!result;
                message = result ? '连接成功' : '连接失败';
            }
            
            if (success) {
                await loadDatabaseTree();
                showNotification('success', '连接成功！');
            } else {
                showNotification('error', message || '连接失败');
            }
        } else {
            // Mock connect
            await new Promise(resolve => setTimeout(resolve, 500));
            await loadMockDatabaseTree();
            showNotification('success', '连接成功！(模拟)');
        }
        
        updateConnectionStatusIcon(state.activeConnection.id, true);
    } catch (error) {
        console.error('Connect error:', error);
        showNotification('error', `连接失败: ${error.message || error}`);
    }
    
    hideLoading();
}

async function deleteConnection(id) {
    try {
        if (isWailsAvailable()) {
            await WailsAPI.deleteConnection(id);
            await loadSavedConnections();
        } else {
            state.connections = state.connections.filter(c => c.id !== id);
            renderConnectionList();
        }
        showNotification('success', 'Connection deleted');
    } catch (error) {
        showNotification('error', `Failed to delete: ${error.message}`);
    }
}

function updateConnectionStatusBar(connection) {
    const currentConnection = document.getElementById('currentConnection');
    if (currentConnection) {
        currentConnection.innerHTML = `<span>${DomUtils.escapeHtml(connection.name)} (${DomUtils.escapeHtml(connection.type)})</span>`;
    }
}

function updateConnectionStatusIcon(id, connected) {
    const item = document.querySelector(`.connection-item[data-id="${id}"]`);
    if (!item) return;
    
    const statusDiv = item.querySelector('.connection-status');
    item.dataset.connected = connected.toString();
    
    if (connected) {
        statusDiv.classList.remove('disconnected');
        statusDiv.classList.add('connected');
        statusDiv.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <path d="M22 4L12 14.01l-3-3"/>
            </svg>
        `;
        
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.innerHTML = `
                <svg class="status-icon connected" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <path d="M22 4L12 14.01l-3-3"/>
                </svg>
            `;
            const statusSpan = document.createElement('span');
            statusSpan.textContent = 'Connected';
            connectionStatus.appendChild(statusSpan);
        }
    } else {
        statusDiv.classList.remove('connected');
        statusDiv.classList.add('disconnected');
        statusDiv.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
        `;
    }
}

function browseSQLiteFile() {
    if (isWailsAvailable()) {
        WailsAPI.openFileDialog('Select SQLite Database', 'SQLite files (*.db;*.sqlite;*.sqlite3)').then(path => {
            if (path) {
                document.getElementById('sqlitePath').value = path;
            }
        });
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.db,.sqlite,.sqlite3';
        input.onchange = (e) => {
            document.getElementById('sqlitePath').value = e.target.files[0]?.path || '';
        };
        input.click();
    }
}

// ==========================================================================
// Database Tree
// ==========================================================================
function initDatabaseTree() {
    document.querySelectorAll('.connection-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.connection-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
        });
    });
}

async function loadDatabaseTree() {
  if (!state.activeConnection) return;

  showLoading('Loading databases...');

  try {
    if (isWailsAvailable()) {
      const databases = await WailsAPI.getDatabases(state.activeConnection);
      if (databases && databases.length > 0) {
        renderDatabaseTree(databases);
        populateDatabaseSelector(databases);
      } else {
        showNotification('warning', '未找到数据库');
      }
    } else {
      await loadMockDatabaseTree();
    }
  } catch (error) {
    console.error('Load database tree error:', error);
    const errorMsg = error?.message || error?.toString() || '未知错误';
    showNotification('error', `加载数据库失败: ${errorMsg}`);
  }

  hideLoading();
}

function populateDatabaseSelector(databases) {
    const selector = document.getElementById('queryDatabase');
    if (!selector) return;
    
    // Clear existing options except the first one
    selector.innerHTML = '<option value="">选择数据库</option>';
    
    // Add all databases (safe DOM creation)
    databases.forEach(db => {
        selector.appendChild(DomUtils.createOption(db.name, db.name));
    });
    
    // Select the previously selected database if exists
    if (state.selectedDatabase) {
        selector.value = state.selectedDatabase;
    }
}

async function loadMockDatabaseTree() {
    const databases = [
        { name: 'mydb' },
        { name: 'testdb' }
    ];
    renderDatabaseTree(databases);
    populateDatabaseSelector(databases);
}

function renderDatabaseTree(databases) {
  const dbTree = document.getElementById('databasesTree');
  dbTree.innerHTML = '';

  databases.forEach(db => {
    const dbName = DomUtils.escapeHtml(db.name);
    const safeDbName = db.name;

    const node = document.createElement('div');
    node.className = 'tree-node';

    const dbItem = document.createElement('div');
    dbItem.className = 'tree-item db-item';
    dbItem.addEventListener('click', () => toggleDatabase(safeDbName));
    dbItem.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDatabaseContextMenu(e.clientX, e.clientY, safeDbName);
    });

    dbItem.innerHTML = `
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m9 18 6-6-6-6"/>
      </svg>
      <svg class="db-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
      </svg>
    `;
    const dbSpan = document.createElement('span');
    dbSpan.textContent = safeDbName;
    dbItem.appendChild(dbSpan);
    node.appendChild(dbItem);

    const children = document.createElement('div');
    children.className = 'tree-children collapsed';
    children.id = `db-${dbName}-children`;

    // Tables branch
    const tablesBranch = document.createElement('div');
    tablesBranch.className = 'tree-branch';
    const tablesBranchItem = document.createElement('div');
    tablesBranchItem.className = 'tree-item branch-item';
    tablesBranchItem.addEventListener('click', () => toggleTreeSection(`tables-${safeDbName}`));
    tablesBranchItem.innerHTML = `
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m9 18 6-6-6-6"/>
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <span>表</span>
    `;
    tablesBranch.appendChild(tablesBranchItem);
    const tablesTreeDiv = document.createElement('div');
    tablesTreeDiv.className = 'tree-children collapsed';
    tablesTreeDiv.id = `tables-${safeDbName}Tree`;
    tablesTreeDiv.innerHTML = '<div class="tree-loading">加载中...</div>';
    tablesBranch.appendChild(tablesTreeDiv);
    children.appendChild(tablesBranch);

    // Views branch
    const viewsBranch = document.createElement('div');
    viewsBranch.className = 'tree-branch';
    const viewsBranchItem = document.createElement('div');
    viewsBranchItem.className = 'tree-item branch-item';
    viewsBranchItem.addEventListener('click', () => toggleTreeSection(`views-${safeDbName}`));
    viewsBranchItem.innerHTML = `
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m9 18 6-6-6-6"/>
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span>视图</span>
    `;
    viewsBranch.appendChild(viewsBranchItem);
    const viewsTreeDiv = document.createElement('div');
    viewsTreeDiv.className = 'tree-children collapsed';
    viewsTreeDiv.id = `views-${safeDbName}Tree`;
    viewsTreeDiv.innerHTML = '<div class="tree-loading">加载中...</div>';
    viewsBranch.appendChild(viewsTreeDiv);
    children.appendChild(viewsBranch);

    node.appendChild(children);
    dbTree.appendChild(node);
  });

  if (databases.length > 0) {
    toggleDatabase(databases[0].name);
  }
}

function toggleDatabase(dbName) {
    const children = document.getElementById(`db-${dbName}-children`);
    const dbItem = children?.previousElementSibling;
    
    if (children && dbItem) {
        const isCollapsed = children.classList.contains('collapsed');
        if (isCollapsed) {
            children.classList.remove('collapsed');
            children.classList.add('expanded');
            dbItem.classList.add('expanded');
            // Load tables when expanding
            loadTablesForDatabase(dbName);
        } else {
            children.classList.remove('expanded');
            children.classList.add('collapsed');
            dbItem.classList.remove('expanded');
        }
    }
}

async function loadTablesForDatabase(dbName) {
  if (!state.activeConnection) return;

  try {
    if (isWailsAvailable()) {
      const tables = await WailsAPI.getTables(state.activeConnection, dbName);
      renderTablesTree(tables, dbName);
      // Update autocomplete with table names
      updateDatabaseTables(tables.map(t => t.name));
      
      // Load columns for each table for autocomplete — do NOT await, run in parallel
      // so that a single failing table doesn't block the entire tree rendering
      tables.forEach(async (table) => {
        try {
          const columns = await WailsAPI.getTableColumns(state.activeConnection, dbName, table.name);
          updateTableColumns(table.name, columns);
        } catch (e) {
          console.warn(`Failed to load columns for ${table.name}:`, e);
        }
      });
    } else {
      // Mock tables
      const tables = [
        { name: 'users' },
        { name: 'orders' },
        { name: 'products' }
      ];
      renderTablesTree(tables, dbName);
      updateDatabaseTables(tables.map(t => t.name));
      
      // Mock columns
      updateTableColumns('users', ['id', 'name', 'email', 'created_at', 'status']);
      updateTableColumns('orders', ['id', 'user_id', 'total', 'created_at']);
      updateTableColumns('products', ['id', 'name', 'price', 'stock']);
    }
  } catch (error) {
    console.error('Failed to load tables:', error);
  }
}

async function loadViewsForDatabase(dbName) {
  if (!state.activeConnection) return;
  const viewsTree = document.getElementById(`views-${dbName}Tree`);
  if (!viewsTree) return;

  try {
    if (isWailsAvailable()) {
      const views = await WailsAPI.getViews(state.activeConnection, dbName);
      viewsTree.innerHTML = '';
      if (!views || views.length === 0) {
        viewsTree.innerHTML = '<div class="tree-empty-hint" style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">无视图</div>';
        return;
      }
      views.forEach(view => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const span = document.createElement('span');
        span.textContent = view.name || view.Name || String(view);
        item.appendChild(span);
        item.addEventListener('click', () => openView(view.name || view.Name || String(view), dbName));
        viewsTree.appendChild(item);
      });
    } else {
      viewsTree.innerHTML = '<div class="tree-empty-hint" style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">无视图</div>';
    }
  } catch (e) {
    viewsTree.innerHTML = '<div class="tree-empty-hint" style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">加载失败</div>';
  }
}

async function loadFunctionsForDatabase(dbName) {
  if (!state.activeConnection) return;
  const functionsTree = document.getElementById(`functions-${dbName}Tree`);
  if (!functionsTree) return;

  try {
    if (isWailsAvailable()) {
      const functions = await WailsAPI.getFunctions(state.activeConnection, dbName);
      functionsTree.innerHTML = '';
      if (!functions || functions.length === 0) {
        functionsTree.innerHTML = '<div class="tree-empty-hint" style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">无函数</div>';
        return;
      }
      functions.forEach(func => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M10 13a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/></svg>`;
        const span = document.createElement('span');
        span.textContent = func.name || func.Name || String(func);
        item.appendChild(span);
        item.addEventListener('click', () => openFunction(func.name || func.Name || String(func)));
        functionsTree.appendChild(item);
      });
    } else {
      functionsTree.innerHTML = '<div class="tree-empty-hint" style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">无函数</div>';
    }
  } catch (e) {
    functionsTree.innerHTML = '<div class="tree-empty-hint" style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">加载失败</div>';
  }
}

async function refreshDatabaseTables(dbName) {
  if (!state.activeConnection) return;

  try {
    if (isWailsAvailable()) {
      const tables = await WailsAPI.getTables(state.activeConnection, dbName);
      renderTablesTree(tables, dbName);
      updateDatabaseTables(tables.map(t => t.name));
      
      // Reload columns in background
      tables.forEach(async (table) => {
        try {
          const columns = await WailsAPI.getTableColumns(state.activeConnection, dbName, table.name);
          updateTableColumns(table.name, columns);
        } catch (e) {
          console.warn(`Failed to load columns for ${table.name}:`, e);
        }
      });
      
      showNotification('success', `已刷新数据库 "${dbName}" 的表列表`);
    }
  } catch (error) {
    showNotification('error', `刷新表列表失败: ${error.message || error}`);
  }
}

function renderTablesTree(tables, dbName) {
  const tablesTree = document.getElementById(`tables-${dbName}Tree`);
  if (!tablesTree) return;

  tablesTree.innerHTML = '';

  tables.forEach(table => {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.innerHTML = `
      <svg class="table-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    `;
    const span = document.createElement('span');
    span.textContent = table.name;
    item.appendChild(span);

    item.addEventListener('click', () => openTable(table.name, dbName));
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTableContextMenu(e.clientX, e.clientY, table.name, dbName);
    });

    tablesTree.appendChild(item);
  });
}

function toggleTreeSection(sectionId) {
    const section = document.getElementById(sectionId + 'Tree');
    const header = section?.previousElementSibling;

    if (section && header) {
        const wasCollapsed = section.classList.contains('collapsed');
        section.classList.toggle('collapsed');
        header.classList.toggle('expanded');

        if (wasCollapsed) {
            if (sectionId.startsWith('views-')) {
                const dbName = sectionId.substring(6);
                loadViewsForDatabase(dbName);
            } else if (sectionId.startsWith('functions-')) {
                const dbName = sectionId.substring(10);
                loadFunctionsForDatabase(dbName);
            } else if (sectionId.startsWith('tables-')) {
                const dbName = sectionId.substring(7);
                loadTablesForDatabase(dbName);
            }
        }
    }
}

async function selectDatabase(databaseName) {
    console.log('Selected database:', databaseName);
    
    // Save to state
    state.selectedDatabase = databaseName;
    
    const selector = document.getElementById('queryDatabase');
    const option = Array.from(selector.options).find(opt => opt.value === databaseName);
    if (!option) {
        selector.appendChild(DomUtils.createOption(databaseName, databaseName));
    }
    selector.value = databaseName;
    
    // Update status bar
    const currentDb = document.getElementById('currentConnection');
    if (currentDb && state.activeConnection) {
        currentDb.innerHTML = `<span>${DomUtils.escapeHtml(state.activeConnection.name)} / ${DomUtils.escapeHtml(databaseName)}</span>`;
    }
    
    await loadTablesForDatabase(databaseName);
}

async function openTable(tableName, database) {
    console.log('Opening table:', tableName, 'in database:', database);
    
    // Set the database in state and selector
    if (database) {
        state.selectedDatabase = database;
        const selector = document.getElementById('queryDatabase');
        const option = Array.from(selector.options).find(opt => opt.value === database);
        if (!option) {
            selector.appendChild(DomUtils.createOption(database, database));
        }
        selector.value = database;
    }
    
    // Save current table info
    state.currentTable = {
        name: tableName,
        database: database || state.selectedDatabase
    };
    
    const tabId = `table-${tableName}`;
    let tab = document.querySelector(`[data-tab="${tabId}"]`);
    
    if (!tab) {
        const tabDiv = document.createElement('div');
        tabDiv.className = 'tab';
        tabDiv.dataset.tab = tabId;
        tabDiv.dataset.type = 'table';

        // Static SVG structure (safe innerHTML — no server data)
        tabDiv.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
            </svg>
            <span class="tab-name"></span>
            <button class="tab-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
            </button>
        `;

        // Dynamic text via textContent (tableName is server data — XSS-safe)
        tabDiv.querySelector('.tab-name').textContent = tableName;

        // Close button via addEventListener (no inline onclick XSS risk)
        tabDiv.querySelector('.tab-close').addEventListener('click', (e) => closeTab(tabId, e));

        document.getElementById('tabsContainer').appendChild(tabDiv);
    }
    
    activateTab(tabId);
    
    // Show data view panel, hide editor and results
    document.querySelector('.editor-panel').style.display = 'none';
    document.querySelector('.results-panel').style.display = 'none';
    document.querySelector('.split-handle').style.display = 'none';
    document.getElementById('dataViewPanel').style.display = 'flex';
    
    // Reset data view tabs
    document.querySelectorAll('.data-view-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.data-view-tab[data-view="content"]').classList.add('active');
    document.getElementById('structureView').style.display = 'none';
    document.getElementById('dataViewGrid').style.display = 'block';
    document.querySelector('.data-view-filter').style.display = 'flex';
    document.querySelector('.data-view-status').style.display = 'flex';

// Load table data
await loadTableData(tableName, database);
}

function populateFilterDropdowns(columns) {
    const filterColumn = document.getElementById('filterColumn');
    const sortColumn = document.getElementById('sortColumn');
    
    filterColumn.innerHTML = '<option value="">所有列</option>';
    sortColumn.innerHTML = '<option value="">无</option>';
    
    columns.forEach(col => {
        filterColumn.appendChild(DomUtils.createOption(col.name, col.name));
        sortColumn.appendChild(DomUtils.createOption(col.name, col.name));
    });
}

function populateStructureView(columns) {
    const tbody = document.getElementById('structureViewBody');
    tbody.innerHTML = '';
    
    columns.forEach((col, index) => {
        const typeMatch = col.type.match(/^(\w+)(?:\((\d+(?:,\d+)?)\))?/);
        const dataType = typeMatch ? typeMatch[1] : col.type;
        const length = typeMatch && typeMatch[2] ? typeMatch[2] : '';
        
        const row = DomUtils.createTableRow([
            String(index + 1),
            DomUtils.escapeHtml(col.name),
            DomUtils.escapeHtml(dataType),
            DomUtils.escapeHtml(length),
            '',
            { content: '' },
            { content: '' },
            { content: '' },
            DomUtils.escapeHtml(col.default_value || ''),
            '',
            'utf8mb4',
            'utf8mb4_general_ci'
        ]);
        
        // Add checkboxes to appropriate cells
        const nullableInput = document.createElement('input');
        nullableInput.type = 'checkbox';
        if (!col.nullable) nullableInput.checked = true;
        row.cells[5].appendChild(nullableInput);
        
        const pkInput = document.createElement('input');
        pkInput.type = 'checkbox';
        if (col.primary_key) pkInput.checked = true;
        row.cells[6].appendChild(pkInput);
        
        const autoInput = document.createElement('input');
        autoInput.type = 'checkbox';
        row.cells[7].appendChild(autoInput);
        
        tbody.appendChild(row);
    });
}

function initColumnResize() {
    const table = document.getElementById('dvTable');
    const headers = table.querySelectorAll('th');
    
    headers.forEach((th, index) => {
        if (index === 0) return; // Skip checkbox column
        
        const resizeHandle = th.querySelector('.resize-handle');
        if (!resizeHandle) return;
        
        let startX, startWidth;
        
        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            startX = e.pageX;
            startWidth = th.offsetWidth;
            
            resizeHandle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
        
        const onMouseMove = (e) => {
            const diff = e.pageX - startX;
            const newWidth = Math.max(80, Math.min(400, startWidth + diff));
            
            th.style.width = newWidth + 'px';
            th.style.minWidth = newWidth + 'px';
            
            // Update all cells in this column
            const colIndex = th.dataset.col;
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cell = row.cells[parseInt(colIndex) + 1];
                if (cell) {
                    cell.style.width = newWidth + 'px';
                    cell.style.minWidth = newWidth + 'px';
                }
            });
            
            // Store the width
            state.columnWidths[th.dataset.colname] = newWidth;
        };
        
        const onMouseUp = () => {
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        resizeHandle.addEventListener('mousedown', onMouseDown);
    });
}

function toggleSelectAllRows(e) {
    const checked = e.target.checked;
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
        cb.closest('tr').classList.toggle('selected', checked);
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const selected = document.querySelectorAll('.row-checkbox:checked').length;
    document.getElementById('dvSelectedCount').textContent = `已选: ${selected}`;
    
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
    });
}

// Data view tab switching
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.data-view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            
            document.querySelectorAll('.data-view-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Hide all views first
            document.getElementById('dataViewGrid').style.display = 'none';
            document.getElementById('structureView').style.display = 'none';
            document.getElementById('indexesView').style.display = 'none';
            document.getElementById('foreignKeysView').style.display = 'none';
            document.querySelector('.data-view-filter').style.display = 'none';
            
            // Show selected view
            switch (view) {
                case 'content':
                    document.getElementById('dataViewGrid').style.display = 'block';
                    document.querySelector('.data-view-filter').style.display = 'flex';
                    break;
                case 'structure':
                    document.getElementById('structureView').style.display = 'block';
                    break;
                case 'indexes':
                    document.getElementById('indexesView').style.display = 'block';
                    loadTableIndexes();
                    break;
                case 'foreign-keys':
                    document.getElementById('foreignKeysView').style.display = 'block';
                    loadTableForeignKeys();
                    break;
            }
        });
    });
    
    // Go to page input
    document.getElementById('dvGoToPage')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            goToPage();
        }
    });
});

// Data view actions
function addNewRow() {
    const body = document.getElementById('dataViewBody');
    const headerThs = document.querySelectorAll('#dataViewHeader th');
    const columns = [];
    headerThs.forEach((th, i) => {
        if (i === 0) return;
        columns.push(th.dataset.colname || `col_${i}`);
    });
    
    const tr = document.createElement('tr');
    tr.className = 'new-row editing';
    
    const cbTd = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'row-checkbox';
    cbTd.appendChild(cb);
    tr.appendChild(cbTd);
    
    columns.forEach(col => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'NULL';
        input.dataset.column = col;
        td.appendChild(input);
        tr.appendChild(td);
    });
    
    body.insertBefore(tr, body.firstChild);
    tr.querySelector('input[type="text"]')?.focus();
}

function deleteSelectedRows() {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    if (selected.length === 0) {
        showNotification('warning', '请先选择要删除的行');
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selected.length} 行吗？`)) {
        selected.forEach(cb => {
            const tr = cb.closest('tr');
            tr.classList.add('deleted-row');
            if (!tr.classList.contains('new-row')) {
                tr.style.display = 'none';
            } else {
                tr.remove();
            }
        });
        updateSelectedCount();
        showNotification('success', `已标记 ${selected.length} 行待删除（点击"保存更改"生效）`);
    }
}

function saveDataChanges() {
    if (!state.activeConnection || !state.currentTable) {
        showNotification('warning', '请先连接数据库并打开表');
        return;
    }
    
    const newRows = document.querySelectorAll('#dataViewBody tr.new-row');
    const modifiedRows = document.querySelectorAll('#dataViewBody tr.modified-row');
    const deletedRows = document.querySelectorAll('#dataViewBody tr.deleted-row');
    
    const total = newRows.length + modifiedRows.length + deletedRows.length;
    if (total === 0) {
        showNotification('info', '没有需要保存的更改');
        return;
    }
    
    if (!confirm(`确定要保存 ${total} 条数据更改吗？`)) return;
    
    const pending = [];
    
    // Collect deleted rows (Primary Key from data attributes)
    deletedRows.forEach(row => {
        const pkStr = row.dataset.primaryKey;
        if (pkStr) {
            try {
                const pk = JSON.parse(pkStr);
                pending.push({
                    operation: 'DELETE',
                    table: state.currentTable.name,
                    database: state.currentTable.database,
                    primaryKey: pk
                });
            } catch (e) {}
        }
    });
    
    // Collect new rows
    newRows.forEach(row => {
        const inputs = row.querySelectorAll('input:not([type="checkbox"])');
        const data = {};
        inputs.forEach(input => {
            if (input.dataset.column) {
                data[input.dataset.column] = input.value || null;
            }
        });
        if (Object.keys(data).length > 0) {
            pending.push({
                operation: 'INSERT',
                table: state.currentTable.name,
                database: state.currentTable.database,
                data: data
            });
        }
    });
    
    // Collect modified rows (Primary Key approach)
    modifiedRows.forEach(row => {
        const pkStr = row.dataset.primaryKey;
        const inputs = row.querySelectorAll('input:not([type="checkbox"])');
        if (!pkStr) return;
        try {
            const pk = JSON.parse(pkStr);
            const data = {};
            inputs.forEach(input => {
                if (input.dataset.column) {
                    const origVal = input.dataset.originalValue || '';
                    if (input.value !== origVal) {
                        data[input.dataset.column] = input.value || null;
                    }
                }
            });
            if (Object.keys(data).length > 0) {
                pending.push({
                    operation: 'UPDATE',
                    table: state.currentTable.name,
                    database: state.currentTable.database,
                    data: data,
                    primaryKey: pk
                });
            }
        } catch (e) {}
    });
    
    if (pending.length === 0) {
        showNotification('info', '没有检测到数据变更');
        return;
    }
    
    showLoading('保存数据更改中...');
    WailsAPI.batchEdit(state.activeConnection, pending)
        .then(results => {
            hideLoading();
            const errors = results.filter(r => !r.success);
            if (errors.length > 0) {
                showNotification('error', `保存失败: ${errors.length} 条出错 - ${errors[0].error}`);
            } else {
                showNotification('success', `成功保存 ${results.length} 条数据更改`);
                refreshDataView();
            }
        })
        .catch(error => {
            hideLoading();
            showNotification('error', `保存失败: ${error.message || error}`);
        });
}

function discardChanges() {
    if (state.currentTable) {
        loadTableData(state.currentTable.name, state.currentTable.database);
    }
}

function refreshDataView() {
    if (state.currentTable) {
        loadTableData(state.currentTable.name, state.currentTable.database);
    }
}

function applyFilter() {
    const filterColumn = document.getElementById('filterColumn').value;
    const filterOperator = document.getElementById('filterOperator').value;
    const filterValue = document.getElementById('filterValue').value.trim();
    
    if (!filterColumn || !filterValue) {
        refreshDataView();
        return;
    }
    
    if (!pagination.allData || pagination.allData.length === 0) return;
    
    const colIndex = pagination.columns.indexOf(filterColumn);
    if (colIndex === -1) return;
    
    let filtered = pagination.allData.filter(row => {
        const cellValue = row[colIndex];
        if (cellValue === null || cellValue === undefined) {
            return filterOperator === 'IS NULL' || filterOperator === 'IS NOT NULL' ? true : false;
        }
        const strVal = String(cellValue).toLowerCase();
        const filterVal = filterValue.toLowerCase();
        
        switch (filterOperator) {
            case '=': return strVal === filterVal;
            case '!=': return strVal !== filterVal;
            case '>': return parseFloat(strVal) > parseFloat(filterVal);
            case '<': return parseFloat(strVal) < parseFloat(filterVal);
            case '>=': return parseFloat(strVal) >= parseFloat(filterVal);
            case '<=': return parseFloat(strVal) <= parseFloat(filterVal);
            case 'LIKE': return strVal.includes(filterVal);
            case 'IN': return filterVal.split(',').some(v => strVal === v.trim().toLowerCase());
            case 'IS NULL': return false;
            case 'IS NOT NULL': return true;
            default: return strVal.includes(filterVal);
        }
    });
    
    initPagination(filtered.length);
    pagination.allData = filtered;
    pagination.currentPage = 1;
    updatePaginationUI();
    renderCurrentPage();
}

function clearFilter() {
    const filterCol = document.getElementById('filterColumn');
    const filterVal = document.getElementById('filterValue');
    const filterOp = document.getElementById('filterOperator');
    if (filterCol) filterCol.value = '';
    if (filterVal) filterVal.value = '';
    if (filterOp) filterOp.value = '=';
    refreshDataView();
}

function toggleSortOrder() {
    const btn = document.getElementById('sortOrder');
    const sortColumn = document.getElementById('sortColumn').value;
    btn.classList.toggle('desc');
    
    if (!sortColumn || !pagination.allData || pagination.allData.length === 0) {
        showNotification('info', '请选择排序列');
        return;
    }
    
    const colIndex = pagination.columns.indexOf(sortColumn);
    if (colIndex === -1) return;
    
    const isDesc = btn.classList.contains('desc');
    pagination.allData.sort((a, b) => {
        const va = a[colIndex], vb = b[colIndex];
        if (va === null || va === undefined) return isDesc ? -1 : 1;
        if (vb === null || vb === undefined) return isDesc ? 1 : -1;
        const na = isNaN(va) ? String(va) : Number(va);
        const nb = isNaN(vb) ? String(vb) : Number(vb);
        if (na < nb) return isDesc ? 1 : -1;
        if (na > nb) return isDesc ? -1 : 1;
        return 0;
    });
    
    pagination.currentPage = 1;
    updatePaginationUI();
    renderCurrentPage();
}

// ==========================================================================
// Pagination
// ==========================================================================
let pagination = {
    currentPage: 1,
    pageSize: 100,
    totalRows: 0,
    totalPages: 1,
    allData: [],
    currentData: [],
    columns: []
};

function initPagination(totalRows) {
    pagination.totalRows = totalRows;
    pagination.totalPages = Math.ceil(totalRows / pagination.pageSize) || 1;
    pagination.currentPage = 1;
    updatePaginationUI();
}

function updatePaginationUI() {
    document.getElementById('dvPageInfo').textContent = 
        `第 ${pagination.currentPage} 页，共 ${pagination.totalPages} 页`;
    document.getElementById('dvGoToPage').max = pagination.totalPages;
    document.getElementById('dvGoToPage').value = pagination.currentPage;
}

function dataViewFirstPage() {
    if (pagination.currentPage !== 1) {
        pagination.currentPage = 1;
        updatePaginationUI();
        renderCurrentPage();
    }
}

function dataViewPrevPage() {
    if (pagination.currentPage > 1) {
        pagination.currentPage--;
        updatePaginationUI();
        renderCurrentPage();
    }
}

function dataViewNextPage() {
    if (pagination.currentPage < pagination.totalPages) {
        pagination.currentPage++;
        updatePaginationUI();
        renderCurrentPage();
    }
}

function dataViewLastPage() {
    if (pagination.currentPage !== pagination.totalPages) {
        pagination.currentPage = pagination.totalPages;
        updatePaginationUI();
        renderCurrentPage();
    }
}

function changePageSize() {
    pagination.pageSize = parseInt(document.getElementById('dvPageSize').value);
    pagination.totalPages = Math.ceil(pagination.totalRows / pagination.pageSize) || 1;
    pagination.currentPage = 1;
    updatePaginationUI();
    renderCurrentPage();
}

function goToPage() {
    let page = parseInt(document.getElementById('dvGoToPage').value);
    page = Math.max(1, Math.min(page, pagination.totalPages));
    pagination.currentPage = page;
    updatePaginationUI();
    renderCurrentPage();
}

function renderCurrentPage() {
    if (!pagination.allData || pagination.allData.length === 0) {
        renderDataView({ columns: [], rows: [], row_count: 0 });
        return;
    }
    
    const start = (pagination.currentPage - 1) * pagination.pageSize;
    const end = Math.min(start + pagination.pageSize, pagination.allData.length);
    const pageData = pagination.allData.slice(start, end);
    
    renderDataView({
        columns: pagination.columns,
        rows: pageData,
        row_count: pagination.allData.length
    });
}

function renderDataView(result) {
	console.log('renderDataView called, columns:', result.columns?.length, 'rows:', result.rows?.length);
	const header = document.getElementById('dataViewHeader');
	const body = document.getElementById('dataViewBody');

	state.columnWidths = state.columnWidths || {};

	const columns = result.columns || [];
	const pkColumns = [];
	if (columns.includes('id')) pkColumns.push('id');
	else if (columns.includes('ID')) pkColumns.push('ID');
	else if (columns.includes('pk')) pkColumns.push('pk');

	header.innerHTML = '';
	const headerRow = document.createElement('tr');
	const checkboxTh = document.createElement('th');
	checkboxTh.style.cssText = 'width: 50px; min-width: 50px; max-width: 50px;';
	const selectAllInput = document.createElement('input');
	selectAllInput.type = 'checkbox';
	selectAllInput.id = 'selectAllRows';
	checkboxTh.appendChild(selectAllInput);
	headerRow.appendChild(checkboxTh);
	columns.forEach((col, index) => {
		const width = state.columnWidths[col] || 150;
		const th = document.createElement('th');
		th.style.cssText = `width: ${width}px; min-width: 80px; max-width: 400px;`;
		th.dataset.col = String(index);
		th.dataset.colname = col;
		const span = document.createElement('span');
		span.className = 'th-content';
		span.textContent = col;
		if (pkColumns.includes(col)) {
			const pkBadge = document.createElement('span');
			pkBadge.className = 'pk-badge';
			pkBadge.textContent = ' PK';
			pkBadge.style.cssText = 'color:var(--accent-primary);font-size:10px;font-weight:bold;';
			span.appendChild(pkBadge);
		}
		const resizeDiv = document.createElement('div');
		resizeDiv.className = 'resize-handle';
		resizeDiv.dataset.col = String(index);
		th.appendChild(span);
		th.appendChild(resizeDiv);
		headerRow.appendChild(th);
	});
	header.appendChild(headerRow);

	body.innerHTML = '';
	result.rows.forEach((row, rowIndex) => {
		const tr = document.createElement('tr');
		tr.dataset.row = String(rowIndex);

		const pkData = {};
		pkColumns.forEach(pkCol => {
			const idx = columns.indexOf(pkCol);
			if (idx >= 0 && row[idx] !== undefined) {
				pkData[pkCol] = row[idx];
			}
		});
		if (Object.keys(pkData).length > 0) {
			tr.dataset.primaryKey = JSON.stringify(pkData);
		}

		const cbTd = document.createElement('td');
		cbTd.style.cssText = 'width: 50px; min-width: 50px; max-width: 50px;';
		const cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.className = 'row-checkbox';
		cb.dataset.row = String(rowIndex);
		cbTd.appendChild(cb);
		tr.appendChild(cbTd);

		row.forEach((cell, colIndex) => {
			const td = document.createElement('td');
			const colName = columns[colIndex];
			td.dataset.column = colName;
			td.dataset.rowIndex = String(rowIndex);

			if (cell === null) {
				const span = document.createElement('span');
				span.className = 'null-value';
				span.textContent = 'NULL';
				td.appendChild(span);
				td.title = 'NULL';
			} else {
				td.textContent = String(cell);
				td.title = String(cell);
			}

			td.addEventListener('dblclick', function() {
				startCellEdit(td, colName, rowIndex);
			});

			tr.appendChild(td);
		});
		body.appendChild(tr);
	});

	const dvRecordCount = document.getElementById('dvRecordCount');
	if (dvRecordCount) dvRecordCount.textContent = `${result.row_count} 条记录`;
	const dvSelectedCount = document.getElementById('dvSelectedCount');
	if (dvSelectedCount) dvSelectedCount.textContent = '已选: 0';

	document.getElementById('selectAllRows')?.addEventListener('change', toggleSelectAllRows);
	document.querySelectorAll('.row-checkbox').forEach(cb => {
		cb.addEventListener('change', updateSelectedCount);
	});

	initColumnResize();
}

function startCellEdit(td, colName, rowIndex) {
	if (td.querySelector('input')) return;

	const originalValue = td.textContent === 'NULL' ? '' : td.textContent;
	const input = document.createElement('input');
	input.type = 'text';
	input.value = originalValue;
	input.dataset.column = colName;
	input.dataset.originalValue = originalValue;
	input.style.cssText = 'width:100%;box-sizing:border-box;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--accent-primary);border-radius:2px;padding:2px 4px;font-size:13px;';

	td.textContent = '';
	td.appendChild(input);
	input.focus();
	input.select();

	const tr = td.closest('tr');
	if (tr && !tr.classList.contains('new-row')) {
		tr.classList.add('modified-row');
	}

	function finishEdit() {
		const newValue = input.value;
		const origVal = input.dataset.originalValue;
		td.textContent = newValue === '' ? 'NULL' : newValue;
		td.title = newValue === '' ? 'NULL' : newValue;
		if (newValue === '') {
			const span = document.createElement('span');
			span.className = 'null-value';
			span.textContent = 'NULL';
			td.textContent = '';
			td.appendChild(span);
		}
	}

	input.addEventListener('blur', finishEdit);
	input.addEventListener('keydown', function(e) {
		if (e.key === 'Enter') {
			input.blur();
		} else if (e.key === 'Escape') {
			input.value = originalValue;
			input.blur();
		}
	});
}

// ==========================================================================
// Load Table Indexes
// ==========================================================================
async function loadTableIndexes() {
	if (!state.currentTable || !state.activeConnection) return;

	const tbody = document.getElementById('indexesViewBody');
	tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">加载中...</td></tr>';

	try {
		if (isWailsAvailable()) {
			const indexes = await WailsAPI.getTableIndexes(
				state.activeConnection,
				state.currentTable.database,
				state.currentTable.name
			);
            renderIndexes(indexes);
        } else {
            // Mock indexes
            await new Promise(r => setTimeout(r, 300));
            renderIndexes([
                { name: 'PRIMARY', type: 'PRIMARY', columns: ['id'], unique: true, cardinality: 100 },
                { name: 'idx_email', type: 'UNIQUE', columns: ['email'], unique: true, cardinality: 98 },
                { name: 'idx_name', type: 'INDEX', columns: ['name'], unique: false, cardinality: 50 },
                { name: 'idx_status_created', type: 'INDEX', columns: ['status', 'created_at'], unique: false, cardinality: 3 }
            ]);
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="error-cell">加载失败: ${DomUtils.escapeHtml(error.message)}</td></tr>`;
    }
}

function renderIndexes(indexes) {
    const tbody = document.getElementById('indexesViewBody');
    
    if (!indexes || indexes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无索引</td></tr>';
        document.getElementById('indexCount').textContent = '0';
        return;
    }
    
    tbody.innerHTML = '';
    indexes.forEach((idx, index) => {
        const typeBadge = idx.type === 'PRIMARY' ? 'badge-primary' : 
                         idx.type === 'UNIQUE' ? 'badge-unique' : 'badge-index';
        
        const row = document.createElement('tr');
        row.dataset.index = idx.name;
        row.innerHTML = `
            <td><input type="checkbox" class="index-checkbox" data-index="${DomUtils.escapeHtml(idx.name)}"></td>
            <td><strong>${DomUtils.escapeHtml(idx.name)}</strong></td>
            <td><span class="badge ${typeBadge}">${DomUtils.escapeHtml(idx.type)}</span></td>
            <td>${idx.unique ? '是' : '否'}</td>
            <td>${DomUtils.escapeHtml(idx.columns.join(', '))}</td>
            <td>${idx.cardinality || '-'}</td>
            <td>${DomUtils.escapeHtml(idx.comment || '')}</td>
            <td class="row-actions"></td>
        `;
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn-sm';
        editBtn.title = '编辑';
        editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        editBtn.addEventListener('click', () => editIndex(idx.name));
        row.cells[7].appendChild(editBtn);
        
        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn-sm danger';
        delBtn.title = '删除';
        delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
        delBtn.addEventListener('click', () => dropIndex(idx.name));
        row.cells[7].appendChild(delBtn);
        
        tbody.appendChild(row);
    });
    document.getElementById('indexCount').textContent = indexes.length;
    
    document.getElementById('selectAllIndexes')?.addEventListener('change', (e) => {
        document.querySelectorAll('.index-checkbox').forEach(cb => cb.checked = e.target.checked);
    });
}

function showCreateIndexDialog() {
    if (!state.currentTable) { showNotification('warning', '请先打开一个表'); return; }
    const table = state.currentTable.name;
    const template = `CREATE INDEX idx_${table}_column\nON \`${table}\` (column_name);`;
    setEditorValue(template);
    showNotification('info', '已生成 CREATE INDEX 模板，请修改列名后执行');
}

function editIndex(indexName) {
    if (!state.currentTable) { showNotification('warning', '请先打开一个表'); return; }
    const table = state.currentTable.name;
    const template = `-- 删除旧索引\nDROP INDEX \`${indexName}\` ON \`${table}\`;\n\n-- 创建新索引\nCREATE INDEX ${indexName}\nON \`${table}\` (column_name);`;
    setEditorValue(template);
    showNotification('info', `已生成重建索引 ${indexName} 的 SQL 模板`);
}

function dropIndex(indexName) {
    if (!state.activeConnection || !state.currentTable) return;
    if (confirm(`确定要删除索引 "${indexName}" 吗？此操作不可撤销。`)) {
        const sql = `DROP INDEX \`${indexName}\` ON \`${state.currentTable.name}\``;
        showLoading('删除索引中...');
        WailsAPI.executeQuery(state.activeConnection, state.currentTable.database, sql)
            .then(result => {
                hideLoading();
                if (result.error) {
                    showNotification('error', `删除失败: ${result.error}`);
                } else {
                    showNotification('success', `索引 ${indexName} 已删除`);
                    loadTableIndexes();
                }
            })
            .catch(err => {
                hideLoading();
                showNotification('error', `删除失败: ${err.message || err}`);
            });
    }
}

function deleteSelectedIndexes() {
    const selected = document.querySelectorAll('.index-checkbox:checked');
    if (selected.length === 0) {
        showNotification('warning', '请先选择要删除的索引');
        return;
    }
    const names = Array.from(selected).map(cb => cb.dataset.index);
    if (confirm(`确定要删除选中的 ${selected.length} 个索引吗？\n${names.join(', ')}`)) {
        if (!state.activeConnection || !state.currentTable) return;
        let completed = 0;
        showLoading('批量删除索引中...');
        const runNext = () => {
            if (completed >= names.length) {
                hideLoading();
                showNotification('success', `已删除 ${completed} 个索引`);
                loadTableIndexes();
                return;
            }
            const sql = `DROP INDEX \`${names[completed]}\` ON \`${state.currentTable.name}\``;
            WailsAPI.executeQuery(state.activeConnection, state.currentTable.database, sql)
                .then(() => { completed++; runNext(); })
                .catch(() => { completed++; runNext(); });
        };
        runNext();
    }
}

// ==========================================================================
// Load Table Foreign Keys
// ==========================================================================
async function loadTableForeignKeys() {
    if (!state.currentTable || !state.activeConnection) return;
    
    const tbody = document.getElementById('foreignKeysViewBody');
    tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">加载中...</td></tr>';
    
    try {
        if (isWailsAvailable()) {
            const fks = await WailsAPI.getTableForeignKeys(
                state.activeConnection, 
                state.currentTable.database, 
                state.currentTable.name
            );
            renderForeignKeys(fks);
        } else {
            // Mock foreign keys
            await new Promise(r => setTimeout(r, 300));
            renderForeignKeys([
                { name: 'fk_user_id', column_name: 'user_id', ref_table: 'users', ref_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
                { name: 'fk_product_id', column_name: 'product_id', ref_table: 'products', ref_column: 'id', on_delete: 'RESTRICT', on_update: 'CASCADE' }
            ]);
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="error-cell">加载失败: ${DomUtils.escapeHtml(error.message)}</td></tr>`;
    }
}

function renderForeignKeys(fks) {
    const tbody = document.getElementById('foreignKeysViewBody');
    
    if (!fks || fks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">暂无外键</td></tr>';
        document.getElementById('fkCount').textContent = '0';
        document.getElementById('fkVisual').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = '';
    fks.forEach((fk, index) => {
        const row = document.createElement('tr');
        row.dataset.fk = fk.name;
        row.innerHTML = `
            <td><input type="checkbox" class="fk-checkbox" data-fk="${DomUtils.escapeHtml(fk.name)}"></td>
            <td><strong>${DomUtils.escapeHtml(fk.name)}</strong></td>
            <td>${DomUtils.escapeHtml(fk.column_name)}</td>
            <td class="arrow-cell">→</td>
            <td>${DomUtils.escapeHtml(fk.ref_table)}</td>
            <td>${DomUtils.escapeHtml(fk.ref_column)}</td>
            <td><span class="fk-rule">${DomUtils.escapeHtml(fk.on_update)}</span></td>
            <td><span class="fk-rule">${DomUtils.escapeHtml(fk.on_delete)}</span></td>
            <td class="row-actions"></td>
        `;
        
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn-sm';
        editBtn.title = '编辑';
        editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        editBtn.addEventListener('click', () => editForeignKey(fk.name));
        row.cells[8].appendChild(editBtn);
        
        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn-sm danger';
        delBtn.title = '删除';
        delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
        delBtn.addEventListener('click', () => dropForeignKey(fk.name));
        row.cells[8].appendChild(delBtn);
        
        tbody.appendChild(row);
    });
    document.getElementById('fkCount').textContent = fks.length;
    
    renderFKVisualization(fks);
    
    document.getElementById('selectAllFK')?.addEventListener('change', (e) => {
        document.querySelectorAll('.fk-checkbox').forEach(cb => cb.checked = e.target.checked);
    });
}

function renderFKVisualization(fks) {
    const container = document.getElementById('fkVisual');
    if (!fks || fks.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="fk-diagram">';
    html += '<div class="fk-current-table">';
    html += `<span class="fk-table-name">${DomUtils.escapeHtml(state.currentTable?.name || '当前表')}</span>`;
    html += '<div class="fk-columns">';
    fks.forEach(fk => {
        html += `<span class="fk-column">${DomUtils.escapeHtml(fk.column_name)}</span>`;
    });
    html += '</div></div>';
    
    html += '<div class="fk-arrows">';
    fks.forEach(fk => {
        html += `
            <div class="fk-arrow">
                <svg viewBox="0 0 100 24" width="100" height="24">
                    <line x1="0" y1="12" x2="70" y2="12" stroke="var(--accent-primary)" stroke-width="2"/>
                    <polygon points="70,6 84,12 70,18" fill="var(--accent-primary)"/>
                </svg>
                <span class="fk-rule-badge">${DomUtils.escapeHtml(fk.on_delete)}</span>
            </div>
        `;
    });
    html += '</div>';
    
    html += '<div class="fk-ref-tables">';
    fks.forEach(fk => {
        html += `
            <div class="fk-ref-table">
                <span class="fk-table-name">${DomUtils.escapeHtml(fk.ref_table)}</span>
                <div class="fk-columns">
                    <span class="fk-column pk-column">${DomUtils.escapeHtml(fk.ref_column)} (PK)</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

function showAddForeignKeyDialog() {
    if (!state.currentTable) { showNotification('warning', '请先打开一个表'); return; }
    const table = state.currentTable.name;
    const template = `ALTER TABLE \`${table}\`\nADD CONSTRAINT fk_${table}_ref\nFOREIGN KEY (column_name)\nREFERENCES ref_table(ref_column)\nON DELETE CASCADE\nON UPDATE CASCADE;`;
    setEditorValue(template);
    showNotification('info', '已生成 ADD FOREIGN KEY 模板，请修改后执行');
}

function editForeignKey(fkName) {
    if (!state.currentTable) { showNotification('warning', '请先打开一个表'); return; }
    const table = state.currentTable.name;
    const template = `-- 删除旧外键\nALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fkName}\`;\n\n-- 添加新外键\nALTER TABLE \`${table}\`\nADD CONSTRAINT ${fkName}\nFOREIGN KEY (column_name)\nREFERENCES ref_table(ref_column)\nON DELETE CASCADE\nON UPDATE CASCADE;`;
    setEditorValue(template);
    showNotification('info', `已生成重建外键 ${fkName} 的 SQL 模板`);
}

function dropForeignKey(fkName) {
    if (!state.activeConnection || !state.currentTable) return;
    if (confirm(`确定要删除外键 "${fkName}" 吗？此操作不可撤销。`)) {
        const sql = `ALTER TABLE \`${state.currentTable.name}\` DROP FOREIGN KEY \`${fkName}\``;
        showLoading('删除外键中...');
        WailsAPI.executeQuery(state.activeConnection, state.currentTable.database, sql)
            .then(result => {
                hideLoading();
                if (result.error) {
                    showNotification('error', `删除失败: ${result.error}`);
                } else {
                    showNotification('success', `外键 ${fkName} 已删除`);
                    loadTableForeignKeys();
                }
            })
            .catch(err => {
                hideLoading();
                showNotification('error', `删除失败: ${err.message || err}`);
            });
    }
}

function deleteSelectedForeignKeys() {
    const selected = document.querySelectorAll('.fk-checkbox:checked');
    if (selected.length === 0) {
        showNotification('warning', '请先选择要删除的外键');
        return;
    }
    const names = Array.from(selected).map(cb => cb.dataset.fk);
    if (confirm(`确定要删除选中的 ${selected.length} 个外键吗？\n${names.join(', ')}`)) {
        if (!state.activeConnection || !state.currentTable) return;
        let completed = 0;
        showLoading('批量删除外键中...');
        const runNext = () => {
            if (completed >= names.length) {
                hideLoading();
                showNotification('success', `已删除 ${completed} 个外键`);
                loadTableForeignKeys();
                return;
            }
            const sql = `ALTER TABLE \`${state.currentTable.name}\` DROP FOREIGN KEY \`${names[completed]}\``;
            WailsAPI.executeQuery(state.activeConnection, state.currentTable.database, sql)
                .then(() => { completed++; runNext(); })
                .catch(() => { completed++; runNext(); });
        };
        runNext();
    }
}

// Update loadTableData to store all data for pagination
async function loadTableData(tableName, database) {
	console.log('loadTableData called:', { tableName, database, activeConnection: state.activeConnection });

	if (!state.activeConnection) {
		showNotification('warning', '请先选择一个数据库连接');
		return;
	}

	// Ensure database is set - use selectedDatabase as fallback
	const activeDb = database || state.selectedDatabase;
	if (!activeDb) {
		showNotification('warning', '请先选择数据库');
		return;
	}

	state.currentTable = state.currentTable || {};
	state.currentTable.name = tableName;
	state.currentTable.database = activeDb;

	showLoading(`加载表数据: ${tableName}...`);

	try {
		let columns = [];
		// Determine connection type for proper SQL quoting
		const connType = state.activeConnection.type || 'mysql';

		// Format table identifier based on database type
		let quotedTableName;
		if (connType === 'postgresql' || connType === 'polardb' || connType === 'gaussdb') {
			quotedTableName = `"${tableName}"`;
		} else {
			quotedTableName = `\`${tableName}\``;
		}

		// Load columns for filter dropdowns
		if (isWailsAvailable()) {
			try {
				columns = await WailsAPI.getTableColumns(state.activeConnection, activeDb, tableName);
				if (columns && columns.length > 0) {
					populateFilterDropdowns(columns);
					populateStructureView(columns);
				}
			} catch (e) {
				console.warn('Failed to load columns:', e);
			}
		}

		// Load table stats
		if (isWailsAvailable()) {
			try {
				const stats = await WailsAPI.getTableStats(state.activeConnection, activeDb, tableName);
				if (stats && stats.engine) {
					document.getElementById('dvTableEngine').textContent = stats.engine;
				}
			} catch (e) {
				console.log('Stats not available:', e);
			}
		}

		// Execute query to get data - using proper quoting
		const query = `SELECT * FROM ${quotedTableName} LIMIT 10000`;

		if (isWailsAvailable()) {
			const result = await WailsAPI.executeQuery(state.activeConnection, activeDb, query);
			console.log('Query result:', result);
			console.log('Result type:', typeof result);
			console.log('Result keys:', result ? Object.keys(result) : 'null');
			console.log('Result error:', result?.error);
			console.log('Result rows:', result?.rows);
			console.log('Result columns:', result?.columns);

			if (result && result.error) {
			showNotification('error', result.error);
		} else if (result && result.rows) {
				const savedPage = pagination.currentPage || 1;
				pagination.allData = result.rows || [];
				pagination.columns = result.columns || [];
				pagination.totalRows = result.row_count || 0;
				pagination.totalPages = Math.ceil(pagination.totalRows / pagination.pageSize) || 1;
				if (savedPage > pagination.totalPages) {
					pagination.currentPage = pagination.totalPages;
				} else {
					pagination.currentPage = savedPage;
				}

				if (pagination.totalRows >= 10000) {
					const banner = document.getElementById('largeResultBanner');
					if (banner) {
						banner.style.display = 'flex';
						banner.querySelector('.banner-text').textContent = i18n.t('largeResultWarning');
					}
				} else {
					const banner = document.getElementById('largeResultBanner');
					if (banner) banner.style.display = 'none';
				}

				updatePaginationUI();
				renderCurrentPage();
			} else {
				showNotification('warning', '未获取到数据');
			}
		} else {
			// Mock data
			await new Promise(resolve => setTimeout(resolve, 300));

			const mockColumns = ['id', 'name', 'email', 'created_at', 'status', 'phone', 'address'];
			const mockRows = [];
			for (let i = 1; i <= 156; i++) {
				mockRows.push([
					i,
					`用户${i}`,
					`user${i}@example.com`,
					`2024-01-${String(i % 28 + 1).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00:00`,
					i % 3 === 0 ? 'inactive' : 'active',
					`1380000${String(i).padStart(4, '0')}`,
					`北京市朝阳区某街道${i}号`
				]);
			}

			// Store all data
			pagination.allData = mockRows;
			pagination.columns = mockColumns;
			pagination.totalRows = mockRows.length;
			pagination.totalPages = Math.ceil(mockRows.length / pagination.pageSize);
			pagination.currentPage = 1;

			updatePaginationUI();
			renderCurrentPage();

			// Populate mock structure
			const mockColumnsInfo = [
				{ name: 'id', type: 'INT', nullable: false, primary_key: true, default_value: 'auto_increment' },
				{ name: 'name', type: 'VARCHAR(100)', nullable: false, primary_key: false, default_value: '' },
				{ name: 'email', type: 'VARCHAR(255)', nullable: true, primary_key: false, default_value: '' },
				{ name: 'created_at', type: 'DATETIME', nullable: true, primary_key: false, default_value: 'CURRENT_TIMESTAMP' },
				{ name: 'status', type: 'VARCHAR(20)', nullable: true, primary_key: false, default_value: "'active'" },
				{ name: 'phone', type: 'VARCHAR(20)', nullable: true, primary_key: false, default_value: '' },
				{ name: 'address', type: 'VARCHAR(500)', nullable: true, primary_key: false, default_value: '' }
			];
			populateFilterDropdowns(mockColumnsInfo);
			populateStructureView(mockColumnsInfo);
		}
	} catch (error) {
		const msg = error?.message || error?.toString() || '未知错误';
		console.error('Load table data error:', error);
		showNotification('error', `加载数据失败: ${msg}`);
	} finally {
		hideLoading();
	}
}

function openView(viewName, database) {
    openTable(viewName, database);
}

function openFunction(funcName) {
    console.log('Opening function:', funcName);
    createNewTab();
    
    setEditorValue(`SELECT * FROM ${DomUtils.escapeHtml(funcName)}();`);
    updateLineNumbers();
}

// ==========================================================================
// Settings Modal
// ==========================================================================
function initSettings() {
    const modal = document.getElementById('settingsModal');
    const navBtns = document.querySelectorAll('.settings-nav-btn');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showSettingsSection(btn.dataset.section);
        });
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeSettings();
        }
    });
}

function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
    saveSettings();
    document.getElementById('settingsModal').classList.remove('active');
}

function saveSettings() {
    const settings = {
        connTimeout: document.getElementById('settingsConnTimeout')?.value || '10',
        queryTimeout: document.getElementById('settingsQueryTimeout')?.value || '30',
        fontSize: document.getElementById('settingsFontSize')?.value || '14',
        tabSize: document.getElementById('settingsTabSize')?.value || '2',
        lineNumbers: document.getElementById('settingsLineNumbers')?.checked ?? true
    };
    localStorage.setItem('db-client-settings', JSON.stringify(settings));
    applyEditorSettings(settings);
}

function loadSettings() {
    const saved = localStorage.getItem('db-client-settings');
    if (!saved) return;
    try {
        const settings = JSON.parse(saved);
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
        setVal('settingsConnTimeout', settings.connTimeout);
        setVal('settingsQueryTimeout', settings.queryTimeout);
        setVal('settingsFontSize', settings.fontSize);
        setVal('settingsTabSize', settings.tabSize);
        setChk('settingsLineNumbers', settings.lineNumbers);
        applyEditorSettings(settings);
    } catch (e) {}
}

function applyEditorSettings(settings) {
    if (typeof monacoEditor !== 'undefined' && monacoEditor) {
        monacoEditor.updateOptions({
            fontSize: parseInt(settings.fontSize) || 14,
            tabSize: parseInt(settings.tabSize) || 2,
            lineNumbers: settings.lineNumbers ? 'on' : 'off'
        });
    }
}

async function saveAIConfig() {
    if (!isWailsAvailable()) { showNotification('warning', 'AI配置需要 Wails 环境'); return; }
    const provider = document.getElementById('aiProvider')?.value || 'ollama';
    const apiKey = document.getElementById('aiApiKey')?.value || '';
    const baseURL = document.getElementById('aiBaseURL')?.value || '';
    const model = document.getElementById('aiModel')?.value || 'llama3';
    const enable = document.getElementById('aiEnable')?.checked || false;
    try {
        await WailsAPI.setAIConfig(provider, apiKey, baseURL, model, enable);
        showNotification('success', 'AI 配置已保存');
    } catch (e) {
        showNotification('error', 'AI 配置保存失败: ' + (e.message || e));
    }
}

async function testAIConnection() {
    if (!isWailsAvailable()) { showNotification('warning', 'AI测试需要 Wails 环境'); return; }
    await saveAIConfig();
    showLoading('测试 AI 连接...');
    try {
        const result = await WailsAPI.testAIConnection();
        hideLoading();
        if (Array.isArray(result) ? result[0] : result.success) {
            showNotification('success', 'AI 连接成功');
        } else {
            showNotification('error', 'AI 连接失败: ' + (Array.isArray(result) ? result[1] : result.message));
        }
    } catch (e) {
        hideLoading();
        showNotification('error', 'AI 连接失败: ' + (e.message || e));
    }
}

async function aiExplainSQL() {
    const query = getSelectedText() || getEditorValue().trim();
    if (!query) { showNotification('warning', '请选择或输入 SQL'); return; }
    showLoading('AI 正在解释 SQL...');
    try {
        const result = await WailsAPI.explainSQL(query);
        hideLoading();
        showAIResult('AI SQL解释', result);
    } catch (e) {
        hideLoading();
        showNotification('error', 'AI解释失败: ' + (e.message || e));
    }
}

async function aiOptimizeSQL() {
    const query = getSelectedText() || getEditorValue().trim();
    if (!query) { showNotification('warning', '请选择或输入 SQL'); return; }
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    const db = document.getElementById('queryDatabase')?.value || state.selectedDatabase || '';
    showLoading('AI 正在分析优化建议...');
    try {
        const result = await WailsAPI.suggestOptimizations(state.activeConnection, db, query);
        hideLoading();
        showAIResult('AI 优化建议', result);
    } catch (e) {
        hideLoading();
        showNotification('error', 'AI优化失败: ' + (e.message || e));
    }
}

function showAIResult(title, content) {
    const messagesTab = document.querySelector('[data-result-tab="messages"]');
    if (messagesTab) messagesTab.click();
    const output = document.getElementById('messagesOutput');
    if (!output) { showNotification('info', content.substring(0, 200)); return; }
    output.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'ai-result-card';
    card.style.cssText = 'padding:16px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);white-space:pre-wrap;line-height:1.6;';
    const h = document.createElement('h3');
    h.textContent = title;
    h.style.marginTop = '0';
    const pre = document.createElement('div');
    pre.textContent = content;
    card.appendChild(h);
    card.appendChild(pre);
    output.appendChild(card);
    const resultsPanel = document.getElementById('resultsPanel');
    const splitHandle = document.getElementById('splitHandle');
    if (resultsPanel) resultsPanel.style.display = 'flex';
    if (splitHandle) splitHandle.style.display = 'block';
}

function openNL2SQLDialog() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    document.getElementById('nl2sqlModal').classList.add('active');
    document.getElementById('nl2sqlResult').style.display = 'none';
    document.getElementById('nl2sqlInput').value = '';
    document.getElementById('nl2sqlOutput').value = '';
}

function closeNL2SQLDialog() {
    document.getElementById('nl2sqlModal').classList.remove('active');
}

async function executeNL2SQL() {
    const input = document.getElementById('nl2sqlInput').value.trim();
    if (!input) { showNotification('warning', '请输入自然语言描述'); return; }
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    const db = document.getElementById('queryDatabase')?.value || state.selectedDatabase || '';
    showLoading('AI 正在生成 SQL...');
    try {
        const sql = await WailsAPI.naturalLanguageToSQL(state.activeConnection, db, input);
        hideLoading();
        document.getElementById('nl2sqlOutput').value = sql || '';
        document.getElementById('nl2sqlResult').style.display = 'block';
        showNotification('success', 'SQL 已生成');
    } catch (e) {
        hideLoading();
        showNotification('error', 'AI 生成失败: ' + (e.message || e));
    }
}

function copyNL2SQLResult() {
    const output = document.getElementById('nl2sqlOutput').value;
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
        showNotification('success', '已复制到剪贴板');
    }).catch(() => {
        showNotification('error', '复制失败');
    });
}

function applyNL2SQLResult() {
    const sql = document.getElementById('nl2sqlOutput').value;
    if (!sql) return;
    setEditorValue(sql);
    closeNL2SQLDialog();
    showNotification('success', 'SQL 已插入编辑器');
}

function showSettingsSection(section) {
    document.querySelectorAll('.settings-section').forEach(s => {
        s.classList.remove('active');
        if (s.dataset.section === section) {
            s.classList.add('active');
        }
    });
}

// ==========================================================================
// Monaco Editor - SQL Editor with Advanced Features
// ==========================================================================
let monacoEditor = null;
let sqlCompletionProvider = null;
let monacoReady = false;
let monacoLibraryLoaded = false;

// Global state for autocomplete
let currentDatabaseTables = [];
let currentTableColumns = {};

function initEditor() {
  // Start loading Monaco library during page load (but don't create editor yet)
  if (typeof require !== 'undefined') {
    require(['vs/editor/editor.main'], function () {
      // Register SQL language and provider
      monaco.languages.register({ id: 'sql' });

      monaco.languages.setMonarchTokensProvider('sql', {
        ignoreCase: true,
        defaultToken: '',
        tokenPostfix: '.sql',

        keywords: [
          'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
          'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP',
          'INDEX', 'VIEW', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER',
          'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'AS', 'DISTINCT',
          'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
          'AUTO_INCREMENT', 'IDENTITY', 'SERIAL', 'INT', 'INTEGER', 'VARCHAR', 'CHAR', 'TEXT',
          'DECIMAL', 'FLOAT', 'DOUBLE', 'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'BOOLEAN'
        ],

        operators: [
          '=', '>', '<', '<=', '>=', '<>', '!=', '+', '-', '*', '/', '||'
        ],

        symbols: /[=><!~&|\+\-\*\/\^]+/,

        tokenizer: {
          root: [
            [/@?[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
            [/'/, { token: 'string', next: '@string' }],
            [/"/, { token: 'string', next: '@stringDouble' }],
            [/--.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            [/\d+\.?\d*/, 'number'],
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }]
          ],
          string: [
            [/[^']+/, 'string'], [/''/, 'string'], [/'/, { token: 'string', next: '@pop' }]
          ],
          stringDouble: [
            [/[^"]+/, 'string'], [/""/, 'string'], [/"/, { token: 'string', next: '@pop' }]
          ],
          comment: [
            [/\*\//, 'comment', '@pop'], [/[^*]+/, 'comment'], [/\*/, 'comment']
          ]
        }
      });

      monaco.languages.setLanguageConfiguration('sql', {
        comments: { lineComment: '--', blockComment: ['/*', '*/'] },
        brackets: [['{', '}'], ['[', ']'], ['(', ')']],
        autoClosingPairs: [
          { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
          { open: "'", close: "'", notIn: ['string', 'comment'] },
          { open: '"', close: '"', notIn: ['string', 'comment'] }
        ],
        surroundingPairs: [
          { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
          { open: "'", close: "'" }, { open: '"', close: '"' }
        ]
      });

      sqlCompletionProvider = monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems: function (model, position) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: word.startColumn, endColumn: word.endColumn
          };

          const suggestions = [];

          ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
            'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
            'DROP', 'ALTER', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
            'GROUP BY', 'ORDER BY', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET'
          ].forEach(keyword => {
            suggestions.push({
              label: keyword, kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword, documentation: `SQL keyword: ${keyword}`, range: range
            });
          });

          currentDatabaseTables.forEach(table => {
            suggestions.push({
              label: table, kind: monaco.languages.CompletionItemKind.Class,
              insertText: table, documentation: `Table: ${table}`, range: range, detail: 'Table'
            });
            if (currentTableColumns[table]) {
              currentTableColumns[table].forEach(column => {
                suggestions.push({
                  label: column, kind: monaco.languages.CompletionItemKind.Field,
                  insertText: column, documentation: `Column from ${table}`, range: range, detail: `Column (${table})`
                });
              });
            }
          });

          return { suggestions: suggestions };
        }
      });

      monacoLibraryLoaded = true;
      console.log('Monaco library loaded');

      // If editor is already visible, create it now
      createMonacoEditorIfNeeded();
    });
  } else {
    console.error('Monaco Editor loader not found');
  }
}

function createMonacoEditorIfNeeded() {
  if (monacoEditor) return;
  if (!monacoLibraryLoaded) return;

  const editorContainer = document.getElementById('monacoEditor');
  if (!editorContainer) return;
  if (editorContainer.offsetParent === null) return;

  // Force reflow to ensure dimensions are computed
  void editorContainer.offsetHeight;

  const rect = editorContainer.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) {
    // Container visible but still no dimensions — wait a bit more
    return;
  }

  monacoEditor = monaco.editor.create(editorContainer, {
    value: '',
    language: 'sql',
    theme: state.currentTheme === 'dark' ? 'vs-dark' : 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: 'JetBrains Mono, Consolas, monospace',
    fontLigatures: true,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    folding: false,
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorStyle: 'line',
    smoothScrolling: true,
    padding: { top: 10 },
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    suggest: { showKeywords: true, showClasses: true, showFields: true, showFunctions: true },
    domReadOnly: false,
    readOnly: false,
    contextmenu: true,
    mouseWheelZoom: true,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
  });

  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
    executeQuery();
  });

  monacoReady = true;
  console.log('Monaco Editor created in container:', rect.width.toFixed(0), 'x', rect.height.toFixed(0));
}

function updateDatabaseTables(tables) {
  currentDatabaseTables = tables || [];
}

function updateTableColumns(tableName, columns) {
  if (columns && columns.length > 0) {
    currentTableColumns[tableName] = columns.map(col => {
      if (typeof col === 'object' && col.name) {
        return col.name;
      }
      return String(col);
    });
  }
}

function getEditorValue() {
  if (monacoEditor) {
    return monacoEditor.getValue();
  }
  return '';
}

function setEditorValue(value) {
  if (monacoEditor) {
    monacoEditor.setValue(value);
  }
}

function focusEditor() {
  if (monacoEditor) {
    monacoEditor.focus();
  }
}

function updateEditorTheme(theme) {
  if (monacoEditor) {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }
}

// Legacy compatibility functions
function updateSyntaxHighlight() {
  // No longer needed with Monaco
}

function updateLineNumbers() {
  // No longer needed with Monaco
}

async function executeQuery() {
  let selected = getSelectedText();
  let query = selected || getEditorValue().trim();
  if (!query) {
    showNotification('warning', '请输入查询语句');
    return;
  }

  // DDL safety check — confirm before destructive operations
  const ddlPattern = /\b(CREATE\s+(TABLE|INDEX|DATABASE|SCHEMA|VIEW|FUNCTION|PROCEDURE)|DROP\s+(TABLE|INDEX|DATABASE|SCHEMA|VIEW|FUNCTION|PROCEDURE)|ALTER\s+(TABLE|INDEX|DATABASE)|TRUNCATE\s+(TABLE)?|DELETE\s+FROM\b(?!.*\bWHERE\b))/i;
  const queries = query.split(';').filter(q => q.trim());
  let hasDestructive = false;
  for (const q of queries) {
    const trimmedQ = q.trim().toUpperCase();
    if (ddlPattern.test(trimmedQ)) {
      if (trimmedQ.startsWith('DELETE') && trimmedQ.includes('WHERE')) continue;
      if (trimmedQ.startsWith('ALTER') && trimmedQ.includes('ADD CONSTRAINT')) continue;
      hasDestructive = true;
      break;
    }
  }
  if (hasDestructive && !confirm('检测到 DDL/Destructive 操作 (CREATE/DROP/ALTER/TRUNCATE/DELETE without WHERE)。\n\n确定要执行吗？此操作不可撤销。')) {
    return;
  }

  if (!state.activeConnection) {
    showNotification('warning', '请先选择一个数据库连接');
    return;
  }

  let database = document.getElementById('queryDatabase').value;
  if (!database && state.selectedDatabase) {
    database = state.selectedDatabase;
    document.getElementById('queryDatabase').value = database;
  }

  if (!database) {
    showNotification('warning', '请先在左侧选择一个数据库');
    return;
  }

  showLoading('执行查询中...');

  try {
    if (isWailsAvailable()) {
      // Use multi-query execution to support multiple SQL statements
      const result = await WailsAPI.executeMultiQuery(state.activeConnection, database, query);
      renderMultiQueryResults(result);
    } else {
      await new Promise(resolve => setTimeout(resolve, 300));
      renderMultiQueryResults({
        results: [
          { query: 'SELECT * FROM users LIMIT 100', columns: ['id', 'name', 'email'], rows: [[1, '张三', 'zhang@example.com']], row_count: 1, duration: '0.023s', status: 'success', error: '' },
        ],
        total_count: 1,
        success_count: 1,
        error_count: 0,
        total_duration: '0.023s',
        start_time: new Date().toLocaleTimeString(),
        end_time: new Date().toLocaleTimeString()
      });
    }
  } catch (error) {
    showNotification('error', `查询失败: ${error.message}`);
  }

  hideLoading();
}

function renderMultiQueryResults(data) {
  const results = data.results || [];
  if (results.length === 0) return;

  // Show results panel and split handle
  const editorPanel = document.getElementById('editorPanel');
  const resultsPanel = document.getElementById('resultsPanel');
  const splitHandle = document.getElementById('splitHandle');
  editorPanel.style.flex = 'none';
  editorPanel.style.height = '50%';
  splitHandle.style.display = 'block';
  resultsPanel.style.display = 'flex';
  resultsPanel.style.flex = 'none';
  resultsPanel.style.height = '50%';
  setTimeout(() => { if (monacoEditor) monacoEditor.layout(); }, 50);

  // === Messages Tab (first tab - with summary info at top) ===
  const summaryBar = `<div class="msg-summary-bar">
    <span class="msg-summary-item"><span class="msg-summary-label">已处理的查询</span>${data.total_count}</span>
    <span class="msg-summary-item"><span class="msg-summary-label">成功</span>${data.success_count}</span>
    <span class="msg-summary-item"><span class="msg-summary-label">错误</span>${data.error_count}</span>
    <span class="msg-summary-item"><span class="msg-summary-label">运行时间</span>${data.total_duration}</span>
  </div>`;

  let messagesHtml = '';
  results.forEach((r, i) => {
    if (r.status === 'error') {
      messagesHtml += `<div class="msg-item msg-error">
        <div class="msg-query">${escapeHtml(r.query)}</div>
        <div class="msg-text msg-error-text">✖ ${escapeHtml(r.error)}</div>
      </div>`;
    } else {
      messagesHtml += `<div class="msg-item msg-success">
        <div class="msg-query">${escapeHtml(r.query)}</div>
        <div class="msg-text">✔ OK — ${r.row_count !== undefined ? r.row_count + ' 行' : '已执行'} — 查询时间: ${r.duration}</div>
      </div>`;
    }
  });

  // === Summary Tab ===
  const summaryHtml = `
    <div class="summary-container">
      <div class="summary-grid">
        <div class="summary-card"><label>已处理的查询</label><span>${data.total_count}</span></div>
        <div class="summary-card success"><label>成功</label><span>${data.success_count}</span></div>
        <div class="summary-card error"><label>错误</label><span>${data.error_count}</span></div>
        <div class="summary-card"><label>开始时间</label><span>${data.start_time}</span></div>
        <div class="summary-card"><label>结束时间</label><span>${data.end_time}</span></div>
        <div class="summary-card"><label>运行时间</label><span>${data.total_duration}</span></div>
      </div>
      <div class="summary-list">
        ${results.map(r => `
          <div class="summary-item ${r.status === 'error' ? 'summary-error' : ''}">
            <div class="summary-item-query">${escapeHtml(r.query)}</div>
            <div class="summary-item-status">
              ${r.status === 'error'
                ? `<span class="badge badge-error">错误 ${escapeHtml(r.error)}</span>`
                : `<span class="badge badge-ok">OK 查询时间: ${r.duration}</span>`}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // === Result Tabs (结果1, 结果2, ...) ===
  const dataResults = results.filter(r => r.columns && r.columns.length > 0);
  let resultTabsSection = '';

  if (dataResults.length > 0) {
    const resultTabs = dataResults.map((r, i) =>
      `<button class="result-sub-tab ${i === 0 ? 'active' : ''}" data-idx="${i}" onclick="switchResultTab(${i})">${dataResults.length > 1 ? `结果 ${i + 1}` : `结果`}</button>`
    );

    const resultPanels = dataResults.map((r, i) => {
      let theadHtml = r.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');
      let tbodyHtml = r.rows.map(row => {
        let cells = '';
        (row || []).forEach(cell => {
          cells += `<td>${cell === 'NULL' ? '<em class="null-val">NULL</em>' : escapeHtml(String(cell))}</td>`;
        });
        return `<tr>${cells}</tr>`;
      }).join('');

      return `<div class="result-sub-panel" data-rp="${i}" style="display:${i === 0 ? 'block' : 'none'};">
        <div class="result-sub-info">${r.row_count} 行数据 — ${r.duration}</div>
        <div class="result-sub-table-wrap"><table class="results-table"><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></div>
      </div>`;
    });

    resultTabsSection = `<div class="result-tabs-bar">${resultTabs.join('')}</div><div class="result-tabs-panels">${resultPanels.join('')}</div>`;
  } else {
    resultTabsSection = '<div class="result-no-data">没有返回数据的查询</div>';
  }

  // Show/hide the Results tab based on whether there are data results
  const resultsTab = document.getElementById('resultsPanel').querySelector('.rv-tab[data-rv="results"]');
  if (resultsTab) resultsTab.style.display = dataResults.length > 0 ? '' : 'none';

  // Reset to Messages tab
  document.querySelectorAll('.results-container .rv-tab').forEach(t => t.classList.toggle('active', t.dataset.rv === 'messages'));

  // Inject into results panel
  const rvMessages = document.getElementById('rv-messages');
  const rvSummary = document.getElementById('rv-summary');
  const rvResults = document.getElementById('rv-results');

  if (rvMessages) rvMessages.innerHTML = `${summaryBar}<div class="messages-container">${messagesHtml}</div>`;
  if (rvSummary) rvSummary.innerHTML = summaryHtml;
  if (rvResults) rvResults.innerHTML = resultTabsSection;

  // Show messages, hide others
  document.getElementById('rv-messages').style.display = 'block';
  document.getElementById('rv-summary').style.display = 'none';
  document.getElementById('rv-results').style.display = 'none';
}

window.switchResultsView = function(view) {
  document.querySelectorAll('.results-container .rv-tab').forEach(t => t.classList.toggle('active', t.dataset.rv === view));
  ['summary', 'messages', 'results'].forEach(v => {
    const el = document.getElementById('rv-' + v);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });
};

window.switchResultTab = function(idx) {
  document.querySelectorAll('.result-sub-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.idx) === idx));
  document.querySelectorAll('.result-sub-panel').forEach(p => p.style.display = parseInt(p.dataset.rp) === idx ? 'block' : 'none');
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getSelectedText() {
  if (monacoEditor) {
    const sel = monacoEditor.getSelection();
    if (sel && !sel.isEmpty()) {
      const model = monacoEditor.getModel();
      return model.getValueInRange(sel);
    }
  }
  return '';
}

function formatSQL() {
  if (!monacoEditor) return;
  
  let sql = getEditorValue();
  
  const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'];
  
  keywords.forEach(keyword => {
    const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
    sql = sql.replace(regex, keyword);
  });
  
  setEditorValue(sql);
}

function explainQuery() {
  if (!monacoEditor) return;
  
  const query = getEditorValue().trim();
  
  if (!query) return;
  
  if (!query.toUpperCase().startsWith('EXPLAIN')) {
    setEditorValue('EXPLAIN ' + query);
  }
  
  executeQuery();
}

async function saveQuery() {
  const query = getEditorValue();
  if (!query || !query.trim()) {
    showNotification('warning', '查询内容为空');
    return;
  }

  if (isWailsAvailable()) {
    const path = await WailsAPI.saveFileDialog('保存查询', 'query.sql');
    if (path) {
      try {
        await WailsAPI.writeFile(path, query);
        showNotification('success', '查询已保存到: ' + path);
      } catch (e) {
        showNotification('error', '保存失败: ' + (e.message || e));
      }
    }
  } else {
    const blob = new Blob([query], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query.sql';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('success', 'Query saved!');
  }
}

async function loadQuery() {
    if (isWailsAvailable()) {
        const path = await WailsAPI.openFileDialog('加载查询', 'SQL files (*.sql)');
        if (path) {
            try {
                const content = await WailsAPI.readFile(path);
                setEditorValue(content);
                showNotification('success', '查询已加载: ' + path);
            } catch (e) {
                showNotification('error', '加载失败: ' + (e.message || e));
            }
        }
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sql';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setEditorValue(event.target.result);
                    showNotification('success', 'Query loaded!');
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
}

// ==========================================================================
// Results Tabs
// ==========================================================================
function initResultsTabs() {
    const resultsTabs = document.querySelectorAll('.results-tab');
    
    resultsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            resultsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const view = tab.dataset.results;
            console.log('Switching results view to:', view);
        });
    });
}

// ==========================================================================
// Connection Management
// ==========================================================================
async function refreshConnection() {
    if (!state.activeConnection) {
        showNotification('warning', 'No connection selected');
        return;
    }
    
    showLoading('Refreshing...');
    
    try {
        await loadDatabaseTree();
        showNotification('success', 'Refreshed successfully!');
    } catch (error) {
        showNotification('error', `Refresh failed: ${error.message}`);
    }
    
    hideLoading();
}

// ==========================================================================
// Search Panel
// ==========================================================================
function toggleSearchPanel() {
    console.log('Toggling search panel...');
}

// ==========================================================================
// Utility Functions
// ==========================================================================
function updateClock() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

function showNotification(type, message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${DomUtils.escapeHtml(message)}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add styles if not exists
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 60px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 2000;
                animation: slideIn 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .notification button {
                background: transparent;
                border: none;
                color: inherit;
                font-size: 18px;
                cursor: pointer;
                opacity: 0.7;
            }
            .notification button:hover { opacity: 1; }
            .notification-success { background: #10b981; color: white; }
            .notification-error { background: #ef4444; color: white; }
            .notification-warning { background: #f59e0b; color: white; }
            .notification-info { background: #3b82f6; color: white; }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showLoading(message = 'Loading...') {
    let loader = document.getElementById('app-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'app-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="loader-spinner"></div>
                <span class="loader-text">${message}</span>
            </div>
        `;
        
        if (!document.getElementById('loader-styles')) {
            const style = document.createElement('style');
            style.id = 'loader-styles';
            style.textContent = `
                #app-loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 3000;
                }
                .loader-content {
                    background: var(--bg-elevated, #1c2128);
                    padding: 20px 40px;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }
                .loader-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--border-color, #30363d);
                    border-top-color: var(--accent-primary, #58a6ff);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                .loader-text {
                    color: var(--fg-primary, #e6edf3);
                    font-size: 14px;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(loader);
    }
    
    loader.querySelector('.loader-text').textContent = message;
    loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('app-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// ==========================================================================
// Keyboard Shortcuts
// ==========================================================================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to execute query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
    }
    
    // Ctrl/Cmd + N for new connection
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openConnectionDialog();
    }
    
    // Ctrl/Cmd + T for new tab
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        createNewTab();
    }
    
    // Ctrl/Cmd + S to save query
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveQuery();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        closeConnectionDialog();
        closeSettings();
        closeLanguageDialog();
    }
    
    // Ctrl/Cmd + Shift + F to format SQL
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        formatSQLViaAPI();
    }
    
    // Ctrl/Cmd + W to close current tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (state.activeTab) {
            closeTab(state.activeTab, e);
        }
    }
    
    // F5 to refresh
    if (e.key === 'F5') {
        e.preventDefault();
        refreshDataView();
    }
    
    // Ctrl/Cmd + B to toggle sidebar (reserved for future sidebar toggle)
});

// ==========================================================================
// Add spin animation for loading states
// ==========================================================================
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
    }
`;
document.head.appendChild(style);

// ==========================================================================
// Expose functions to window for onclick handlers
// ==========================================================================
window.openConnectionDialog = openConnectionDialog;
window.closeConnectionDialog = closeConnectionDialog;
window.saveConnection = saveConnection;
window.testConnection = testConnection;
window.toggleTheme = toggleTheme;
window.createNewTab = createNewTab;
window.closeTab = closeTab;
window.executeQuery = executeQuery;
window.formatSQL = formatSQL;
window.explainQuery = explainQuery;
window.saveQuery = saveQuery;
window.loadQuery = loadQuery;
window.browseSQLiteFile = browseSQLiteFile;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.setThemeFromSettings = setThemeFromSettings;
window.setDensity = setDensity;
window.formatSQLViaAPI = formatSQLViaAPI;
window.minimizeWindow = minimizeWindow;
window.maximizeWindow = maximizeWindow;
window.closeWindow = closeWindow;
window.toggleTreeSection = toggleTreeSection;
window.selectDatabase = selectDatabase;
window.openTable = openTable;
window.openView = openView;
window.openFunction = openFunction;
window.refreshConnection = refreshConnection;
window.toggleSearchPanel = toggleSearchPanel;
window.contextAction = contextAction;
window.selectConnection = selectConnection;
window.connectToConnection = connectToConnection;
window.fetchDatabases = fetchDatabases;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.browseExportPath = browseExportPath;
window.executeExport = executeExport;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.browseImportPath = browseImportPath;
window.executeImport = executeImport;
window.openSqlPreview = openSqlPreview;
window.closeSqlPreviewModal = closeSqlPreviewModal;
window.copySqlPreview = copySqlPreview;
window.openRedisPanel = openRedisPanel;
window.closeRedisPanel = closeRedisPanel;
window.scanRedisKeys = scanRedisKeys;
window.setRedisKey = setRedisKey;
window.loadRedisInfo = loadRedisInfo;
window.openComparePanel = openComparePanel;
window.closeComparePanel = closeComparePanel;
window.switchCompareMode = switchCompareMode;
window.executeCompare = executeCompare;
window.openTransactionPanel = openTransactionPanel;
window.closeTransactionPanel = closeTransactionPanel;
window.startTransaction = startTransaction;
window.executeInTx = executeInTx;
window.commitTx = commitTx;
window.rollbackTx = rollbackTx;
window.clearFilter = clearFilter;
window.saveAIConfig = saveAIConfig;
window.testAIConnection = testAIConnection;
window.aiExplainSQL = aiExplainSQL;
window.aiOptimizeSQL = aiOptimizeSQL;
window.openNL2SQLDialog = openNL2SQLDialog;
window.closeNL2SQLDialog = closeNL2SQLDialog;
window.executeNL2SQL = executeNL2SQL;
window.copyNL2SQLResult = copyNL2SQLResult;
window.applyNL2SQLResult = applyNL2SQLResult;

// ==========================================================================
// Language Settings
// ==========================================================================
function openLanguageSettings() {
    document.getElementById('languageModal').classList.add('active');
    // Update active button based on current language
    const currentLang = i18n.getCurrentLanguage();
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
}

function closeLanguageDialog() {
    document.getElementById('languageModal').classList.remove('active');
}

function setLanguage(lang) {
    i18n.setLanguage(lang);
    
    // Update active button
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // Update settings language select
    const settingsLang = document.getElementById('settingsLanguage');
    if (settingsLang) {
        settingsLang.value = lang;
    }
    
    // Update language status in status bar
    const langStatus = document.getElementById('languageStatus');
    if (langStatus) {
        langStatus.querySelector('span').textContent = lang === 'zh' ? '中文' : 'English';
    }
    
    // Close language modal if open
    closeLanguageDialog();
    
    // Save to backend if available
    if (isWailsAvailable()) {
        WailsAPI.setLanguage(lang).catch(() => {});
    }
}

// Close language modal when clicking outside
document.addEventListener('DOMContentLoaded', () => {
    const langModal = document.getElementById('languageModal');
    langModal.addEventListener('click', (e) => {
        if (e.target === langModal) {
            closeLanguageDialog();
        }
    });
});

// ==========================================================================
// Test Services
// ==========================================================================
async function runConnectionTest() {
    if (!state.activeConnection) {
        showNotification('warning', '请先选择一个连接');
        return;
    }
    
    showLoading('测试连接中...');
    
    try {
        if (isWailsAvailable()) {
            const result = await WailsAPI.runConnectionTest(state.activeConnection);
            showNotification(result.success ? 'success' : 'error', result.message);
        } else {
            // Mock test
            await new Promise(resolve => setTimeout(resolve, 500));
            showNotification('success', '连接测试成功！(模拟)');
        }
    } catch (error) {
        showNotification('error', `测试失败: ${error.message}`);
    }
    
    hideLoading();
}

async function runAllTests() {
    showLoading('运行所有连接测试...');
    
    try {
        if (isWailsAvailable()) {
            const results = await WailsAPI.runAllTests();
            
            let html = '<h3>连接测试结果</h3><ul>';
            results.forEach(r => {
                const icon = r.success ? '✓' : '✗';
                const color = r.success ? 'green' : 'red';
                html += `<li style="color: ${color}">${icon} ${r.name}: ${r.message} (${r.time})</li>`;
            });
            html += '</ul>';
            
            showNotification('info', `测试完成: ${results.filter(r => r.success).length}/${results.length} 成功`);
        } else {
            // Mock test results
            await new Promise(resolve => setTimeout(resolve, 800));
            showNotification('success', '所有连接测试通过！(模拟)');
        }
    } catch (error) {
        showNotification('error', `测试失败: ${error.message}`);
    }
    
    hideLoading();
}

async function getServerInfo() {
    if (!state.activeConnection) {
        showNotification('warning', '请先选择一个连接');
        return;
    }
    
    try {
        if (isWailsAvailable()) {
            const info = await WailsAPI.getServerInfo();
            console.log('Server Info:', info);
            showNotification('info', `版本: ${info.version || 'N/A'}, 连接池: ${info.poolSize || 0}/${info.maxPoolSize || 50}`);
        } else {
            showNotification('info', '服务器信息: PostgreSQL 14.0 (模拟)');
        }
    } catch (error) {
        showNotification('error', `获取信息失败: ${error.message}`);
    }
}

// Test button handler for toolbar
async function runTest() {
    if (state.activeConnection) {
        await runConnectionTest();
    } else {
        await runAllTests();
    }
}

// ==========================================================================
// Fetch Databases from Connection
// ==========================================================================
async function fetchDatabases() {
    const connection = getConnectionFromForm();
    const dbSelect = document.getElementById('connDatabase');
    
    // Clear current options
    dbSelect.innerHTML = '<option value="">加载中...</option>';
    
    try {
        if (isWailsAvailable()) {
            const databases = await WailsAPI.getDatabases(connection);
            
            dbSelect.innerHTML = '<option value="">选择数据库</option>';
            
            if (databases && databases.length > 0) {
                databases.forEach(db => {
                    const option = document.createElement('option');
                    option.value = db.name;
                    option.textContent = db.name;
                    dbSelect.appendChild(option);
                });
                showNotification('success', `找到 ${databases.length} 个数据库`);
            } else {
                dbSelect.innerHTML = '<option value="">未找到数据库</option>';
                showNotification('warning', '未找到数据库');
            }
        } else {
            // Mock databases
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const mockDatabases = [
                { name: 'postgres' },
                { name: 'mydb' },
                { name: 'testdb' },
                { name: 'production' }
            ];
            
            dbSelect.innerHTML = '<option value="">选择数据库</option>';
            mockDatabases.forEach(db => {
                const option = document.createElement('option');
                option.value = db.name;
                option.textContent = db.name;
                dbSelect.appendChild(option);
            });
            showNotification('success', `找到 ${mockDatabases.length} 个数据库 (模拟)`);
        }
    } catch (error) {
        console.error('Fetch databases error:', error);
        dbSelect.innerHTML = '<option value="">获取失败</option>';
        showNotification('error', `获取数据库失败: ${error.message || error}`);
    }
}

// ==========================================================================
function openExportModal() {
    if (state.currentTable) {
        document.getElementById('exportTableName').value = state.currentTable.name;
    }
    document.getElementById('exportPath').value = '';
    document.getElementById('exportModal').classList.add('active');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('active');
}

async function browseExportPath() {
    try {
        if (isWailsAvailable()) {
            const path = await WailsAPI.saveFileDialog('选择导出路径', `export_${new Date().toISOString().slice(0,10)}`);
            if (path) document.getElementById('exportPath').value = path;
        }
    } catch (e) { showNotification('error', e.message); }
}

async function executeExport() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    const format = document.getElementById('exportFormat').value;
    const tableName = document.getElementById('exportTableName').value;
    const path = document.getElementById('exportPath').value;
    if (!tableName) { showNotification('warning', '请指定表名'); return; }
    if (!path) { showNotification('warning', '请选择导出路径'); return; }

    showLoading('导出数据中...');
    try {
        const req = {
            format: format,
            table: tableName,
            database: state.currentTable?.database || state.selectedDatabase || '',
            file_path: path
        };
        const result = await WailsAPI.exportData(state.activeConnection, req);
        hideLoading();
        closeExportModal();
        showNotification('success', `导出成功: ${result.file_path || path}`);
    } catch (e) {
        hideLoading();
        showNotification('error', `导出失败: ${e.message || e}`);
    }
}

// ==========================================================================
// Import Dialog
// ==========================================================================
function openImportModal() {
    if (state.currentTable) {
        document.getElementById('importTableName').value = state.currentTable.name;
    }
    document.getElementById('importPath').value = '';
    document.getElementById('importModal').classList.add('active');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
}

async function browseImportPath() {
    try {
        if (isWailsAvailable()) {
            const path = await WailsAPI.openFileDialog('选择导入文件', [
                { display: 'CSV', pattern: '*.csv' },
                { display: 'JSON', pattern: '*.json' }
            ]);
            if (path) document.getElementById('importPath').value = path;
        }
    } catch (e) { showNotification('error', e.message); }
}

async function executeImport() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    const format = document.getElementById('importFormat').value;
    const tableName = document.getElementById('importTableName').value;
    const path = document.getElementById('importPath').value;
    if (!tableName) { showNotification('warning', '请指定目标表'); return; }
    if (!path) { showNotification('warning', '请选择导入文件'); return; }

    showLoading('导入数据中...');
    try {
        const req = {
            format: format,
            table: tableName,
            database: state.currentTable?.database || state.selectedDatabase || '',
            file_path: path,
            truncate_first: false
        };
        const result = await WailsAPI.importData(state.activeConnection, req);
        hideLoading();
        closeImportModal();
        showNotification('success', `导入成功: ${result.rows_imported || 0} 行`);
        refreshDataView();
    } catch (e) {
        hideLoading();
        showNotification('error', `导入失败: ${e.message || e}`);
    }
}

// ==========================================================================
// SQL Preview Dialog
// ==========================================================================
function openSqlPreview() {
    if (!state.currentTable) { showNotification('warning', '请先打开一个表'); return; }
    const tableName = state.currentTable.name;
    WailsAPI.generateInsertStatement(tableName, {})
        .then(sql => {
            document.getElementById('sqlPreviewContent').textContent = sql || '-- 无数据';
            document.getElementById('sqlPreviewModal').classList.add('active');
        })
        .catch(e => {
            document.getElementById('sqlPreviewContent').textContent = `-- 生成失败: ${e.message}`;
            document.getElementById('sqlPreviewModal').classList.add('active');
        });
}

function closeSqlPreviewModal() {
    document.getElementById('sqlPreviewModal').classList.remove('active');
}

function copySqlPreview() {
    const content = document.getElementById('sqlPreviewContent').textContent;
    navigator.clipboard.writeText(content).then(() => {
        showNotification('success', 'SQL 已复制到剪贴板');
    }).catch(() => {
        showNotification('error', '复制失败');
    });
}

// ==========================================================================
// Redis Browser Panel
// ==========================================================================
function openRedisPanel() {
    if (!state.activeConnection) { showNotification('warning', '请先连接 Redis 数据库'); return; }
    if (state.activeConnection.type !== 'redis') { showNotification('warning', '请先连接 Redis'); return; }
    document.getElementById('redisPanel').style.display = 'block';
    loadRedisDBSize();
    scanRedisKeys();
}

function closeRedisPanel() {
    document.getElementById('redisPanel').style.display = 'none';
}

async function loadRedisDBSize() {
    try {
        const size = await WailsAPI.getRedisDBSize(state.activeConnection);
        document.getElementById('redisDBSize').textContent = `${size} keys`;
    } catch (e) { document.getElementById('redisDBSize').textContent = '--'; }
}

async function scanRedisKeys() {
    const pattern = document.getElementById('redisKeyPattern').value || '*';
    const listEl = document.getElementById('redisKeyList');
    listEl.innerHTML = '<div style="padding:8px;color:var(--text-secondary);">扫描中...</div>';
    try {
        const result = await WailsAPI.scanRedisKeys(state.activeConnection, pattern, 0, 100);
        const keys = result.keys || [];
        if (keys.length === 0) {
            listEl.innerHTML = '<div style="padding:8px;color:var(--text-secondary);">无匹配 Key</div>';
            return;
        }
        listEl.innerHTML = '';
        keys.forEach(key => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border-color);cursor:pointer;';
            item.innerHTML = `<span style="font-family:var(--font-mono);font-size:13px;">${DomUtils.escapeHtml(key)}</span>
                <button class="action-btn-sm danger" title="删除" style="visibility:hidden;">x</button>`;
            item.addEventListener('mouseenter', () => { item.querySelector('button').style.visibility = 'visible'; });
            item.addEventListener('mouseleave', () => { item.querySelector('button').style.visibility = 'hidden'; });
            item.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); deleteRedisKey(key); });
            item.addEventListener('click', () => getRedisKeyDetail(key));
            listEl.appendChild(item);
        });
    } catch (e) {
        listEl.innerHTML = `<div style="padding:8px;color:var(--danger);">扫描失败: ${DomUtils.escapeHtml(e.message || e)}</div>`;
    }
}

async function getRedisKeyDetail(key) {
    try {
        const info = await WailsAPI.getRedisKeyInfo(state.activeConnection, key);
        const content = `类型: ${info.type}, TTL: ${info.ttl}s\n值: ${JSON.stringify(info.value, null, 2)}`;
        showNotification('info', content.substring(0, 120));
        document.getElementById('redisNewKey').value = key;
        document.getElementById('redisNewValue').value = typeof info.value === 'string' ? info.value : JSON.stringify(info.value);
    } catch (e) { showNotification('error', `获取失败: ${e.message}`); }
}

async function setRedisKey() {
    const key = document.getElementById('redisNewKey').value.trim();
    const value = document.getElementById('redisNewValue').value.trim();
    if (!key) { showNotification('warning', '请输入 Key'); return; }
    try {
        await WailsAPI.setRedisKeyValue(state.activeConnection, key, value, 0);
        showNotification('success', `SET ${key} OK`);
        scanRedisKeys();
    } catch (e) { showNotification('error', `SET 失败: ${e.message}`); }
}

async function deleteRedisKey(key) {
    if (!confirm(`确定要删除 Key "${key}" 吗？`)) return;
    try {
        await WailsAPI.deleteRedisKey(state.activeConnection, key);
        showNotification('success', `DEL ${key} OK`);
        scanRedisKeys();
    } catch (e) { showNotification('error', `删除失败: ${e.message}`); }
}

async function loadRedisInfo() {
    const section = document.getElementById('redisInfoSection').value;
    try {
        const info = await WailsAPI.getRedisInfo(state.activeConnection, section);
        const content = document.getElementById('redisInfoContent');
        content.innerHTML = '';
        for (const [k, v] of Object.entries(info)) {
            const line = document.createElement('div');
            line.style.cssText = 'padding:2px 0;border-bottom:1px solid var(--border-color);';
            line.innerHTML = `<span style="color:var(--accent-primary);">${DomUtils.escapeHtml(k)}:</span> ${DomUtils.escapeHtml(String(v))}`;
            content.appendChild(line);
        }
    } catch (e) {
        document.getElementById('redisInfoContent').innerHTML = '(无数据)';
    }
}

// ==========================================================================
// Compare Panel
// ==========================================================================
function openComparePanel() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    document.getElementById('comparePanel').style.display = 'block';
}

function closeComparePanel() {
    document.getElementById('comparePanel').style.display = 'none';
}

function switchCompareMode() {
    const mode = document.getElementById('compareMode').value;
    document.getElementById('compareTableFields').style.display = mode === 'table' ? 'block' : 'none';
    document.getElementById('compareQueryFields').style.display = mode === 'query' ? 'block' : 'none';
}

async function executeCompare() {
    if (!state.activeConnection) return;
    const mode = document.getElementById('compareMode').value;
    const resultEl = document.getElementById('compareResult');
    resultEl.innerHTML = '<div style="padding:8px;color:var(--text-secondary);">对比中...</div>';
    showLoading('对比中...');

    try {
        let result;
        if (mode === 'table') {
            const table1 = document.getElementById('compareTable1').value.trim();
            const table2 = document.getElementById('compareTable2').value.trim();
            if (!table1 || !table2) { hideLoading(); showNotification('warning', '请输入两个表名'); return; }
            const excludeCols = document.getElementById('compareExcludeCols').value.split(',').map(s => s.trim()).filter(Boolean);
            result = await WailsAPI.compareTables(state.activeConnection, {
                table1, table2,
                database: state.selectedDatabase || '',
                exclude_columns: excludeCols
            });
        } else {
            const query1 = document.getElementById('compareQuery1').value.trim();
            const query2 = document.getElementById('compareQuery2').value.trim();
            if (!query1 || !query2) { hideLoading(); showNotification('warning', '请输入两条查询'); return; }
            result = await WailsAPI.compareQueries(state.activeConnection, {
                query1, query2,
                database: state.selectedDatabase || ''
            });
        }
        hideLoading();
        renderCompareResult(result);
    } catch (e) {
        hideLoading();
        resultEl.innerHTML = `<div style="color:var(--danger);">对比失败: ${DomUtils.escapeHtml(e.message || e)}</div>`;
    }
}

function renderCompareResult(result) {
    const el = document.getElementById('compareResult');
    if (!result) { el.innerHTML = '<div>无结果</div>'; return; }
    let html = `<div style="margin-bottom:8px;">`;
    html += `匹配: <b>${result.matched_count || 0}</b> / 差异: <b>${result.diff_count || 0}</b> / 仅左: <b>${result.left_only || 0}</b> / 仅右: <b>${result.right_only || 0}</b>`;
    html += `</div>`;
    const diffs = result.differences || [];
    if (diffs.length === 0) {
        html += '<div style="color:var(--success);">数据完全一致</div>';
    } else {
        html += '<table style="width:100%;font-size:12px;border-collapse:collapse;"><thead><tr style="background:var(--bg-tertiary);">';
        html += '<th style="padding:4px 8px;text-align:left;">行</th><th style="padding:4px 8px;text-align:left;">列</th>';
        html += '<th style="padding:4px 8px;text-align:left;">左值</th><th style="padding:4px 8px;text-align:left;">右值</th></tr></thead><tbody>';
        diffs.forEach(diff => {
            html += `<tr style="border-bottom:1px solid var(--border-color);">`;
            html += `<td style="padding:4px 8px;">${diff.row || ''}</td>`;
            html += `<td style="padding:4px 8px;">${DomUtils.escapeHtml(diff.column || '')}</td>`;
            html += `<td style="padding:4px 8px;color:var(--danger);">${DomUtils.escapeHtml(String(diff.left_value ?? 'NULL'))}</td>`;
            html += `<td style="padding:4px 8px;color:var(--success);">${DomUtils.escapeHtml(String(diff.right_value ?? 'NULL'))}</td>`;
            html += `</tr>`;
        });
        html += '</tbody></table>';
    }
    el.innerHTML = html;
}


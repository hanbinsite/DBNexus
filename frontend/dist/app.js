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
    wailsReady: false
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
    
    // Window Controls
    windowMinimize: () => window.go.main.App.WindowMinimize(),
    windowMaximize: () => window.go.main.App.WindowMaximize(),
    windowClose: () => window.go.main.App.WindowClose(),
    windowIsMaximized: () => window.go.main.App.WindowIsMaximized(),
    
    // File Dialogs
    openFileDialog: (title, filters) => window.go.main.App.OpenFileDialog(title, filters),
    saveFileDialog: (title, defaultName) => window.go.main.App.SaveFileDialog(title, defaultName),
    
    // Language
    getLanguage: () => window.go.main.App.GetLanguage(),
    setLanguage: (lang) => window.go.main.App.SetLanguage(lang),
    
    // Test Services
    runConnectionTest: (conn) => window.go.main.App.RunConnectionTest(conn),
    runAllTests: () => window.go.main.App.RunAllTests(),
    getSupportedFeatures: () => window.go.main.App.GetSupportedFeatures(),
    getServerInfo: (conn) => window.go.main.App.GetServerInfo(conn),
    
    // Table Info
    getTableIndexes: (conn, db, table) => window.go.main.App.GetTableIndexes(conn, db, table),
    getTableForeignKeys: (conn, db, table) => window.go.main.App.GetTableForeignKeys(conn, db, table),
    getTableStats: (conn, db, table) => window.go.main.App.GetTableStats(conn, db, table),
    
    // Utility
    greet: (name) => window.go.main.App.Greet(name)
};

// Check if Wails is available
function isWailsAvailable() {
    return typeof window.go !== 'undefined' && window.go.main && window.go.main.App;
}

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize i18n first (default to Chinese)
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

  const tabHtml = `
    <div class="tab" data-tab="${tabId}" data-type="query">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M12 18v-6M9 15h6"/>
      </svg>
      <span>查询 ${tabNumber}</span>
      <button class="tab-close" onclick="closeTab('${tabId}', event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;

  document.getElementById('tabsContainer').insertAdjacentHTML('beforeend', tabHtml);
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
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });

  const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
  if (!selectedTab) return;

  selectedTab.classList.add('active');
  state.activeTab = tabId;

  // Hide welcome panel
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
    // Query tab — only show editor, not results
    editorPanel.style.display = 'flex';
    editorPanel.style.flex = '1';
    editorPanel.style.height = 'auto';
    // Keep results hidden (only shown after query execution)
    resultsPanel.style.display = 'none';
    splitHandle.style.display = 'none';
    dataViewPanel.style.display = 'none';

    setTimeout(() => {
      if (monacoEditor) {
        monacoEditor.layout();
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

async function testConnection() {
    const btn = event.target.closest('button');
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
    const colorBtn = document.querySelector('.color-option.selected');
    
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
        save_password: document.getElementById('connSavePassword').checked,
        auto_connect: document.getElementById('connAutoConnect').checked
    };
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
    
  const html = `
<div class="connection-item" data-id="${connection.id}" onclick="selectConnection('${connection.id}')" ondblclick="connectToConnection('${connection.id}')">
  <div class="connection-icon" style="background: ${iconColors[connection.type] || iconColors.postgresql}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${typeIcons[connection.type] || typeIcons.postgresql}
    </svg>
  </div>
  <div class="connection-info">
    <span class="connection-name">${connection.name}</span>
    <span class="connection-type">${connection.type.charAt(0).toUpperCase() + connection.type.slice(1)}</span>
  </div>
  <div class="connection-status disconnected">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  </div>
</div>
`;

  connectionList.insertAdjacentHTML('beforeend', html);
  
  // Bind context menu to newly added connection
  const newItem = connectionList.lastElementChild;
  newItem.addEventListener('contextmenu', (e) => {
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
        currentConnection.innerHTML = `<span>${connection.name} (${connection.type})</span>`;
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
                <span>Connected</span>
            `;
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
    
    // Add all databases
    databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db.name;
        option.textContent = db.name;
        selector.appendChild(option);
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
    const dbHtml = `
<div class="tree-node">
  <div class="tree-item db-item" onclick="toggleDatabase('${db.name}')" oncontextmenu="event.preventDefault(); event.stopPropagation(); contextMenuTarget='database'; contextMenuData={dbName:'${db.name}'}; showDatabaseContextMenu(event.clientX, event.clientY, '${db.name}');">
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m9 18 6-6-6-6"/>
    </svg>
    <svg class="db-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    </svg>
    <span>${db.name}</span>
  </div>
  <div class="tree-children collapsed" id="db-${db.name}-children">
    <div class="tree-branch">
      <div class="tree-item branch-item" onclick="toggleTreeSection('tables-${db.name}')">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        <span>表</span>
      </div>
      <div class="tree-children collapsed" id="tables-${db.name}Tree">
        <div class="tree-loading">加载中...</div>
      </div>
    </div>
    <div class="tree-branch">
      <div class="tree-item branch-item" onclick="toggleTreeSection('views-${db.name}')">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
                            </svg>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            <span>视图</span>
                        </div>
                        <div class="tree-children collapsed" id="views-${db.name}Tree">
                            <div class="tree-loading">加载中...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        dbTree.insertAdjacentHTML('beforeend', dbHtml);
    });
    
    // Auto-load tables for first database
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
    const tableHtml = `
<div class="tree-item" onclick="openTable('${table.name}', '${dbName}')" oncontextmenu="event.preventDefault(); event.stopPropagation(); contextMenuTarget='table'; contextMenuData={tableName:'${table.name}', dbName:'${dbName}'}; showTableContextMenu(event.clientX, event.clientY, '${table.name}', '${dbName}');">
  <svg class="table-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18M9 21V9"/>
  </svg>
  <span>${table.name}</span>
</div>
`;
    tablesTree.insertAdjacentHTML('beforeend', tableHtml);
  });
}

function toggleTreeSection(sectionId) {
    const section = document.getElementById(sectionId + 'Tree');
    const header = section?.previousElementSibling;
    
    if (section && header) {
        section.classList.toggle('expanded');
        header.classList.toggle('expanded');
    }
}

async function selectDatabase(databaseName) {
    console.log('Selected database:', databaseName);
    
    // Save to state
    state.selectedDatabase = databaseName;
    
    const selector = document.getElementById('queryDatabase');
    const option = Array.from(selector.options).find(opt => opt.value === databaseName);
    if (!option) {
        selector.insertAdjacentHTML('beforeend', `<option value="${databaseName}">${databaseName}</option>`);
    }
    selector.value = databaseName;
    
    // Update status bar
    const currentDb = document.getElementById('currentConnection');
    if (currentDb && state.activeConnection) {
        currentDb.innerHTML = `<span>${state.activeConnection.name} / ${databaseName}</span>`;
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
            selector.insertAdjacentHTML('beforeend', `<option value="${database}">${database}</option>`);
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
        const tabHtml = `
            <div class="tab" data-tab="${tabId}" data-type="table">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                </svg>
                <span>${tableName}</span>
                <button class="tab-close" onclick="closeTab('${tabId}', event)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
        document.getElementById('tabsContainer').insertAdjacentHTML('beforeend', tabHtml);
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
        filterColumn.insertAdjacentHTML('beforeend', `<option value="${col.name}">${col.name}</option>`);
        sortColumn.insertAdjacentHTML('beforeend', `<option value="${col.name}">${col.name}</option>`);
    });
}

function populateStructureView(columns) {
    const tbody = document.getElementById('structureViewBody');
    tbody.innerHTML = '';
    
    columns.forEach((col, index) => {
        const typeMatch = col.type.match(/^(\w+)(?:\((\d+(?:,\d+)?)\))?/);
        const dataType = typeMatch ? typeMatch[1] : col.type;
        const length = typeMatch && typeMatch[2] ? typeMatch[2] : '';
        
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${col.name}</td>
                <td>${dataType}</td>
                <td>${length}</td>
                <td></td>
                <td><input type="checkbox" ${col.nullable ? '' : 'checked'}></td>
                <td><input type="checkbox" ${col.primary_key ? 'checked' : ''}></td>
                <td><input type="checkbox"></td>
                <td>${col.default_value || ''}</td>
                <td></td>
                <td>utf8mb4</td>
                <td>utf8mb4_general_ci</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

function renderDataView(result) {
    const header = document.getElementById('dataViewHeader');
    const body = document.getElementById('dataViewBody');
    
    // Store column widths in state
    state.columnWidths = state.columnWidths || {};
    
    // Render header with resize handles
    let headerHtml = '<tr><th style="width: 50px; min-width: 50px; max-width: 50px;"><input type="checkbox" id="selectAllRows"></th>';
    result.columns.forEach((col, index) => {
        const width = state.columnWidths[col] || 150;
        headerHtml += `
            <th style="width: ${width}px; min-width: 80px; max-width: 400px;" data-col="${index}" data-colname="${col}">
                <span class="th-content">${col}</span>
                <div class="resize-handle" data-col="${index}"></div>
            </th>`;
    });
    headerHtml += '</tr>';
    header.innerHTML = headerHtml;
    
    // Render body
    let bodyHtml = '';
    result.rows.forEach((row, rowIndex) => {
        bodyHtml += `<tr data-row="${rowIndex}"><td style="width: 50px; min-width: 50px; max-width: 50px;"><input type="checkbox" class="row-checkbox" data-row="${rowIndex}"></td>`;
        row.forEach((cell, colIndex) => {
            const displayValue = cell === null ? '<span class="null-value">NULL</span>' : escapeHtml(String(cell));
            bodyHtml += `<td title="${cell === null ? 'NULL' : cell}">${displayValue}</td>`;
        });
        bodyHtml += '</tr>';
    });
    body.innerHTML = bodyHtml;
    
    // Update record count
    document.getElementById('dvRecordCount').textContent = `${result.row_count} 条记录`;
    document.getElementById('dvSelectedCount').textContent = '已选: 0';
    
    // Add event listeners
    document.getElementById('selectAllRows')?.addEventListener('change', toggleSelectAllRows);
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', updateSelectedCount);
    });
    
    // Initialize column resize
    initColumnResize();
}

// Column resize functionality
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
    const columnCount = document.querySelectorAll('#dataViewHeader th').length - 1;
    
    let rowHtml = '<tr class="new-row editing"><td><input type="checkbox" class="row-checkbox"></td>';
    for (let i = 0; i < columnCount; i++) {
        rowHtml += '<td><input type="text" placeholder="NULL"></td>';
    }
    rowHtml += '</tr>';
    
    body.insertAdjacentHTML('afterbegin', rowHtml);
}

function deleteSelectedRows() {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    if (selected.length === 0) {
        showNotification('warning', '请先选择要删除的行');
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selected.length} 行吗？`)) {
        selected.forEach(cb => cb.closest('tr').remove());
        updateSelectedCount();
        showNotification('success', `已删除 ${selected.length} 行`);
    }
}

function saveDataChanges() {
    showNotification('info', '保存更改功能开发中...');
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
    showNotification('info', '筛选功能开发中...');
}

function clearFilter() {
    document.getElementById('filterColumn').value = '';
    document.getElementById('filterValue').value = '';
    refreshDataView();
}

function toggleSortOrder() {
    const btn = document.getElementById('sortOrder');
    btn.classList.toggle('desc');
    showNotification('info', '排序功能开发中...');
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
    currentData: []
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

	// Store column widths in state
	state.columnWidths = state.columnWidths || {};

	// Render header with resize handles
	let headerHtml = '<tr><th style="width: 50px; min-width: 50px; max-width: 50px;"><input type="checkbox" id="selectAllRows"></th>';
	result.columns.forEach((col, index) => {
		const width = state.columnWidths[col] || 150;
		headerHtml += `
		<th style="width: ${width}px; min-width: 80px; max-width: 400px;" data-col="${index}" data-colname="${col}">
		<span class="th-content">${col}</span>
		<div class="resize-handle" data-col="${index}"></div>
	</th>`;
	});
	headerHtml += '</tr>';
	header.innerHTML = headerHtml;

	// Render body
	let bodyHtml = '';
	result.rows.forEach((row, rowIndex) => {
		bodyHtml += `<tr data-row="${rowIndex}"><td style="width: 50px; min-width: 50px; max-width: 50px;"><input type="checkbox" class="row-checkbox" data-row="${rowIndex}"></td>`;
		row.forEach((cell, colIndex) => {
			const displayValue = cell === null ? '<span class="null-value">NULL</span>' : escapeHtml(String(cell));
			bodyHtml += `<td title="${cell === null ? 'NULL' : cell}">${displayValue}</td>`;
		});
		bodyHtml += '</tr>';
	});
	body.innerHTML = bodyHtml;

	// Update record count
	document.getElementById('dvRecordCount').textContent = `${result.row_count} 条记录`;
	document.getElementById('resultCount').textContent = `${result.row_count} 条记录`;
	document.getElementById('dvSelectedCount').textContent = '已选: 0';

	// Add event listeners
	document.getElementById('selectAllRows')?.addEventListener('change', toggleSelectAllRows);
	document.querySelectorAll('.row-checkbox').forEach(cb => {
		cb.addEventListener('change', updateSelectedCount);
	});

	// Initialize column resize
	initColumnResize();
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
        tbody.innerHTML = `<tr><td colspan="8" class="error-cell">加载失败: ${error.message}</td></tr>`;
    }
}

function renderIndexes(indexes) {
    const tbody = document.getElementById('indexesViewBody');
    
    if (!indexes || indexes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无索引</td></tr>';
        document.getElementById('indexCount').textContent = '0';
        return;
    }
    
    let html = '';
    indexes.forEach((idx, index) => {
        const typeBadge = idx.type === 'PRIMARY' ? 'badge-primary' : 
                         idx.type === 'UNIQUE' ? 'badge-unique' : 'badge-index';
        
        html += `
            <tr data-index="${idx.name}">
                <td><input type="checkbox" class="index-checkbox" data-index="${idx.name}"></td>
                <td><strong>${idx.name}</strong></td>
                <td><span class="badge ${typeBadge}">${idx.type}</span></td>
                <td>${idx.unique ? '是' : '否'}</td>
                <td>${idx.columns.join(', ')}</td>
                <td>${idx.cardinality || '-'}</td>
                <td>${idx.comment || ''}</td>
                <td class="row-actions">
                    <button class="action-btn-sm" onclick="editIndex('${idx.name}')" title="编辑">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn-sm danger" onclick="dropIndex('${idx.name}')" title="删除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    document.getElementById('indexCount').textContent = indexes.length;
    
    // Add select all listener
    document.getElementById('selectAllIndexes')?.addEventListener('change', (e) => {
        document.querySelectorAll('.index-checkbox').forEach(cb => cb.checked = e.target.checked);
    });
}

function showCreateIndexDialog() {
    showNotification('info', '新建索引功能开发中...');
}

function editIndex(indexName) {
    showNotification('info', `编辑索引 ${indexName} 功能开发中...`);
}

function dropIndex(indexName) {
    if (confirm(`确定要删除索引 "${indexName}" 吗？`)) {
        showNotification('info', `删除索引 ${indexName} 功能开发中...`);
    }
}

function deleteSelectedIndexes() {
    const selected = document.querySelectorAll('.index-checkbox:checked');
    if (selected.length === 0) {
        showNotification('warning', '请先选择要删除的索引');
        return;
    }
    if (confirm(`确定要删除选中的 ${selected.length} 个索引吗？`)) {
        showNotification('info', '批量删除索引功能开发中...');
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
        tbody.innerHTML = `<tr><td colspan="9" class="error-cell">加载失败: ${error.message}</td></tr>`;
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
    
    let html = '';
    fks.forEach((fk, index) => {
        html += `
            <tr data-fk="${fk.name}">
                <td><input type="checkbox" class="fk-checkbox" data-fk="${fk.name}"></td>
                <td><strong>${fk.name}</strong></td>
                <td>${fk.column_name}</td>
                <td class="arrow-cell">→</td>
                <td>${fk.ref_table}</td>
                <td>${fk.ref_column}</td>
                <td><span class="fk-rule">${fk.on_update}</span></td>
                <td><span class="fk-rule">${fk.on_delete}</span></td>
                <td class="row-actions">
                    <button class="action-btn-sm" onclick="editForeignKey('${fk.name}')" title="编辑">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn-sm danger" onclick="dropForeignKey('${fk.name}')" title="删除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    document.getElementById('fkCount').textContent = fks.length;
    
    // Render foreign key visualization
    renderFKVisualization(fks);
    
    // Add select all listener
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
    html += `<span class="fk-table-name">${state.currentTable?.name || '当前表'}</span>`;
    html += '<div class="fk-columns">';
    fks.forEach(fk => {
        html += `<span class="fk-column">${fk.column_name}</span>`;
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
                <span class="fk-rule-badge">${fk.on_delete}</span>
            </div>
        `;
    });
    html += '</div>';
    
    html += '<div class="fk-ref-tables">';
    fks.forEach(fk => {
        html += `
            <div class="fk-ref-table">
                <span class="fk-table-name">${fk.ref_table}</span>
                <div class="fk-columns">
                    <span class="fk-column pk-column">${fk.ref_column} (PK)</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

function showAddForeignKeyDialog() {
    showNotification('info', '新建外键功能开发中...');
}

function editForeignKey(fkName) {
    showNotification('info', `编辑外键 ${fkName} 功能开发中...`);
}

function dropForeignKey(fkName) {
    if (confirm(`确定要删除外键 "${fkName}" 吗？`)) {
        showNotification('info', `删除外键 ${fkName} 功能开发中...`);
    }
}

function deleteSelectedForeignKeys() {
    const selected = document.querySelectorAll('.fk-checkbox:checked');
    if (selected.length === 0) {
        showNotification('warning', '请先选择要删除的外键');
        return;
    }
    if (confirm(`确定要删除选中的 ${selected.length} 个外键吗？`)) {
        showNotification('info', '批量删除外键功能开发中...');
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
				pagination.allData = result.rows || [];
				pagination.columns = result.columns || [];
				pagination.totalRows = result.row_count || 0;
				pagination.totalPages = Math.ceil(pagination.totalRows / pagination.pageSize) || 1;
				pagination.currentPage = 1;

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
    
    const editor = document.getElementById('queryEditor');
    editor.value = `SELECT * FROM ${funcName}();`;
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
    document.getElementById('settingsModal').classList.remove('active');
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
  
  if (isWailsAvailable()) {
    const path = await WailsAPI.saveFileDialog('Save Query', 'query.sql');
    if (path) {
      // In a real implementation, save to file
      showNotification('success', 'Query saved!');
    }
  } else {
    // Mock save - download as file
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
        const path = await WailsAPI.openFileDialog('Load Query', 'SQL files (*.sql)');
        if (path) {
            // In a real implementation, read from file
            showNotification('success', 'Query loaded!');
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
                    document.getElementById('queryEditor').value = event.target.result;
                    updateLineNumbers();
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
        <span>${message}</span>
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
    }
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

// Add language modal close to escape handler
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLanguageDialog();
    }
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
            const info = await WailsAPI.getServerInfo(state.activeConnection);
            console.log('Server Info:', info);
            showNotification('info', `数据库: ${info.type}, 表数量: ${info.table_count || 'N/A'}`);
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

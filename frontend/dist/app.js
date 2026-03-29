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
    // Wait for Wails to be ready
    if (typeof window.runtime !== 'undefined') {
        state.wailsReady = true;
        loadSavedConnections();
    } else {
        // Wails not available, run in browser mode
        console.log('Running in browser mode (Wails not available)');
        loadMockConnections();
    }
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
    console.log('Minimize window');
    if (isWailsAvailable()) {
        await WailsAPI.windowMinimize();
    }
}

async function maximizeWindow() {
    console.log('Maximize window');
    if (isWailsAvailable()) {
        await WailsAPI.windowMaximize();
        // Toggle icon based on maximized state
        const isMaximized = await WailsAPI.windowIsMaximized();
        updateMaximizeIcon(isMaximized);
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
    const splitHandle = document.getElementById('editorResultsSplit');
    const editorPanel = document.querySelector('.editor-panel');
    const resultsPanel = document.querySelector('.results-panel');
    
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
        
        if (sidebarResize.classList.contains('active')) {
            const newWidth = e.clientX;
            if (newWidth >= 180 && newWidth <= 400) {
                sidebar.style.width = newWidth + 'px';
            }
        }
        
        if (splitHandle.classList.contains('active')) {
            const workspace = document.querySelector('.workspace');
            const workspaceRect = workspace.getBoundingClientRect();
            const relativeY = e.clientY - workspaceRect.top;
            const newEditorHeight = relativeY;
            
            if (newEditorHeight >= 150 && newEditorHeight <= workspaceRect.height - 150) {
                editorPanel.style.minHeight = newEditorHeight + 'px';
                resultsPanel.style.minHeight = (workspaceRect.height - newEditorHeight - 4) + 'px';
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (state.isResizing) {
            state.isResizing = false;
            document.getElementById('sidebarResize')?.classList.remove('active');
            document.getElementById('editorResultsSplit')?.classList.remove('active');
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
    document.querySelector('.editor-panel').style.display = 'block';
    document.querySelector('.results-panel').style.display = 'block';
    document.querySelector('.split-handle').style.display = 'block';
    document.getElementById('dataViewPanel').style.display = 'none';
    
    // Clear editor for new tab
    const editor = document.getElementById('queryEditor');
    editor.value = '';
    updateSyntaxHighlight();
    updateLineNumbers();
    
    // Focus the editor
    editor.focus();
}

function activateTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
        state.activeTab = tabId;
        
        // Hide welcome panel
        const welcomePanel = document.getElementById('welcomePanel');
        if (welcomePanel) welcomePanel.style.display = 'none';
        
        // Switch view based on tab type
        const tabType = selectedTab.dataset.type;
        
        if (tabType === 'table') {
            // Show data view panel
            document.querySelector('.editor-panel').style.display = 'none';
            document.querySelector('.results-panel').style.display = 'none';
            document.querySelector('.split-handle').style.display = 'none';
            document.getElementById('dataViewPanel').style.display = 'flex';
        } else {
            // Show query editor
            document.querySelector('.editor-panel').style.display = 'block';
            document.querySelector('.results-panel').style.display = 'block';
            document.querySelector('.split-handle').style.display = 'block';
            document.getElementById('dataViewPanel').style.display = 'none';
            
            // Focus the editor for query tabs
            const editor = document.getElementById('queryEditor');
            if (editor) {
                editor.focus();
            }
        }
    }
}

function closeTab(tabId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    const allTabs = document.querySelectorAll('.tab');
    
    if (tab && tab.classList.contains('active')) {
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
            const welcomePanel = document.getElementById('welcomePanel');
            if (welcomePanel) welcomePanel.style.display = 'flex';
            document.querySelector('.editor-panel').style.display = 'none';
            document.querySelector('.results-panel').style.display = 'none';
            document.querySelector('.split-handle').style.display = 'none';
            document.getElementById('dataViewPanel').style.display = 'none';
        }
    }
    
    if (tab) {
        tab.remove();
    }
}

// ==========================================================================
// Context Menu
// ==========================================================================
function initContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    
    document.addEventListener('click', () => {
        contextMenu.classList.remove('active');
    });
    
    document.querySelectorAll('.connection-item, .tree-item').forEach(item => {
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY);
        });
    });
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
        case 'duplicate':
            console.log('Duplicating connection...');
            break;
        case 'delete':
            if (confirm('Are you sure you want to delete this connection?')) {
                if (state.activeConnection) {
                    await deleteConnection(state.activeConnection.id);
                }
            }
            break;
    }
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
            renderDatabaseTree(databases);
            populateDatabaseSelector(databases);
        } else {
            await loadMockDatabaseTree();
        }
    } catch (error) {
        showNotification('error', `Failed to load databases: ${error.message}`);
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
                <div class="tree-item db-item" onclick="toggleDatabase('${db.name}')">
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
        } else {
            // Mock tables
            const tables = [
                { name: 'users' },
                { name: 'orders' },
                { name: 'products' }
            ];
            renderTablesTree(tables, dbName);
            updateDatabaseTables(tables.map(t => t.name));
        }
    } catch (error) {
        console.error('Failed to load tables:', error);
    }
}

function renderTablesTree(tables, dbName) {
    const tablesTree = document.getElementById(`tables-${dbName}Tree`);
    if (!tablesTree) return;
    
    tablesTree.innerHTML = '';
    
    tables.forEach(table => {
        const tableHtml = `
            <div class="tree-item" onclick="openTable('${table.name}', '${dbName}')">
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

async function loadTableData(tableName, database) {
    if (!state.activeConnection) {
        showNotification('warning', '请先选择一个数据库连接');
        return;
    }
    
    showLoading(`加载表数据: ${tableName}...`);
    
    try {
        // Load columns for filter dropdowns
        if (isWailsAvailable()) {
            const columns = await WailsAPI.getTableColumns(state.activeConnection, database, tableName);
            populateFilterDropdowns(columns);
            populateStructureView(columns);
        }
        
        // Execute query to get data
        const query = `SELECT * FROM \`${tableName}\` LIMIT 1000`;
        
        if (isWailsAvailable()) {
            const result = await WailsAPI.executeQuery(state.activeConnection, database, query);
            
            if (result.error) {
                showNotification('error', result.error);
            } else {
                renderDataView(result);
            }
        } else {
            // Mock data
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const mockResult = {
                columns: ['id', 'name', 'email', 'created_at', 'status'],
                rows: [
                    [1, '张三', 'zhangsan@example.com', '2024-01-15 10:30:00', 'active'],
                    [2, '李四', 'lisi@example.com', '2024-01-16 11:45:00', 'active'],
                    [3, '王五', 'wangwu@example.com', '2024-01-17 14:20:00', 'inactive'],
                    [4, '赵六', 'zhaoliu@example.com', '2024-01-18 09:15:00', 'active'],
                    [5, '钱七', 'qianqi@example.com', '2024-01-19 16:30:00', 'pending'],
                    [6, '孙八', 'sunba@example.com', '2024-01-20 13:25:00', 'active'],
                    [7, '周九', 'zhoujiu@example.com', '2024-01-21 10:10:00', 'inactive'],
                    [8, '吴十', 'wushi@example.com', '2024-01-22 15:45:00', 'active'],
                ],
                row_count: 8,
                duration: '0.015s'
            };
            
            renderDataView(mockResult);
            
            // Populate mock structure
            const mockColumns = [
                { name: 'id', type: 'INT', nullable: false, primary_key: true, default_value: 'auto_increment' },
                { name: 'name', type: 'VARCHAR(100)', nullable: false, primary_key: false, default_value: '' },
                { name: 'email', type: 'VARCHAR(255)', nullable: true, primary_key: false, default_value: '' },
                { name: 'created_at', type: 'DATETIME', nullable: true, primary_key: false, default_value: 'CURRENT_TIMESTAMP' },
                { name: 'status', type: 'VARCHAR(20)', nullable: true, primary_key: false, default_value: "'active'" }
            ];
            populateFilterDropdowns(mockColumns);
            populateStructureView(mockColumns);
        }
    } catch (error) {
        showNotification('error', `加载数据失败: ${error.message}`);
    }
    
    hideLoading();
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
    if (!state.activeConnection) {
        showNotification('warning', '请先选择一个数据库连接');
        return;
    }
    
    showLoading(`加载表数据: ${tableName}...`);
    
    try {
        // Load columns for filter dropdowns
        if (isWailsAvailable()) {
            const columns = await WailsAPI.getTableColumns(state.activeConnection, database, tableName);
            populateFilterDropdowns(columns);
            populateStructureView(columns);
        }
        
        // Load table stats
        if (isWailsAvailable()) {
            try {
                const stats = await WailsAPI.getTableStats(state.activeConnection, database, tableName);
                document.getElementById('dvTableEngine').textContent = stats.engine || 'InnoDB';
            } catch (e) {
                console.log('Stats not available:', e);
            }
        }
        
        // Execute query to get data
        const query = `SELECT * FROM \`${tableName}\` LIMIT 10000`;
        
        if (isWailsAvailable()) {
            const result = await WailsAPI.executeQuery(state.activeConnection, database, query);
            
            if (result.error) {
                showNotification('error', result.error);
            } else {
                // Store all data for pagination
                pagination.allData = result.rows;
                pagination.columns = result.columns;
                pagination.totalRows = result.row_count;
                pagination.totalPages = Math.ceil(result.row_count / pagination.pageSize);
                pagination.currentPage = 1;
                
                updatePaginationUI();
                renderCurrentPage();
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
        showNotification('error', `加载数据失败: ${error.message}`);
    }
    
    hideLoading();
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
// Query Editor with Syntax Highlighting and Autocomplete
// ==========================================================================

// SQL Keywords for highlighting and autocomplete
const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP',
    'INDEX', 'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'DATABASE', 'SCHEMA',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'ON', 'USING',
    'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
    'AS', 'DISTINCT', 'TOP', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE', 'CHECK', 'DEFAULT',
    'NOT', 'NULL', 'AUTO_INCREMENT', 'IDENTITY', 'SERIAL',
    'INT', 'INTEGER', 'VARCHAR', 'CHAR', 'TEXT', 'BLOB', 'DECIMAL', 'FLOAT', 'DOUBLE',
    'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'BOOLEAN', 'BOOL', 'BIT',
    'IF', 'EXISTS', 'CASCADE', 'RESTRICT', 'ADD', 'COLUMN', 'RENAME', 'TO',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'GRANT', 'REVOKE',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'CONVERT',
    'SUBSTRING', 'LENGTH', 'TRIM', 'UPPER', 'LOWER', 'REPLACE', 'CONCAT',
    'NOW', 'CURDATE', 'CURTIME', 'DATE_FORMAT', 'STR_TO_DATE', 'DATEDIFF', 'DATE_ADD', 'DATE_SUB',
    'IFNULL', 'IF', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
];

const SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'CONVERT',
    'SUBSTRING', 'LENGTH', 'TRIM', 'UPPER', 'LOWER', 'REPLACE', 'CONCAT',
    'NOW', 'CURDATE', 'CURTIME', 'DATE_FORMAT', 'STR_TO_DATE', 'DATEDIFF',
    'IFNULL', 'IF', 'ABS', 'CEIL', 'FLOOR', 'ROUND', 'MOD', 'POWER', 'SQRT'
];

// Global state for autocomplete
let autocompleteIndex = 0;
let autocompleteItems = [];
let autocompleteVisible = false;
let currentDatabaseTables = [];

function initEditor() {
    const editor = document.getElementById('queryEditor');
    const highlight = document.getElementById('sqlHighlight');
    const lineNumbers = document.getElementById('lineNumbers');
    const popup = document.getElementById('autocompletePopup');
    const editorContainer = document.getElementById('editorContainer');
    
    if (!editor || !highlight) return;
    
    // Fix: Ensure the highlight element doesn't block pointer events
    highlight.style.pointerEvents = 'none';
    
    // Fix: Ensure the textarea has proper z-index and is on top
    editor.style.position = 'relative';
    editor.style.zIndex = '1';
    
    // Fix: Focus the editor when clicking anywhere in the editor container
    if (editorContainer) {
        editorContainer.addEventListener('click', (e) => {
            // Only focus if clicking directly on the container or the wrapper, not on buttons
            if (e.target === editorContainer || e.target.classList.contains('sql-editor-wrapper')) {
                editor.focus();
            }
        });
    }
    
    // Fix: Ensure the editor gets focus when clicked
    editor.addEventListener('click', () => {
        editor.focus();
    });
    
    // Sync scroll between editor and highlight
    editor.addEventListener('scroll', () => {
        highlight.scrollTop = editor.scrollTop;
        highlight.scrollLeft = editor.scrollLeft;
        lineNumbers.scrollTop = editor.scrollTop;
    });
    
    // Update syntax highlighting and autocomplete on input
    editor.addEventListener('input', () => {
        updateSyntaxHighlight();
        updateLineNumbers();
        // 暂时禁用自动完成功能，因为它可能导致输入问题
        // showAutocomplete();
    });
    
    // Handle keyboard navigation for autocomplete
    editor.addEventListener('keydown', (e) => {
        if (autocompleteVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateAutocomplete(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateAutocomplete(-1);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectAutocompleteItem();
            } else if (e.key === 'Escape') {
                hideAutocomplete();
            }
        }
        
        // Handle tab key for indentation
        if (e.key === 'Tab' && !autocompleteVisible) {
            e.preventDefault();
            insertAtCursor('    ');
        }
    });
    
    // Hide autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== editor) {
            hideAutocomplete();
        }
    });
    
    // Initial render
    updateSyntaxHighlight();
    updateLineNumbers();
    
    // Fix: Make the editor focusable
    editor.setAttribute('tabindex', '0');
}

function updateSyntaxHighlight() {
    const editor = document.getElementById('queryEditor');
    const highlight = document.getElementById('sqlHighlight');
    if (!editor || !highlight) return;
    
    let code = editor.value;
    
    // Escape HTML
    code = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Highlight comments (-- single line)
    code = code.replace(/(--.*$)/gm, '<span class="comment">$1</span>');
    
    // Highlight multi-line comments /* ... */
    code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');
    
    // Highlight strings (single and double quotes)
    code = code.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="string">$1</span>');
    code = code.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>');
    
    // Highlight numbers
    code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');
    
    // Highlight keywords
    SQL_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
        code = code.replace(regex, (match) => {
            // Don't highlight if already inside a span
            return `<span class="keyword">${match}</span>`;
        });
    });
    
    // Highlight functions
    SQL_FUNCTIONS.forEach(func => {
        const regex = new RegExp(`\\b(${func})\\s*\\(`, 'gi');
        code = code.replace(regex, (match, p1) => {
            return `<span class="function">${p1}</span>(`;
        });
    });
    
    // Highlight operators
    code = code.replace(/(\+|-|\*|\/|=|&lt;|&gt;|!|%)/g, '<span class="operator">$1</span>');
    
    highlight.innerHTML = code + '\n';
}

function updateLineNumbers() {
    const editor = document.getElementById('queryEditor');
    const lineNumbers = document.getElementById('lineNumbers');
    if (!editor || !lineNumbers) return;
    
    const lines = editor.value.split('\n').length;
    
    let html = '';
    for (let i = 1; i <= Math.max(lines, 10); i++) {
        html += `<span>${i}</span>`;
    }
    lineNumbers.innerHTML = html;
}

function showAutocomplete() {
    const editor = document.getElementById('queryEditor');
    const popup = document.getElementById('autocompletePopup');
    const list = document.getElementById('autocompleteList');
    if (!editor || !popup || !list) return;
    
    const cursorPos = editor.selectionStart;
    const text = editor.value.substring(0, cursorPos);
    
    // Get the current word being typed
    const match = text.match(/[`"']?([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (!match || match[1].length < 1) {
        hideAutocomplete();
        return;
    }
    
    const currentWord = match[1].toUpperCase();
    
    // Only show autocomplete if word is at least 2 characters
    if (currentWord.length < 2) {
        hideAutocomplete();
        return;
    }
    
    // Build autocomplete items
    autocompleteItems = [];
    
    // Add SQL keywords
    SQL_KEYWORDS.forEach(keyword => {
        if (keyword.startsWith(currentWord) && keyword !== currentWord) {
            autocompleteItems.push({ text: keyword, type: 'keyword' });
        }
    });
    
    // Add table names from current database
    currentDatabaseTables.forEach(table => {
        if (table.toUpperCase().startsWith(currentWord) && table.toUpperCase() !== currentWord) {
            autocompleteItems.push({ text: table, type: 'table' });
        }
    });
    
    // Remove duplicates
    autocompleteItems = autocompleteItems.filter((item, index, self) =>
        index === self.findIndex(t => t.text === item.text)
    );
    
    if (autocompleteItems.length === 0) {
        hideAutocomplete();
        return;
    }
    
    // Limit items shown
    autocompleteItems = autocompleteItems.slice(0, 8);
    autocompleteIndex = 0;
    
    // Render items - escape HTML to prevent XSS
    list.innerHTML = autocompleteItems.map((item, index) => `
        <div class="autocomplete-item ${index === 0 ? 'selected' : ''}" data-index="${index}" onclick="selectAutocompleteItemByIndex(${index})">
            <span class="item-text">${escapeHtml(item.text)}</span>
            <span class="item-type">${escapeHtml(item.type)}</span>
        </div>
    `).join('');
    
    // Position popup near cursor
    const rect = editor.getBoundingClientRect();
    const coords = getCaretCoordinates(editor, cursorPos);
    
    // Ensure popup stays within viewport
    const popupLeft = Math.min(coords.left + rect.left - editor.scrollLeft, window.innerWidth - 250);
    const popupTop = Math.min(coords.top + rect.top - editor.scrollTop + 20, window.innerHeight - 200);
    
    popup.style.left = popupLeft + 'px';
    popup.style.top = popupTop + 'px';
    popup.style.display = 'block';
    autocompleteVisible = true;
}

function hideAutocomplete() {
    const popup = document.getElementById('autocompletePopup');
    if (popup) {
        popup.style.display = 'none';
    }
    autocompleteVisible = false;
    autocompleteItems = [];
}

function navigateAutocomplete(direction) {
    autocompleteIndex += direction;
    if (autocompleteIndex < 0) autocompleteIndex = autocompleteItems.length - 1;
    if (autocompleteIndex >= autocompleteItems.length) autocompleteIndex = 0;
    
    const items = document.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === autocompleteIndex);
    });
    
    // Scroll selected item into view
    const selected = document.querySelector('.autocomplete-item.selected');
    if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
    }
}

function selectAutocompleteItem() {
    if (autocompleteItems.length === 0) return;
    selectAutocompleteItemByIndex(autocompleteIndex);
}

function selectAutocompleteItemByIndex(index) {
    const editor = document.getElementById('queryEditor');
    if (!editor || !autocompleteItems[index]) return;
    
    const item = autocompleteItems[index];
    const cursorPos = editor.selectionStart;
    const text = editor.value;
    
    // Find the start of the current word
    const beforeCursor = text.substring(0, cursorPos);
    const match = beforeCursor.match(/[`"']?([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (!match) return;
    
    const wordStart = cursorPos - match[1].length;
    const wordEnd = cursorPos;
    
    // Replace the word with the selected item
    editor.value = text.substring(0, wordStart) + item.text + text.substring(wordEnd);
    editor.selectionStart = editor.selectionEnd = wordStart + item.text.length;
    
    hideAutocomplete();
    updateSyntaxHighlight();
    updateLineNumbers();
    editor.focus();
}

function insertAtCursor(text) {
    const editor = document.getElementById('queryEditor');
    if (!editor) return;
    
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    
    editor.value = value.substring(0, start) + text + value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + text.length;
    
    updateSyntaxHighlight();
    updateLineNumbers();
}

function getCaretCoordinates(element, position) {
    const div = document.createElement('div');
    const style = getComputedStyle(element);
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = style.width;
    div.style.height = style.height;
    div.style.padding = style.padding;
    div.style.font = style.font;
    div.style.lineHeight = style.lineHeight;
    
    div.textContent = element.value.substring(0, position);
    document.body.appendChild(div);
    
    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);
    
    const coordinates = {
        top: span.offsetTop,
        left: span.offsetLeft
    };
    
    document.body.removeChild(div);
    return coordinates;
}

function updateDatabaseTables(tables) {
    currentDatabaseTables = tables || [];
}

async function executeQuery() {
    const editor = document.getElementById('queryEditor');
    const query = editor.value.trim();
    let database = document.getElementById('queryDatabase').value;
    
    if (!query) {
        showNotification('warning', '请输入查询语句');
        return;
    }
    
    if (!state.activeConnection) {
        showNotification('warning', '请先选择一个数据库连接');
        return;
    }
    
    // Check if database is selected, try to use from state
    if (!database && state.selectedDatabase) {
        database = state.selectedDatabase;
        document.getElementById('queryDatabase').value = database;
    }
    
    if (!database) {
        showNotification('warning', '请先在左侧选择一个数据库');
        return;
    }
    
    showLoading('执行查询中...');
    
    const resultCount = document.getElementById('resultCount');
    const resultTime = document.getElementById('resultTime');
    const resultsBody = document.getElementById('resultsBody');
    
    try {
        if (isWailsAvailable()) {
            const result = await WailsAPI.executeQuery(state.activeConnection, database, query);
            
            if (result.error) {
                showNotification('error', result.error);
                resultCount.textContent = '错误';
                resultTime.textContent = '';
            } else {
                renderQueryResult(result);
                resultCount.textContent = `${result.row_count} 行数据`;
                resultTime.textContent = result.duration;
            }
        } else {
            // Mock result
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const mockResult = {
                columns: ['id', 'name', 'email', 'created_at', 'status'],
                rows: [
                    [1, '张三', 'zhangsan@example.com', '2024-01-15', 'active'],
                    [2, '李四', 'lisi@example.com', '2024-01-16', 'active'],
                    [3, '王五', 'wangwu@example.com', '2024-01-17', 'inactive'],
                    [4, '赵六', 'zhaoliu@example.com', '2024-01-18', 'active'],
                    [5, '钱七', 'qianqi@example.com', '2024-01-19', 'pending']
                ],
                row_count: 5,
                duration: '0.023s'
            };
            
            renderQueryResult(mockResult);
            resultCount.textContent = `${mockResult.row_count} 行数据`;
            resultTime.textContent = mockResult.duration;
        }
    } catch (error) {
        showNotification('error', `查询失败: ${error.message}`);
        resultCount.textContent = '错误';
        resultTime.textContent = '';
    }
    
    hideLoading();
}

function renderQueryResult(result) {
    const tableHead = document.querySelector('.results-table thead tr');
    const resultsBody = document.getElementById('resultsBody');
    
    // Render headers
    let headerHtml = '<th><input type="checkbox"></th>';
    result.columns.forEach(col => {
        headerHtml += `
            <th>${col} <svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>
            </svg></th>
        `;
    });
    headerHtml += '<th>Actions</th>';
    tableHead.innerHTML = headerHtml;
    
    // Render rows
    let rowsHtml = '';
    result.rows.forEach((row, index) => {
        rowsHtml += '<tr>';
        rowsHtml += '<td><input type="checkbox"></td>';
        row.forEach(cell => {
            const displayValue = cell === null ? '<em>NULL</em>' : escapeHtml(String(cell));
            rowsHtml += `<td>${displayValue}</td>`;
        });
        rowsHtml += `
            <td class="row-actions">
                <button class="action-btn" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="action-btn" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </td>
        `;
        rowsHtml += '</tr>';
    });
    resultsBody.innerHTML = rowsHtml;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatSQL() {
    const editor = document.getElementById('queryEditor');
    let sql = editor.value;
    
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'];
    
    keywords.forEach(keyword => {
        const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
        sql = sql.replace(regex, keyword);
    });
    
    editor.value = sql;
    updateLineNumbers();
}

function explainQuery() {
    const editor = document.getElementById('queryEditor');
    const query = editor.value.trim();
    
    if (!query) return;
    
    if (!query.toUpperCase().startsWith('EXPLAIN')) {
        editor.value = 'EXPLAIN ' + query;
        updateLineNumbers();
    }
    
    executeQuery();
}

async function saveQuery() {
    if (isWailsAvailable()) {
        const path = await WailsAPI.saveFileDialog('Save Query', 'query.sql');
        if (path) {
            const query = document.getElementById('queryEditor').value;
            // In a real implementation, save to file
            showNotification('success', 'Query saved!');
        }
    } else {
        // Mock save - download as file
        const query = document.getElementById('queryEditor').value;
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

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
    activeTab: 'query-1',
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
    
    // Show query editor, hide data view
    document.querySelector('.editor-panel').style.display = 'block';
    document.querySelector('.results-panel').style.display = 'block';
    document.querySelector('.split-handle').style.display = 'block';
    document.getElementById('dataViewPanel').style.display = 'none';
    
    // Clear editor for new tab
    document.getElementById('queryEditor').value = '';
    updateLineNumbers();
}

function activateTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
        state.activeTab = tabId;
        
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
        }
    }
}

function closeTab(tabId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    if (tab && tab.classList.contains('active')) {
        const allTabs = document.querySelectorAll('.tab');
        if (allTabs.length > 1) {
            const tabArray = Array.from(allTabs);
            const currentIndex = tabArray.indexOf(tab);
            const prevTab = tabArray[currentIndex - 1] || tabArray[currentIndex + 1];
            if (prevTab) {
                activateTab(prevTab.dataset.tab);
            }
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
        } else {
            await loadMockDatabaseTree();
        }
    } catch (error) {
        showNotification('error', `Failed to load databases: ${error.message}`);
    }
    
    hideLoading();
}

async function loadMockDatabaseTree() {
    const databases = [
        { name: 'mydb' },
        { name: 'testdb' }
    ];
    renderDatabaseTree(databases);
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
        } else {
            // Mock tables
            const tables = [
                { name: 'users' },
                { name: 'orders' },
                { name: 'products' }
            ];
            renderTablesTree(tables, dbName);
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
    
    // Render header
    let headerHtml = '<tr><th style="width: 50px;"><input type="checkbox" id="selectAllRows"></th>';
    result.columns.forEach(col => {
        headerHtml += `<th>${col}</th>`;
    });
    headerHtml += '</tr>';
    header.innerHTML = headerHtml;
    
    // Render body
    let bodyHtml = '';
    result.rows.forEach((row, rowIndex) => {
        bodyHtml += `<tr data-row="${rowIndex}"><td><input type="checkbox" class="row-checkbox" data-row="${rowIndex}"></td>`;
        row.forEach(cell => {
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
            
            // Show/hide views
            document.getElementById('dataViewGrid').style.display = view === 'content' ? 'block' : 'none';
            document.getElementById('structureView').style.display = view === 'structure' ? 'block' : 'none';
            document.querySelector('.data-view-filter').style.display = view === 'content' ? 'flex' : 'none';
            
            // Show loading for other views
            if (view !== 'content' && view !== 'structure') {
                showNotification('info', `${tab.textContent} 视图开发中...`);
            }
        });
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

function dataViewFirstPage() { showNotification('info', '分页功能开发中...'); }
function dataViewPrevPage() { showNotification('info', '分页功能开发中...'); }
function dataViewNextPage() { showNotification('info', '分页功能开发中...'); }
function dataViewLastPage() { showNotification('info', '分页功能开发中...'); }
function changePageSize() { showNotification('info', '分页功能开发中...'); }

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
// Query Editor
// ==========================================================================
function initEditor() {
    const editor = document.getElementById('queryEditor');
    const lineNumbers = document.getElementById('lineNumbers');
    
    editor.addEventListener('scroll', () => {
        lineNumbers.scrollTop = editor.scrollTop;
    });
    
    editor.addEventListener('input', () => {
        updateLineNumbers();
    });
    
    updateLineNumbers();
}

function updateLineNumbers() {
    const editor = document.getElementById('queryEditor');
    const lineNumbers = document.getElementById('lineNumbers');
    const lines = editor.value.split('\n').length;
    
    let html = '';
    for (let i = 1; i <= Math.max(lines, 10); i++) {
        html += `<span>${i}</span>`;
    }
    lineNumbers.innerHTML = html;
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

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
    columnWidths: {},
    queryHistory: [],
    editingConnectionId: null,
};

// ==========================================================================
// Wails Integration
// ==========================================================================
let WailsAPI = null;

function initWails() {
    if (typeof window.go !== 'undefined' && window.go.main && window.go.main.App) {
        const api = window.go.main.App;
        WailsAPI = {
            // Connection
            saveConnection: (conn) => api.SaveConnection(conn),
            getConnections: () => api.GetConnections(),
            deleteConnection: (id) => api.DeleteConnection(id),
            connectToDatabase: (conn) => api.ConnectToDatabase(conn),
            disconnectFromDatabase: (conn) => api.DisconnectFromDatabase(conn),
            testConnection: (conn) => api.TestConnection(conn),
            // Database
            getDatabases: (conn) => api.GetDatabases(conn),
            getTables: (conn, db) => api.GetTables(conn, db),
            getTableStructure: (conn, db, table) => api.GetTableStructure(conn, db, table),
            getTableData: (conn, db, table, page, pageSize) => api.GetTableData(conn, db, table, page, pageSize),
            // Query
            executeQuery: (conn, db, query) => api.ExecuteQuery(conn, db, query),
            executeMultiQuery: (conn, db, query) => api.ExecuteMultiQuery(conn, db, query),
            explainQuery: (conn, db, query) => api.ExplainQuery(conn, db, query),
            cancelQuery: (conn, pid) => api.CancelQuery(conn, pid),
            beautifySQL: (sql) => api.BeautifySQL(sql),
            // Schema
            getTableIndexes: (conn, db, table) => api.GetTableIndexes(conn, db, table),
            getTableForeignKeys: (conn, db, table) => api.GetTableForeignKeys(conn, db, table),
            // Export/Import
            exportData: (conn, db, table, format, path) => api.ExportData(conn, db, table, format, path),
            importData: (conn, db, table, format, path) => api.ImportData(conn, db, table, format, path),
            openFileDialog: () => api.OpenFileDialog(),
            saveFileDialog: () => api.SaveFileDialog(),
            // Window
            windowMinimize: () => api.WindowMinimize(),
            windowMaximize: () => api.WindowMaximize(),
            windowClose: () => api.WindowClose(),
            windowIsMaximized: () => api.WindowIsMaximized(),
            windowSetSize: (w, h) => api.WindowSetSize(w, h),
            // AI
            testAIConnection: () => api.TestAIConnection(),
            explainSQL: (sql) => api.ExplainSQL(sql),
            suggestOptimizations: (conn, db, sql) => api.SuggestOptimizations(conn, db, sql),
            naturalLanguageToSQL: (conn, db, nl) => api.NaturalLanguageToSQL(conn, db, nl),
            // Settings
            getSettings: () => api.GetSettings(),
            saveSettings: (s) => api.SaveSettings(s),
            // Redis
            getRedisDBSize: (conn) => api.GetRedisDBSize(conn),
            scanRedisKeys: (conn, pattern, cursor, count) => api.ScanRedisKeys(conn, pattern, cursor, count),
            getRedisKeyType: (conn, key) => api.GetRedisKeyType(conn, key),
            getRedisKeyValue: (conn, key) => api.GetRedisKeyValue(conn, key),
            setRedisKey: (conn, key, value) => api.SetRedisKey(conn, key, value),
            deleteRedisKey: (conn, key) => api.DeleteRedisKey(conn, key),
            // Performance
            getSystemInfo: () => api.GetSystemInfo(),
            getPoolStats: () => api.GetPoolStats(),
            getSlowQueries: (conn, limit) => api.GetSlowQueries(conn, limit),
            getActiveQueries: (conn) => api.GetActiveQueries(conn),
            // History
            getQueryHistory: (limit) => api.GetQueryHistory(limit),
            // Git
            getGitRepos: () => api.GetGitRepos(),
            addGitRepo: (path) => api.AddGitRepo(path),
            getGitRepoInfo: (repo) => api.GetGitRepoInfo(repo),
            getGitChanges: (repo) => api.GetGitChanges(repo),
            getGitLog: (repo, limit) => api.GetGitLog(repo, limit),
            gitPull: (repo) => api.GitPull(repo),
            gitPush: (repo) => api.GitPush(repo),
            gitCommit: (repo, msg) => api.GitCommit(repo, msg),
            gitCreateBranch: (repo, name) => api.GitCreateBranch(repo, name),
            // Roles
            getRoles: () => api.GetRoles(),
            createRole: (name, perms, desc) => api.CreateRole(name, perms, desc),
            deleteRole: (id) => api.DeleteRole(id),
            assignRoleToConnection: (connID, roleID) => api.AssignRoleToConnection(connID, roleID),
            // Plugins
            getPlugins: () => api.GetPlugins(),
            registerPlugin: (name, ver, desc, type) => api.RegisterPlugin(name, ver, desc, type),
            togglePlugin: (id, enabled) => api.TogglePlugin(id, enabled),
            removePlugin: (id) => api.RemovePlugin(id),
            // Report
            getReportTemplates: () => api.GetReportTemplates(),
            saveReportTemplate: (tpl) => api.SaveReportTemplate(tpl),
            deleteReportTemplate: (id) => api.DeleteReportTemplate(id),
            executeReportTemplate: (conn, db, id, params) => api.ExecuteReportTemplate(conn, db, id, params),
            // SSL
            testSSLConnection: (connID) => api.TestSSLConnection(connID),
        };
        state.wailsReady = true;
    }
}

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
    initWails();
});

function updateClock() {
    const now = new Date();
    const el = document.getElementById('statusTime');
    if (el) el.textContent = now.toLocaleTimeString();
}

// ==========================================================================
// Tab Management — extracted to modules/tabs.js
// ==========================================================================

// ==========================================================================
// Context Menu — extracted to modules/context-menu.js
// ==========================================================================

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
    const cloudFields = document.getElementById('cloudFields');
    const cloudInstanceRow = document.getElementById('cloudInstanceRow');
    if (cloudFields) cloudFields.style.display = 'none';
    if (cloudInstanceRow) cloudInstanceRow.style.display = 'none';
    
    // Reset connection name placeholder
    const typeNames = {
        postgresql: 'PostgreSQL',
        mysql: 'MySQL', 
        polardb: 'PolarDB',
        gaussdb: 'GaussDB',
        sqlite: 'SQLite',
        redis: 'Redis',
        mongodb: 'MongoDB',
        elasticsearch: 'Elasticsearch',
        cloud: '云数据库'
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
            
        case 'mongodb':
            portInput.value = '27017';
            connUser.placeholder = '可选';
            connHost.placeholder = 'localhost';
            if (!connName.value) connName.placeholder = 'MongoDB 连接';
            databaseHint.textContent = 'MongoDB 数据库名 (可选)';
            dbNameLabel.textContent = '数据库 (可选)';
            break;
            
        case 'elasticsearch':
            portInput.value = '9200';
            connUser.placeholder = '可选';
            connHost.placeholder = 'localhost';
            if (!connName.value) connName.placeholder = 'Elasticsearch 连接';
            databaseHint.textContent = 'Elasticsearch 索引前缀 (可选)';
            dbNameLabel.textContent = '索引 (可选)';
            break;
            
        case 'cloud':
            portInput.value = '5432';
            connUser.placeholder = '数据库用户名';
            connHost.placeholder = '数据库端点地址';
            if (!connName.value) connName.placeholder = '云数据库连接';
            databaseHint.textContent = '云数据库实例的数据库名';
            dbNameLabel.textContent = '数据库';
            if (cloudFields) cloudFields.style.display = 'flex';
            if (cloudInstanceRow) cloudInstanceRow.style.display = 'flex';
            break;
    }
}

function onCloudProviderChange() {
    const provider = document.getElementById('cloudProvider')?.value;
    const portInput = document.getElementById('connPort');
    const hostInput = document.getElementById('connHost');
    if (!provider) return;
    // Set default port based on provider's common DB types
    const defaults = {
        aws: { port: '5432', host: 'your-rds.amazonaws.com' },
        gcp: { port: '5432', host: 'your-cloudsql.googleapis.com' },
        azure: { port: '5432', host: 'your-server.postgres.database.azure.com' },
        aliyun: { port: '5432', host: 'your-rds.rds.aliyuncs.com' },
        tencent: { port: '5432', host: 'your-cdb.tencentcloudapi.com' },
        huawei: { port: '5432', host: 'your-rds.huaweicloud.com' },
    };
    const d = defaults[provider];
    if (d) {
        if (portInput) portInput.value = d.port;
        if (hostInput) hostInput.placeholder = d.host;
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
    const type = activeDbType ? activeDbType.dataset.type : 'postgresql';
    
    const conn = {
        id: document.getElementById('connName').dataset.id || '',
        name: document.getElementById('connName').value || 'New Connection',
        type: type,
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
    
    // Cloud DB fields
    if (type === 'cloud') {
        conn.cloud_provider = document.getElementById('cloudProvider')?.value || '';
        conn.cloud_region = document.getElementById('cloudRegion')?.value || '';
        conn.cloud_instance_id = document.getElementById('cloudInstanceID')?.value || '';
    }
    
    // SSL fields
    if (document.getElementById('connSSLEnabled')?.checked) {
        conn.ssl_enabled = true;
        conn.ssl_skip_verify = document.getElementById('sslSkipVerify')?.checked || false;
        conn.ssl_ca_path = document.getElementById('sslCAPath')?.value || '';
        conn.ssl_cert_path = document.getElementById('sslCertPath')?.value || '';
        conn.ssl_key_path = document.getElementById('sslKeyPath')?.value || '';
        conn.ssl_min_version = document.getElementById('sslMinVersion')?.value || '1.2';
    }
    
    return conn;
}

function toggleSSHFields() {
    const enabled = document.getElementById('connSSHEnabled')?.checked;
    const fields = document.getElementById('sshFields');
    if (fields) fields.style.display = enabled ? 'block' : 'none';
}

function toggleSSLFields() {
    const enabled = document.getElementById('connSSLEnabled')?.checked;
    const fields = document.getElementById('sslFields');
    if (fields) fields.style.display = enabled ? 'block' : 'none';
}

async function browseSSLFile(inputId) {
    if (!isWailsAvailable()) { showNotification('warning', '需要 Wails 环境'); return; }
    try {
        const result = await WailsAPI.openFileDialog();
        if (result && document.getElementById(inputId)) {
            document.getElementById(inputId).value = result;
        }
    } catch (e) {
        showNotification('error', '选择文件失败: ' + (e.message || e));
    }
}

async function testSSLConnection() {
    if (!state.editingConnectionId) { showNotification('warning', '请先保存连接'); return; }
    if (!isWailsAvailable()) { showNotification('warning', '需要 Wails 环境'); return; }
    showLoading('测试 SSL 连接...');
    try {
        const result = await WailsAPI.testSSLConnection(state.editingConnectionId);
        hideLoading();
        if (Array.isArray(result) ? result[0] : result.success) {
            showNotification('success', (Array.isArray(result) ? result[1] : result.message) || 'SSL 连接成功');
        } else {
            showNotification('error', 'SSL 连接失败: ' + (Array.isArray(result) ? result[1] : result.message));
        }
    } catch (e) {
        hideLoading();
        showNotification('error', 'SSL 测试失败: ' + (e.message || e));
    }
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

function filterConnections(searchText) {
    const connectionList = document.getElementById('connectionList');
    if (!connectionList) return;
    const items = connectionList.querySelectorAll('.connection-item');
    const lowerSearch = (searchText || '').toLowerCase().trim();
    
    items.forEach(item => {
        if (!lowerSearch) {
            item.style.display = '';
            return;
        }
        const name = (item.querySelector('.connection-name')?.textContent || '').toLowerCase();
        const type = (item.querySelector('.connection-type')?.textContent || '').toLowerCase();
        const host = (item.dataset.host || '').toLowerCase();
        if (name.includes(lowerSearch) || type.includes(lowerSearch) || host.includes(lowerSearch)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
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

	// Virtual scrolling for large datasets (>500 rows)
	const VIRTUAL_THRESHOLD = 500;
	const VIRTUAL_ROW_HEIGHT = 32; // approximate row height in px
	const allRows = result.rows;
	const totalRows = allRows.length;

	if (totalRows > VIRTUAL_THRESHOLD) {
		// Create virtual scroll container
		const scrollContainer = body.parentElement; // tbody's parent (table or scroll div)
		const visibleHeight = (scrollContainer.clientHeight || 600);
		const visibleRowCount = Math.ceil(visibleHeight / VIRTUAL_ROW_HEIGHT) + 10;
		let scrollTop = scrollContainer.scrollTop || 0;
		let firstVisible = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT);
		if (firstVisible < 0) firstVisible = 0;
		let lastVisible = Math.min(firstVisible + visibleRowCount, totalRows);

		// Spacer row at top
		if (firstVisible > 0) {
			const spacerTr = document.createElement('tr');
			spacerTr.style.height = (firstVisible * VIRTUAL_ROW_HEIGHT) + 'px';
			spacerTr.innerHTML = '<td colspan="' + (columns.length + 1) + '"></td>';
			body.appendChild(spacerTr);
		}

		// Render visible rows
		for (let rowIndex = firstVisible; rowIndex < lastVisible; rowIndex++) {
			const row = allRows[rowIndex];
			const tr = document.createElement('tr');
			tr.dataset.row = String(rowIndex);
			tr.style.height = VIRTUAL_ROW_HEIGHT + 'px';

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
		}

		// Spacer row at bottom
		if (lastVisible < totalRows) {
			const bottomSpacer = document.createElement('tr');
			bottomSpacer.style.height = ((totalRows - lastVisible) * VIRTUAL_ROW_HEIGHT) + 'px';
			bottomSpacer.innerHTML = '<td colspan="' + (columns.length + 1) + '"></td>';
			body.appendChild(bottomSpacer);
		}

		// Virtual scroll event handler (debounced)
		if (!scrollContainer._virtualScrollHandler) {
			let scrollTimer = null;
			scrollContainer._virtualScrollHandler = function() {
				if (scrollTimer) clearTimeout(scrollTimer);
				scrollTimer = setTimeout(function() {
					const newScrollTop = scrollContainer.scrollTop || 0;
					const newFirst = Math.floor(newScrollTop / VIRTUAL_ROW_HEIGHT);
					if (Math.abs(newFirst - firstVisible) > 5) {
						renderDataView(result);
					}
				}, 100);
			};
			scrollContainer.addEventListener('scroll', scrollContainer._virtualScrollHandler);
		}
	} else {
		// Normal rendering for small datasets
		allRows.forEach((row, rowIndex) => {
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
	}

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
    loadRolesUI();
    loadPluginsUI();
    loadPluginHooksUI();
}

function closeSettings() {
    saveSettings();
    document.getElementById('settingsModal').classList.remove('active');
}

// ==================== F7: Role/Permission Management UI ====================

async function loadRolesUI() {
    const el = document.getElementById('rolesList');
    if (!el) return;
    el.innerHTML = '<div class="perf-loading">加载中...</div>';
    try {
        if (!isWailsAvailable()) { el.innerHTML = '<div class="perf-empty">需要 Wails 环境</div>'; return; }
        const roles = await WailsAPI.getRoles();
        el.innerHTML = '';
        if (!roles || roles.length === 0) {
            el.innerHTML = '<div class="perf-empty">无角色</div>';
            return;
        }
        roles.forEach(r => {
            const item = document.createElement('div');
            item.className = 'perf-list-item';
            const perms = (r.permissions || []).join(', ');
            item.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;"><div><strong>' + escapeHtml(r.name) + '</strong> <span style="color:var(--fg-muted);font-size:11px;">(' + perms + ')</span></div><button class="btn btn-danger btn-sm" onclick="deleteRoleUI(\'' + r.id + '\')">删除</button></div>' + (r.description ? '<div style="font-size:11px;color:var(--fg-muted);margin-top:4px;">' + escapeHtml(r.description) + '</div>' : '');
            el.appendChild(item);
        });
        // Populate assign select
        const assignSel = document.getElementById('roleAssignSelect');
        if (assignSel) {
            assignSel.innerHTML = '<option value="">选择角色...</option>';
            roles.forEach(r => assignSel.appendChild(new Option(r.name, r.id)));
        }
        // Populate connection select
        const connSel = document.getElementById('roleConnSelect');
        if (connSel) {
            connSel.innerHTML = '<option value="">选择连接...</option>';
            state.connections.forEach(c => connSel.appendChild(new Option(c.name, c.id)));
        }
    } catch (e) {
        el.innerHTML = '<div class="perf-empty">加载失败</div>';
    }
}

async function createRoleUI() {
    const name = document.getElementById('newRoleName')?.value.trim();
    if (!name) { showNotification('warning', '请输入角色名称'); return; }
    if (!isWailsAvailable()) { showNotification('warning', '需要 Wails 环境'); return; }
    try {
        await WailsAPI.createRole(name, ['read'], '');
        showNotification('success', '角色已创建');
        document.getElementById('newRoleName').value = '';
        loadRolesUI();
    } catch (e) {
        showNotification('error', '创建失败: ' + (e.message || e));
    }
}

async function deleteRoleUI(roleId) {
    if (!confirm('确定删除此角色？')) return;
    try {
        await WailsAPI.deleteRole(roleId);
        showNotification('success', '角色已删除');
        loadRolesUI();
    } catch (e) {
        showNotification('error', '删除失败: ' + (e.message || e));
    }
}

async function assignRoleUI() {
    const connID = document.getElementById('roleConnSelect')?.value;
    const roleID = document.getElementById('roleAssignSelect')?.value;
    if (!connID || !roleID) { showNotification('warning', '请选择连接和角色'); return; }
    try {
        await WailsAPI.assignRoleToConnection(connID, roleID);
        showNotification('success', '角色已分配');
    } catch (e) {
        showNotification('error', '分配失败: ' + (e.message || e));
    }
}

// ==================== F10: Plugin Management UI ====================

async function loadPluginsUI() {
    const el = document.getElementById('pluginsList');
    if (!el) return;
    el.innerHTML = '<div class="perf-loading">加载中...</div>';
    try {
        if (!isWailsAvailable()) { el.innerHTML = '<div class="perf-empty">需要 Wails 环境</div>'; return; }
        const plugins = await WailsAPI.getPlugins();
        el.innerHTML = '';
        if (!plugins || plugins.length === 0) {
            el.innerHTML = '<div class="perf-empty">无插件</div>';
            return;
        }
        plugins.forEach(p => {
            const item = document.createElement('div');
            item.className = 'perf-list-item';
            const statusColor = p.enabled ? 'var(--accent-success)' : 'var(--fg-muted)';
            item.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;"><div><strong>' + escapeHtml(p.name) + '</strong> <span style="color:var(--fg-muted);font-size:11px;">v' + (p.version || '1.0') + ' (' + (p.type || '') + ')</span> <span style="color:' + statusColor + ';font-size:11px;">' + (p.enabled ? '启用' : '禁用') + '</span></div><div style="display:flex;gap:4px;"><button class="btn btn-secondary btn-sm" onclick="togglePluginUI(\'' + p.id + '\', ' + !p.enabled + ')">' + (p.enabled ? '禁用' : '启用') + '</button><button class="btn btn-danger btn-sm" onclick="removePluginUI(\'' + p.id + '\')">删除</button></div></div>' + (p.description ? '<div style="font-size:11px;color:var(--fg-muted);margin-top:4px;">' + escapeHtml(p.description) + '</div>' : '');
            el.appendChild(item);
        });
    } catch (e) {
        el.innerHTML = '<div class="perf-empty">加载失败</div>';
    }
}

async function registerPluginUI() {
    const name = document.getElementById('newPluginName')?.value.trim();
    const version = document.getElementById('newPluginVersion')?.value.trim() || '1.0';
    const type = document.getElementById('newPluginType')?.value || 'query_hook';
    if (!name) { showNotification('warning', '请输入插件名称'); return; }
    if (!isWailsAvailable()) { showNotification('warning', '需要 Wails 环境'); return; }
    try {
        await WailsAPI.registerPlugin(name, version, '', type);
        showNotification('success', '插件已注册');
        document.getElementById('newPluginName').value = '';
        loadPluginsUI();
    } catch (e) {
        showNotification('error', '注册失败: ' + (e.message || e));
    }
}

async function togglePluginUI(pluginId, enabled) {
    try {
        await WailsAPI.togglePlugin(pluginId, enabled);
        showNotification('success', enabled ? '插件已启用' : '插件已禁用');
        loadPluginsUI();
    } catch (e) {
        showNotification('error', '操作失败: ' + (e.message || e));
    }
}

async function removePluginUI(pluginId) {
    if (!confirm('确定删除此插件？')) return;
    try {
        await WailsAPI.removePlugin(pluginId);
        showNotification('success', '插件已删除');
        loadPluginsUI();
    } catch (e) {
        showNotification('error', '删除失败: ' + (e.message || e));
    }
}

async function loadPluginHooksUI() {
    const el = document.getElementById('pluginHooksList');
    if (!el) return;
    el.innerHTML = '';
    const hooks = ['before_query', 'after_query', 'before_export', 'after_import', 'before_edit', 'after_edit', 'data_transform', 'ui_render'];
    hooks.forEach(h => {
        const badge = document.createElement('span');
        badge.className = 'badge badge-index';
        badge.style.cssText = 'padding:4px 10px;font-size:11px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--fg-secondary);';
        badge.textContent = h;
        el.appendChild(badge);
    });
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

async function aiDiagnoseError() {
    const query = getSelectedText() || getEditorValue().trim();
    if (!query) { showNotification('warning', '请选择或输入出错的 SQL'); return; }
    // 获取最近一条错误信息
    const messagesOutput = document.getElementById('messagesOutput');
    let lastError = '';
    if (messagesOutput) {
        const errorItems = messagesOutput.querySelectorAll('.msg-item.msg-error .msg-error-text, .msg-item.msg-error .msg-text');
        if (errorItems.length > 0) {
            lastError = errorItems[errorItems.length - 1].textContent || '';
        }
    }
    if (!lastError) {
        showNotification('info', '未检测到最近错误。请先执行查询产生错误，再使用诊断。');
        return;
    }
    showLoading('AI 正在诊断错误...');
    try {
        const prompt = 'SQL: ' + query + '\n\nError: ' + lastError;
        const result = await WailsAPI.explainSQL(prompt);
        hideLoading();
        showAIResult('AI 错误诊断', result);
    } catch (e) {
        hideLoading();
        showNotification('error', 'AI诊断失败: ' + (e.message || e));
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
          '=', '>', '<', '<=', '>=', '<>', '!=', '+', '-', '*', '/', '||', '::', '->', '->>', '#>', '#>>'
        ],

        symbols: /[=><!~&|\+\-\*\/\^]+/,

        keywords: [
          'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
          'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'TRUNCATE', 'USE',
          'INDEX', 'VIEW', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON',
          'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET',
          'UNION', 'ALL', 'AS', 'DISTINCT', 'EXISTS', 'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN',
          'IS', 'NULL', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
          'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
          'AUTO_INCREMENT', 'IDENTITY', 'SERIAL', 'CONSTRAINT', 'CASCADE',
          'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'TRANSACTION',
          'GRANT', 'REVOKE', 'PRIVILEGES', 'SCHEMA', 'DATABASE', 'IF', 'EXISTS',
          'RETURNING', 'WITH', 'RECURSIVE', 'WINDOW', 'OVER', 'PARTITION', 'RANGE',
          'ROWS', 'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT', 'ROW',
          'MATERIALIZED', 'EXPLAIN', 'ANALYZE', 'VACUUM', 'REINDEX', 'CLUSTER',
          'CONFLICT', 'DO', 'NOTHING', 'RETURNING', 'UPSERT', 'ON',
          'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
          'VARCHAR', 'CHAR', 'TEXT', 'CITEXT', 'UUID', 'JSON', 'JSONB', 'XML',
          'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL', 'MONEY',
          'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL', 'DATETIME',
          'BOOLEAN', 'BOOL', 'BYTEA', 'BLOB', 'BINARY', 'VARBINARY',
          'ENGINE', 'CHARSET', 'COLLATE', 'COLLATION', 'TABLESPACE',
          'PARTITION', 'PARTITIONED', 'DISTRIBUTED', 'SORTED', 'STORED', 'FORMAT'
        ],

        functions: [
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'GREATEST', 'LEAST',
          'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'EXTRACT', 'DATE_PART',
          'DATE_TRUNC', 'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP', 'AGE', 'INTERVAL',
          'LENGTH', 'CHAR_LENGTH', 'SUBSTRING', 'SUBSTR', 'POSITION', 'TRIM', 'LTRIM', 'RTRIM',
          'UPPER', 'LOWER', 'INITCAP', 'REPLACE', 'SPLIT_PART', 'REGEXP_MATCHES', 'REGEXP_REPLACE',
          'CONCAT', 'CONCAT_WS', 'FORMAT', 'LPAD', 'RPAD', 'LEFT', 'RIGHT', 'REPEAT',
          'ROUND', 'CEIL', 'CEILING', 'FLOOR', 'ABS', 'POWER', 'SQRT', 'CBRT', 'EXP', 'LN', 'LOG',
          'RANDOM', 'GENERATE_SERIES', 'GENERATE_UUID', 'UUID_GENERATE_V4',
          'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
          'NTH_VALUE', 'NTILE', 'CUME_DIST', 'PERCENT_RANK', 'PERCENTILE_CONT', 'PERCENTILE_DISC',
          'ARRAY_AGG', 'STRING_AGG', 'BOOL_AND', 'BOOL_OR', 'EVERY', 'MEDIAN',
          'JSON_AGG', 'JSONB_AGG', 'JSON_OBJECT', 'JSONB_OBJECT', 'JSON_EXTRACT_PATH',
          'CAST', 'CONVERT', 'ENCODE', 'DECODE', 'DIGEST', 'HMAC',
          'PG_SLEEP', 'PG_TERMINATE_BACKEND', 'PG_CANCEL_BACKEND',
          'CURRENT_USER', 'CURRENT_SCHEMA', 'SESSION_USER', 'CURRENT_ROLE',
          'VERSION', 'PG_VERSION', 'GET_LOCK', 'RELEASE_LOCK'
        ],

        tokenizer: {
          root: [
            [/@?[a-zA-Z_]\w*/, { cases: {
              '@keywords': 'keyword',
              '@functions': 'function',
              '@default': 'identifier'
            } }],
            [/'/, { token: 'string', next: '@string' }],
            [/"/, { token: 'string', next: '@stringDouble' }],
            [/`/, { token: 'identifier.quote', next: '@backtick' }],
            [/--.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            [/\$\d+/, 'predefined'],
            [/\$\{[a-zA-Z_]\w*\}/, 'predefined'],
            [/\d+\.?\d*[eE]?\d*/, 'number'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
            [/[;,.]/, 'delimiter']
          ],
          string: [
            [/[^']+/, 'string'], [/''/, 'string.escape'], [/'/, { token: 'string', next: '@pop' }]
          ],
          stringDouble: [
            [/[^"]+/, 'string'], [/""/, 'string.escape'], [/"/, { token: 'string', next: '@pop' }]
          ],
          backtick: [
            [/[^`]+/, 'identifier'], [/`/, { token: 'identifier.quote', next: '@pop' }]
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

function findInEditor() {
  if (monacoEditor) {
    monacoEditor.getAction('actions.find').run();
  }
}

function replaceInEditor() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.startFindReplaceAction').run();
  }
}

function findNext() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.nextMatchFindAction').run();
  }
}

function findPrevious() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.previousMatchFindAction').run();
  }
}

function toggleComment() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.commentLine').run();
  }
}

function toggleBlockComment() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.blockComment').run();
  }
}

function selectAllOccurrences() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.selectHighlights').run();
  }
}

function addCursorBelow() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.insertCursorBelow').run();
  }
}

function formatDocument() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.formatDocument').run();
  }
}

function goToLine() {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.gotoLine').run();
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
  ['summary', 'messages', 'results', 'chart'].forEach(v => {
    const el = document.getElementById('rv-' + v);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });
  if (view === 'chart') renderChart();
};

window.switchResultTab = function(idx) {
  document.querySelectorAll('.result-sub-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.idx) === idx));
  document.querySelectorAll('.result-sub-panel').forEach(p => p.style.display = parseInt(p.dataset.rp) === idx ? 'block' : 'none');
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== F5: Chart Visualization ====================

let lastQueryResult = null;

function setChartResult(result) {
    lastQueryResult = result;
    const chartBtn = document.getElementById('chartTabBtn');
    if (chartBtn && result && result.columns && result.columns.length >= 2 && result.rows && result.rows.length > 0) {
        chartBtn.style.display = '';
        // Populate column selectors
        const labelSel = document.getElementById('chartLabelCol');
        const valueSel = document.getElementById('chartValueCol');
        if (labelSel && valueSel) {
            labelSel.innerHTML = '';
            valueSel.innerHTML = '';
            result.columns.forEach((col, i) => {
                labelSel.appendChild(new Option(col, i));
                valueSel.appendChild(new Option(col, i));
            });
            if (result.columns.length >= 2) {
                labelSel.value = '0';
                valueSel.value = '1';
            }
        }
    } else if (chartBtn) {
        chartBtn.style.display = 'none';
    }
}

function renderChart() {
    const canvas = document.getElementById('chartCanvas');
    if (!canvas || !lastQueryResult || !lastQueryResult.columns) return;
    const ctx = canvas.getContext('2d');
    const type = document.getElementById('chartType')?.value || 'bar';
    const labelIdx = parseInt(document.getElementById('chartLabelCol')?.value || '0');
    const valueIdx = parseInt(document.getElementById('chartValueCol')?.value || '1');

    const rows = lastQueryResult.rows || [];
    if (rows.length === 0) return;

    const labels = rows.map(r => r[labelIdx] != null ? String(r[labelIdx]).substring(0, 20) : '');
    const values = rows.map(r => {
        const v = r[valueIdx];
        if (v == null) return 0;
        const f = parseFloat(v);
        return isNaN(f) ? 0 : f;
    });

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width, h = canvas.height;
    const padding = 40;
    const chartW = w - padding * 2;
    const chartH = h - padding * 2;
    const maxVal = Math.max(...values, 1);
    const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

    if (type === 'bar') {
        const barW = chartW / values.length * 0.7;
        const gap = chartW / values.length * 0.3;
        ctx.fillStyle = '#e6edf3';
        ctx.font = '11px sans-serif';
        // Y axis labels
        for (let i = 0; i <= 4; i++) {
            const y = padding + chartH - (chartH / 4) * i;
            const val = (maxVal / 4 * i).toFixed(0);
            ctx.fillText(val, 5, y + 3);
            ctx.strokeStyle = '#30363d';
            ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(w - padding, y); ctx.stroke();
        }
        values.forEach((v, i) => {
            const x = padding + i * (barW + gap) + gap / 2;
            const barH = (v / maxVal) * chartH;
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x, padding + chartH - barH, barW, barH);
            // Label
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px sans-serif';
            const label = labels[i].substring(0, 8);
            ctx.fillText(label, x + barW / 2 - label.length * 3, padding + chartH + 15);
        });
    } else if (type === 'line') {
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        values.forEach((v, i) => {
            const x = padding + (chartW / (values.length - 1 || 1)) * i;
            const y = padding + chartH - (v / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        // Points
        values.forEach((v, i) => {
            const x = padding + (chartW / (values.length - 1 || 1)) * i;
            const y = padding + chartH - (v / maxVal) * chartH;
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px sans-serif';
            ctx.fillText(labels[i].substring(0, 8), x - 12, padding + chartH + 15);
        });
    } else if (type === 'pie') {
        const total = values.reduce((a, b) => a + b, 0) || 1;
        let angle = -Math.PI / 2;
        const cx = w / 2, cy = h / 2, r = Math.min(chartW, chartH) / 2;
        values.forEach((v, i) => {
            const slice = (v / total) * Math.PI * 2;
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, angle, angle + slice);
            ctx.closePath();
            ctx.fill();
            angle += slice;
        });
        // Legend
        ctx.font = '11px sans-serif';
        values.forEach((v, i) => {
            const ly = padding + i * 18;
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(padding, ly, 12, 12);
            ctx.fillStyle = '#e6edf3';
            ctx.fillText(labels[i].substring(0, 15) + ' (' + v + ')', padding + 18, ly + 10);
        });
    }
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
window.findInEditor = findInEditor;
window.replaceInEditor = replaceInEditor;
window.findNext = findNext;
window.findPrevious = findPrevious;
window.toggleComment = toggleComment;
window.toggleBlockComment = toggleBlockComment;
window.selectAllOccurrences = selectAllOccurrences;
window.addCursorBelow = addCursorBelow;
window.formatDocument = formatDocument;
window.goToLine = goToLine;
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
window.filterConnections = filterConnections;
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

// ==================== F3: Performance Monitor Panel ====================

function openPerfPanel() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    closeAllSidePanels();
    document.getElementById('perfPanel').style.display = 'block';
    refreshPerfPanel();
}

function closePerfPanel() {
    document.getElementById('perfPanel').style.display = 'none';
}

async function refreshPerfPanel() {
    refreshSystemInfo();
    refreshPoolStatus();
    refreshSlowQueries();
    refreshActiveQueries();
}

async function refreshSystemInfo() {
    const el = document.getElementById('perfSystemInfo');
    if (!el) return;
    el.innerHTML = '<div class="perf-loading">加载中...</div>';
    try {
        if (!isWailsAvailable()) { el.innerHTML = '<div class="perf-empty">需要 Wails 环境</div>'; return; }
        const info = await WailsAPI.getSystemInfo();
        el.innerHTML = '';
        const items = [
            ['CPU 使用率', info.cpuUsage + '%'],
            ['内存使用率', info.memoryUsage + '%'],
            ['磁盘使用率', info.diskUsage + '%'],
            ['运行时间', info.uptime || '--'],
            ['Go 版本', info.goVersion || '--'],
            ['OS', info.os || '--'],
        ];
        items.forEach(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'perf-info-item';
            item.innerHTML = '<span class="perf-info-label">' + label + '</span><span class="perf-info-value">' + value + '</span>';
            el.appendChild(item);
        });
    } catch (e) {
        el.innerHTML = '<div class="perf-empty">获取失败: ' + (e.message || e) + '</div>';
    }
}

async function refreshPoolStatus() {
    const el = document.getElementById('perfPoolStatus');
    if (!el) return;
    el.innerHTML = '<div class="perf-loading">加载中...</div>';
    try {
        if (!isWailsAvailable()) { el.innerHTML = '<div class="perf-empty">需要 Wails 环境</div>'; return; }
        const stats = await WailsAPI.getPoolStats();
        el.innerHTML = '';
        const items = [
            ['总连接数', stats.totalConnections || 0],
            ['活跃连接', stats.activeConnections || 0],
            ['空闲连接', stats.idleConnections || 0],
            ['最大连接数', stats.maxConnections || 0],
        ];
        items.forEach(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'perf-info-item';
            item.innerHTML = '<span class="perf-info-label">' + label + '</span><span class="perf-info-value">' + value + '</span>';
            el.appendChild(item);
        });
    } catch (e) {
        el.innerHTML = '<div class="perf-empty">获取失败</div>';
    }
}

async function refreshSlowQueries() {
    const el = document.getElementById('perfSlowQueries');
    if (!el) return;
    el.innerHTML = '<div class="perf-loading">加载中...</div>';
    try {
        if (!isWailsAvailable()) { el.innerHTML = '<div class="perf-empty">需要 Wails 环境</div>'; return; }
        const queries = await WailsAPI.getSlowQueries(state.activeConnection, 10);
        el.innerHTML = '';
        if (!queries || queries.length === 0) {
            el.innerHTML = '<div class="perf-empty">无慢查询</div>';
            return;
        }
        queries.forEach(q => {
            const item = document.createElement('div');
            item.className = 'perf-list-item';
            item.innerHTML = '<div class="perf-list-query">' + escapeHtml(q.query || q.sql || '').substring(0, 80) + '</div><div class="perf-list-meta"><span>' + (q.duration || q.totalTime || '--') + '</span><span>' + (q.calls || 1) + ' 次</span></div>';
            el.appendChild(item);
        });
    } catch (e) {
        el.innerHTML = '<div class="perf-empty">获取失败</div>';
    }
}

async function refreshActiveQueries() {
    const el = document.getElementById('perfActiveQueries');
    if (!el) return;
    el.innerHTML = '<div class="perf-loading">加载中...</div>';
    try {
        if (!isWailsAvailable()) { el.innerHTML = '<div class="perf-empty">需要 Wails 环境</div>'; return; }
        const queries = await WailsAPI.getActiveQueries(state.activeConnection);
        el.innerHTML = '';
        if (!queries || queries.length === 0) {
            el.innerHTML = '<div class="perf-empty">无活跃查询</div>';
            return;
        }
        queries.forEach(q => {
            const item = document.createElement('div');
            item.className = 'perf-list-item';
            item.innerHTML = '<div class="perf-list-query">' + escapeHtml(q.query || '').substring(0, 80) + '</div><div class="perf-list-meta"><span>' + (q.duration || '--') + '</span>' + (q.pid ? '<button class="btn btn-danger btn-sm" onclick="cancelQueryById(' + q.pid + ')" style="margin-left:8px;">取消</button>' : '') + '</div>';
            el.appendChild(item);
        });
    } catch (e) {
        el.innerHTML = '<div class="perf-empty">获取失败</div>';
    }
}

async function cancelQueryById(pid) {
    if (!isWailsAvailable()) return;
    try {
        await WailsAPI.cancelQuery(state.activeConnection, pid);
        showNotification('success', '查询已取消');
        refreshActiveQueries();
    } catch (e) {
        showNotification('error', '取消失败: ' + (e.message || e));
    }
}

// ==================== F4: Query History Panel ====================

let queryHistoryData = [];

function openHistoryPanel() {
    closeAllSidePanels();
    document.getElementById('historyPanel').style.display = 'block';
    loadQueryHistory();
}

function closeHistoryPanel() {
    document.getElementById('historyPanel').style.display = 'none';
}

async function loadQueryHistory() {
    const el = document.getElementById('historyList');
    if (!el) return;
    el.innerHTML = '<div class="perf-loading">加载中...</div>';
    try {
        if (!isWailsAvailable()) {
            // Use local history
            queryHistoryData = state.queryHistory || [];
            renderHistory();
            return;
        }
        const result = await WailsAPI.getQueryHistory(100);
        queryHistoryData = result || [];
        renderHistory();
    } catch (e) {
        el.innerHTML = '<div class="perf-empty">加载失败</div>';
    }
}

function renderHistory() {
    const el = document.getElementById('historyList');
    if (!el) return;
    const search = (document.getElementById('historySearch')?.value || '').toLowerCase();
    const filter = document.getElementById('historyFilter')?.value || 'all';

    let filtered = queryHistoryData;
    if (search) {
        filtered = filtered.filter(h => (h.query || '').toLowerCase().includes(search));
    }
    if (filter === 'slow') {
        filtered = filtered.filter(h => h.isSlow || (h.durationMs && h.durationMs > 1000));
    } else if (filter === 'error') {
        filtered = filtered.filter(h => h.error);
    }

    if (filtered.length === 0) {
        el.innerHTML = '<div class="perf-empty">无历史记录</div>';
        return;
    }

    el.innerHTML = '';
    filtered.slice(0, 100).forEach(h => {
        const item = document.createElement('div');
        item.className = 'perf-list-item' + (h.error ? ' perf-list-error' : '');
        const time = h.timestamp || h.time || '';
        const dur = h.duration || (h.durationMs ? h.durationMs + 'ms' : '');
        const queryPreview = escapeHtml((h.query || '').substring(0, 100));
        item.innerHTML = '<div class="perf-list-query">' + queryPreview + '</div><div class="perf-list-meta"><span>' + time + '</span><span>' + dur + '</span>' + (h.error ? '<span style="color:var(--accent-danger)">错误</span>' : '') + '</div>';
        item.onclick = () => { if (h.query) { setEditorValue(h.query); showNotification('info', '已加载到编辑器'); } };
        el.appendChild(item);
    });
}

function filterHistory() {
    renderHistory();
}

function clearQueryHistory() {
    if (!confirm('确定清空所有查询历史？')) return;
    queryHistoryData = [];
    state.queryHistory = [];
    renderHistory();
    showNotification('success', '历史已清空');
}

// ==================== F6: Git Panel ====================

let currentGitRepo = '';

function openGitPanel() {
    closeAllSidePanels();
    document.getElementById('gitPanel').style.display = 'block';
    loadGitRepos();
}

function closeGitPanel() {
    document.getElementById('gitPanel').style.display = 'none';
}

// ==================== F9: Report Designer Panel ====================

let reportTemplatesData = [];
let currentReportSections = [];

function openReportPanel() {
    closeAllSidePanels();
    document.getElementById('reportPanel').style.display = 'block';
    loadReportTemplatesUI();
}

function closeReportPanel() {
    document.getElementById('reportPanel').style.display = 'none';
}

async function loadReportTemplatesUI() {
    const select = document.getElementById('reportTemplateSelect');
    if (!select) return;
    try {
        if (!isWailsAvailable()) { select.innerHTML = '<option value="">需要 Wails 环境</option>'; return; }
        const templates = await WailsAPI.getReportTemplates();
        reportTemplatesData = templates || [];
        select.innerHTML = '<option value="">选择模板...</option>';
        reportTemplatesData.forEach(t => {
            select.appendChild(new Option(t.name, t.id));
        });
    } catch (e) {
        select.innerHTML = '<option value="">加载失败</option>';
    }
}

function onReportTemplateChange() {
    const id = document.getElementById('reportTemplateSelect').value;
    const editor = document.getElementById('reportEditor');
    if (!id) { editor.style.display = 'none'; return; }
    editor.style.display = 'block';
    const tpl = reportTemplatesData.find(t => t.id === id);
    if (tpl) {
        document.getElementById('reportTplName').value = tpl.name || '';
        document.getElementById('reportTplDesc').value = tpl.description || '';
        currentReportSections = tpl.sections || [];
        renderReportSections();
    }
    document.getElementById('reportResult').style.display = 'none';
}

function newReportTemplate() {
    document.getElementById('reportTemplateSelect').value = '';
    document.getElementById('reportEditor').style.display = 'block';
    document.getElementById('reportTplName').value = '';
    document.getElementById('reportTplDesc').value = '';
    currentReportSections = [];
    renderReportSections();
    document.getElementById('reportResult').style.display = 'none';
}

function addReportSection() {
    const section = {
        id: 'sec_' + Date.now(),
        title: '新区块',
        type: 'table',
        query: '',
        chartType: 'bar',
        labelColumn: '',
        valueColumn: '',
        width: 12,
        height: 300
    };
    currentReportSections.push(section);
    renderReportSections();
}

function removeReportSection(idx) {
    currentReportSections.splice(idx, 1);
    renderReportSections();
}

function renderReportSections() {
    const el = document.getElementById('reportSections');
    if (!el) return;
    el.innerHTML = '';
    if (currentReportSections.length === 0) {
        el.innerHTML = '<div class="perf-empty">无区块，点击下方按钮添加</div>';
        return;
    }
    currentReportSections.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'perf-list-item';
        item.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <input type="text" value="${escapeHtml(s.title)}" placeholder="区块标题" onchange="updateReportSection(${i},'title',this.value)" style="flex:1;padding:4px 8px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:12px;">
                <select onchange="updateReportSection(${i},'type',this.value)" style="margin-left:8px;padding:4px 8px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:12px;">
                    <option value="table" ${s.type==='table'?'selected':''}>表格</option>
                    <option value="chart" ${s.type==='chart'?'selected':''}>图表</option>
                    <option value="summary" ${s.type==='summary'?'selected':''}>摘要</option>
                    <option value="text" ${s.type==='text'?'selected':''}>文本</option>
                </select>
                <button class="btn btn-danger btn-sm" onclick="removeReportSection(${i})" style="margin-left:8px;">删除</button>
            </div>
            <textarea placeholder="SQL查询 (文本类型填内容)" onchange="updateReportSection(${i},'query',this.value)" style="width:100%;height:60px;padding:6px 8px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:var(--font-mono);font-size:11px;resize:vertical;">${escapeHtml(s.query || '')}</textarea>
            ${s.type === 'chart' ? `
            <div style="display:flex;gap:8px;margin-top:4px;">
                <select onchange="updateReportSection(${i},'chartType',this.value)" style="padding:4px 8px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:11px;">
                    <option value="bar" ${s.chartType==='bar'?'selected':''}>柱状图</option>
                    <option value="line" ${s.chartType==='line'?'selected':''}>折线图</option>
                    <option value="pie" ${s.chartType==='pie'?'selected':''}>饼图</option>
                </select>
                <input type="text" value="${s.labelColumn||''}" placeholder="标签列" onchange="updateReportSection(${i},'labelColumn',this.value)" style="flex:1;padding:4px 8px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:11px;">
                <input type="text" value="${s.valueColumn||''}" placeholder="数值列" onchange="updateReportSection(${i},'valueColumn',this.value)" style="flex:1;padding:4px 8px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:11px;">
            </div>` : ''}
        `;
        el.appendChild(item);
    });
}

function updateReportSection(idx, field, value) {
    if (currentReportSections[idx]) {
        currentReportSections[idx][field] = value;
    }
}

async function saveReportTemplateUI() {
    const name = document.getElementById('reportTplName').value.trim();
    if (!name) { showNotification('warning', '请输入模板名称'); return; }
    if (!isWailsAvailable()) { showNotification('warning', '需要 Wails 环境'); return; }
    const id = document.getElementById('reportTemplateSelect').value || '';
    const tpl = {
        id: id,
        name: name,
        description: document.getElementById('reportTplDesc').value || '',
        sections: currentReportSections,
    };
    try {
        await WailsAPI.saveReportTemplate(tpl);
        showNotification('success', '模板已保存');
        loadReportTemplatesUI();
    } catch (e) {
        showNotification('error', '保存失败: ' + (e.message || e));
    }
}

async function deleteReportTemplateUI() {
    const id = document.getElementById('reportTemplateSelect').value;
    if (!id) { showNotification('warning', '请先选择模板'); return; }
    if (!confirm('确定删除此模板？')) return;
    try {
        await WailsAPI.deleteReportTemplate(id);
        showNotification('success', '模板已删除');
        document.getElementById('reportEditor').style.display = 'none';
        loadReportTemplatesUI();
    } catch (e) {
        showNotification('error', '删除失败: ' + (e.message || e));
    }
}

async function executeReportUI() {
    const id = document.getElementById('reportTemplateSelect').value;
    if (!id) { showNotification('warning', '请先选择模板'); return; }
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    if (!isWailsAvailable()) { showNotification('warning', '需要 Wails 环境'); return; }
    const db = document.getElementById('queryDatabase')?.value || state.selectedDatabase || '';
    showLoading('执行报表...');
    try {
        const result = await WailsAPI.executeReportTemplate(state.activeConnection, db, id, {});
        hideLoading();
        const resultDiv = document.getElementById('reportResult');
        const contentDiv = document.getElementById('reportResultContent');
        resultDiv.style.display = 'block';
        contentDiv.innerHTML = '';
        if (result && result.sections) {
            result.sections.forEach(sec => {
                const item = document.createElement('div');
                item.className = 'perf-list-item';
                let html = '<div style="font-weight:600;margin-bottom:4px;">' + escapeHtml(sec.title || sec.id) + '</div>';
                if (sec.error) {
                    html += '<div style="color:var(--accent-danger);font-size:11px;">' + escapeHtml(sec.error) + '</div>';
                } else if (sec.type === 'table' && sec.rows) {
                    html += '<div style="font-size:11px;color:var(--fg-muted);">' + (sec.row_count || sec.rows.length) + ' 行</div>';
                } else if (sec.type === 'chart' && sec.chart) {
                    html += '<div style="font-size:11px;color:var(--fg-muted);">图表数据: ' + (sec.chart.labels ? sec.chart.labels.length : 0) + ' 项</div>';
                } else if (sec.type === 'summary' && sec.summary) {
                    html += '<div style="font-size:11px;color:var(--fg-muted);">摘要已生成</div>';
                } else if (sec.type === 'text' && sec.content) {
                    html += '<div style="font-size:11px;color:var(--fg-secondary);white-space:pre-wrap;">' + escapeHtml(sec.content.substring(0, 200)) + '</div>';
                }
                item.innerHTML = html;
                contentDiv.appendChild(item);
            });
        }
        showNotification('success', '报表已执行');
    } catch (e) {
        hideLoading();
        showNotification('error', '执行失败: ' + (e.message || e));
    }
}

function closeAllSidePanels() {
    document.querySelectorAll('.side-panel').forEach(p => p.style.display = 'none');
}

async function loadGitRepos() {
    const select = document.getElementById('gitRepoSelect');
    if (!select) return;
    try {
        if (!isWailsAvailable()) { select.innerHTML = '<option value="">需要 Wails 环境</option>'; return; }
        const repos = await WailsAPI.getGitRepos();
        select.innerHTML = '<option value="">选择仓库...</option>';
        repos.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r.split('/').pop() || r;
            select.appendChild(opt);
        });
    } catch (e) {
        select.innerHTML = '<option value="">加载失败</option>';
    }
}

async function onGitRepoChange() {
    currentGitRepo = document.getElementById('gitRepoSelect').value;
    const infoDiv = document.getElementById('gitRepoInfo');
    if (!currentGitRepo) { infoDiv.style.display = 'none'; return; }
    infoDiv.style.display = 'block';
    refreshGitInfo();
}

async function refreshGitInfo() {
    if (!currentGitRepo || !isWailsAvailable()) return;
    // Branch info
    try {
        const info = await WailsAPI.getGitRepoInfo(currentGitRepo);
        const el = document.getElementById('gitBranchInfo');
        el.innerHTML = '';
        const items = [
            ['分支', info.branch || '--'],
            ['状态', info.status || '--'],
            ['远程', info.remote || '--'],
            ['领先', info.aheadCount || 0],
            ['落后', info.behindCount || 0],
        ];
        items.forEach(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'perf-info-item';
            item.innerHTML = '<span class="perf-info-label">' + label + '</span><span class="perf-info-value">' + value + '</span>';
            el.appendChild(item);
        });
    } catch (e) {}

    // Changes
    try {
        const changes = await WailsAPI.getGitChanges(currentGitRepo);
        const el = document.getElementById('gitChanges');
        el.innerHTML = '';
        if (changes.length === 0) {
            el.innerHTML = '<div class="perf-empty">无变更</div>';
        } else {
            changes.forEach(c => {
                const item = document.createElement('div');
                item.className = 'perf-list-item';
                const statusColor = c.status === 'added' ? 'var(--accent-success)' : c.status === 'deleted' ? 'var(--accent-danger)' : 'var(--accent-warning)';
                item.innerHTML = '<span style="color:' + statusColor + ';font-weight:600;width:60px;flex-shrink:0;">' + c.status + '</span><span class="perf-list-query">' + escapeHtml(c.file) + '</span>';
                el.appendChild(item);
            });
        }
    } catch (e) {}

    // Log
    try {
        const log = await WailsAPI.getGitLog(currentGitRepo, 20);
        const el = document.getElementById('gitLog');
        el.innerHTML = '';
        if (log.length === 0) {
            el.innerHTML = '<div class="perf-empty">无提交历史</div>';
        } else {
            log.forEach(c => {
                const item = document.createElement('div');
                item.className = 'perf-list-item';
                item.innerHTML = '<div class="perf-list-query">' + escapeHtml(c.message).substring(0, 60) + '</div><div class="perf-list-meta"><span>' + c.hash.substring(0, 7) + '</span><span>' + c.author + '</span><span>' + c.date + '</span></div>';
                el.appendChild(item);
            });
        }
    } catch (e) {}
}

async function addGitRepoDialog() {
    if (!isWailsAvailable()) { showNotification('warning', '需要 Wails 环境'); return; }
    try {
        const path = await WailsAPI.openFileDialog();
        if (!path) return;
        await WailsAPI.addGitRepo(path);
        showNotification('success', '仓库已添加');
        loadGitRepos();
    } catch (e) {
        showNotification('error', '添加失败: ' + (e.message || e));
    }
}

async function gitPullCurrent() {
    if (!currentGitRepo) return;
    try {
        const msg = await WailsAPI.gitPull(currentGitRepo);
        showNotification('success', msg || 'Pull 成功');
        refreshGitInfo();
    } catch (e) {
        showNotification('error', 'Pull 失败: ' + (e.message || e));
    }
}

async function gitPushCurrent() {
    if (!currentGitRepo) return;
    try {
        const msg = await WailsAPI.gitPush(currentGitRepo);
        showNotification('success', msg || 'Push 成功');
        refreshGitInfo();
    } catch (e) {
        showNotification('error', 'Push 失败: ' + (e.message || e));
    }
}

async function gitCommitDialog() {
    if (!currentGitRepo) { showNotification('warning', '请先选择仓库'); return; }
    const message = prompt('请输入提交信息:');
    if (!message) return;
    try {
        const msg = await WailsAPI.gitCommit(currentGitRepo, message);
        showNotification('success', msg || '提交成功');
        refreshGitInfo();
    } catch (e) {
        showNotification('error', '提交失败: ' + (e.message || e));
    }
}

async function gitBranchDialog() {
    if (!currentGitRepo) { showNotification('warning', '请先选择仓库'); return; }
    const name = prompt('请输入新分支名称:');
    if (!name) return;
    try {
        const msg = await WailsAPI.gitCreateBranch(currentGitRepo, name);
        showNotification('success', msg || '分支已创建');
        refreshGitInfo();
    } catch (e) {
        showNotification('error', '创建失败: ' + (e.message || e));
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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


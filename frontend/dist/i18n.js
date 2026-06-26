/**
 * DBNexus - Internationalization (i18n)
 * Supports: zh (Chinese), en (English)
 */

const translations = {
    zh: {
        // App
        appName: 'DBNexus',
        appSubtitle: '数据库管理工具',
        
// Toolbar
	newConnection: '新建连接',
	newQuery: '新建查询',
	executeQuery: '执行查询',
	refresh: '刷新',
	settings: '设置',
	language: '语言',
	disconnect: '断开连接',
	
	// Editor buttons
	formatSQL: '格式化 SQL',
	runQuery: '运行查询 (F5)',
	explainQuery: '查看执行计划',
	saveQuery: '保存查询',
	loadQuery: '加载查询',
	
	// Data view buttons
	addRecord: '添加记录',
	deleteSelected: '删除选中',
	saveChanges: '保存更改',
	discardChanges: '撤销更改',
	refreshData: '刷新数据',
	firstPage: '首页',
	prevPage: '上一页',
	nextPage: '下一页',
	lastPage: '末页',
	applyFilter: '应用筛选',
	clearFilter: '清除筛选',
	toggleSort: '切换排序',
	
	// Window buttons
	minimize: '最小化',
	maximize: '最大化',
	close: '关闭',
	
	// Sidebar
	connections: '连接',
        databases: '数据库',
        tables: '表',
        views: '视图',
        functions: '函数',
        
        // Connection Dialog
        newConnectionTitle: '新建连接',
        connectionName: '连接名称',
        host: '主机',
        port: '端口',
        username: '用户名',
        password: '密码',
        database: '数据库 (可选)',
        databaseOptional: '留空将连接到默认数据库',
        fetchDatabases: '获取数据库列表',
        databaseFile: '数据库文件路径',
        databaseNumber: '数据库编号',
        colorLabel: '颜色标签',
        savePassword: '保存密码',
        autoConnect: '启动时自动连接',
        testConnection: '测试连接',
        save: '保存',
        cancel: '取消',
        
        // Database Types
        postgresql: 'PostgreSQL',
        mysql: 'MySQL',
        polardb: 'PolarDB',
        gaussdb: 'GaussDB',
        sqlite: 'SQLite',
        redis: 'Redis',
        
        // Results
        gridView: '网格视图',
        textView: '文本视图',
        history: '历史记录',
        rowsReturned: '返回 {count} 行',
        executionTime: '执行时间: {time}',
        
        // Settings
        settingsTitle: '设置',
        general: '常规',
        editor: '编辑器',
        appearance: '外观',
        language: '语言',
        theme: '主题',
        dark: '深色',
        light: '浅色',
        system: '跟随系统',
        fontSize: '字体大小',
        tabSize: 'Tab 大小',
        wordWrap: '自动换行',
        lineNumbers: '行号',
        connectionTimeout: '连接超时（秒）',
        queryTimeout: '查询超时（秒）',
        maxConnections: '最大连接数',
        
        // Status Bar
        connected: '已连接',
        notConnected: '未连接',
        
        // Context Menu
        open: '打开',
        newQueryMenu: '新查询',
        refreshMenu: '刷新',
        duplicate: '复制',
        delete: '删除',
        
        // Messages
        connectionSuccessful: '连接成功！',
        connectionFailed: '连接失败',
        querySuccessful: '查询成功',
        queryFailed: '查询失败',
        saved: '已保存',
        deleted: '已删除',
        
        // Time
        hours: '小时',
        minutes: '分钟',
        seconds: '秒',

        // Data View
        dataView: '数据视图',
        records: '条记录',
        selected: '已选',
        pageSize: '每页',
        filterColumn: '筛选列',
        filterValue: '筛选值',
        filterOperator: '运算符',
        nullValue: 'NULL',
        noData: '暂无数据',
        loading: '加载中...',
        largeResultWarning: '结果集超过 10000 行，仅显示前 10000 行',

        // Export/Import
        exportData: '导出数据',
        importData: '导入数据',
        exportFormat: '导出格式',
        tableName: '表名',
        filePath: '文件路径',
        browse: '浏览',
        importFormat: '导入格式',
        targetTable: '目标表',
        sqlPreview: 'SQL 预览',
        copySQL: '复制 SQL',

        // Redis
        redisBrowser: 'Redis 浏览器',
        keyPattern: 'Key 模式',
        scanKeys: '扫描',
        keyList: 'Key 列表',
        keyDetail: 'Key 详情',
        keyValue: '值',
        setKey: '设置 Key',
        deleteKey: '删除 Key',
        serverInfo: '服务器信息',
        dbSize: 'Key 数量',

        // Compare
        dataCompare: '数据对比',
        compareMode: '对比模式',
        tableCompare: '表对比',
        queryCompare: '查询对比',
        table1: '表 1',
        table2: '表 2',
        excludeColumns: '排除列 (逗号分隔)',
        query1: '查询 1',
        query2: '查询 2',
        executeCompare: '执行对比',
        matched: '匹配',
        differences: '差异',
        leftOnly: '仅左',
        rightOnly: '仅右',

        // Transaction
        transaction: '事务',
        beginTransaction: '开始事务',
        commitTransaction: '提交',
        rollbackTransaction: '回滚',
        txId: '事务 ID',
        noActiveTransaction: '无活动事务',
        activeTransaction: '活动事务',
        executeInTx: '执行',
        txQuery: 'SQL 语句',
        txResults: '执行结果',
        rowsAffected: '影响行数',

        // AI
        aiAssistant: 'AI 助手',
        aiExplain: 'AI 解释',
        aiOptimize: 'AI 优化',
        aiEnable: '启用 AI',
        aiProvider: 'Provider',
        aiApiKey: 'API Key',
        aiBaseURL: 'Base URL',
        aiModel: '模型',
        testAI: '测试连接',
        saveAIConfig: '保存 AI 配置',
        aiExplainTitle: 'AI SQL 解释',
        aiOptimizeTitle: 'AI 优化建议',

        // Schema
        structure: '表结构',
        indexes: '索引',
        foreignKeys: '外键',
        createIndex: '创建索引',
        addForeignKey: '添加外键',
        columnName: '列名',
        dataType: '类型',
        nullable: '允许空',
        defaultValue: '默认值',
        primaryKey: '主键',

        // Empty states
        noConnections: '暂无连接，点击「新建连接」开始',
        noTables: '暂无表',
        noDatabases: '暂无数据库',

        // Query messages
        enterSQL: '请输入 SQL 语句',
        noDatabaseSelected: '请先选择数据库',
        queryExecuting: '正在执行查询...',
        queryCancelled: '查询已取消',
        queryHistory: '查询历史',
        bookmarks: '书签',
        saveBookmark: '保存书签',
        bookmarkName: '书签名称',
        clearHistory: '清除历史',

        // Misc
        confirmDelete: '确认删除？',
        confirmRollback: '确定要回滚事务吗？',
        confirmClose: '确认关闭？',
        saveSuccess: '保存成功',
        saveFailed: '保存失败',
        loadSuccess: '加载成功',
        loadFailed: '加载失败',
        exportSuccess: '导出成功',
        exportFailed: '导出失败',
        importSuccess: '导入成功',
        importFailed: '导入失败',
        copySuccess: '已复制到剪贴板',
        copyFailed: '复制失败',
        connectionRequired: '请先连接数据库',
        wailsRequired: '此功能需要 Wails 环境',
    },
    en: {
        // App
        appName: 'DBNexus',
        appSubtitle: 'Database Management Tool',
        
// Toolbar
	newConnection: 'New',
	newQuery: 'Query',
	executeQuery: 'Run',
	refresh: 'Refresh',
	settings: 'Settings',
	language: 'Language',
	disconnect: 'Disconnect',
	
	// Editor buttons
	formatSQL: 'Format SQL',
	runQuery: 'Run Query (F5)',
	explainQuery: 'Explain Query',
	saveQuery: 'Save Query',
	loadQuery: 'Load Query',
	
	// Data view buttons
	addRecord: 'Add Record',
	deleteSelected: 'Delete Selected',
	saveChanges: 'Save Changes',
	discardChanges: 'Discard Changes',
	refreshData: 'Refresh Data',
	firstPage: 'First Page',
	prevPage: 'Previous Page',
	nextPage: 'Next Page',
	lastPage: 'Last Page',
	applyFilter: 'Apply Filter',
	clearFilter: 'Clear Filter',
	toggleSort: 'Toggle Sort Order',
	
	// Window buttons
	minimize: 'Minimize',
	maximize: 'Maximize',
	close: 'Close',

	// Sidebar
	connections: 'Connections',
        databases: 'DATABASES',
        tables: 'Tables',
        views: 'Views',
        functions: 'Functions',
        
        // Connection Dialog
        newConnectionTitle: 'New Connection',
        connectionName: 'Connection Name',
        host: 'Host',
        port: 'Port',
        username: 'Username',
        password: 'Password',
        database: 'Database',
        databaseFile: 'Database File Path',
        databaseNumber: 'Database Number',
        colorLabel: 'Color Label',
        savePassword: 'Save password',
        autoConnect: 'Auto-connect on startup',
        testConnection: 'Test Connection',
        save: 'Save',
        cancel: 'Cancel',
        
        // Database Types
        postgresql: 'PostgreSQL',
        mysql: 'MySQL',
        polardb: 'PolarDB',
        gaussdb: 'GaussDB',
        sqlite: 'SQLite',
        redis: 'Redis',
        
        // Results
        gridView: 'Grid View',
        textView: 'Text View',
        history: 'History',
        rowsReturned: '{count} rows returned',
        executionTime: 'Execution time: {time}',
        
        // Settings
        settingsTitle: 'Settings',
        general: 'General',
        editor: 'Editor',
        appearance: 'Appearance',
        language: 'Language',
        theme: 'Theme',
        dark: 'Dark',
        light: 'Light',
        system: 'System',
        fontSize: 'Font Size',
        tabSize: 'Tab Size',
        wordWrap: 'Word Wrap',
        lineNumbers: 'Line Numbers',
        connectionTimeout: 'Connection timeout (seconds)',
        queryTimeout: 'Query timeout (seconds)',
        maxConnections: 'Max connections in pool',
        
        // Status Bar
        connected: 'Connected',
        notConnected: 'Not Connected',
        
        // Context Menu
        open: 'Open',
        newQueryMenu: 'New Query',
        refreshMenu: 'Refresh',
        duplicate: 'Duplicate',
        delete: 'Delete',
        
        // Messages
        connectionSuccessful: 'Connection successful!',
        connectionFailed: 'Connection failed',
        querySuccessful: 'Query successful',
        queryFailed: 'Query failed',
        saved: 'Saved',
        deleted: 'Deleted',
        
        // Time
        hours: 'hours',
        minutes: 'minutes',
        seconds: 'seconds',

        // Data View
        dataView: 'Data View',
        records: 'records',
        selected: 'selected',
        pageSize: 'Per page',
        filterColumn: 'Filter Column',
        filterValue: 'Filter Value',
        filterOperator: 'Operator',
        nullValue: 'NULL',
        noData: 'No data',
        loading: 'Loading...',
        largeResultWarning: 'Result set exceeds 10000 rows, showing first 10000 only',

        // Export/Import
        exportData: 'Export Data',
        importData: 'Import Data',
        exportFormat: 'Export Format',
        tableName: 'Table Name',
        filePath: 'File Path',
        browse: 'Browse',
        importFormat: 'Import Format',
        targetTable: 'Target Table',
        sqlPreview: 'SQL Preview',
        copySQL: 'Copy SQL',

        // Redis
        redisBrowser: 'Redis Browser',
        keyPattern: 'Key Pattern',
        scanKeys: 'Scan',
        keyList: 'Key List',
        keyDetail: 'Key Detail',
        keyValue: 'Value',
        setKey: 'Set Key',
        deleteKey: 'Delete Key',
        serverInfo: 'Server Info',
        dbSize: 'Key Count',

        // Compare
        dataCompare: 'Data Compare',
        compareMode: 'Compare Mode',
        tableCompare: 'Table Compare',
        queryCompare: 'Query Compare',
        table1: 'Table 1',
        table2: 'Table 2',
        excludeColumns: 'Exclude columns (comma-separated)',
        query1: 'Query 1',
        query2: 'Query 2',
        executeCompare: 'Execute Compare',
        matched: 'Matched',
        differences: 'Differences',
        leftOnly: 'Left Only',
        rightOnly: 'Right Only',

        // Transaction
        transaction: 'Transaction',
        beginTransaction: 'Begin Transaction',
        commitTransaction: 'Commit',
        rollbackTransaction: 'Rollback',
        txId: 'Transaction ID',
        noActiveTransaction: 'No active transaction',
        activeTransaction: 'Active transaction',
        executeInTx: 'Execute',
        txQuery: 'SQL statement',
        txResults: 'Results',
        rowsAffected: 'rows affected',

        // AI
        aiAssistant: 'AI Assistant',
        aiExplain: 'AI Explain',
        aiOptimize: 'AI Optimize',
        aiEnable: 'Enable AI',
        aiProvider: 'Provider',
        aiApiKey: 'API Key',
        aiBaseURL: 'Base URL',
        aiModel: 'Model',
        testAI: 'Test Connection',
        saveAIConfig: 'Save AI Config',
        aiExplainTitle: 'AI SQL Explanation',
        aiOptimizeTitle: 'AI Optimization Suggestions',

        // Schema
        structure: 'Structure',
        indexes: 'Indexes',
        foreignKeys: 'Foreign Keys',
        createIndex: 'Create Index',
        addForeignKey: 'Add Foreign Key',
        columnName: 'Column Name',
        dataType: 'Type',
        nullable: 'Nullable',
        defaultValue: 'Default',
        primaryKey: 'PK',

        // Empty states
        noConnections: 'No connections yet. Click "New Connection" to start.',
        noTables: 'No tables',
        noDatabases: 'No databases',

        // Query messages
        enterSQL: 'Please enter a SQL statement',
        noDatabaseSelected: 'Please select a database first',
        queryExecuting: 'Executing query...',
        queryCancelled: 'Query cancelled',
        queryHistory: 'Query History',
        bookmarks: 'Bookmarks',
        saveBookmark: 'Save Bookmark',
        bookmarkName: 'Bookmark name',
        clearHistory: 'Clear History',

        // Misc
        confirmDelete: 'Confirm delete?',
        confirmRollback: 'Are you sure you want to rollback?',
        confirmClose: 'Confirm close?',
        saveSuccess: 'Saved successfully',
        saveFailed: 'Save failed',
        loadSuccess: 'Loaded successfully',
        loadFailed: 'Load failed',
        exportSuccess: 'Export successful',
        exportFailed: 'Export failed',
        importSuccess: 'Import successful',
        importFailed: 'Import failed',
        copySuccess: 'Copied to clipboard',
        copyFailed: 'Copy failed',
        connectionRequired: 'Please connect to a database first',
        wailsRequired: 'This feature requires Wails environment',
    }
};

// i18n Manager
const i18n = {
    currentLang: 'zh',
    
    init() {
        // Load saved language preference
        const savedLang = localStorage.getItem('dbnexus-lang') || 'zh';
        this.setLanguage(savedLang);
    },
    
    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('dbnexus-lang', lang);
            document.documentElement.setAttribute('lang', lang);
            this.updateUI();
        }
    },
    
    t(key, params = {}) {
        let text = translations[this.currentLang][key] || key;
        
        // Replace placeholders like {count}, {time}
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        
        return text;
    },
    
    updateUI() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);
            
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        });
        
        // Update elements with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });
        
        // Update elements with data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });
        
        // Update page title
        document.title = this.t('appName') + ' - ' + this.t('appSubtitle');
        
        // Dispatch event for custom updates
        document.dispatchEvent(new CustomEvent('i18n:updated', { detail: { lang: this.currentLang } }));
    },
    
    getCurrentLanguage() {
        return this.currentLang;
    }
};

// Export for use in app.js
window.i18n = i18n;

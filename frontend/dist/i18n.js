/**
 * DB Client - Internationalization (i18n)
 * Supports: zh (Chinese), en (English)
 */

const translations = {
    zh: {
        // App
        appName: 'DB Client',
        appSubtitle: '数据库管理工具',
        
        // Toolbar
        newConnection: '新建连接',
        newQuery: '新建查询',
        executeQuery: '执行查询',
        refresh: '刷新',
        settings: '设置',
        
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
        database: '数据库',
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
    },
    en: {
        // App
        appName: 'DB Client',
        appSubtitle: 'Database Management Tool',
        
        // Toolbar
        newConnection: 'New',
        newQuery: 'Query',
        executeQuery: 'Run',
        refresh: 'Refresh',
        settings: 'Settings',
        
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
    }
};

// i18n Manager
const i18n = {
    currentLang: 'zh',
    
    init() {
        // Load saved language preference
        const savedLang = localStorage.getItem('db-client-lang') || 'zh';
        this.setLanguage(savedLang);
    },
    
    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('db-client-lang', lang);
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

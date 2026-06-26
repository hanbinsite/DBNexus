// DBNexus Global Type Declarations
// Declares global variables and functions used across all modules

declare global {
    // Global state
    const state: {
        currentTheme: 'dark' | 'light';
        connections: any[];
        tabs: any[];
        activeTab: string | null;
        activeConnection: any | null;
        sidebarWidth: number;
        editorHeight: number;
        isResizing: boolean;
        wailsReady: boolean;
        currentTable: { name: string; database: string; schema?: string } | null;
        selectedDatabase: string | null;
        columnWidths: Record<string, number>;
        queryHistory: any[];
        editingConnectionId: string | null;
    };

    // Wails API
    const WailsAPI: any | null;

    // Monaco editor
    let monacoEditor: any | null;

    // Core functions
    function isWailsAvailable(): boolean;
    function showNotification(type: 'success' | 'error' | 'warning' | 'info', message: string): void;
    function showLoading(message: string): void;
    function hideLoading(): void;
    function getEditorValue(): string;
    function setEditorValue(value: string): void;
    function formatSQL(): void;
    function formatSQLViaAPI(): void;
    function executeQuery(): void;
    function createNewTab(): void;
    function closeTab(tabId: string, event?: Event): void;
    function activateTab(tabId: string): void;
    function openSettings(): void;
    function closeSettings(): void;
    function openTable(tableName: string, dbName: string): void;
    function loadTableData(tableName: string, dbName: string): Promise<void>;
    function refreshDataView(): void;
    function loadSavedConnections(): Promise<void>;
    function addConnectionToList(conn: any): void;
    function selectConnection(id: string): void;
    function connectToConnection(id: string): Promise<void>;
    function updateConnectionStatusIcon(id: string, connected: boolean): void;
    function loadDatabaseTree(): Promise<void>;
    function setEditorTheme(theme: string): void;
    function updateEditorTheme(theme: string): void;
    function findInEditor(): void;
    function replaceInEditor(): void;
    function toggleComment(): void;
    function goToLine(): void;
    function saveQuery(): void;
    function loadQuery(): void;
    function openPerfPanel(): void;
    function openHistoryPanel(): void;
    function openGitPanel(): void;
    function openReportPanel(): void;
    function openNL2SQLDialog(): void;
    function aiExplainSQL(): void;
    function aiOptimizeSQL(): void;
    function closeConnectionDialog(): void;
    function closeLanguageDialog(): void;
    function openAIChatPanel(): void;
    function closeAIChatPanel(): void;

    // i18n
    const i18n: {
        currentLang: string;
        init(): void;
        t(key: string): string;
        setLang(lang: string): void;
        messages: Record<string, Record<string, string>>;
    };

    // DomUtils
    const DomUtils: {
        escapeHtml(str: string): string;
        createElement(tag: string, props?: Record<string, any>, children?: Node[]): HTMLElement;
        debounce(fn: Function, delay: number): Function;
    };

    // Event bus
    function PublishEvent(eventType: string, data: any): void;

    // Window object extensions
    interface Window {
        go?: any;
        require?: any;
        define?: any;
    }
}

export {};

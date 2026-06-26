// DBNexus Global Type Declarations
// Declares global variables and functions used across all modules

declare global {
    // Global state — typed as any to allow dynamic property access
    const state: any;

    // Wails API — typed as any to allow dynamic property access
    const WailsAPI: any;

    // Monaco editor
    let monacoEditor: any;

    // Core functions
    function isWailsAvailable(): boolean;
    function showNotification(type: string, message: string): void;
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
    function insertSQLToEditor(sql: string): void;

    // i18n
    const i18n: any;

    // DomUtils
    const DomUtils: any;

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

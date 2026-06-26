// DBNexus TypeScript Type Definitions
// Central type definitions for the entire application

// ============================================================
// Connection Types
// ============================================================

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'redis' | 'polardb' | 'gaussdb' | 'mongodb' | 'elasticsearch';

export interface Connection {
    id: string;
    name: string;
    type: DatabaseType;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl?: SSLOptions;
    ssh?: SSHTunnelOptions;
    color?: string;
    group?: string;
    autoConnect?: boolean;
}

export interface SSLOptions {
    enabled: boolean;
    caPath?: string;
    certPath?: string;
    keyPath?: string;
    skipVerify?: boolean;
    minVersion?: string;
}

export interface SSHTunnelOptions {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password?: string;
    keyPath?: string;
}

export interface NoSQLConnection {
    type: 'mongodb' | 'elasticsearch';
    host: string;
    port: number;
    database: string;
    username?: string;
    password?: string;
    ssl: boolean;
}

// ============================================================
// Query Types
// ============================================================

export interface QueryResult {
    columns: string[];
    rows: any[][];
    rowCount: number;
    duration: string;
    error: string;
    affectedRows?: number;
    lastInsertId?: number;
}

export interface MultiQueryResult {
    results: QueryResult[];
    totalCount: number;
    successCount: number;
    errorCount: number;
}

export interface QueryOptions {
    timeout?: number;
    limit?: number;
    offset?: number;
}

export interface QueryHistoryItem {
    id: string;
    query: string;
    database: string;
    timestamp: string;
    duration: string;
    rowCount: number;
    success: boolean;
    bookmarked: boolean;
}

// ============================================================
// Schema Types
// ============================================================

export interface TableInfo {
    name: string;
    type: 'table' | 'view' | 'materialized_view';
    schema?: string;
    rows?: number;
    size?: string;
    comment?: string;
}

export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string;
    primaryKey: boolean;
}

export interface IndexInfo {
    name: string;
    type: string;
    columns: string[];
    unique: boolean;
    cardinality: number;
}

export interface ForeignKeyInfo {
    name: string;
    columnName: string;
    refTable: string;
    refColumn: string;
    onDelete: string;
    onUpdate: string;
}

export interface DatabaseInfo {
    name: string;
    size?: string;
    tables?: number;
}

// ============================================================
// Data Editing Types
// ============================================================

export type EditOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface EditRequest {
    operation: EditOperation;
    table: string;
    database: string;
    data?: Record<string, any>;
    primaryKey?: Record<string, any>;
}

export interface EditResult {
    success: boolean;
    error: string;
    affectedRows: number;
}

// ============================================================
// Transaction Types
// ============================================================

export interface TransactionOptions {
    isolationLevel?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
    readOnly?: boolean;
}

// ============================================================
// AI Types
// ============================================================

export interface AIChatRequest {
    sessionId: string;
    message: string;
    config: Connection;
    database: string;
    context?: AIChatContext;
}

export interface AIChatContext {
    currentTable?: string;
    currentQuery?: string;
    recentQueries?: string[];
    tableStructure?: string;
}

export interface AIChatResponse {
    success: boolean;
    message: string;
    sql?: string;
    action?: string;
    suggestions?: string[];
    error?: string;
}

export interface IndexRecommendation {
    tableName: string;
    columnName: string;
    indexType: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    createSql: string;
    estimatedImpact?: string;
}

export interface IndexAnalysisResult {
    recommendations: IndexRecommendation[];
    existingIndexes: string[];
    summary: string;
}

// ============================================================
// Export/Import Types
// ============================================================

export type ExportFormat = 'csv' | 'json' | 'excel' | 'sql';

export interface ExportRequest {
    format: ExportFormat;
    fileName: string;
    query?: string;
    table?: string;
    database: string;
    limit?: number;
    offset?: number;
}

export interface ExportResult {
    success: boolean;
    fileName: string;
    rowsCount: number;
    message: string;
    error?: string;
    filePath?: string;
}

// ============================================================
// UI State Types
// ============================================================

export interface AppState {
    currentTheme: 'dark' | 'light';
    connections: Connection[];
    tabs: Tab[];
    activeTab: string | null;
    activeConnection: Connection | null;
    sidebarWidth: number;
    editorHeight: number;
    isResizing: boolean;
    wailsReady: boolean;
    currentTable: TableRef | null;
    selectedDatabase: string | null;
    columnWidths: Record<string, number>;
    queryHistory: QueryHistoryItem[];
    editingConnectionId: string | null;
}

export interface Tab {
    id: string;
    type: 'query' | 'table';
    label: string;
}

export interface TableRef {
    name: string;
    database: string;
    schema?: string;
}

// ============================================================
// Wails API Interface — see globals.d.ts for global declaration
// WailsAPI is typed as `any` in globals.d.ts to allow dynamic property access
// ============================================================

// ============================================================
// Event Types
// ============================================================

export interface Event {
    type: string;
    data: any;
    timestamp: string;
    source?: string;
}

// ============================================================
// Notification Types
// ============================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    type: NotificationType;
    message: string;
    timestamp: string;
}

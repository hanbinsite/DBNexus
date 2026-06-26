// DBNexus TypeScript Migration Example
// This module demonstrates how to migrate JS modules to TS

import { Connection, QueryResult, WailsAPI, NotificationType } from '../types/index';

// Global state typed
declare global {
    const state: {
        currentTheme: 'dark' | 'light';
        connections: Connection[];
        activeConnection: Connection | null;
        selectedDatabase: string | null;
        currentTable: { name: string; database: string } | null;
        activeTab: string | null;
        wailsReady: boolean;
    };

    const WailsAPI: WailsAPI | null;

    function isWailsAvailable(): boolean;
    function showNotification(type: NotificationType, message: string): void;
    function showLoading(message: string): void;
    function hideLoading(): void;
    function getEditorValue(): string;
    function setEditorValue(value: string): void;
}

// Typed error handler
export class AppError extends Error {
    code: string;
    detail?: string;

    constructor(code: string, message: string, detail?: string) {
        super(message);
        this.code = code;
        this.detail = detail;
        this.name = 'AppError';
    }
}

// Typed safe async wrapper
export async function safeAsync<T>(
    fn: () => Promise<T>,
    context: string
): Promise<T | null> {
    try {
        return await fn();
    } catch (error) {
        console.error(`[${context}] Error:`, error);
        if (typeof showNotification === 'function') {
            showNotification('error', `${context}: ${(error as Error).message}`);
        }
        return null;
    }
}

// Typed query executor
export async function executeQuery(
    connection: Connection,
    database: string,
    query: string
): Promise<QueryResult | null> {
    return safeAsync(async () => {
        if (!isWailsAvailable() || !WailsAPI) {
            throw new AppError('NET_001', 'Wails API not available');
        }
        return WailsAPI.executeQuery(connection, database, query);
    }, 'executeQuery');
}

// Typed connection manager
export class ConnectionManager {
    private connections: Connection[] = [];

    async load(): Promise<Connection[]> {
        if (!isWailsAvailable() || !WailsAPI) {
            return this.connections;
        }
        this.connections = await WailsAPI.getConnections();
        return this.connections;
    }

    async save(conn: Connection): Promise<void> {
        if (!isWailsAvailable() || !WailsAPI) return;
        await WailsAPI.saveConnection(conn);
        await this.load();
    }

    async delete(id: string): Promise<void> {
        if (!isWailsAvailable() || !WailsAPI) return;
        await WailsAPI.deleteConnection(id);
        await this.load();
    }

    find(id: string): Connection | undefined {
        return this.connections.find(c => c.id === id);
    }

    filter(searchText: string): Connection[] {
        const lower = searchText.toLowerCase();
        return this.connections.filter(c =>
            c.name.toLowerCase().includes(lower) ||
            c.host.toLowerCase().includes(lower) ||
            c.type.toLowerCase().includes(lower)
        );
    }
}

// Export for use in migration
export { ConnectionManager as default };

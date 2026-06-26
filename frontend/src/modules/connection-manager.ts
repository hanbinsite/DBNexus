// DBNexus TypeScript Migration Example
// This module demonstrates how to migrate JS modules to TS

import { Connection, QueryResult, NotificationType } from '../types/index';

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
        if (!isWailsAvailable()) {
            throw new AppError('NET_001', 'Wails API not available');
        }
        return WailsAPI.executeQuery(connection, database, query);
    }, 'executeQuery');
}

// Typed connection manager
export class ConnectionManager {
    private connections: Connection[] = [];

    async load(): Promise<Connection[]> {
        if (!isWailsAvailable()) {
            return this.connections;
        }
        this.connections = await WailsAPI.getConnections();
        return this.connections;
    }

    async save(conn: Connection): Promise<void> {
        if (!isWailsAvailable()) return;
        await WailsAPI.saveConnection(conn);
        await this.load();
    }

    async delete(id: string): Promise<void> {
        if (!isWailsAvailable()) return;
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

export { ConnectionManager as default };

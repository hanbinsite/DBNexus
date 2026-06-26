"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.ConnectionManager = exports.AppError = void 0;
exports.safeAsync = safeAsync;
exports.executeQuery = executeQuery;
class AppError extends Error {
    constructor(code, message, detail) {
        super(message);
        this.code = code;
        this.detail = detail;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
async function safeAsync(fn, context) {
    try {
        return await fn();
    }
    catch (error) {
        console.error(`[${context}] Error:`, error);
        if (typeof showNotification === 'function') {
            showNotification('error', `${context}: ${error.message}`);
        }
        return null;
    }
}
async function executeQuery(connection, database, query) {
    return safeAsync(async () => {
        if (!isWailsAvailable()) {
            throw new AppError('NET_001', 'Wails API not available');
        }
        return WailsAPI.executeQuery(connection, database, query);
    }, 'executeQuery');
}
class ConnectionManager {
    constructor() {
        this.connections = [];
    }
    async load() {
        if (!isWailsAvailable()) {
            return this.connections;
        }
        this.connections = await WailsAPI.getConnections();
        return this.connections;
    }
    async save(conn) {
        if (!isWailsAvailable())
            return;
        await WailsAPI.saveConnection(conn);
        await this.load();
    }
    async delete(id) {
        if (!isWailsAvailable())
            return;
        await WailsAPI.deleteConnection(id);
        await this.load();
    }
    find(id) {
        return this.connections.find(c => c.id === id);
    }
    filter(searchText) {
        const lower = searchText.toLowerCase();
        return this.connections.filter(c => c.name.toLowerCase().includes(lower) ||
            c.host.toLowerCase().includes(lower) ||
            c.type.toLowerCase().includes(lower));
    }
}
exports.ConnectionManager = ConnectionManager;
exports.default = ConnectionManager;

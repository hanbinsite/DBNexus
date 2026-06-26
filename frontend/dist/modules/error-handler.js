"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.ErrorCodes = void 0;
exports.handleError = handleError;
exports.safeAsync = safeAsync;
exports.safeSync = safeSync;
exports.ErrorCodes = {
    CONNECTION_FAILED: 'CONN_001',
    QUERY_TIMEOUT: 'QUERY_001',
    QUERY_FAILED: 'QUERY_002',
    AUTH_FAILED: 'AUTH_001',
    NOT_FOUND: 'NOT_FOUND',
    INVALID_INPUT: 'INVALID_INPUT',
    PERMISSION_DENIED: 'PERM_001',
    INTERNAL_ERROR: 'INTERNAL_001',
    NETWORK_ERROR: 'NET_001',
    AI_ERROR: 'AI_001',
};
const ErrorMessages = {
    zh: {
        CONN_001: '数据库连接失败', QUERY_001: '查询超时', QUERY_002: '查询执行失败',
        AUTH_001: '认证失败', NOT_FOUND: '资源不存在', INVALID_INPUT: '输入无效',
        PERM_001: '权限不足', INTERNAL_001: '内部错误', NET_001: '网络错误', AI_001: 'AI 服务错误',
    },
    en: {
        CONN_001: 'Database connection failed', QUERY_001: 'Query timeout', QUERY_002: 'Query execution failed',
        AUTH_001: 'Authentication failed', NOT_FOUND: 'Resource not found', INVALID_INPUT: 'Invalid input',
        PERM_001: 'Permission denied', INTERNAL_001: 'Internal error', NET_001: 'Network error', AI_001: 'AI service error',
    },
};
class AppError extends Error {
    constructor(code, message, detail) {
        super(message);
        this.code = code;
        this.detail = detail;
        this.name = 'AppError';
    }
    toString() {
        const lang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        const msgs = ErrorMessages[lang] || ErrorMessages.zh;
        const baseMsg = msgs[this.code] || this.message || 'Unknown error';
        return this.detail ? `${baseMsg}: ${this.detail}` : baseMsg;
    }
}
exports.AppError = AppError;
function handleError(error, context) {
    console.error(`[${context || 'unknown'}] Error:`, error);
    let appError;
    if (error instanceof AppError) {
        appError = error;
    }
    else if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('timeout') || msg.includes('deadline')) {
            appError = new AppError(exports.ErrorCodes.QUERY_TIMEOUT, error.message);
        }
        else if (msg.includes('connection') || msg.includes('connect')) {
            appError = new AppError(exports.ErrorCodes.CONNECTION_FAILED, error.message);
        }
        else if (msg.includes('permission') || msg.includes('denied')) {
            appError = new AppError(exports.ErrorCodes.PERMISSION_DENIED, error.message);
        }
        else if (msg.includes('not found') || msg.includes('no such')) {
            appError = new AppError(exports.ErrorCodes.NOT_FOUND, error.message);
        }
        else if (msg.includes('ai') || msg.includes('llm') || msg.includes('ollama')) {
            appError = new AppError(exports.ErrorCodes.AI_ERROR, error.message);
        }
        else {
            appError = new AppError(exports.ErrorCodes.INTERNAL_ERROR, error.message);
        }
    }
    else {
        appError = new AppError(exports.ErrorCodes.INTERNAL_ERROR, String(error));
    }
    if (typeof showNotification === 'function')
        showNotification('error', appError.toString());
    return appError;
}
function safeAsync(fn, context) {
    return async function (...args) {
        try {
            return await fn();
        }
        catch (error) {
            handleError(error, context);
            return null;
        }
    };
}
function safeSync(fn, context) {
    return function (...args) {
        try {
            return fn();
        }
        catch (error) {
            handleError(error, context);
            return null;
        }
    };
}
window.addEventListener('unhandledrejection', (event) => handleError(event.reason, 'unhandledrejection'));
window.addEventListener('error', (event) => handleError(event.error, 'global'));

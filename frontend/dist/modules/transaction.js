"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginTransaction = beginTransaction;
exports.executeInTransaction = executeInTransaction;
exports.commitTransaction = commitTransaction;
exports.rollbackTransaction = rollbackTransaction;
exports.createSavepoint = createSavepoint;
exports.rollbackToSavepoint = rollbackToSavepoint;
exports.getCurrentTransactionId = getCurrentTransactionId;
exports.hasActiveTransaction = hasActiveTransaction;
exports.getActiveTransactions = getActiveTransactions;
let currentTransactionId = null;
async function beginTransaction(options) {
    if (!state.activeConnection) {
        showNotification('warning', '请先选择连接');
        return;
    }
    try {
        if (isWailsAvailable()) {
            const txId = await WailsAPI.beginTransaction(state.activeConnection, state.selectedDatabase || '', options || {});
            currentTransactionId = txId;
            showNotification('success', `事务已开始: ${txId}`);
            updateTransactionStatus();
        }
    }
    catch (e) {
        showNotification('error', '开始事务失败: ' + (e.message || e));
    }
}
async function executeInTransaction(query) {
    if (!currentTransactionId) {
        showNotification('warning', '没有活跃事务');
        return null;
    }
    try {
        if (isWailsAvailable()) {
            const result = await WailsAPI.executeInTransaction(currentTransactionId, query);
            return result;
        }
    }
    catch (e) {
        showNotification('error', '事务执行失败: ' + (e.message || e));
    }
    return null;
}
async function commitTransaction() {
    if (!currentTransactionId) {
        showNotification('warning', '没有活跃事务');
        return;
    }
    try {
        if (isWailsAvailable()) {
            await WailsAPI.commitTransaction(currentTransactionId);
            showNotification('success', '事务已提交');
            currentTransactionId = null;
            updateTransactionStatus();
        }
    }
    catch (e) {
        showNotification('error', '提交事务失败: ' + (e.message || e));
    }
}
async function rollbackTransaction() {
    if (!currentTransactionId) {
        showNotification('warning', '没有活跃事务');
        return;
    }
    try {
        if (isWailsAvailable()) {
            await WailsAPI.rollbackTransaction(currentTransactionId);
            showNotification('info', '事务已回滚');
            currentTransactionId = null;
            updateTransactionStatus();
        }
    }
    catch (e) {
        showNotification('error', '回滚事务失败: ' + (e.message || e));
    }
}
async function createSavepoint(name) {
    if (!currentTransactionId) {
        showNotification('warning', '没有活跃事务');
        return;
    }
    try {
        if (isWailsAvailable() && WailsAPI.createSavepoint) {
            await WailsAPI.createSavepoint(currentTransactionId, name);
            showNotification('success', `保存点已创建: ${name}`);
        }
    }
    catch (e) {
        showNotification('error', '创建保存点失败: ' + (e.message || e));
    }
}
async function rollbackToSavepoint(name) {
    if (!currentTransactionId) {
        showNotification('warning', '没有活跃事务');
        return;
    }
    try {
        if (isWailsAvailable() && WailsAPI.rollbackToSavepoint) {
            await WailsAPI.rollbackToSavepoint(currentTransactionId, name);
            showNotification('info', `已回滚到保存点: ${name}`);
        }
    }
    catch (e) {
        showNotification('error', '回滚到保存点失败: ' + (e.message || e));
    }
}
function getCurrentTransactionId() {
    return currentTransactionId;
}
function hasActiveTransaction() {
    return currentTransactionId !== null;
}
function updateTransactionStatus() {
    const statusEl = document.getElementById('transactionStatus');
    if (!statusEl)
        return;
    if (currentTransactionId) {
        statusEl.style.display = 'flex';
        statusEl.classList.add('active');
    }
    else {
        statusEl.style.display = 'none';
        statusEl.classList.remove('active');
    }
}
async function getActiveTransactions() {
    try {
        if (isWailsAvailable() && WailsAPI.getActiveTransactions) {
            return await WailsAPI.getActiveTransactions();
        }
    }
    catch { }
    return [];
}

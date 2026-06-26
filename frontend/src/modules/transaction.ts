// DBNexus — Transaction Management Module (TypeScript)

let currentTransactionId: string | null = null;

export async function beginTransaction(options?: { isolationLevel?: string; readOnly?: boolean }): Promise<void> {
    if (!state.activeConnection) { showNotification('warning', '请先选择连接'); return; }
    try {
        if (isWailsAvailable()) {
            const txId = await WailsAPI.beginTransaction(state.activeConnection, state.selectedDatabase || '', options || {});
            currentTransactionId = txId;
            showNotification('success', `事务已开始: ${txId}`);
            updateTransactionStatus();
        }
    } catch (e: any) { showNotification('error', '开始事务失败: ' + (e.message || e)); }
}

export async function executeInTransaction(query: string): Promise<any> {
    if (!currentTransactionId) { showNotification('warning', '没有活跃事务'); return null; }
    try {
        if (isWailsAvailable()) {
            const result = await WailsAPI.executeInTransaction(currentTransactionId, query);
            return result;
        }
    } catch (e: any) { showNotification('error', '事务执行失败: ' + (e.message || e)); }
    return null;
}

export async function commitTransaction(): Promise<void> {
    if (!currentTransactionId) { showNotification('warning', '没有活跃事务'); return; }
    try {
        if (isWailsAvailable()) {
            await WailsAPI.commitTransaction(currentTransactionId);
            showNotification('success', '事务已提交');
            currentTransactionId = null;
            updateTransactionStatus();
        }
    } catch (e: any) { showNotification('error', '提交事务失败: ' + (e.message || e)); }
}

export async function rollbackTransaction(): Promise<void> {
    if (!currentTransactionId) { showNotification('warning', '没有活跃事务'); return; }
    try {
        if (isWailsAvailable()) {
            await WailsAPI.rollbackTransaction(currentTransactionId);
            showNotification('info', '事务已回滚');
            currentTransactionId = null;
            updateTransactionStatus();
        }
    } catch (e: any) { showNotification('error', '回滚事务失败: ' + (e.message || e)); }
}

export async function createSavepoint(name: string): Promise<void> {
    if (!currentTransactionId) { showNotification('warning', '没有活跃事务'); return; }
    try {
        if (isWailsAvailable() && WailsAPI.createSavepoint) {
            await WailsAPI.createSavepoint(currentTransactionId, name);
            showNotification('success', `保存点已创建: ${name}`);
        }
    } catch (e: any) { showNotification('error', '创建保存点失败: ' + (e.message || e)); }
}

export async function rollbackToSavepoint(name: string): Promise<void> {
    if (!currentTransactionId) { showNotification('warning', '没有活跃事务'); return; }
    try {
        if (isWailsAvailable() && WailsAPI.rollbackToSavepoint) {
            await WailsAPI.rollbackToSavepoint(currentTransactionId, name);
            showNotification('info', `已回滚到保存点: ${name}`);
        }
    } catch (e: any) { showNotification('error', '回滚到保存点失败: ' + (e.message || e)); }
}

export function getCurrentTransactionId(): string | null {
    return currentTransactionId;
}

export function hasActiveTransaction(): boolean {
    return currentTransactionId !== null;
}

function updateTransactionStatus(): void {
    const statusEl = document.getElementById('transactionStatus');
    if (!statusEl) return;
    if (currentTransactionId) {
        statusEl.style.display = 'flex';
        statusEl.classList.add('active');
    } else {
        statusEl.style.display = 'none';
        statusEl.classList.remove('active');
    }
}

export async function getActiveTransactions(): Promise<any[]> {
    try {
        if (isWailsAvailable() && WailsAPI.getActiveTransactions) {
            return await WailsAPI.getActiveTransactions();
        }
    } catch { }
    return [];
}

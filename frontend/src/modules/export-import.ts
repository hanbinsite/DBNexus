// DBNexus — Export/Import Module (TypeScript)

export async function exportTableData(format: string, tableName: string, database: string): Promise<void> {
    if (!state.activeConnection) { showNotification('warning', '请先选择连接'); return; }
    showLoading('正在导出数据...');
    try {
        if (isWailsAvailable()) {
            const req = { format, table: tableName, database, fileName: `${tableName}_${Date.now()}.${format}` };
            const result = await WailsAPI.exportData(state.activeConnection, req);
            if (result && result.success) {
                showNotification('success', `导出成功: ${result.rowsCount} 行`);
            } else {
                showNotification('error', '导出失败: ' + (result?.error || '未知错误'));
            }
        }
    } catch (e: any) { showNotification('error', '导出失败: ' + (e.message || e)); }
    finally { hideLoading(); }
}

export async function importTableData(format: string, tableName: string, database: string, filePath: string): Promise<void> {
    if (!state.activeConnection) { showNotification('warning', '请先选择连接'); return; }
    showLoading('正在导入数据...');
    try {
        if (isWailsAvailable()) {
            const req = { format, table: tableName, database, filePath };
            const result = await WailsAPI.importData(state.activeConnection, req);
            if (result && result.success) {
                showNotification('success', `导入成功: ${result.rowsCount} 行`);
                if (state.currentTable) await loadTableData(state.currentTable.name, state.currentTable.database);
            } else {
                showNotification('error', '导入失败: ' + (result?.error || '未知错误'));
            }
        }
    } catch (e: any) { showNotification('error', '导入失败: ' + (e.message || e)); }
    finally { hideLoading(); }
}

export async function browseFile(): Promise<string | null> {
    if (!isWailsAvailable()) return null;
    try {
        const path = await WailsAPI.openFileDialog();
        return path || null;
    } catch { return null; }
}

export async function browseSaveFile(): Promise<string | null> {
    if (!isWailsAvailable()) return null;
    try {
        const path = await WailsAPI.saveFileDialog();
        return path || null;
    } catch { return null; }
}

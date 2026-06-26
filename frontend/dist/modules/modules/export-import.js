"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportTableData = exportTableData;
exports.importTableData = importTableData;
exports.browseFile = browseFile;
exports.browseSaveFile = browseSaveFile;
async function exportTableData(format, tableName, database) {
    if (!state.activeConnection) {
        showNotification('warning', '请先选择连接');
        return;
    }
    showLoading('正在导出数据...');
    try {
        if (isWailsAvailable()) {
            const req = { format, table: tableName, database, fileName: `${tableName}_${Date.now()}.${format}` };
            const result = await WailsAPI.exportData(state.activeConnection, req);
            if (result && result.success) {
                showNotification('success', `导出成功: ${result.rowsCount} 行`);
            }
            else {
                showNotification('error', '导出失败: ' + (result?.error || '未知错误'));
            }
        }
    }
    catch (e) {
        showNotification('error', '导出失败: ' + (e.message || e));
    }
    finally {
        hideLoading();
    }
}
async function importTableData(format, tableName, database, filePath) {
    if (!state.activeConnection) {
        showNotification('warning', '请先选择连接');
        return;
    }
    showLoading('正在导入数据...');
    try {
        if (isWailsAvailable()) {
            const req = { format, table: tableName, database, filePath };
            const result = await WailsAPI.importData(state.activeConnection, req);
            if (result && result.success) {
                showNotification('success', `导入成功: ${result.rowsCount} 行`);
                if (state.currentTable)
                    await loadTableData(state.currentTable.name, state.currentTable.database);
            }
            else {
                showNotification('error', '导入失败: ' + (result?.error || '未知错误'));
            }
        }
    }
    catch (e) {
        showNotification('error', '导入失败: ' + (e.message || e));
    }
    finally {
        hideLoading();
    }
}
async function browseFile() {
    if (!isWailsAvailable())
        return null;
    try {
        const path = await WailsAPI.openFileDialog();
        return path || null;
    }
    catch {
        return null;
    }
}
async function browseSaveFile() {
    if (!isWailsAvailable())
        return null;
    try {
        const path = await WailsAPI.saveFileDialog();
        return path || null;
    }
    catch {
        return null;
    }
}

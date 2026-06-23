// ==========================================================================
// Export/Import/SQL Preview Modules
// ==========================================================================

// ── Export Dialog ──────────────────────────────────────────────────────────
function openExportModal() {
    if (state.currentTable) {
        document.getElementById('exportTableName').value = state.currentTable.name;
    }
    document.getElementById('exportPath').value = '';
    document.getElementById('exportModal').classList.add('active');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('active');
}

async function browseExportPath() {
    try {
        if (isWailsAvailable()) {
            const path = await WailsAPI.saveFileDialog('选择导出路径', `export_${new Date().toISOString().slice(0, 10)}`);
            if (path) document.getElementById('exportPath').value = path;
        }
    } catch (e) {
        showNotification('error', e.message);
    }
}

async function executeExport() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    const format = document.getElementById('exportFormat').value;
    const tableName = document.getElementById('exportTableName').value;
    const path = document.getElementById('exportPath').value;
    if (!tableName) { showNotification('warning', '请指定表名'); return; }
    if (!path) { showNotification('warning', '请选择导出路径'); return; }

    showLoading('导出数据中...');
    try {
        const req = {
            format: format,
            table: tableName,
            database: state.currentTable?.database || state.selectedDatabase || '',
            file_path: path
        };
        const result = await WailsAPI.exportData(state.activeConnection, req);
        hideLoading();
        closeExportModal();
        showNotification('success', `导出成功: ${result.file_path || path}`);
    } catch (e) {
        hideLoading();
        showNotification('error', `导出失败: ${e.message || e}`);
    }
}

// ── Import Dialog ──────────────────────────────────────────────────────────
function openImportModal() {
    if (state.currentTable) {
        document.getElementById('importTableName').value = state.currentTable.name;
    }
    document.getElementById('importPath').value = '';
    document.getElementById('importModal').classList.add('active');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
}

async function browseImportPath() {
    try {
        if (isWailsAvailable()) {
            const path = await WailsAPI.openFileDialog('选择导入文件', [
                { display: 'CSV', pattern: '*.csv' },
                { display: 'JSON', pattern: '*.json' }
            ]);
            if (path) document.getElementById('importPath').value = path;
        }
    } catch (e) {
        showNotification('error', e.message);
    }
}

async function executeImport() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    const format = document.getElementById('importFormat').value;
    const tableName = document.getElementById('importTableName').value;
    const path = document.getElementById('importPath').value;
    if (!tableName) { showNotification('warning', '请指定目标表'); return; }
    if (!path) { showNotification('warning', '请选择导入文件'); return; }

    showLoading('导入数据中...');
    try {
        const req = {
            format: format,
            table: tableName,
            database: state.currentTable?.database || state.selectedDatabase || '',
            file_path: path,
            truncate_first: false
        };
        const result = await WailsAPI.importData(state.activeConnection, req);
        hideLoading();
        closeImportModal();
        showNotification('success', `导入成功: ${result.rows_imported || 0} 行`);
        if (typeof refreshDataView === 'function') refreshDataView();
    } catch (e) {
        hideLoading();
        showNotification('error', `导入失败: ${e.message || e}`);
    }
}

// ── SQL Preview Dialog ─────────────────────────────────────────────────────
function openSqlPreview() {
    if (!state.currentTable) { showNotification('warning', '请先打开一个表'); return; }
    const tableName = state.currentTable.name;
    WailsAPI.generateInsertStatement(tableName, {})
        .then(sql => {
            document.getElementById('sqlPreviewContent').textContent = sql || '-- 无数据';
            document.getElementById('sqlPreviewModal').classList.add('active');
        })
        .catch(e => {
            document.getElementById('sqlPreviewContent').textContent = `-- 生成失败: ${e.message}`;
            document.getElementById('sqlPreviewModal').classList.add('active');
        });
}

function closeSqlPreviewModal() {
    document.getElementById('sqlPreviewModal').classList.remove('active');
}

function copySqlPreview() {
    const content = document.getElementById('sqlPreviewContent').textContent;
    navigator.clipboard.writeText(content).then(() => {
        showNotification('success', 'SQL 已复制到剪贴板');
    }).catch(() => {
        showNotification('error', '复制失败');
    });
}
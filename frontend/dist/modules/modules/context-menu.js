"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initContextMenu = initContextMenu;
exports.bindConnectionContextMenu = bindConnectionContextMenu;
exports.showConnectionContextMenu = showConnectionContextMenu;
exports.showDatabaseContextMenu = showDatabaseContextMenu;
exports.showTableContextMenu = showTableContextMenu;
exports.contextAction = contextAction;
let contextMenuTarget = null;
let contextMenuData = null;
function initContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu)
        return;
    document.addEventListener('click', () => contextMenu.classList.remove('active'));
    bindConnectionContextMenu();
}
function bindConnectionContextMenu() {
    document.querySelectorAll('.connection-item').forEach(item => {
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = item.dataset.id || '';
            const connection = state.connections.find(c => c.id === id);
            if (connection) {
                selectConnection(id);
                contextMenuTarget = 'connection';
                contextMenuData = { connection };
                showConnectionContextMenu(e.clientX, e.clientY, connection);
            }
        });
    });
}
function showConnectionContextMenu(x, y, connection) {
    const contextMenu = document.getElementById('contextMenu');
    const connEl = document.querySelector(`.connection-item[data-id="${connection.id}"]`);
    const isConnected = connEl?.dataset.connected === 'true';
    let html = '';
    if (isConnected) {
        html += `<div class="context-menu-item" onclick="contextAction('disconnect')"><span>断开连接</span></div>
                 <div class="context-menu-item" onclick="contextAction('new_query')"><span>新查询</span></div>
                 <div class="context-menu-divider"></div>
                 <div class="context-menu-item" onclick="contextAction('refresh')"><span>刷新</span></div>`;
    }
    else {
        html += `<div class="context-menu-item" onclick="contextAction('connect')"><span>连接</span></div>`;
    }
    html += `<div class="context-menu-divider"></div>
             <div class="context-menu-item" onclick="contextAction('edit')"><span>编辑连接</span></div>
             <div class="context-menu-item" onclick="contextAction('duplicate')"><span>复制连接</span></div>
             <div class="context-menu-item danger" onclick="contextAction('delete')"><span>删除</span></div>`;
    contextMenu.innerHTML = html;
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('active');
}
function showDatabaseContextMenu(x, y, dbName) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenuTarget = 'database';
    contextMenuData = { dbName };
    contextMenu.innerHTML = `
        <div class="context-menu-item" onclick="contextAction('new_query')"><span>新查询</span></div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="contextAction('create_table')"><span>创建表</span></div>`;
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('active');
}
function showTableContextMenu(x, y, tableName, dbName) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenuTarget = 'table';
    contextMenuData = { tableName, dbName };
    contextMenu.innerHTML = `
        <div class="context-menu-item" onclick="contextAction('open_table')"><span>打开表</span></div>
        <div class="context-menu-item" onclick="contextAction('view_data')"><span>查看数据</span></div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="contextAction('view_structure')"><span>表结构</span></div>
        <div class="context-menu-item" onclick="contextAction('refresh_table')"><span>刷新</span></div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="contextAction('create_table')"><span>创建表</span></div>
        <div class="context-menu-item danger" onclick="contextAction('drop_table')"><span>删除表</span></div>`;
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('active');
}
async function contextAction(action) {
    document.getElementById('contextMenu')?.classList.remove('active');
    switch (action) {
        case 'connect':
            if (contextMenuData?.connection)
                await connectToConnection(contextMenuData.connection.id);
            break;
        case 'disconnect':
            if (state.activeConnection) {
                try {
                    if (isWailsAvailable()) {
                        await WailsAPI.disconnectFromDatabase(state.activeConnection);
                        updateConnectionStatusIcon(state.activeConnection.id, false);
                    }
                    showNotification('success', '已断开连接');
                }
                catch (e) {
                    showNotification('error', '断开连接失败: ' + (e.message || e));
                }
            }
            break;
        case 'new_query':
            createNewTab();
            break;
        case 'edit':
            if (contextMenuData?.connection) {
                const conn = contextMenuData.connection;
                const modal = document.getElementById('connectionModal');
                modal.classList.add('active');
                document.getElementById('connName').value = conn.name || '';
                document.getElementById('connName').dataset.id = conn.id || '';
                document.getElementById('connHost').value = conn.host || 'localhost';
                document.getElementById('connPort').value = conn.port || 5432;
                document.getElementById('connUser').value = conn.username || '';
                document.getElementById('connPassword').value = conn.password || '';
                document.getElementById('connDatabase').value = conn.database || '';
            }
            break;
        case 'delete':
            if (contextMenuData?.connection) {
                if (confirm(`确定要删除连接 ${contextMenuData.connection.name} 吗？`)) {
                    try {
                        if (isWailsAvailable())
                            await WailsAPI.deleteConnection(contextMenuData.connection.id);
                        await loadSavedConnections();
                        showNotification('success', '连接已删除');
                    }
                    catch (e) {
                        showNotification('error', '删除失败: ' + (e.message || e));
                    }
                }
            }
            break;
        case 'refresh':
            if (state.activeConnection)
                await loadDatabaseTree();
            break;
        case 'open_table':
        case 'view_data':
            if (contextMenuData?.tableName)
                openTable(contextMenuData.tableName, contextMenuData.dbName);
            break;
        case 'refresh_table':
            if (state.currentTable)
                await loadTableData(state.currentTable.name, state.currentTable.database);
            break;
        case 'create_table':
            createNewTab();
            setEditorValue('CREATE TABLE new_table (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);');
            showNotification('info', '已生成 CREATE TABLE 模板，请修改后执行');
            break;
        case 'drop_table':
            if (contextMenuData?.tableName) {
                if (confirm(`确定要删除表 ${contextMenuData.tableName} 吗？此操作不可撤销！`)) {
                    createNewTab();
                    setEditorValue(`DROP TABLE IF EXISTS ${contextMenuData.tableName};`);
                    showNotification('warning', '请确认后执行 DROP TABLE');
                }
            }
            break;
    }
}

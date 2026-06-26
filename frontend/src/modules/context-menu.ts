// DBNexus — Context Menu Module (TypeScript)

let contextMenuTarget: string | null = null;
let contextMenuData: any = null;

export function initContextMenu(): void {
    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;
    document.addEventListener('click', () => contextMenu.classList.remove('active'));
    bindConnectionContextMenu();
}

export function bindConnectionContextMenu(): void {
    document.querySelectorAll('.connection-item').forEach(item => {
        item.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const id = (item as HTMLElement).dataset.id || '';
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

export function showConnectionContextMenu(x: number, y: number, connection: any): void {
    const contextMenu = document.getElementById('contextMenu')!;
    const connEl = document.querySelector(`.connection-item[data-id="${connection.id}"]`) as HTMLElement | null;
    const isConnected = connEl?.dataset.connected === 'true';
    let html = '';
    if (isConnected) {
        html += `<div class="context-menu-item" onclick="contextAction('disconnect')"><span>断开连接</span></div>
                 <div class="context-menu-item" onclick="contextAction('new_query')"><span>新查询</span></div>
                 <div class="context-menu-divider"></div>
                 <div class="context-menu-item" onclick="contextAction('refresh')"><span>刷新</span></div>`;
    } else {
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

export function showDatabaseContextMenu(x: number, y: number, dbName: string): void {
    const contextMenu = document.getElementById('contextMenu')!;
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

export function showTableContextMenu(x: number, y: number, tableName: string, dbName: string): void {
    const contextMenu = document.getElementById('contextMenu')!;
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

export async function contextAction(action: string): Promise<void> {
    document.getElementById('contextMenu')?.classList.remove('active');
    switch (action) {
        case 'connect':
            if (contextMenuData?.connection) await connectToConnection(contextMenuData.connection.id);
            break;
        case 'disconnect':
            if (state.activeConnection) {
                try {
                    if (isWailsAvailable()) {
                        await WailsAPI.disconnectFromDatabase(state.activeConnection);
                        updateConnectionStatusIcon(state.activeConnection.id, false);
                    }
                    showNotification('success', '已断开连接');
                } catch (e: any) { showNotification('error', '断开连接失败: ' + (e.message || e)); }
            }
            break;
        case 'new_query': createNewTab(); break;
        case 'edit':
            if (contextMenuData?.connection) {
                const conn = contextMenuData.connection;
                const modal = document.getElementById('connectionModal')!;
                modal.classList.add('active');
                (document.getElementById('connName') as HTMLInputElement).value = conn.name || '';
                (document.getElementById('connName') as HTMLInputElement).dataset.id = conn.id || '';
                (document.getElementById('connHost') as HTMLInputElement).value = conn.host || 'localhost';
                (document.getElementById('connPort') as HTMLInputElement).value = conn.port || 5432;
                (document.getElementById('connUser') as HTMLInputElement).value = conn.username || '';
                (document.getElementById('connPassword') as HTMLInputElement).value = conn.password || '';
                (document.getElementById('connDatabase') as HTMLInputElement).value = conn.database || '';
            }
            break;
        case 'delete':
            if (contextMenuData?.connection) {
                if (confirm(`确定要删除连接 ${contextMenuData.connection.name} 吗？`)) {
                    try {
                        if (isWailsAvailable()) await WailsAPI.deleteConnection(contextMenuData.connection.id);
                        await loadSavedConnections();
                        showNotification('success', '连接已删除');
                    } catch (e: any) { showNotification('error', '删除失败: ' + (e.message || e)); }
                }
            }
            break;
        case 'refresh': if (state.activeConnection) await loadDatabaseTree(); break;
        case 'open_table':
        case 'view_data':
            if (contextMenuData?.tableName) openTable(contextMenuData.tableName, contextMenuData.dbName);
            break;
        case 'refresh_table':
            if (state.currentTable) await loadTableData(state.currentTable.name, state.currentTable.database);
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

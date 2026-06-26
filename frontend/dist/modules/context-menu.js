/**
 * Context Menu Module
 * Handles right-click context menus for connections, databases, and tables
 */

let contextMenuTarget = null;
let contextMenuData = null;

function initContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  document.addEventListener('click', () => {
    contextMenu.classList.remove('active');
  });
  bindConnectionContextMenu();
}

function bindConnectionContextMenu() {
  document.querySelectorAll('.connection-item').forEach(item => {
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = item.dataset.id;
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
  const isConnected = document.querySelector(`.connection-item[data-id="${connection.id}"]`)?.dataset.connected === 'true';
  
  let html = '';
  
  if (isConnected) {
    html += `
      <div class="context-menu-item" onclick="contextAction('disconnect')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>断开连接</span>
      </div>
      <div class="context-menu-item" onclick="contextAction('new_query')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>
        <span>新查询</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" onclick="contextAction('refresh')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <span>刷新</span>
      </div>
    `;
  } else {
    html += `
      <div class="context-menu-item" onclick="contextAction('connect')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        <span>连接</span>
      </div>
    `;
  }
  
  html += `
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="contextAction('edit')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      <span>编辑连接</span>
    </div>
    <div class="context-menu-item" onclick="contextAction('duplicate')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span>复制连接</span>
    </div>
    <div class="context-menu-item danger" onclick="contextAction('delete')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      <span>删除</span>
    </div>
  `;

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
    <div class="context-menu-item" onclick="contextAction('new_query')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>
      <span>新查询</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="contextAction('create_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      <span>创建表</span>
    </div>
  `;
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');
}

function showTableContextMenu(x, y, tableName, dbName) {
  const contextMenu = document.getElementById('contextMenu');
  contextMenuTarget = 'table';
  contextMenuData = { tableName, dbName };
  
  contextMenu.innerHTML = `
    <div class="context-menu-item" onclick="contextAction('open_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
      <span>打开表</span>
    </div>
    <div class="context-menu-item" onclick="contextAction('view_data')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      <span>查看数据</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="contextAction('view_structure')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18"/></svg>
      <span>表结构</span>
    </div>
    <div class="context-menu-item" onclick="contextAction('refresh_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      <span>刷新</span>
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="contextAction('create_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      <span>创建表</span>
    </div>
    <div class="context-menu-item danger" onclick="contextAction('drop_table')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      <span>删除表</span>
    </div>
  `;
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');
}

function showContextMenu(x, y) {
  const contextMenu = document.getElementById('contextMenu');
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('active');
}

async function contextAction(action) {
  document.getElementById('contextMenu').classList.remove('active');
  
  switch (action) {
    case 'connect':
      if (contextMenuData && contextMenuData.connection) {
        await connectToConnection(contextMenuData.connection.id);
      }
      break;
    case 'disconnect':
      await disconnectConnection();
      break;
    case 'new_query':
      createNewTab();
      break;
    case 'edit':
      if (contextMenuData && contextMenuData.connection) {
        editConnection(contextMenuData.connection);
      }
      break;
    case 'duplicate':
      if (contextMenuData && contextMenuData.connection) {
        await duplicateConnection(contextMenuData.connection);
      }
      break;
    case 'delete':
      if (contextMenuData && contextMenuData.connection) {
        await deleteConnection(contextMenuData.connection.id);
      }
      break;
    case 'refresh':
      if (state.activeConnection) {
        await loadDatabaseTree();
      }
      break;
    case 'open_table':
    case 'view_data':
      if (contextMenuData && contextMenuData.tableName) {
        openTable(contextMenuData.tableName, contextMenuData.dbName);
      }
      break;
    case 'view_structure':
      if (state.currentTable) {
        document.querySelector('.data-view-tab[data-view="structure"]')?.click();
      }
      break;
    case 'refresh_table':
      if (state.currentTable) {
        await loadTableData(state.currentTable.name, state.currentTable.database);
      }
      break;
    case 'create_table':
      createNewTab();
      setEditorValue('CREATE TABLE new_table (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);');
      showNotification('info', '已生成 CREATE TABLE 模板，请修改后执行');
      break;
    case 'drop_table':
      if (contextMenuData && contextMenuData.tableName) {
        if (confirm(`确定要删除表 ${contextMenuData.tableName} 吗？此操作不可撤销！`)) {
          createNewTab();
          setEditorValue(`DROP TABLE IF EXISTS ${contextMenuData.tableName};`);
          showNotification('warning', '请确认后执行 DROP TABLE');
        }
      }
      break;
  }
}

async function disconnectConnection() {
  if (!state.activeConnection) return;
  try {
    if (isWailsAvailable()) {
      await WailsAPI.disconnectFromDatabase(state.activeConnection);
      updateConnectionStatusIcon(state.activeConnection.id, false);
    }
    showNotification('success', '已断开连接');
  } catch (e) {
    showNotification('error', '断开连接失败: ' + (e.message || e));
  }
}

function editConnection(connection) {
  const modal = document.getElementById('connectionModal');
  modal.classList.add('active');
  document.getElementById('connName').value = connection.name || '';
  document.getElementById('connName').dataset.id = connection.id || '';
  document.getElementById('connHost').value = connection.host || 'localhost';
  document.getElementById('connPort').value = connection.port || 5432;
  document.getElementById('connUser').value = connection.username || '';
  document.getElementById('connPassword').value = connection.password || '';
  document.getElementById('connDatabase').value = connection.database || '';
  
  const dbTypeBtn = document.querySelector(`.db-type-btn[data-type="${connection.type}"]`);
  if (dbTypeBtn) {
    document.querySelectorAll('.db-type-btn').forEach(b => b.classList.remove('active'));
    dbTypeBtn.classList.add('active');
    updateConnectionForm(connection.type);
  }
}

async function duplicateConnection(connection) {
  const newConn = { ...connection, name: connection.name + '_copy', id: '' };
  if (isWailsAvailable()) {
    await WailsAPI.saveConnection(newConn);
    await loadSavedConnections();
  } else {
    newConn.id = Date.now().toString();
    state.connections.push(newConn);
    addConnectionToList(newConn);
  }
  showNotification('success', '连接已复制');
}

function generateSelectStatement(tableName, dbName) {
  return `SELECT * FROM ${tableName} LIMIT 100;`;
}

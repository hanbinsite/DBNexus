/**
 * Multi-Window Management Module
 * Provides independent window instances with per-window connection state
 */

let currentWindowId = null;

function initMultiWindow() {
    loadCurrentWindow();
    addWindowManagerButton();
    window.addEventListener('focus', () => {
        if (currentWindowId) activateWindow(currentWindowId);
    });
    window.addEventListener('resize', onWindowGeometryChange);
}

async function loadCurrentWindow() {
    try {
        if (isWailsAvailable() && WailsAPI && WailsAPI.getActiveWindowInfo) {
            const info = await WailsAPI.getActiveWindowInfo();
            if (info) currentWindowId = info.id;
        }
    } catch (e) { /* ignore */ }
}

function addWindowManagerButton() {
    const toolbar = document.querySelector('.toolbar-actions') || document.querySelector('.app-header');
    if (!toolbar) return;
    if (document.getElementById('windowManagerBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'windowManagerBtn';
    btn.className = 'toolbar-btn';
    btn.title = '窗口管理';
    btn.style.cssText = 'background:var(--bg-tertiary);border:1px solid var(--border-primary);border-radius:var(--radius-md);padding:6px 10px;cursor:pointer;color:var(--fg-secondary);font-size:12px;display:flex;align-items:center;gap:4px;';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><span>窗口</span>';
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleWindowManagerPanel(); });
    toolbar.appendChild(btn);
}

function toggleWindowManagerPanel() {
    let panel = document.getElementById('windowManagerPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        if (panel.style.display === 'flex') refreshWindowList();
        return;
    }

    panel = document.createElement('div');
    panel.id = 'windowManagerPanel';
    panel.style.cssText = 'display:none;flex-direction:column;position:fixed;top:40px;right:16px;width:320px;max-height:400px;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-md);box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:950;overflow:hidden;';
    panel.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border-primary);">
            <span style="font-weight:600;font-size:13px;color:var(--fg-primary);">窗口管理</span>
            <div style="display:flex;gap:6px;">
                <button id="newWindowBtn" style="padding:4px 10px;font-size:11px;background:var(--accent-primary);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;">+ 新窗口</button>
                <button onclick="document.getElementById('windowManagerPanel').style.display='none'" style="padding:4px;background:none;border:none;cursor:pointer;color:var(--fg-muted);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
            </div>
        </div>
        <div id="windowListContainer" style="flex:1;overflow-y:auto;padding:8px;"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById('newWindowBtn').addEventListener('click', createNewWindow);
    refreshWindowList();
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== document.getElementById('windowManagerBtn')) {
            panel.style.display = 'none';
        }
    });
}

async function refreshWindowList() {
    const container = document.getElementById('windowListContainer');
    if (!container) return;
    try {
        if (!isWailsAvailable() || !WailsAPI || !WailsAPI.getAllWindows) {
            container.innerHTML = '<div style="padding:12px;color:var(--fg-muted);font-size:12px;">需要后端服务支持</div>';
            return;
        }
        const windows = await WailsAPI.getAllWindows();
        if (!windows || windows.length === 0) {
            container.innerHTML = '<div style="padding:12px;color:var(--fg-muted);font-size:12px;">暂无窗口</div>';
            return;
        }
        container.innerHTML = '';
        windows.forEach(w => {
            const item = document.createElement('div');
            item.style.cssText = `padding:10px 12px;margin-bottom:4px;border-radius:var(--radius-sm);background:${w.isActive ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'};border:1px solid ${w.isActive ? 'var(--accent-primary)' : 'var(--border-primary)'};cursor:pointer;display:flex;align-items:center;justify-content:space-between;`;
            item.innerHTML = `
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:500;color:var(--fg-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${DomUtils.escapeHtml(w.title)}</div>
                    <div style="font-size:10px;color:var(--fg-muted);margin-top:2px;">${w.tabCount} 标签 · ${w.connectionId || '无连接'}</div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;">
                    ${w.isActive ? '<span style="font-size:10px;color:var(--accent-success);">●</span>' : ''}
                    <button class="win-close-btn" data-id="${w.id}" style="padding:2px;background:none;border:none;cursor:pointer;color:var(--fg-muted);"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                </div>`;
            item.addEventListener('click', () => { activateWindow(w.id); refreshWindowList(); });
            item.querySelector('.win-close-btn').addEventListener('click', (e) => { e.stopPropagation(); closeWindowById(w.id); });
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = `<div style="padding:12px;color:var(--accent-danger);font-size:12px;">加载失败: ${e.message || e}</div>`;
    }
}

async function createNewWindow() {
    try {
        if (!isWailsAvailable() || !WailsAPI || !WailsAPI.createWindow) {
            showNotification('warning', '需要后端服务支持');
            return;
        }
        const title = 'DBNexus - 窗口 ' + (Date.now() % 10000);
        const connectionId = (state.activeConnection && state.activeConnection.id) || '';
        const database = state.selectedDatabase || '';
        const w = await WailsAPI.createWindow(title, connectionId, database);
        if (w) {
            currentWindowId = w.id;
            showNotification('success', '新窗口已创建: ' + title);
            refreshWindowList();
        }
    } catch (e) {
        showNotification('error', '创建窗口失败: ' + (e.message || e));
    }
}

async function activateWindow(id) {
    try {
        if (isWailsAvailable() && WailsAPI && WailsAPI.activateWindowByID) {
            await WailsAPI.activateWindowByID(id);
            currentWindowId = id;
        }
    } catch (e) {
        showNotification('error', '激活窗口失败: ' + (e.message || e));
    }
}

async function closeWindowById(id) {
    if (!confirm('确定要关闭此窗口吗？')) return;
    try {
        if (isWailsAvailable() && WailsAPI && WailsAPI.closeWindowByID) {
            await WailsAPI.closeWindowByID(id);
            if (currentWindowId === id) currentWindowId = null;
            showNotification('info', '窗口已关闭');
            refreshWindowList();
        }
    } catch (e) {
        showNotification('error', '关闭窗口失败: ' + (e.message || e));
    }
}

async function saveWindowState() {
    if (!currentWindowId) return;
    try {
        if (isWailsAvailable() && WailsAPI && WailsAPI.saveWindowSessionState) {
            const session = {
                windowId: currentWindowId,
                connectionId: (state.activeConnection && state.activeConnection.id) || '',
                database: state.selectedDatabase || '',
                activeTable: (state.currentTable && state.currentTable.name) || '',
                openTabs: Array.from(document.querySelectorAll('.tab')).map(t => ({
                    id: t.dataset.tab || '',
                    type: t.dataset.type || 'query',
                    label: (t.querySelector('.tab-name') || {}).textContent || '',
                    query: getEditorValue(),
                })),
                queryHistory: (state.queryHistory || []).slice(0, 50),
            };
            await WailsAPI.saveWindowSessionState(session);
        }
    } catch (e) { /* ignore */ }
}

async function restoreWindowState() {
    if (!currentWindowId) return;
    try {
        if (isWailsAvailable() && WailsAPI && WailsAPI.getWindowSessionState) {
            const session = await WailsAPI.getWindowSessionState(currentWindowId);
            if (session && session.openTabs) {
                session.openTabs.forEach(tab => {
                    if (tab.type === 'query') {
                        createNewTab();
                        if (tab.query) setEditorValue(tab.query);
                    }
                });
            }
        }
    } catch (e) { /* ignore */ }
}

let geometrySaveTimer = null;
function onWindowGeometryChange() {
    if (geometrySaveTimer) clearTimeout(geometrySaveTimer);
    geometrySaveTimer = setTimeout(async () => {
        if (!currentWindowId || !isWailsAvailable() || !WailsAPI || !WailsAPI.updateWindowGeometry) return;
        try {
            await WailsAPI.updateWindowGeometry(currentWindowId, window.innerWidth, window.innerHeight, window.screenX, window.screenY);
        } catch (e) { /* ignore */ }
    }, 1000);
}

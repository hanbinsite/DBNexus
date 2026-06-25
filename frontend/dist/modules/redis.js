// ==========================================================================
// Redis Browser Panel Module
// ==========================================================================
function openRedisPanel() {
    if (!state.activeConnection) { showNotification('warning', '请先连接 Redis 数据库'); return; }
    if (state.activeConnection.type !== 'redis') { showNotification('warning', '请先连接 Redis'); return; }
    document.getElementById('redisPanel').style.display = 'block';
    loadRedisDBSize();
    scanRedisKeys();
}

function closeRedisPanel() {
    document.getElementById('redisPanel').style.display = 'none';
}

async function loadRedisDBSize() {
    if (!isWailsAvailable()) return;
    try {
        const size = await WailsAPI.getRedisDBSize(state.activeConnection);
        document.getElementById('redisDBSize').textContent = `${size} keys`;
    } catch (e) {
        document.getElementById('redisDBSize').textContent = '--';
    }
}

async function scanRedisKeys() {
    const pattern = document.getElementById('redisKeyPattern').value || '*';
    const listEl = document.getElementById('redisKeyList');
    listEl.innerHTML = '<div style="padding:8px;color:var(--text-secondary);">扫描中...</div>';
    if (!isWailsAvailable()) return;
    try {
        const result = await WailsAPI.scanRedisKeys(state.activeConnection, pattern, 0, 100);
        const keys = result.keys || [];
        if (keys.length === 0) {
            listEl.innerHTML = '<div style="padding:8px;color:var(--text-secondary);">无匹配 Key</div>';
            return;
        }
        listEl.innerHTML = '';
        keys.forEach(key => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border-color);cursor:pointer;';
            item.innerHTML = `<span style="font-family:var(--font-mono);font-size:13px;">${DomUtils.escapeHtml(key)}</span>
                <button class="action-btn-sm danger" title="删除" style="visibility:hidden;">x</button>`;
            item.addEventListener('mouseenter', () => { item.querySelector('button').style.visibility = 'visible'; });
            item.addEventListener('mouseleave', () => { item.querySelector('button').style.visibility = 'hidden'; });
            item.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); deleteRedisKey(key); });
            item.addEventListener('click', () => getRedisKeyDetail(key));
            listEl.appendChild(item);
        });
    } catch (e) {
        listEl.innerHTML = `<div style="padding:8px;color:var(--danger);">扫描失败: ${DomUtils.escapeHtml(e.message || e)}</div>`;
    }
}

async function getRedisKeyDetail(key) {
    if (!isWailsAvailable()) return;
    const detailEl = document.getElementById('redisKeyDetail');
    const contentEl = document.getElementById('redisKeyDetailContent');
    if (!detailEl || !contentEl) return;

    detailEl.style.display = 'block';
    contentEl.textContent = '加载中...';

    try {
        const info = await WailsAPI.getRedisKeyInfo(state.activeConnection, key);
        const lines = [];
        lines.push(`Key:   ${key}`);
        lines.push(`Type:  ${info.type || 'unknown'}`);
        lines.push(`TTL:   ${info.ttl !== undefined ? info.ttl + 's' : 'N/A'}`);
        lines.push('');
        lines.push('Value:');
        const valStr = typeof info.value === 'string' ? info.value : JSON.stringify(info.value, null, 2);
        lines.push(valStr);
        contentEl.textContent = lines.join('\n');

        document.getElementById('redisNewKey').value = key;
        document.getElementById('redisNewValue').value = typeof info.value === 'string' ? info.value : JSON.stringify(info.value);
    } catch (e) {
        contentEl.textContent = `获取失败: ${e.message || e}`;
    }
}

async function setRedisKey() {
    const key = document.getElementById('redisNewKey').value.trim();
    const value = document.getElementById('redisNewValue').value.trim();
    if (!key) { showNotification('warning', '请输入 Key'); return; }
    if (!isWailsAvailable()) return;
    try {
        await WailsAPI.setRedisKeyValue(state.activeConnection, key, value, 0);
        showNotification('success', `SET ${key} OK`);
        scanRedisKeys();
    } catch (e) {
        showNotification('error', `SET 失败: ${e.message}`);
    }
}

async function deleteRedisKey(key) {
    if (!confirm(`确定要删除 Key "${key}" 吗？`)) return;
    if (!isWailsAvailable()) return;
    try {
        await WailsAPI.deleteRedisKey(state.activeConnection, key);
        showNotification('success', `DEL ${key} OK`);
        scanRedisKeys();
    } catch (e) {
        showNotification('error', `删除失败: ${e.message}`);
    }
}

async function loadRedisInfo() {
    const section = document.getElementById('redisInfoSection').value;
    if (!isWailsAvailable()) return;
    try {
        const info = await WailsAPI.getRedisInfo(state.activeConnection, section);
        const content = document.getElementById('redisInfoContent');
        content.innerHTML = '';
        for (const [k, v] of Object.entries(info)) {
            const line = document.createElement('div');
            line.style.cssText = 'padding:2px 0;border-bottom:1px solid var(--border-color);';
            line.innerHTML = `<span style="color:var(--accent-primary);">${DomUtils.escapeHtml(k)}:</span> ${DomUtils.escapeHtml(String(v))}`;
            content.appendChild(line);
        }
    } catch (e) {
        document.getElementById('redisInfoContent').textContent = '(无数据)';
    }
}
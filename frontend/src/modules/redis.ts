// DBNexus — Redis Browser Module (TypeScript)

let redisCurrentDB: number = 0;
let redisScanCursor: number = 0;

export async function loadRedisDatabases(): Promise<void> {
    if (!state.activeConnection) return;
    try {
        if (isWailsAvailable()) {
            const dbSize = await WailsAPI.getRedisDBSize(state.activeConnection);
            const dbList = document.getElementById('redisDBList');
            if (!dbList) return;
            dbList.innerHTML = '';
            for (let i = 0; i < dbSize; i++) {
                const item = document.createElement('div');
                item.className = 'redis-db-item';
                item.dataset.db = String(i);
                item.textContent = `db${i}`;
                if (i === redisCurrentDB) item.classList.add('active');
                item.addEventListener('click', () => selectRedisDB(i));
                dbList.appendChild(item);
            }
        }
    } catch (e: any) { showNotification('error', '加载Redis数据库失败: ' + (e.message || e)); }
}

export async function selectRedisDB(dbIndex: number): Promise<void> {
    redisCurrentDB = dbIndex;
    redisScanCursor = 0;
    document.querySelectorAll('.redis-db-item').forEach(item => item.classList.remove('active'));
    const item = document.querySelector(`.redis-db-item[data-db="${dbIndex}"]`);
    if (item) item.classList.add('active');
    await scanRedisKeys();
}

export async function scanRedisKeys(pattern: string = '*'): Promise<void> {
    if (!state.activeConnection) return;
    try {
        if (isWailsAvailable()) {
            const result = await WailsAPI.scanRedisKeys(state.activeConnection, pattern, redisScanCursor, 100);
            const keyList = document.getElementById('redisKeyList');
            if (!keyList) return;
            if (redisScanCursor === 0) keyList.innerHTML = '';
            if (result && result.keys) {
                result.keys.forEach((key: string) => {
                    const item = document.createElement('div');
                    item.className = 'redis-key-item';
                    item.textContent = key;
                    item.addEventListener('click', () => loadRedisKeyValue(key));
                    keyList.appendChild(item);
                });
            }
            redisScanCursor = result?.cursor || 0;
        }
    } catch (e: any) { showNotification('error', '扫描Key失败: ' + (e.message || e)); }
}

export async function loadRedisKeyValue(key: string): Promise<void> {
    if (!state.activeConnection) return;
    try {
        if (isWailsAvailable()) {
            const keyType = await WailsAPI.getRedisKeyType(state.activeConnection, key);
            const keyInfo = document.getElementById('redisKeyInfo');
            if (keyInfo) {
                keyInfo.innerHTML = `<div class="redis-key-detail"><span class="redis-key-name">${DomUtils.escapeHtml(key)}</span><span class="redis-key-type">${keyType}</span></div>`;
            }
            const value = await WailsAPI.getRedisKeyValue(state.activeConnection, key);
            const valueEl = document.getElementById('redisKeyValue');
            if (valueEl) {
                if (typeof value === 'object') {
                    valueEl.innerHTML = `<pre>${DomUtils.escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
                } else {
                    valueEl.innerHTML = `<pre>${DomUtils.escapeHtml(String(value))}</pre>`;
                }
            }
        }
    } catch (e: any) { showNotification('error', '加载Key值失败: ' + (e.message || e)); }
}

export async function setRedisKeyValue(key: string, value: string): Promise<void> {
    if (!state.activeConnection) return;
    try {
        if (isWailsAvailable()) {
            await WailsAPI.setRedisKey(state.activeConnection, key, value);
            showNotification('success', 'Key已设置');
            await loadRedisKeyValue(key);
        }
    } catch (e: any) { showNotification('error', '设置Key失败: ' + (e.message || e)); }
}

export async function deleteRedisKey(key: string): Promise<void> {
    if (!state.activeConnection) return;
    if (!confirm(`确定要删除Key "${key}" 吗？`)) return;
    try {
        if (isWailsAvailable()) {
            await WailsAPI.deleteRedisKey(state.activeConnection, key);
            showNotification('success', 'Key已删除');
            await scanRedisKeys();
        }
    } catch (e: any) { showNotification('error', '删除Key失败: ' + (e.message || e)); }
}

export async function loadRedisInfo(): Promise<void> {
    if (!state.activeConnection) return;
    try {
        if (isWailsAvailable() && WailsAPI.getRedisInfo) {
            const info = await WailsAPI.getRedisInfo(state.activeConnection);
            const infoEl = document.getElementById('redisInfoContent');
            if (infoEl) infoEl.innerHTML = `<pre>${DomUtils.escapeHtml(info)}</pre>`;
        }
    } catch (e: any) { showNotification('error', '加载Redis信息失败: ' + (e.message || e)); }
}

export function openRedisPanel(): void {
    const panel = document.getElementById('redisPanel');
    if (panel) { panel.style.display = 'flex'; loadRedisDatabases(); }
}

export function closeRedisPanel(): void {
    const panel = document.getElementById('redisPanel');
    if (panel) panel.style.display = 'none';
}

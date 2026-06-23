// ==========================================================================
// Transaction Management Panel Module
// ==========================================================================
let activeTxId = null;
let txStartTime = null;
let txTimerInterval = null;

function openTransactionPanel() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    document.getElementById('transactionPanel').style.display = 'block';
}

function closeTransactionPanel() {
    document.getElementById('transactionPanel').style.display = 'none';
}

function updateTransactionStatus() {
    const label = document.getElementById('transactionLabel');
    if (label) {
        label.style.color = activeTxId ? 'var(--accent-primary)' : '';
    }
}

async function startTransaction() {
    if (!state.activeConnection || !isWailsAvailable()) return;
    showLoading('开始事务...');
    try {
        const db = state.selectedDatabase || state.currentTable?.database || '';
        const result = await WailsAPI.beginTransaction(state.activeConnection, db, { isolated: true });
        activeTxId = result.tx_id || result.txID;
        txStartTime = Date.now();
        document.getElementById('txId').textContent = `TX: ${activeTxId}`;
        document.getElementById('txNoActive').style.display = 'none';
        document.getElementById('txActive').style.display = 'block';
        document.getElementById('txResults').innerHTML = '';
        document.getElementById('txQuery').value = '';
        startTxTimer();
        updateTransactionStatus();
        hideLoading();
        showNotification('success', '事务已开始');
    } catch (e) {
        hideLoading();
        showNotification('error', `开始事务失败: ${e.message || e}`);
    }
}

function startTxTimer() {
    if (txTimerInterval) clearInterval(txTimerInterval);
    txTimerInterval = setInterval(() => {
        if (!txStartTime) return;
        const elapsed = Math.floor((Date.now() - txStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('txTimer').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
}

function stopTxTimer() {
    if (txTimerInterval) { clearInterval(txTimerInterval); txTimerInterval = null; }
}

async function executeInTx() {
    if (!activeTxId) { showNotification('warning', '无活动事务'); return; }
    if (!isWailsAvailable()) return;
    const query = document.getElementById('txQuery').value.trim();
    if (!query) { showNotification('warning', '请输入 SQL'); return; }
    showLoading('执行中...');
    try {
        const result = await WailsAPI.executeInTransaction(activeTxId, query);
        hideLoading();
        const resultsEl = document.getElementById('txResults');
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 8px;background:var(--bg-primary);border-radius:var(--radius-md);margin-bottom:4px;font-family:var(--font-mono);font-size:12px;';
        if (result.error) {
            div.style.borderLeft = '3px solid var(--danger)';
            div.innerHTML = `<span style="color:var(--text-secondary);">${DomUtils.escapeHtml(query.substring(0, 60))}...</span><br><span style="color:var(--danger);">${DomUtils.escapeHtml(result.error)}</span>`;
        } else {
            div.style.borderLeft = '3px solid var(--success)';
            div.innerHTML = `<span style="color:var(--text-secondary);">${DomUtils.escapeHtml(query.substring(0, 60))}...</span><br>影响: ${result.rows_affected || 0} 行`;
        }
        resultsEl.insertBefore(div, resultsEl.firstChild);
    } catch (e) {
        hideLoading();
        showNotification('error', `执行失败: ${e.message || e}`);
    }
}

async function commitTx() {
    if (!activeTxId || !isWailsAvailable()) return;
    showLoading('提交事务中...');
    try {
        await WailsAPI.commitTransaction(activeTxId);
        hideLoading();
        showNotification('success', '事务已提交');
        resetTxState();
    } catch (e) {
        hideLoading();
        showNotification('error', `提交失败: ${e.message || e}`);
    }
}

async function rollbackTx() {
    if (!activeTxId || !isWailsAvailable()) return;
    if (!confirm('确定要回滚事务吗？')) return;
    showLoading('回滚事务中...');
    try {
        await WailsAPI.rollbackTransaction(activeTxId);
        hideLoading();
        showNotification('success', '事务已回滚');
        resetTxState();
    } catch (e) {
        hideLoading();
        showNotification('error', `回滚失败: ${e.message || e}`);
    }
}

function resetTxState() {
    activeTxId = null;
    txStartTime = null;
    stopTxTimer();
    document.getElementById('txNoActive').style.display = 'block';
    document.getElementById('txActive').style.display = 'none';
    document.getElementById('txResults').innerHTML = '';
    updateTransactionStatus();
}
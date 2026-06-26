// DBNexus — Compare Module (TypeScript)

export async function compareTables(conn1: any, db1: string, table1: string, conn2: any, db2: string, table2: string): Promise<void> {
    showLoading('正在对比表数据...');
    try {
        if (isWailsAvailable() && WailsAPI.compareTableData) {
            const result = await WailsAPI.compareTableData(conn1, db1, table1, conn2, db2, table2);
            displayCompareResult(result);
        }
    } catch (e: any) { showNotification('error', '对比失败: ' + (e.message || e)); }
    finally { hideLoading(); }
}

export async function compareTableStructures(conn: any, db: string, table1: string, table2: string): Promise<void> {
    showLoading('正在对比表结构...');
    try {
        if (isWailsAvailable() && WailsAPI.compareTableStructures) {
            const result = await WailsAPI.compareTableStructures(conn, db, table1, table2);
            displayStructureDiff(result);
        }
    } catch (e: any) { showNotification('error', '对比失败: ' + (e.message || e)); }
    finally { hideLoading(); }
}

export async function compareQueryResults(conn1: any, db1: string, query1: string, conn2: any, db2: string, query2: string): Promise<void> {
    showLoading('正在对比查询结果...');
    try {
        if (isWailsAvailable() && WailsAPI.compareQueryResults) {
            const result = await WailsAPI.compareQueryResults(conn1, db1, query1, conn2, db2, query2);
            displayCompareResult(result);
        }
    } catch (e: any) { showNotification('error', '对比失败: ' + (e.message || e)); }
    finally { hideLoading(); }
}

function displayCompareResult(result: any): void {
    const container = document.getElementById('compareResult');
    if (!container) return;
    if (!result) { container.innerHTML = '<p>无对比结果</p>'; return; }
    let html = '<div class="compare-summary">';
    html += `<span class="compare-stat">仅表1: ${result.onlyIn1 || 0}</span>`;
    html += `<span class="compare-stat">仅表2: ${result.onlyIn2 || 0}</span>`;
    html += `<span class="compare-stat">差异: ${result.different || 0}</span>`;
    html += `<span class="compare-stat">相同: ${result.identical || 0}</span>`;
    html += '</div>';
    if (result.differences && result.differences.length > 0) {
        html += '<table class="compare-table"><thead><tr><th>类型</th><th>主键</th><th>列</th><th>表1值</th><th>表2值</th></tr></thead><tbody>';
        result.differences.forEach((diff: any) => {
            html += `<tr><td>${diff.type}</td><td>${DomUtils.escapeHtml(String(diff.primaryKey || ''))}</td><td>${DomUtils.escapeHtml(String(diff.column || ''))}</td><td>${DomUtils.escapeHtml(String(diff.value1 || ''))}</td><td>${DomUtils.escapeHtml(String(diff.value2 || ''))}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    container.innerHTML = html;
}

function displayStructureDiff(result: any): void {
    const container = document.getElementById('compareResult');
    if (!container) return;
    if (!result) { container.innerHTML = '<p>无结构差异</p>'; return; }
    let html = '<div class="structure-diff">';
    if (result.onlyIn1 && result.onlyIn1.length > 0) {
        html += `<div class="diff-section"><h4>仅表1有</h4><ul>`;
        result.onlyIn1.forEach((col: string) => { html += `<li>${DomUtils.escapeHtml(col)}</li>`; });
        html += '</ul></div>';
    }
    if (result.onlyIn2 && result.onlyIn2.length > 0) {
        html += `<div class="diff-section"><h4>仅表2有</h4><ul>`;
        result.onlyIn2.forEach((col: string) => { html += `<li>${DomUtils.escapeHtml(col)}</li>`; });
        html += '</ul></div>';
    }
    if (result.typeDiffs && result.typeDiffs.length > 0) {
        html += `<div class="diff-section"><h4>类型差异</h4><table><thead><tr><th>列</th><th>表1类型</th><th>表2类型</th></tr></thead><tbody>`;
        result.typeDiffs.forEach((diff: any) => { html += `<tr><td>${DomUtils.escapeHtml(diff.column)}</td><td>${DomUtils.escapeHtml(diff.type1)}</td><td>${DomUtils.escapeHtml(diff.type2)}</td></tr>`; });
        html += '</tbody></table></div>';
    }
    if (!result.onlyIn1?.length && !result.onlyIn2?.length && !result.typeDiffs?.length) {
        html += '<p>表结构完全相同</p>';
    }
    html += '</div>';
    container.innerHTML = html;
}

export async function syncCompareResult(conn2: any, db2: string, table2: string, differences: any[]): Promise<void> {
    if (!differences || differences.length === 0) { showNotification('info', '无差异需要同步'); return; }
    if (!confirm(`确定要同步 ${differences.length} 条差异到目标表吗？`)) return;
    showLoading('正在同步...');
    try {
        if (isWailsAvailable() && WailsAPI.syncCompareResult) {
            const result = await WailsAPI.syncCompareResult(conn2, db2, table2, differences);
            if (result && result.success) {
                showNotification('success', `同步成功: ${result.syncedCount} 条`);
            } else {
                showNotification('error', '同步失败: ' + (result?.error || '未知错误'));
            }
        }
    } catch (e: any) { showNotification('error', '同步失败: ' + (e.message || e)); }
    finally { hideLoading(); }
}

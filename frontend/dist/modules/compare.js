// ==========================================================================
// Data Compare Panel Module
// ==========================================================================
function openComparePanel() {
    if (!state.activeConnection) { showNotification('warning', '请先连接数据库'); return; }
    document.getElementById('comparePanel').style.display = 'block';
}

function closeComparePanel() {
    document.getElementById('comparePanel').style.display = 'none';
}

function switchCompareMode() {
    const mode = document.getElementById('compareMode').value;
    document.getElementById('compareTableFields').style.display = mode === 'table' ? 'block' : 'none';
    document.getElementById('compareQueryFields').style.display = mode === 'query' ? 'block' : 'none';
}

async function executeCompare() {
    if (!state.activeConnection || !isWailsAvailable()) return;
    const mode = document.getElementById('compareMode').value;
    const resultEl = document.getElementById('compareResult');
    resultEl.innerHTML = '<div style="padding:8px;color:var(--text-secondary);">对比中...</div>';
    showLoading('对比中...');

    try {
        let result;
        if (mode === 'table') {
            const table1 = document.getElementById('compareTable1').value.trim();
            const table2 = document.getElementById('compareTable2').value.trim();
            if (!table1 || !table2) { hideLoading(); showNotification('warning', '请输入两个表名'); return; }
            const excludeCols = document.getElementById('compareExcludeCols').value.split(',').map(s => s.trim()).filter(Boolean);
            result = await WailsAPI.compareTables(state.activeConnection, {
                table1, table2,
                database: state.selectedDatabase || '',
                exclude_columns: excludeCols
            });
        } else {
            const query1 = document.getElementById('compareQuery1').value.trim();
            const query2 = document.getElementById('compareQuery2').value.trim();
            if (!query1 || !query2) { hideLoading(); showNotification('warning', '请输入两条查询'); return; }
            result = await WailsAPI.compareQueries(state.activeConnection, {
                query1, query2,
                database: state.selectedDatabase || ''
            });
        }
        hideLoading();
        renderCompareResult(result);
    } catch (e) {
        hideLoading();
        resultEl.innerHTML = `<div style="color:var(--danger);">对比失败: ${DomUtils.escapeHtml(e.message || e)}</div>`;
    }
}

function renderCompareResult(result) {
    const el = document.getElementById('compareResult');
    if (!result) { el.innerHTML = '<div>无结果</div>'; return; }
    let html = `<div style="margin-bottom:8px;font-weight:500;">`;
    html += `匹配: <b style="color:var(--success);">${result.matched_count || 0}</b> &nbsp;`;
    html += `差异: <b style="color:var(--warning);">${result.diff_count || 0}</b> &nbsp;`;
    html += `仅左: <b style="color:var(--danger);">${result.left_only || 0}</b> &nbsp;`;
    html += `仅右: <b style="color:var(--accent-primary);">${result.right_only || 0}</b>`;
    html += `</div>`;
    const diffs = result.differences || [];
    if (diffs.length === 0) {
        html += '<div style="color:var(--success);padding:8px;">✓ 数据完全一致</div>';
    } else {
        html += '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
        html += '<thead><tr style="background:var(--bg-tertiary);">';
        html += '<th style="padding:4px 8px;text-align:left;">行</th>';
        html += '<th style="padding:4px 8px;text-align:left;">列</th>';
        html += '<th style="padding:4px 8px;text-align:left;">左值</th>';
        html += '<th style="padding:4px 8px;text-align:left;">右值</th>';
        html += '</tr></thead><tbody>';
        diffs.slice(0, 200).forEach(diff => {
            html += `<tr style="border-bottom:1px solid var(--border-color);">`;
            html += `<td style="padding:4px 8px;">${diff.row || '-'}</td>`;
            html += `<td style="padding:4px 8px;">${DomUtils.escapeHtml(diff.column || '')}</td>`;
            html += `<td style="padding:4px 8px;color:var(--danger);">${DomUtils.escapeHtml(String(diff.left_value ?? 'NULL'))}</td>`;
            html += `<td style="padding:4px 8px;color:var(--success);">${DomUtils.escapeHtml(String(diff.right_value ?? 'NULL'))}</td>`;
            html += `</tr>`;
        });
        if (diffs.length > 200) {
            html += `<tr><td colspan="4" style="padding:8px;color:var(--text-secondary);text-align:center;">... 仅显示前 200 条差异（共 ${diffs.length} 条）</td></tr>`;
        }
        html += '</tbody></table>';
    }
    el.innerHTML = html;
}
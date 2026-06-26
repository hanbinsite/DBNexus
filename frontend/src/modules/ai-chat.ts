// DBNexus — AI Chat Panel Module (TypeScript)

let aiChatSession: string | null = null;

export function initAIChat(): void {
    const input = document.getElementById('aiChatInput') as HTMLTextAreaElement | null;
    if (input) {
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIChatMessage(); }
        });
    }
    const sendBtn = document.getElementById('aiChatSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendAIChatMessage);
}

export function openAIChatPanel(): void {
    let panel = document.getElementById('aiChatPanel');
    if (!panel) createAIChatPanel();
    panel = document.getElementById('aiChatPanel');
    if (panel) { panel.style.display = 'flex'; setTimeout(() => { (document.getElementById('aiChatInput') as HTMLTextAreaElement)?.focus(); }, 100); }
}

export function closeAIChatPanel(): void {
    const panel = document.getElementById('aiChatPanel');
    if (panel) panel.style.display = 'none';
}

function createAIChatPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'aiChatPanel';
    panel.className = 'side-panel ai-chat-panel';
    panel.style.cssText = 'display:none;flex-direction:column;width:420px;position:fixed;right:0;top:32px;bottom:0;z-index:900;background:var(--bg-primary);border-left:1px solid var(--border-primary);';
    panel.innerHTML = `
        <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-primary);">
            <div style="display:flex;align-items:center;gap:8px;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--accent-primary)" stroke-width="2"><path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10 10 10 0 0 0-10-10z"/><path d="M8 12h8M12 8v8"/></svg>
                <span style="font-weight:600;color:var(--fg-primary);">AI 助手</span>
            </div>
            <button onclick="closeAIChatPanel()" style="background:none;border:none;cursor:pointer;color:var(--fg-muted);padding:4px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div id="aiChatMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;"></div>
        <div id="aiChatSuggestions" style="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;border-top:1px solid var(--border-primary);"></div>
        <div style="padding:12px 16px;border-top:1px solid var(--border-primary);display:flex;gap:8px;">
            <textarea id="aiChatInput" placeholder="输入问题... (Enter发送, Shift+Enter换行)" style="flex:1;resize:none;height:60px;padding:8px 12px;border:1px solid var(--border-primary);border-radius:var(--radius-md);background:var(--bg-secondary);color:var(--fg-primary);font-size:13px;"></textarea>
            <button id="aiChatSendBtn" style="padding:8px 16px;background:var(--accent-primary);color:#fff;border:none;border-radius:var(--radius-md);cursor:pointer;font-size:13px;align-self:flex-end;">发送</button>
        </div>`;
    document.body.appendChild(panel);
    initAIChat();
    addWelcomeMessage();
}

function addWelcomeMessage(): void {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const msg = document.createElement('div');
    msg.style.cssText = 'background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px 16px;font-size:13px;color:var(--fg-secondary);';
    msg.textContent = '你好！我是 DBNexus AI 助手。我可以帮你：\n• 编写 SQL 查询\n• 优化慢查询\n• 解释复杂 SQL\n• 推荐索引\n\n请输入你的问题。';
    container.appendChild(msg);
}

export async function sendAIChatMessage(): Promise<void> {
    const input = document.getElementById('aiChatInput') as HTMLTextAreaElement | null;
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    addChatMessage('user', message);
    input.value = '';
    const typingId = addTypingIndicator();
    try {
        if (!isWailsAvailable() || !WailsAPI?.aiChat) {
            removeTypingIndicator(typingId);
            addChatMessage('assistant', 'AI 功能需要连接后端服务。请在设置中配置 AI Provider (OpenAI/Ollama)。');
            return;
        }
        const req = { sessionId: aiChatSession || 'default', message, config: state.activeConnection || {}, database: state.selectedDatabase || '', context: { currentTable: state.currentTable?.name || '', currentQuery: getEditorValue() } };
        const resp = await WailsAPI.aiChat(req);
        removeTypingIndicator(typingId);
        if (resp.error) { addChatMessage('assistant', '错误: ' + resp.error); }
        else { addChatMessage('assistant', resp.message, resp.sql); if (resp.suggestions?.length) showChatSuggestions(resp.suggestions); }
    } catch (error: any) { removeTypingIndicator(typingId); addChatMessage('assistant', '请求失败: ' + (error.message || error)); }
}

function addChatMessage(role: string, content: string, sql?: string): void {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const msg = document.createElement('div');
    const isUser = role === 'user';
    msg.style.cssText = isUser ? 'align-self:flex-end;background:var(--accent-primary);color:#fff;border-radius:var(--radius-md);padding:10px 14px;max-width:85%;font-size:13px;' : 'align-self:flex-start;background:var(--bg-secondary);color:var(--fg-primary);border-radius:var(--radius-md);padding:10px 14px;max-width:85%;font-size:13px;';
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = escaped;
    if (sql) {
        html += '\n<div style="margin-top:8px;background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:8px 12px;font-family:var(--font-mono);font-size:12px;white-space:pre-wrap;color:var(--accent-success);">' + sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
        html += `<button onclick="insertSQLToEditor('${sql.replace(/'/g, "\\'").replace(/\n/g, '\\n')}')" style="margin-top:4px;padding:4px 10px;font-size:11px;background:var(--accent-primary);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;">插入编辑器</button>`;
    }
    msg.innerHTML = html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator(): string {
    const container = document.getElementById('aiChatMessages');
    if (!container) return '';
    const id = 'typing-' + Date.now();
    const msg = document.createElement('div');
    msg.id = id;
    msg.style.cssText = 'align-self:flex-start;background:var(--bg-secondary);border-radius:var(--radius-md);padding:10px 14px;font-size:13px;color:var(--fg-muted);';
    msg.textContent = 'AI 正在思考...';
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id: string): void {
    if (!id) return;
    document.getElementById(id)?.remove();
}

function showChatSuggestions(suggestions: string[]): void {
    const container = document.getElementById('aiChatSuggestions');
    if (!container) return;
    container.innerHTML = '';
    suggestions.forEach(s => {
        const btn = document.createElement('button');
        btn.textContent = s;
        btn.style.cssText = 'padding:4px 10px;font-size:11px;background:var(--bg-tertiary);color:var(--fg-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-sm);cursor:pointer;';
        btn.addEventListener('click', () => {
            const input = document.getElementById('aiChatInput') as HTMLTextAreaElement | null;
            if (input) { input.value = s; sendAIChatMessage(); }
        });
        container.appendChild(btn);
    });
}

export function insertSQLToEditor(sql: string): void {
    if (typeof setEditorValue === 'function') setEditorValue(sql);
    showNotification('success', 'SQL 已插入编辑器');
}

export async function analyzeIndexes(): Promise<void> {
    if (!state.currentTable || !state.activeConnection) { showNotification('warning', '请先选择表'); return; }
    showNotification('info', '正在分析索引...');
    try {
        if (isWailsAvailable() && WailsAPI?.recommendIndexes) {
            const result = await WailsAPI.recommendIndexes(state.activeConnection, state.currentTable.database, state.currentTable.name);
            displayIndexAnalysis(result);
        } else { showNotification('warning', '需要后端服务支持'); }
    } catch (error: any) { showNotification('error', '分析失败: ' + (error.message || error)); }
}

function displayIndexAnalysis(result: any): void {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const msg = document.createElement('div');
    msg.style.cssText = 'align-self:flex-start;background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px 14px;max-width:90%;font-size:13px;';
    let html = '<div style="font-weight:600;margin-bottom:8px;">索引分析报告</div>';
    html += `<div style="color:var(--fg-secondary);margin-bottom:8px;">${result.summary || ''}</div>`;
    if (result.recommendations?.length) {
        html += '<div style="margin-top:8px;">';
        result.recommendations.forEach((rec: any) => {
            const priorityColor = rec.priority === 'high' ? 'var(--accent-danger)' : rec.priority === 'medium' ? 'var(--accent-warning)' : 'var(--fg-muted)';
            html += `<div style="margin-bottom:6px;padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-sm);border-left:3px solid ${priorityColor};"><div style="font-weight:500;">${rec.columnName} (${rec.indexType})</div><div style="font-size:11px;color:var(--fg-muted);">${rec.reason}</div><div style="font-size:11px;color:var(--accent-success);">${rec.estimatedImpact || ''}</div><button onclick="insertSQLToEditor('${rec.createSql.replace(/'/g, "\\'").replace(/\n/g, '\\n')}')" style="margin-top:4px;padding:3px 8px;font-size:10px;background:var(--accent-primary);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;">创建索引</button></div>`;
        });
        html += '</div>';
    }
    if (result.existingIndexes?.length) html += `<div style="margin-top:8px;font-size:11px;color:var(--fg-muted);">已有索引: ${result.existingIndexes.join(', ')}</div>`;
    msg.innerHTML = html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCustomShortcuts = loadCustomShortcuts;
exports.saveCustomShortcuts = saveCustomShortcuts;
exports.getShortcut = getShortcut;
exports.setShortcut = setShortcut;
exports.resetShortcut = resetShortcut;
exports.initKeyboardShortcuts = initKeyboardShortcuts;
exports.getShortcutList = getShortcutList;
exports.formatShortcut = formatShortcut;
const DefaultShortcuts = {
    'execute-query': { key: 'F5', ctrl: false, shift: false, alt: false, desc: '执行查询' },
    'execute-selected': { key: 'F5', ctrl: true, shift: false, alt: false, desc: '执行选中语句' },
    'new-tab': { key: 't', ctrl: true, shift: false, alt: false, desc: '新建标签页' },
    'close-tab': { key: 'w', ctrl: true, shift: false, alt: false, desc: '关闭标签页' },
    'format-sql': { key: 'f', ctrl: true, shift: true, alt: false, desc: '格式化SQL' },
    'find': { key: 'f', ctrl: true, shift: false, alt: false, desc: '查找' },
    'replace': { key: 'h', ctrl: true, shift: false, alt: false, desc: '替换' },
    'comment': { key: '/', ctrl: true, shift: false, alt: false, desc: '注释/取消注释' },
    'go-to-line': { key: 'g', ctrl: true, shift: false, alt: false, desc: '跳转到行' },
    'save-query': { key: 's', ctrl: true, shift: false, alt: false, desc: '保存查询' },
    'load-query': { key: 'o', ctrl: true, shift: false, alt: false, desc: '加载查询' },
    'refresh-data': { key: 'r', ctrl: true, shift: false, alt: false, desc: '刷新数据' },
    'toggle-sidebar': { key: 'b', ctrl: true, shift: false, alt: false, desc: '切换侧边栏' },
    'toggle-theme': { key: 't', ctrl: true, shift: false, alt: true, desc: '切换主题' },
    'ai-explain': { key: 'e', ctrl: true, shift: true, alt: false, desc: 'AI解释SQL' },
    'ai-optimize': { key: 'o', ctrl: true, shift: true, alt: false, desc: 'AI优化SQL' },
    'ai-nl2sql': { key: 'n', ctrl: true, shift: true, alt: false, desc: '自然语言转SQL' },
    'open-settings': { key: ',', ctrl: true, shift: false, alt: false, desc: '设置' },
    'open-perf': { key: 'p', ctrl: true, shift: false, alt: false, desc: '性能监控' },
    'open-history': { key: 'h', ctrl: true, shift: true, alt: false, desc: '查询历史' },
    'open-git': { key: 'g', ctrl: true, shift: true, alt: false, desc: 'Git面板' },
    'open-report': { key: 'r', ctrl: true, shift: true, alt: false, desc: '报表设计器' },
    'escape': { key: 'Escape', ctrl: false, shift: false, alt: false, desc: '关闭对话框' },
};
let customShortcuts = {};
function loadCustomShortcuts() {
    const saved = localStorage.getItem('dbnexus-shortcuts');
    if (saved) {
        try {
            customShortcuts = JSON.parse(saved);
        }
        catch {
            customShortcuts = {};
        }
    }
}
function saveCustomShortcuts() {
    localStorage.setItem('dbnexus-shortcuts', JSON.stringify(customShortcuts));
}
function getShortcut(action) {
    return customShortcuts[action] || DefaultShortcuts[action];
}
function setShortcut(action, shortcut) {
    customShortcuts[action] = shortcut;
    saveCustomShortcuts();
}
function resetShortcut(action) {
    delete customShortcuts[action];
    saveCustomShortcuts();
}
function matchShortcut(e, action) {
    const sc = getShortcut(action);
    if (!sc)
        return false;
    return e.key.toLowerCase() === sc.key.toLowerCase() && e.ctrlKey === sc.ctrl && e.shiftKey === sc.shift && e.altKey === sc.alt;
}
function initKeyboardShortcuts() {
    loadCustomShortcuts();
    document.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            if (!e.ctrlKey && !e.metaKey)
                return;
        }
        const actions = {
            'execute-query': () => executeQuery(),
            'new-tab': () => createNewTab(),
            'close-tab': () => { if (state.activeTab)
                closeTab(state.activeTab, e); },
            'format-sql': () => formatSQLViaAPI(),
            'find': () => findInEditor(),
            'replace': () => replaceInEditor(),
            'comment': () => toggleComment(),
            'go-to-line': () => goToLine(),
            'save-query': () => saveQuery(),
            'load-query': () => loadQuery(),
            'refresh-data': () => refreshDataView(),
            'ai-explain': () => aiExplainSQL(),
            'ai-optimize': () => aiOptimizeSQL(),
            'ai-nl2sql': () => openNL2SQLDialog(),
            'open-settings': () => openSettings(),
            'open-perf': () => openPerfPanel(),
            'open-history': () => openHistoryPanel(),
            'open-git': () => openGitPanel(),
            'open-report': () => openReportPanel(),
            'escape': () => {
                const cm = document.getElementById('connectionModal');
                const sm = document.getElementById('settingsModal');
                const lm = document.getElementById('languageModal');
                if (cm?.classList.contains('active'))
                    closeConnectionDialog();
                if (sm?.classList.contains('active'))
                    closeSettings();
                if (lm?.classList.contains('active'))
                    closeLanguageDialog();
            },
        };
        for (const [action, handler] of Object.entries(actions)) {
            if (matchShortcut(e, action)) {
                e.preventDefault();
                handler();
                return;
            }
        }
    });
}
function getShortcutList() {
    const list = [];
    for (const [action, sc] of Object.entries(DefaultShortcuts)) {
        const current = getShortcut(action);
        list.push({ ...current, action, isCustom: !!customShortcuts[action] });
    }
    return list;
}
function formatShortcut(sc) {
    const parts = [];
    if (sc.ctrl)
        parts.push('Ctrl');
    if (sc.shift)
        parts.push('Shift');
    if (sc.alt)
        parts.push('Alt');
    parts.push(sc.key);
    return parts.join('+');
}

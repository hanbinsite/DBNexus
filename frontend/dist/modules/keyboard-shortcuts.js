/**
 * Keyboard Shortcuts Module
 * Comprehensive keyboard shortcut system with customization support
 */

const DefaultShortcuts = {
    'execute-query': { key: 'F5', ctrl: false, shift: false, alt: false, desc: '执行查询' },
    'execute-selected': { key: 'F5', ctrl: true, shift: false, alt: false, desc: '执行选中语句' },
    'new-tab': { key: 't', ctrl: true, shift: false, alt: false, desc: '新建标签页' },
    'close-tab': { key: 'w', ctrl: true, shift: false, alt: false, desc: '关闭标签页' },
    'format-sql': { key: 'f', ctrl: true, shift: true, alt: false, desc: '格式化SQL' },
    'find': { key: 'f', ctrl: true, shift: false, alt: false, desc: '查找' },
    'replace': { key: 'h', ctrl: true, shift: false, alt: false, desc: '替换' },
    'find-next': { key: 'F3', ctrl: false, shift: false, alt: false, desc: '查找下一个' },
    'find-prev': { key: 'F3', ctrl: false, shift: true, alt: false, desc: '查找上一个' },
    'comment': { key: '/', ctrl: true, shift: false, alt: false, desc: '注释/取消注释' },
    'block-comment': { key: '/', ctrl: true, shift: true, alt: false, desc: '块注释' },
    'go-to-line': { key: 'g', ctrl: true, shift: false, alt: false, desc: '跳转到行' },
    'save-query': { key: 's', ctrl: true, shift: false, alt: false, desc: '保存查询' },
    'load-query': { key: 'o', ctrl: true, shift: false, alt: false, desc: '加载查询' },
    'refresh-data': { key: 'r', ctrl: true, shift: false, alt: false, desc: '刷新数据' },
    'toggle-sidebar': { key: 'b', ctrl: true, shift: false, alt: false, desc: '切换侧边栏' },
    'toggle-theme': { key: 't', ctrl: true, shift: false, alt: true, desc: '切换主题' },
    'ai-explain': { key: 'e', ctrl: true, shift: true, alt: false, desc: 'AI解释SQL' },
    'ai-optimize': { key: 'o', ctrl: true, shift: true, alt: false, desc: 'AI优化SQL' },
    'ai-nl2sql': { key: 'n', ctrl: true, shift: true, alt: false, desc: '自然语言转SQL' },
    'open-connections': { key: 'n', ctrl: true, shift: false, alt: true, desc: '新建连接' },
    'open-settings': { key: ',', ctrl: true, shift: false, alt: false, desc: '设置' },
    'open-perf': { key: 'p', ctrl: true, shift: false, alt: false, desc: '性能监控' },
    'open-history': { key: 'h', ctrl: true, shift: true, alt: false, desc: '查询历史' },
    'open-git': { key: 'g', ctrl: true, shift: true, alt: false, desc: 'Git面板' },
    'open-report': { key: 'r', ctrl: true, shift: true, alt: false, desc: '报表设计器' },
    'select-all': { key: 'a', ctrl: true, shift: false, alt: false, desc: '全选' },
    'undo': { key: 'z', ctrl: true, shift: false, alt: false, desc: '撤销' },
    'redo': { key: 'z', ctrl: true, shift: true, alt: false, desc: '重做' },
    'escape': { key: 'Escape', ctrl: false, shift: false, alt: false, desc: '关闭对话框' },
};

let customShortcuts = {};

function loadCustomShortcuts() {
    const saved = localStorage.getItem('dbnexus-shortcuts');
    if (saved) {
        try {
            customShortcuts = JSON.parse(saved);
        } catch (e) {
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
    if (!sc) return false;
    return e.key.toLowerCase() === sc.key.toLowerCase() &&
           e.ctrlKey === sc.ctrl &&
           e.shiftKey === sc.shift &&
           e.altKey === sc.alt;
}

function initKeyboardShortcuts() {
    loadCustomShortcuts();

    document.addEventListener('keydown', (e) => {
        // Skip if typing in input/textarea/select
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            if (!e.ctrlKey && !e.metaKey) return;
        }

        // Execute query
        if (matchShortcut(e, 'execute-query')) {
            e.preventDefault();
            if (typeof executeQuery === 'function') executeQuery();
            return;
        }

        // New tab
        if (matchShortcut(e, 'new-tab')) {
            e.preventDefault();
            if (typeof createNewTab === 'function') createNewTab();
            return;
        }

        // Close tab
        if (matchShortcut(e, 'close-tab')) {
            e.preventDefault();
            if (state.activeTab && typeof closeTab === 'function') closeTab(state.activeTab, e);
            return;
        }

        // Format SQL
        if (matchShortcut(e, 'format-sql')) {
            e.preventDefault();
            if (typeof formatSQLViaAPI === 'function') formatSQLViaAPI();
            return;
        }

        // Find
        if (matchShortcut(e, 'find')) {
            e.preventDefault();
            if (typeof findInEditor === 'function') findInEditor();
            return;
        }

        // Replace
        if (matchShortcut(e, 'replace')) {
            e.preventDefault();
            if (typeof replaceInEditor === 'function') replaceInEditor();
            return;
        }

        // Comment
        if (matchShortcut(e, 'comment')) {
            e.preventDefault();
            if (typeof toggleComment === 'function') toggleComment();
            return;
        }

        // Go to line
        if (matchShortcut(e, 'go-to-line')) {
            e.preventDefault();
            if (typeof goToLine === 'function') goToLine();
            return;
        }

        // Save query
        if (matchShortcut(e, 'save-query')) {
            e.preventDefault();
            if (typeof saveQuery === 'function') saveQuery();
            return;
        }

        // Load query
        if (matchShortcut(e, 'load-query')) {
            e.preventDefault();
            if (typeof loadQuery === 'function') loadQuery();
            return;
        }

        // Refresh data
        if (matchShortcut(e, 'refresh-data')) {
            e.preventDefault();
            if (typeof refreshDataView === 'function') refreshDataView();
            return;
        }

        // AI explain
        if (matchShortcut(e, 'ai-explain')) {
            e.preventDefault();
            if (typeof aiExplainSQL === 'function') aiExplainSQL();
            return;
        }

        // AI optimize
        if (matchShortcut(e, 'ai-optimize')) {
            e.preventDefault();
            if (typeof aiOptimizeSQL === 'function') aiOptimizeSQL();
            return;
        }

        // AI NL2SQL
        if (matchShortcut(e, 'ai-nl2sql')) {
            e.preventDefault();
            if (typeof openNL2SQLDialog === 'function') openNL2SQLDialog();
            return;
        }

        // Open settings
        if (matchShortcut(e, 'open-settings')) {
            e.preventDefault();
            if (typeof openSettings === 'function') openSettings();
            return;
        }

        // Open perf
        if (matchShortcut(e, 'open-perf')) {
            e.preventDefault();
            if (typeof openPerfPanel === 'function') openPerfPanel();
            return;
        }

        // Open history
        if (matchShortcut(e, 'open-history')) {
            e.preventDefault();
            if (typeof openHistoryPanel === 'function') openHistoryPanel();
            return;
        }

        // Open git
        if (matchShortcut(e, 'open-git')) {
            e.preventDefault();
            if (typeof openGitPanel === 'function') openGitPanel();
            return;
        }

        // Open report
        if (matchShortcut(e, 'open-report')) {
            e.preventDefault();
            if (typeof openReportPanel === 'function') openReportPanel();
            return;
        }

        // Escape
        if (matchShortcut(e, 'escape')) {
            const connectionModal = document.getElementById('connectionModal');
            const settingsModal = document.getElementById('settingsModal');
            const languageModal = document.getElementById('languageModal');
            if (connectionModal?.classList.contains('active')) closeConnectionDialog();
            if (settingsModal?.classList.contains('active')) closeSettings();
            if (languageModal?.classList.contains('active')) closeLanguageDialog();
            return;
        }
    });
}

function getShortcutList() {
    const list = [];
    for (const [action, sc] of Object.entries(DefaultShortcuts)) {
        const current = getShortcut(action);
        list.push({
            action: action,
            key: current.key,
            ctrl: current.ctrl,
            shift: current.shift,
            alt: current.alt,
            desc: current.desc,
            isCustom: !!customShortcuts[action],
        });
    }
    return list;
}

function formatShortcut(sc) {
    let parts = [];
    if (sc.ctrl) parts.push('Ctrl');
    if (sc.shift) parts.push('Shift');
    if (sc.alt) parts.push('Alt');
    parts.push(sc.key);
    return parts.join('+');
}

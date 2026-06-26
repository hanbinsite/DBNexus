// DBNexus — Accessibility Module (TypeScript)

export function initAccessibility(): void {
    labelUnlabeledElements();
    enhanceTableKeyboardNav();
    enhanceModalFocus();
    addSkipToContent();
}

function labelUnlabeledElements(): void {
    document.querySelectorAll('button:not([aria-label]):not([title])').forEach(btn => {
        const svg = btn.querySelector('svg');
        if (svg && !btn.textContent?.trim()) {
            const path = svg.querySelector('path');
            if (path) {
                const d = path.getAttribute('d') || '';
                let label = '按钮';
                if (d.includes('M18 6 6 18')) label = '关闭';
                else if (d.includes('M5 12h14')) label = '展开';
                else if (d.includes('M12 5v14')) label = '添加';
                else if (d.includes('M21 21l-6-6m2-5a7')) label = '搜索';
                btn.setAttribute('aria-label', label);
            }
        }
    });
    document.querySelectorAll('.tree-item').forEach(item => {
        item.setAttribute('role', 'treeitem');
        item.setAttribute('tabindex', '0');
    });
    document.querySelectorAll('#databasesTree, #connectionList').forEach(container => {
        container.setAttribute('role', 'tree');
        container.setAttribute('aria-label', container.id === 'connectionList' ? '连接列表' : '数据库树');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('tabindex', '0');
    });
    const tabBar = document.getElementById('tabBar');
    if (tabBar) tabBar.setAttribute('role', 'tablist');
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
    });
}

function enhanceTableKeyboardNav(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'TD' && !target.closest('td')) return;
        const td = target.tagName === 'TD' ? target : target.closest('td') as HTMLElement;
        const tr = td.closest('tr');
        const table = td.closest('table');
        if (!tr || !table) return;
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const currentRowIdx = rows.indexOf(tr);
        const cells = Array.from(tr.querySelectorAll('td'));
        const currentCellIdx = cells.indexOf(td);
        switch (e.key) {
            case 'ArrowDown': if (currentRowIdx < rows.length - 1) { e.preventDefault(); (rows[currentRowIdx + 1].querySelectorAll('td')[currentCellIdx] as HTMLElement)?.focus(); } break;
            case 'ArrowUp': if (currentRowIdx > 0) { e.preventDefault(); (rows[currentRowIdx - 1].querySelectorAll('td')[currentCellIdx] as HTMLElement)?.focus(); } break;
            case 'ArrowRight': if (currentCellIdx < cells.length - 1) { e.preventDefault(); (cells[currentCellIdx + 1] as HTMLElement).focus(); } break;
            case 'ArrowLeft': if (currentCellIdx > 0) { e.preventDefault(); (cells[currentCellIdx - 1] as HTMLElement).focus(); } break;
            case 'Home': e.preventDefault(); (cells[0] as HTMLElement)?.focus(); break;
            case 'End': e.preventDefault(); (cells[cells.length - 1] as HTMLElement)?.focus(); break;
        }
    });
    document.querySelectorAll('.dv-table td, .results-table td').forEach(td => {
        if (!td.hasAttribute('tabindex')) td.setAttribute('tabindex', '0');
    });
}

function enhanceModalFocus(): void {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        const focusable = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const focusableArr = Array.from(focusable) as HTMLElement[];
        modal.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || focusableArr.length === 0) return;
            const first = focusableArr[0];
            const last = focusableArr[focusableArr.length - 1];
            if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
            else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
        });
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('active') && focusableArr.length > 0) {
                setTimeout(() => focusableArr[0].focus(), 100);
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
}

function addSkipToContent(): void {
    const skipLink = document.createElement('a');
    skipLink.href = '#editorPanel';
    skipLink.className = 'skip-to-content';
    skipLink.textContent = '跳转到内容';
    skipLink.style.cssText = 'position:absolute;top:-40px;left:0;background:var(--accent-primary);color:#fff;padding:8px 16px;text-decoration:none;border-radius:0 0 var(--radius-md) 0;z-index:10000;transition:top 0.2s;';
    skipLink.addEventListener('focus', () => { skipLink.style.top = '0'; });
    skipLink.addEventListener('blur', () => { skipLink.style.top = '-40px'; });
    document.body.insertBefore(skipLink, document.body.firstChild);
}

export function announce(message: string): void {
    const live = document.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
    live.textContent = message;
    document.body.appendChild(live);
    setTimeout(() => live.remove(), 1000);
}

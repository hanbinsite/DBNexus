"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initResizablePanels = initResizablePanels;
function initResizablePanels() {
    const sidebarResize = document.getElementById('sidebarResize');
    const sidebar = document.querySelector('.sidebar');
    const splitHandle = document.getElementById('splitHandle');
    const editorPanel = document.getElementById('editorPanel');
    const resultsPanel = document.getElementById('resultsPanel');
    if (sidebarResize && sidebar) {
        sidebarResize.addEventListener('mousedown', () => {
            state.isResizing = true;
            sidebarResize.classList.add('active');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    }
    if (splitHandle && editorPanel && resultsPanel) {
        splitHandle.addEventListener('mousedown', () => {
            state.isResizing = true;
            splitHandle.classList.add('active');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });
    }
    document.addEventListener('mousemove', (e) => {
        if (!state.isResizing)
            return;
        if (sidebarResize && sidebarResize.classList.contains('active') && sidebar) {
            const newWidth = e.clientX;
            if (newWidth >= 180 && newWidth <= 400) {
                sidebar.style.width = newWidth + 'px';
            }
        }
        if (splitHandle && splitHandle.classList.contains('active') && editorPanel && resultsPanel) {
            const workspace = document.querySelector('.workspace');
            if (!workspace)
                return;
            const workspaceRect = workspace.getBoundingClientRect();
            const relativeY = e.clientY - workspaceRect.top;
            const totalHeight = workspaceRect.height;
            const editorHeight = Math.max(100, Math.min(relativeY - 30, totalHeight - 120));
            const resultsHeight = totalHeight - editorHeight - 6;
            editorPanel.style.height = editorHeight + 'px';
            editorPanel.style.flex = 'none';
            resultsPanel.style.height = resultsHeight + 'px';
            resultsPanel.style.flex = 'none';
            if (monacoEditor)
                monacoEditor.layout();
        }
    });
    document.addEventListener('mouseup', () => {
        if (state.isResizing) {
            state.isResizing = false;
            sidebarResize?.classList.remove('active');
            splitHandle?.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

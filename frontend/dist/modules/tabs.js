/**
 * Tab Management Module
 * Handles query tab creation, activation, and closing
 */

function initTabs() {
    const tabBar = document.getElementById('tabBar');
    tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab && !e.target.closest('.tab-close')) {
            activateTab(tab.dataset.tab);
        }
    });
}

function createNewTab() {
  const tabNumber = document.querySelectorAll('.tab[data-type="query"]').length + 1;
  const tabId = `query-${tabNumber}`;

  const tabDiv = document.createElement('div');
  tabDiv.className = 'tab';
  tabDiv.dataset.tab = tabId;
  tabDiv.dataset.type = 'query';

  tabDiv.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6M12 18v-6M9 15h6"/>
    </svg>
    <span class="tab-name"></span>
    <button class="tab-close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

  tabDiv.querySelector('.tab-name').textContent = `查询 ${tabNumber}`;
  tabDiv.querySelector('.tab-close').addEventListener('click', (e) => closeTab(tabId, e));

  document.getElementById('tabsContainer').appendChild(tabDiv);
  activateTab(tabId);

  const welcomePanel = document.getElementById('welcomePanel');
  if (welcomePanel) welcomePanel.style.display = 'none';

  const editorPanel = document.getElementById('editorPanel');
  const resultsPanel = document.getElementById('resultsPanel');
  const splitHandle = document.getElementById('splitHandle');
  const dataViewPanel = document.getElementById('dataViewPanel');

  editorPanel.style.display = 'flex';
  editorPanel.style.flex = '1';
  editorPanel.style.height = '100%';
  resultsPanel.style.display = 'none';
  splitHandle.style.display = 'none';
  dataViewPanel.style.display = 'none';

  const layoutAndFocus = () => {
    if (!monacoEditor) return;
    monacoEditor.layout();
    const model = monacoEditor.getModel();
    if (model) {
      monacoEditor.setValue(model.getValue());
    }
    monacoEditor.focus();
  };

  setTimeout(layoutAndFocus, 100);
  setTimeout(layoutAndFocus, 300);
}

function activateTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (tab) tab.classList.add('active');
  state.activeTab = tabId;

  const tabType = tab ? tab.dataset.type : 'query';

  const welcomePanel = document.getElementById('welcomePanel');
  const editorPanel = document.getElementById('editorPanel');
  const resultsPanel = document.getElementById('resultsPanel');
  const splitHandle = document.getElementById('splitHandle');
  const dataViewPanel = document.getElementById('dataViewPanel');

  if (tabType === 'query') {
    if (welcomePanel) welcomePanel.style.display = 'none';
    editorPanel.style.display = 'flex';
    editorPanel.style.flex = '1';
    editorPanel.style.height = 'auto';
    resultsPanel.style.display = 'none';
    splitHandle.style.display = 'none';
    dataViewPanel.style.display = 'none';
    setTimeout(() => { if (monacoEditor) { monacoEditor.layout(); monacoEditor.focus(); } }, 150);
  } else if (tabType === 'table') {
    if (welcomePanel) welcomePanel.style.display = 'none';
    editorPanel.style.display = 'none';
    resultsPanel.style.display = 'none';
    splitHandle.style.display = 'none';
    dataViewPanel.style.display = 'flex';
  }
}

function closeTab(tabId, event) {
  if (event) event.stopPropagation();
  const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (!tab) return;
  const wasActive = tab.classList.contains('active');
  tab.remove();
  if (wasActive) {
    const remaining = document.querySelectorAll('.tab');
    if (remaining.length > 0) {
      activateTab(remaining[remaining.length - 1].dataset.tab);
    } else {
      state.activeTab = null;
      const welcomePanel = document.getElementById('welcomePanel');
      if (welcomePanel) welcomePanel.style.display = 'flex';
      const editorPanel = document.getElementById('editorPanel');
      const resultsPanel = document.getElementById('resultsPanel');
      const splitHandle = document.getElementById('splitHandle');
      const dataViewPanel = document.getElementById('dataViewPanel');
      if (editorPanel) editorPanel.style.display = 'none';
      if (resultsPanel) resultsPanel.style.display = 'none';
      if (splitHandle) splitHandle.style.display = 'none';
      if (dataViewPanel) dataViewPanel.style.display = 'none';
    }
  }
}

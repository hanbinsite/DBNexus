/**
 * Theme Management Module
 * Handles dark/light theme switching and density settings
 */

function initTheme() {
    const savedTheme = localStorage.getItem('dbnexus-theme') || 'dark';
    setTheme(savedTheme);
}

function toggleTheme() {
    const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
  state.currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('dbnexus-theme', theme);

  const themeSelect = document.getElementById('appearanceTheme');
  if (themeSelect) {
    themeSelect.value = theme;
  }

  // Update Monaco editor theme
  updateEditorTheme(theme);
}

function setThemeFromSettings(value) {
    if (value === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    } else {
        setTheme(value);
    }
}

function setDensity(value) {
    document.documentElement.setAttribute('data-density', value);
    localStorage.setItem('density', value);
}

function formatSQLViaAPI() {
    if (!monacoEditor) return;
    const sql = getEditorValue().trim();
    if (!sql) return;
    if (isWailsAvailable()) {
        WailsAPI.beautifySQL(sql).then(formatted => {
            if (formatted) setEditorValue(formatted);
        }).catch(() => {});
    } else {
        formatSQL();
    }
}

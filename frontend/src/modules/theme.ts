// DBNexus — Theme Management Module (TypeScript)

export function initTheme(): void {
    const savedTheme = localStorage.getItem('dbnexus-theme') || 'dark';
    setTheme(savedTheme as 'dark' | 'light');
}

export function toggleTheme(): void {
    const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

export function setTheme(theme: 'dark' | 'light'): void {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dbnexus-theme', theme);

    const themeSelect = document.getElementById('appearanceTheme') as HTMLSelectElement | null;
    if (themeSelect) {
        themeSelect.value = theme;
    }

    updateEditorTheme(theme);
}

export function setThemeFromSettings(value: string): void {
    if (value === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    } else {
        setTheme(value as 'dark' | 'light');
    }
}

export function setDensity(value: string): void {
    document.documentElement.setAttribute('data-density', value);
    localStorage.setItem('density', value);
}

export function formatSQLViaAPI(): void {
    if (!monacoEditor) return;
    const sql = getEditorValue().trim();
    if (!sql) return;
    if (isWailsAvailable()) {
        WailsAPI.beautifySQL(sql).then((formatted: string) => {
            if (formatted) setEditorValue(formatted);
        }).catch(() => {});
    } else {
        formatSQL();
    }
}

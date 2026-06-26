// DBNexus — Window Controls Module (TypeScript)

export function initWindowControls(): void {
    if (isWailsAvailable()) {
        WailsAPI.windowIsMaximized().then((isMaximized: boolean) => {
            updateMaximizeIcon(isMaximized);
        });
    }

    const resizeHandles = [
        { id: 'resizeTL', dir: 'top-left' },
        { id: 'resizeT', dir: 'top' },
        { id: 'resizeTR', dir: 'top-right' },
        { id: 'resizeL', dir: 'left' },
        { id: 'resizeR', dir: 'right' },
        { id: 'resizeB', dir: 'bottom' },
        { id: 'resizeBL', dir: 'bottom-left' },
        { id: 'resizeBR', dir: 'bottom-right' },
    ];

    resizeHandles.forEach(({ id, dir }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('mousedown', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (isWailsAvailable() && WailsAPI.windowSetSize) {
                startWindowResize(dir, e);
            }
        });
    });
}

let resizeInterval: ReturnType<typeof setInterval> | null = null;

function startWindowResize(dir: string, e: MouseEvent): void {
    document.body.style.userSelect = 'none';
    document.body.style.cursor = getResizeCursor(dir);

    const onMouseMove = (ev: MouseEvent) => {};
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        if (resizeInterval) { clearInterval(resizeInterval); resizeInterval = null; }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function getResizeCursor(dir: string): string {
    const cursors: Record<string, string> = {
        'top-left': 'nwse-resize',
        'top': 'ns-resize',
        'top-right': 'nesw-resize',
        'left': 'ew-resize',
        'right': 'ew-resize',
        'bottom': 'ns-resize',
        'bottom-left': 'nesw-resize',
        'bottom-right': 'nwse-resize',
    };
    return cursors[dir] || 'default';
}

export async function minimizeWindow(): Promise<void> {
    try {
        if (isWailsAvailable()) await WailsAPI.windowMinimize();
    } catch (e) { console.warn('Window minimize error:', e); }
}

export async function maximizeWindow(): Promise<void> {
    try {
        if (isWailsAvailable()) {
            await WailsAPI.windowMaximize();
            const isMaximized = await WailsAPI.windowIsMaximized();
            updateMaximizeIcon(isMaximized);
        }
    } catch (e) { console.warn('Window maximize error:', e); }
}

export function updateMaximizeIcon(isMaximized: boolean): void {
    const btn = document.getElementById('maximizeBtn');
    if (!btn) return;
    const maximizeIcon = btn.querySelector('.maximize-icon') as HTMLElement | null;
    const restoreIcon = btn.querySelector('.restore-icon') as HTMLElement | null;
    if (isMaximized) {
        if (maximizeIcon) maximizeIcon.style.display = 'none';
        if (restoreIcon) restoreIcon.style.display = 'block';
        btn.title = '还原';
    } else {
        if (maximizeIcon) maximizeIcon.style.display = 'block';
        if (restoreIcon) restoreIcon.style.display = 'none';
        btn.title = '最大化';
    }
}

export async function closeWindow(): Promise<void> {
    if (isWailsAvailable()) await WailsAPI.windowClose();
}

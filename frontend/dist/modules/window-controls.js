/**
 * Window Controls Module
 * Handles window minimize/maximize/close and resize handles
 */

function initWindowControls() {
    if (isWailsAvailable()) {
        WailsAPI.windowIsMaximized().then(isMaximized => {
            updateMaximizeIcon(isMaximized);
        });
    }

    const resizeHandles = [
        { id: 'resizeTL', dir: 'top-left' },
        { id: 'resizeT',  dir: 'top' },
        { id: 'resizeTR', dir: 'top-right' },
        { id: 'resizeL',  dir: 'left' },
        { id: 'resizeR',  dir: 'right' },
        { id: 'resizeB',  dir: 'bottom' },
        { id: 'resizeBL', dir: 'bottom-left' },
        { id: 'resizeBR', dir: 'bottom-right' },
    ];

    resizeHandles.forEach(({ id, dir }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isWailsAvailable() && WailsAPI.windowSetSize) {
                startWindowResize(dir, e);
            }
        });
    });
}

let resizeInterval = null;
function startWindowResize(dir, e) {
    const startX = e.screenX;
    const startY = e.screenY;

    if (resizeInterval) clearInterval(resizeInterval);

    let lastX = startX, lastY = startY;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = getResizeCursor(dir);

    const onMouseMove = (ev) => {
        lastX = ev.screenX;
        lastY = ev.screenY;
    };
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

function getResizeCursor(dir) {
    const cursors = {
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

async function minimizeWindow() {
  try {
    if (isWailsAvailable()) {
      await WailsAPI.windowMinimize();
    }
  } catch (e) {
    console.warn('Window minimize error:', e);
  }
}

async function maximizeWindow() {
  try {
    if (isWailsAvailable()) {
      await WailsAPI.windowMaximize();
      const isMaximized = await WailsAPI.windowIsMaximized();
      updateMaximizeIcon(isMaximized);
    }
  } catch (e) {
    console.warn('Window maximize error:', e);
  }
}

function updateMaximizeIcon(isMaximized) {
    const btn = document.getElementById('maximizeBtn');
    if (!btn) return;
    const maximizeIcon = btn.querySelector('.maximize-icon');
    const restoreIcon = btn.querySelector('.restore-icon');
    if (isMaximized) {
        maximizeIcon.style.display = 'none';
        restoreIcon.style.display = 'block';
        btn.title = '还原';
    } else {
        maximizeIcon.style.display = 'block';
        restoreIcon.style.display = 'none';
        btn.title = '最大化';
    }
}

async function closeWindow() {
    if (isWailsAvailable()) {
        await WailsAPI.windowClose();
    }
}

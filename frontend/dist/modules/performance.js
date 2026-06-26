/**
 * Performance Module — Virtual Scrolling + Streaming Render + Debounce
 */

// Streaming table renderer for large datasets
class StreamingTableRenderer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.rowHeight = options.rowHeight || 32;
        this.visibleRows = options.visibleRows || 50;
        this.bufferRows = options.bufferRows || 10;
        this.columns = [];
        this.allData = [];
        this.scrollTop = 0;
        this.renderedRange = { start: 0, end: 0 };
        this.onRowClick = options.onRowClick || null;
        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.style.overflowY = 'auto';
        this.container.style.position = 'relative';

        // Spacer for total height
        this.spacerTop = document.createElement('div');
        this.spacerTop.style.height = '0px';
        this.container.appendChild(this.spacerTop);

        this.tableBody = document.createElement('div');
        this.container.appendChild(this.tableBody);

        this.spacerBottom = document.createElement('div');
        this.spacerBottom.style.height = '0px';
        this.container.appendChild(this.spacerBottom);

        // Scroll listener with requestAnimationFrame throttle
        let ticking = false;
        this.container.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.onScroll();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    setData(columns, data) {
        this.columns = columns;
        this.allData = data;
        const totalHeight = data.length * this.rowHeight;
        this.spacerTop.style.height = '0px';
        this.spacerBottom.style.height = totalHeight + 'px';
        this.renderRows();
    }

    onScroll() {
        this.scrollTop = this.container.scrollTop;
        this.renderRows();
    }

    renderRows() {
        const totalRows = this.allData.length;
        if (totalRows === 0) return;

        const firstVisible = Math.floor(this.scrollTop / this.rowHeight);
        const start = Math.max(0, firstVisible - this.bufferRows);
        const end = Math.min(totalRows, firstVisible + this.visibleRows + this.bufferRows);

        // Only re-render if range changed significantly
        if (Math.abs(start - this.renderedRange.start) < this.bufferRows / 2 &&
            this.renderedRange.end === end) return;

        this.renderedRange = { start, end };

        // Update spacers
        this.spacerTop.style.height = (start * this.rowHeight) + 'px';
        this.spacerBottom.style.height = ((totalRows - end) * this.rowHeight) + 'px';

        // Render visible rows
        const table = document.createElement('table');
        table.className = 'streaming-table';
        table.style.tableLayout = 'fixed';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        this.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            th.style.position = 'sticky';
            th.style.top = '0';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        for (let i = start; i < end; i++) {
            const row = this.allData[i];
            const tr = document.createElement('tr');
            tr.style.height = this.rowHeight + 'px';
            tr.dataset.rowIndex = i;

            for (let j = 0; j < this.columns.length; j++) {
                const td = document.createElement('td');
                const val = row[j];
                if (val === null || val === undefined) {
                    td.innerHTML = '<span style="color:var(--fg-muted)">NULL</span>';
                } else if (typeof val === 'object') {
                    td.textContent = JSON.stringify(val).substring(0, 100);
                } else {
                    td.textContent = String(val);
                }
                tr.appendChild(td);
            }

            if (this.onRowClick) {
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => this.onRowClick(i, row));
            }

            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        // Replace table body content
        this.tableBody.innerHTML = '';
        this.tableBody.appendChild(table);
    }

    appendData(newData) {
        const oldLen = this.allData.length;
        this.allData = this.allData.concat(newData);
        const totalHeight = this.allData.length * this.rowHeight;
        this.spacerBottom.style.height = totalHeight + 'px';
        // Re-render if new data is in visible range
        if (oldLen < this.renderedRange.end) {
            this.renderRows();
        }
    }

    clear() {
        this.allData = [];
        this.columns = [];
        this.spacerTop.style.height = '0px';
        this.spacerBottom.style.height = '0px';
        this.tableBody.innerHTML = '';
        this.renderedRange = { start: 0, end: 0 };
    }

    getStats() {
        return {
            totalRows: this.allData.length,
            renderedRows: this.renderedRange.end - this.renderedRange.start,
            scrollTop: this.scrollTop,
        };
    }
}

// Debounce utility for search inputs
function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Throttle utility for scroll/resize events
function throttle(fn, limit = 16) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// RequestIdleCallback wrapper for non-urgent work
function runIdle(fn) {
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(fn);
    } else {
        setTimeout(fn, 50);
    }
}

// Batch DOM updates to avoid layout thrashing
function batchDOMUpdates(updates) {
    const fragment = document.createDocumentFragment();
    updates.forEach(update => {
        if (typeof update === 'function') {
            update(fragment);
        }
    });
    return fragment;
}

// Lazy load module script
function lazyLoadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Performance monitor
class PerfMonitor {
    constructor() {
        this.marks = {};
        this.measures = {};
    }

    mark(name) {
        this.marks[name] = performance.now();
    }

    measure(name, startMark, endMark) {
        const start = this.marks[startMark];
        const end = this.marks[endMark] || performance.now();
        if (start) {
            this.measures[name] = end - start;
            return this.measures[name];
        }
        return 0;
    }

    getMeasures() {
        return { ...this.measures };
    }

    clear() {
        this.marks = {};
        this.measures = {};
    }
}

const perfMonitor = new PerfMonitor();

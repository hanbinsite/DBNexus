"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.perfMonitor = exports.PerfMonitor = exports.StreamingTableRenderer = void 0;
exports.debounce = debounce;
exports.throttle = throttle;
exports.runIdle = runIdle;
class StreamingTableRenderer {
    constructor(containerId, options = {}) {
        this.columns = [];
        this.allData = [];
        this.scrollTop = 0;
        this.renderedRange = { start: 0, end: 0 };
        this.container = document.getElementById(containerId);
        if (!this.container) {
            this.spacerTop = {};
            this.tableBody = {};
            this.spacerBottom = {};
            return;
        }
        this.rowHeight = options.rowHeight || 32;
        this.visibleRows = options.visibleRows || 50;
        this.bufferRows = options.bufferRows || 10;
        this.onRowClick = options.onRowClick || null;
        this.init();
    }
    init() {
        if (!this.container)
            return;
        this.container.innerHTML = '';
        this.container.style.overflowY = 'auto';
        this.container.style.position = 'relative';
        this.spacerTop = document.createElement('div');
        this.spacerTop.style.height = '0px';
        this.container.appendChild(this.spacerTop);
        this.tableBody = document.createElement('div');
        this.container.appendChild(this.tableBody);
        this.spacerBottom = document.createElement('div');
        this.spacerBottom.style.height = '0px';
        this.container.appendChild(this.spacerBottom);
        let ticking = false;
        this.container.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => { this.onScroll(); ticking = false; });
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
        if (!this.container)
            return;
        this.scrollTop = this.container.scrollTop;
        this.renderRows();
    }
    renderRows() {
        const totalRows = this.allData.length;
        if (totalRows === 0)
            return;
        const firstVisible = Math.floor(this.scrollTop / this.rowHeight);
        const start = Math.max(0, firstVisible - this.bufferRows);
        const end = Math.min(totalRows, firstVisible + this.visibleRows + this.bufferRows);
        if (Math.abs(start - this.renderedRange.start) < this.bufferRows / 2 && this.renderedRange.end === end)
            return;
        this.renderedRange = { start, end };
        this.spacerTop.style.height = (start * this.rowHeight) + 'px';
        this.spacerBottom.style.height = ((totalRows - end) * this.rowHeight) + 'px';
        const table = document.createElement('table');
        table.className = 'streaming-table';
        table.style.tableLayout = 'fixed';
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
        const tbody = document.createElement('tbody');
        for (let i = start; i < end; i++) {
            const row = this.allData[i];
            const tr = document.createElement('tr');
            tr.style.height = this.rowHeight + 'px';
            tr.dataset.rowIndex = String(i);
            for (let j = 0; j < this.columns.length; j++) {
                const td = document.createElement('td');
                const val = row[j];
                if (val === null || val === undefined) {
                    td.innerHTML = '<span style="color:var(--fg-muted)">NULL</span>';
                }
                else if (typeof val === 'object') {
                    td.textContent = JSON.stringify(val).substring(0, 100);
                }
                else {
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
        this.tableBody.innerHTML = '';
        this.tableBody.appendChild(table);
    }
    appendData(newData) {
        const oldLen = this.allData.length;
        this.allData = this.allData.concat(newData);
        this.spacerBottom.style.height = (this.allData.length * this.rowHeight) + 'px';
        if (oldLen < this.renderedRange.end)
            this.renderRows();
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
        return { totalRows: this.allData.length, renderedRows: this.renderedRange.end - this.renderedRange.start, scrollTop: this.scrollTop };
    }
}
exports.StreamingTableRenderer = StreamingTableRenderer;
function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
function throttle(fn, limit = 16) {
    let inThrottle = false;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
function runIdle(fn) {
    if (typeof requestIdleCallback !== 'undefined')
        requestIdleCallback(fn);
    else
        setTimeout(fn, 50);
}
class PerfMonitor {
    constructor() {
        this.marks = {};
        this.measures = {};
    }
    mark(name) { this.marks[name] = performance.now(); }
    measure(name, startMark, endMark) {
        const start = this.marks[startMark];
        const end = endMark ? this.marks[endMark] : performance.now();
        if (start) {
            this.measures[name] = end - start;
            return this.measures[name];
        }
        return 0;
    }
    getMeasures() { return { ...this.measures }; }
    clear() { this.marks = {}; this.measures = {}; }
}
exports.PerfMonitor = PerfMonitor;
exports.perfMonitor = new PerfMonitor();

// DBNexus — Performance Module (TypeScript)

export class StreamingTableRenderer {
    private container: HTMLElement | null;
    private rowHeight: number;
    private visibleRows: number;
    private bufferRows: number;
    private columns: string[] = [];
    private allData: any[][] = [];
    private scrollTop: number = 0;
    private renderedRange = { start: 0, end: 0 };
    private onRowClick: ((index: number, row: any[]) => void) | null;
    private spacerTop: HTMLElement;
    private tableBody: HTMLElement;
    private spacerBottom: HTMLElement;

    constructor(containerId: string, options: { rowHeight?: number; visibleRows?: number; bufferRows?: number; onRowClick?: (index: number, row: any[]) => void } = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) { this.spacerTop = {} as HTMLElement; this.tableBody = {} as HTMLElement; this.spacerBottom = {} as HTMLElement; return; }
        this.rowHeight = options.rowHeight || 32;
        this.visibleRows = options.visibleRows || 50;
        this.bufferRows = options.bufferRows || 10;
        this.onRowClick = options.onRowClick || null;
        this.init();
    }

    private init(): void {
        if (!this.container) return;
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
            if (!ticking) { requestAnimationFrame(() => { this.onScroll(); ticking = false; }); ticking = true; }
        });
    }

    setData(columns: string[], data: any[][]): void {
        this.columns = columns;
        this.allData = data;
        const totalHeight = data.length * this.rowHeight;
        this.spacerTop.style.height = '0px';
        this.spacerBottom.style.height = totalHeight + 'px';
        this.renderRows();
    }

    private onScroll(): void {
        if (!this.container) return;
        this.scrollTop = this.container.scrollTop;
        this.renderRows();
    }

    private renderRows(): void {
        const totalRows = this.allData.length;
        if (totalRows === 0) return;
        const firstVisible = Math.floor(this.scrollTop / this.rowHeight);
        const start = Math.max(0, firstVisible - this.bufferRows);
        const end = Math.min(totalRows, firstVisible + this.visibleRows + this.bufferRows);
        if (Math.abs(start - this.renderedRange.start) < this.bufferRows / 2 && this.renderedRange.end === end) return;
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
                } else if (typeof val === 'object') {
                    td.textContent = JSON.stringify(val).substring(0, 100);
                } else {
                    td.textContent = String(val);
                }
                tr.appendChild(td);
            }
            if (this.onRowClick) {
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => this.onRowClick!(i, row));
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        this.tableBody.innerHTML = '';
        this.tableBody.appendChild(table);
    }

    appendData(newData: any[][]): void {
        const oldLen = this.allData.length;
        this.allData = this.allData.concat(newData);
        this.spacerBottom.style.height = (this.allData.length * this.rowHeight) + 'px';
        if (oldLen < this.renderedRange.end) this.renderRows();
    }

    clear(): void {
        this.allData = [];
        this.columns = [];
        this.spacerTop.style.height = '0px';
        this.spacerBottom.style.height = '0px';
        this.tableBody.innerHTML = '';
        this.renderedRange = { start: 0, end: 0 };
    }

    getStats(): { totalRows: number; renderedRows: number; scrollTop: number } {
        return { totalRows: this.allData.length, renderedRows: this.renderedRange.end - this.renderedRange.start, scrollTop: this.scrollTop };
    }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number = 300): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function(this: any, ...args: Parameters<T>) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function throttle<T extends (...args: any[]) => void>(fn: T, limit: number = 16): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return function(this: any, ...args: Parameters<T>) {
        if (!inThrottle) { fn.apply(this, args); inThrottle = true; setTimeout(() => inThrottle = false, limit); }
    };
}

export function runIdle(fn: () => void): void {
    if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(fn);
    else setTimeout(fn, 50);
}

export class PerfMonitor {
    private marks: Record<string, number> = {};
    private measures: Record<string, number> = {};

    mark(name: string): void { this.marks[name] = performance.now(); }
    measure(name: string, startMark: string, endMark?: string): number {
        const start = this.marks[startMark];
        const end = endMark ? this.marks[endMark] : performance.now();
        if (start) { this.measures[name] = end - start; return this.measures[name]; }
        return 0;
    }
    getMeasures(): Record<string, number> { return { ...this.measures }; }
    clear(): void { this.marks = {}; this.measures = {}; }
}

export const perfMonitor = new PerfMonitor();

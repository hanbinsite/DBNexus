// DBNexus — DOM Utilities Module (TypeScript)

export class DomUtilsClass {
    static escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    static createElement(tag: string, props?: Record<string, any>, children?: Node[]): HTMLElement {
        const el = document.createElement(tag);
        if (props) {
            for (const [key, value] of Object.entries(props)) {
                if (key === 'className') {
                    el.className = value as string;
                } else if (key === 'style' && typeof value === 'object') {
                    Object.assign(el.style, value);
                } else if (key.startsWith('on') && typeof value === 'function') {
                    el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
                } else if (key === 'dataset' && typeof value === 'object') {
                    Object.assign(el.dataset, value);
                } else {
                    el.setAttribute(key, String(value));
                }
            }
        }
        if (children) {
            children.forEach(child => el.appendChild(child));
        }
        return el;
    }

    static debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
        let timer: ReturnType<typeof setTimeout> | null = null;
        return function(this: any, ...args: Parameters<T>) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    static throttle<T extends (...args: any[]) => void>(fn: T, limit: number): (...args: Parameters<T>) => void {
        let inThrottle = false;
        return function(this: any, ...args: Parameters<T>) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static $(selector: string, parent?: ParentNode): HTMLElement | null {
        return (parent || document).querySelector(selector);
    }

    static $$(selector: string, parent?: ParentNode): HTMLElement[] {
        return Array.from((parent || document).querySelectorAll(selector));
    }
}

// Global assignment for backward compatibility
declare global {
    const DomUtils: typeof DomUtilsClass;
}

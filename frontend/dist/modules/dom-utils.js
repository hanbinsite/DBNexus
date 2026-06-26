"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomUtilsClass = void 0;
class DomUtilsClass {
    static escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    static createElement(tag, props, children) {
        const el = document.createElement(tag);
        if (props) {
            for (const [key, value] of Object.entries(props)) {
                if (key === 'className') {
                    el.className = value;
                }
                else if (key === 'style' && typeof value === 'object') {
                    Object.assign(el.style, value);
                }
                else if (key.startsWith('on') && typeof value === 'function') {
                    el.addEventListener(key.slice(2).toLowerCase(), value);
                }
                else if (key === 'dataset' && typeof value === 'object') {
                    Object.assign(el.dataset, value);
                }
                else {
                    el.setAttribute(key, String(value));
                }
            }
        }
        if (children) {
            children.forEach(child => el.appendChild(child));
        }
        return el;
    }
    static debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
    static throttle(fn, limit) {
        let inThrottle = false;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    static $(selector, parent) {
        return (parent || document).querySelector(selector);
    }
    static $$(selector, parent) {
        return Array.from((parent || document).querySelectorAll(selector));
    }
}
exports.DomUtilsClass = DomUtilsClass;

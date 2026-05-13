const DomUtils = {
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    setText(element, text) {
        if (element) {
            element.textContent = text === null || text === undefined ? '' : String(text);
        }
    },

    setHtml(element, html) {
        if (element) {
            element.innerHTML = DomUtils.sanitizeHtml(html);
        }
    },

    sanitizeHtml(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const scripts = temp.querySelectorAll('script, iframe, object, embed, link[rel="import"]');
        scripts.forEach(el => el.remove());
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return temp.innerHTML;
    },

    createElement(tag, attrs, children) {
        const el = document.createElement(tag);
        if (attrs) {
            Object.entries(attrs).forEach(([key, value]) => {
                if (key === 'className') {
                    el.className = value;
                } else if (key === 'textContent') {
                    el.textContent = value;
                } else if (key === 'style' && typeof value === 'object') {
                    Object.assign(el.style, value);
                } else if (key.startsWith('data-')) {
                    el.setAttribute(key, value);
                } else {
                    el.setAttribute(key, value);
                }
            });
        }
        if (children) {
            if (typeof children === 'string') {
                el.textContent = children;
            } else if (Array.isArray(children)) {
                children.forEach(child => {
                    if (typeof child === 'string') {
                        el.appendChild(document.createTextNode(child));
                    } else if (child instanceof HTMLElement) {
                        el.appendChild(child);
                    }
                });
            } else if (children instanceof HTMLElement) {
                el.appendChild(children);
            }
        }
        return el;
    },

    createOption(value, text) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        return opt;
    },

    createTableRow(cells, isHeader) {
        const tr = document.createElement('tr');
        cells.forEach(cell => {
            const td = document.createElement(isHeader ? 'th' : 'td');
            if (typeof cell === 'string') {
                td.textContent = cell;
            } else if (typeof cell === 'object' && cell !== null) {
                if (cell.content) td.textContent = String(cell.content);
                if (cell.className) td.className = cell.className;
                if (cell.attrs) {
                    Object.entries(cell.attrs).forEach(([k, v]) => td.setAttribute(k, v));
                }
            }
            tr.appendChild(td);
        });
        return tr;
    }
};
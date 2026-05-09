# U01 - UI 设计系统

> 基于 `frontend/dist/styles.css` (3352 行) 实际 CSS 分析。所有值均来自源码，非理论设定。

---

## 1. 设计令牌 (Design Tokens)

### 1.1 颜色系统 (Color System)

所有颜色通过 CSS Custom Properties 定义，按 `data-theme` 属性切换。

#### Dark Theme (`[data-theme="dark"]`)

styles.css:47-89

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--bg-primary` | `#0d1117` | 主背景，workspace/editor 区域 |
| `--bg-secondary` | `#161b22` | 次背景，sidebar/toolbar/modal footer |
| `--bg-tertiary` | `#21262d` | 三级背景，toolbar/表头/results-header |
| `--bg-elevated` | `#1c2128` | 浮层背景，modal container |
| `--bg-hover` | `#292e36` | 悬停态背景 |
| `--bg-active` | `#323940` | 激活态背景 |
| `--fg-primary` | `#e6edf3` | 主文字色 |
| `--fg-secondary` | `#8b949e` | 次文字色 |
| `--fg-muted` | `#6e7681` | 弱化文字/hint |
| `--fg-disabled` | `#484f58` | 禁用态文字 |
| `--border-color` | `#30363d` | 通用边框 |
| `--border-focus` | `#388bfd` | 焦点边框 |
| `--accent-primary` | `#58a6ff` | 强调色（品牌蓝） |
| `--accent-secondary` | `#1f6feb` | 强调色次级（btn-primary hover） |
| `--accent-success` | `#3fb950` | 成功色 |
| `--accent-warning` | `#d29922` | 警告色 |
| `--accent-danger` | `#f85149` | 危险色 |
| `--accent-info` | `#58a6ff` | 信息色 |

**Editor 专用色**:

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--editor-bg` | `#0d1117` | 编辑器背景 |
| `--editor-gutter` | `#161b22` | 行号栏背景 |
| `--editor-line-number` | `#6e7681` | 行号文字色 |
| `--editor-selection` | `rgba(56, 139, 253, 0.25)` | 选区高亮 |
| `--editor-cursor` | `#58a6ff` | 光标色 |

**Table 专用色**:

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--table-header-bg` | `#161b22` | 表头背景 |
| `--table-row-alt` | `#161b22` | 奇数行交替背景 |
| `--table-row-hover` | `#21262d` | 行悬停背景 |
| `--table-border` | `#30363d` | 表格边框 |

**滚动条**:

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--scrollbar-track` | `#161b22` | 滚动条轨道 |
| `--scrollbar-thumb` | `#30363d` | 滚动条滑块 |
| `--scrollbar-thumb-hover` | `#484f58` | 滚动条滑块悬停 |

#### Light Theme (`[data-theme="light"]`)

styles.css:94-136

| 令牌 | 值 |
|------|-----|
| `--bg-primary` | `#ffffff` |
| `--bg-secondary` | `#f6f8fa` |
| `--bg-tertiary` | `#eaeef2` |
| `--bg-elevated` | `#ffffff` |
| `--bg-hover` | `#eaeef2` |
| `--bg-active` | `#d0d7de` |
| `--fg-primary` | `#1f2328` |
| `--fg-secondary` | `#656d76` |
| `--fg-muted` | `#8c959f` |
| `--fg-disabled` | `#a8b3bd` |
| `--border-color` | `#d0d7de` |
| `--border-focus` | `#0969da` |
| `--accent-primary` | `#0969da` |
| `--accent-secondary` | `#0550ae` |
| `--accent-success` | `#1a7f37` |
| `--accent-warning` | `#9a6700` |
| `--accent-danger` | `#cf222e` |
| `--accent-info` | `#0969da` |
| `--editor-bg` | `#ffffff` |
| `--editor-gutter` | `#f6f8fa` |
| `--editor-line-number` | `#8c959f` |
| `--editor-selection` | `rgba(9, 105, 218, 0.2)` |
| `--editor-cursor` | `#0969da` |
| `--table-header-bg` | `#f6f8fa` |
| `--table-row-alt` | `#f6f8fa` |
| `--table-row-hover` | `#eaeef2` |
| `--table-border` | `#d0d7de` |
| `--scrollbar-track` | `#f6f8fa` |
| `--scrollbar-thumb` | `#d0d7de` |
| `--scrollbar-thumb-hover` | `#a8b3bd` |

**Light 专用阴影**:

| 令牌 | 值 |
|------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.08)` |
| `--shadow-md` | `0 4px 8px rgba(0, 0, 0, 0.12)` |
| `--shadow-lg` | `0 8px 16px rgba(0, 0, 0, 0.16)` |
| `--shadow-glow` | `0 0 0 3px rgba(9, 105, 218, 0.3)` |

#### Connection 品牌色

styles.css:457-463

| 类别 | 值 |
|------|-----|
| PostgreSQL/PolarDB/GaussDB | `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))` |
| MySQL | `linear-gradient(135deg, #00758f, #00546f)` |
| Redis | `linear-gradient(135deg, #dc382d, #a4201a)` |

#### 硬编码色彩（未纳入令牌）

styles.css 中部分颜色未使用 CSS 变量，属于技术债：

| 位置 | 值 | 用途 |
|------|-----|------|
| `.sql-highlight .keyword` | `#c678dd` | SQL 关键字高亮 |
| `.sql-highlight .function` | `#61afef` | SQL 函数高亮 |
| `.sql-highlight .string` | `#98c379` | SQL 字符串高亮 |
| `.sql-highlight .number` | `#d19a66` | SQL 数字高亮 |
| `.sql-highlight .comment` | `#5c6370` | SQL 注释高亮 |
| `.sql-highlight .operator` | `#56b6c2` | SQL 运算符高亮 |
| `.notification-error` | `linear-gradient(135deg, #dc3545, #c82333)` | 错误通知 |
| `.notification-success` | `linear-gradient(135deg, #28a745, #218838)` | 成功通知 |
| `.notification-warning` | `linear-gradient(135deg, #ffc107, #e0a800)` | 警告通知 |
| `.badge-unique` | `#f0ad4e` | 唯一索引 badge |

---

### 1.2 字体系统 (Typography)

styles.css:10-11, index.html:9

| 令牌 | 值 |
|------|-----|
| `--font-sans` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` |

Google Fonts 加载：`Inter:wght@300;400;500;600;700` + `JetBrains+Mono:wght@400;500`

**字体使用场景**:

| 用途 | 字体族 | 大小 | 字重 |
|------|--------|------|------|
| body 默认 | `--font-sans` | 13px | 400 |
| sidebar-title | `--font-sans` | 11px | 600 (uppercase, letter-spacing: 0.5px) |
| tree-title | `--font-sans` | 10px | 600 (uppercase, letter-spacing: 0.5px) |
| tree-item | `--font-sans` | 12px | 400 |
| tree-item.branch-item | `--font-sans` | 11px | 400 |
| logo-text | `--font-sans` | 14px | 600 (letter-spacing: -0.3px) |
| tab text | `--font-sans` | 12px | 400 |
| toolbar-btn | `--font-sans` | 12px | 400 |
| editor-btn | `--font-sans` | — | 400 |
| connection-name | `--font-sans` | 13px | 500 |
| connection-type | `--font-sans` | 11px | 400 |
| form-group label | `--font-sans` | 12px | 500 |
| form-group input | `--font-sans` | 13px | 400 |
| btn | `--font-sans` | 13px | 500 |
| modal-header h2 | `--font-sans` | 16px | 600 |
| status-bar | `--font-sans` | 11px | 400 |
| db-type-btn span | `--font-sans` | 11px | 500 |
| settings-section h3 | `--font-sans` | 14px | 600 |
| settings-label | `--font-sans` | 13px | 400 |
| msg-query | `--font-mono` | 12px | 400 |
| msg-text | `--font-sans` | 12px | 400 |
| autocomplete-item | `--font-mono` | 12px | 400 |
| autocomplete-item .item-type | `--font-sans` | 10px | 400 |
| results-table | `--font-sans` | 12px | 400 |
| dv-table | `--font-sans` | 12px | 400 |
| summary-card span | `--font-sans` | 16px | 600 |
| summary-card label | `--font-sans` | 11px | 400 |
| badge | `--font-sans` | 11px | 500 |
| lang-name | `--font-sans` | 14px | 400 |
| lang-flag | `--font-sans` | 24px | 400 |
| data-view-status | `--font-sans` | 11px | 400 |
| welcome-panel h2 | `--font-sans` | 20px | 600 |
| welcome-panel p | `--font-sans` | 14px | 400 |

**行高**: `line-height: 1.5`（body 默认）

---

### 1.3 间距系统 (Spacing)

styles.css:14-22

基于 4px (0.25rem) 基本单位：

| 令牌 | rem | px | 常见用途 |
|------|-----|-----|---------|
| `--space-1` | 0.25rem | 4px | 微间距，icon gap |
| `--space-2` | 0.5rem | 8px | 小间距，padding |
| `--space-3` | 0.75rem | 12px | 中间距 |
| `--space-4` | 1rem | 16px | 标准间距 |
| `--space-5` | 1.25rem | 20px | modal body padding |
| `--space-6` | 1.5rem | 24px | checkbox-row gap |
| `--space-8` | 2rem | 32px | 大间距 |
| `--space-10` | 2.5rem | 40px | — |
| `--space-12` | 3rem | 48px | 最大间距 |

---

### 1.4 圆角 (Border Radius)

styles.css:25-28

| 令牌 | rem | px | 用途 |
|------|-----|-----|------|
| `--radius-sm` | 0.25rem | 4px | 小元素：checkbox, tag, btn-sm, input focus ring |
| `--radius-md` | 0.375rem | 6px | 按钮、卡片、modal、dropdown |
| `--radius-lg` | 0.5rem | 8px | modal container |
| `--radius-xl` | 0.75rem | 12px | 未使用（预留） |

特殊圆角：
- Badge: `border-radius: 10px`（硬编码，styles.css:1307, 3051）
- Color option: `border-radius: 50%`（圆形色块）

---

### 1.5 阴影 (Shadows)

#### Dark Theme

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` | 微阴影 |
| `--shadow-md` | `0 4px 8px rgba(0, 0, 0, 0.4)` | 中阴影 |
| `--shadow-lg` | `0 8px 16px rgba(0, 0, 0, 0.5)` | modal, context-menu |
| `--shadow-glow` | `0 0 0 3px rgba(56, 139, 253, 0.3)` | input focus glow |

#### 硬编码阴影

| 位置 | 值 | 用途 |
|------|-----|------|
| `.autocomplete-popup` | `0 4px 12px rgba(0, 0, 0, 0.3)` | 自动补全弹窗 |
| `.editor-tooltip` | `0 4px 12px rgba(0, 0, 0, 0.3)` | 编辑器 tooltip |

---

### 1.6 过渡 (Transitions)

styles.css:31-33

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--transition-fast` | `150ms ease` | hover/focus 态切换 |
| `--transition-normal` | `250ms ease` | modal 动画、sidebar 宽度、主题切换 |
| `--transition-slow` | `350ms ease` | 预留（当前未使用） |

**Keyframe 动画** (styles.css:2488-2515):

| 名称 | 效果 |
|------|------|
| `fadeIn` | opacity 0 → 1 |
| `slideIn` | translateY(-10px) + opacity 0 → translateY(0) + opacity 1 |
| `pulse` | opacity 1 → 0.5 → 1 |

---

### 1.7 布局常量 (Layout)

styles.css:36-41

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--toolbar-height` | `48px` | 顶部工具栏高度 |
| `--statusbar-height` | `28px` | 底部状态栏高度 |
| `--sidebar-width` | `260px` | 侧边栏默认宽度 |
| `--sidebar-min-width` | `180px` | 侧边栏最小宽度 |
| `--sidebar-max-width` | `400px` | 侧边栏最大宽度 |
| `--tab-height` | `36px` | 标签页高度 |

其他布局尺寸（硬编码）：

| 组件 | 属性 | 值 | 来源行 |
|------|------|-----|--------|
| connection-list | max-height | 200px | :421 |
| data-view-toolbar | height | 40px | :2623 |
| data-view-filter | height | 36px | :2706 |
| data-view-status | height | 28px | :2905 |
| split-handle | height | 6px | :1842 |
| resize-handle | width | 4px | :701 |
| window resize edge | width/height | 8px | :3303 |
| window resize corner | width/height | 12px | :3331 |
| scrollbar | width/height | 8px | :164 |

---

## 2. 组件规格 (Component Specs)

### 2.1 按钮 (Buttons)

项目中有 4 套按钮系统：

#### 通用按钮 `.btn` (styles.css:2183-2233)

| 变体 | 背景 | 边框 | 文字色 | 圆角 |
|------|------|------|--------|------|
| `.btn-primary` | `--accent-primary` | `--accent-primary` | white | `--radius-md` (6px) |
| `.btn-primary:hover` | `--accent-secondary` | `--accent-secondary` | white | |
| `.btn-secondary` | `--bg-tertiary` | `--border-color` | `--fg-primary` | |
| `.btn-secondary:hover` | `--bg-hover` | `--accent-primary` | `--fg-primary` | |
| `.btn-ghost` | transparent | transparent | `--fg-secondary` | |
| `.btn-ghost:hover` | `--bg-hover` | transparent | `--fg-primary` | |

**通用属性**: `padding: var(--space-2) var(--space-4)` (8px 16px), `font-size: 13px`, `font-weight: 500`, SVG icon: 14×14px

#### 工具栏按钮 `.toolbar-btn` (styles.css:249-275)

| 属性 | 值 |
|------|-----|
| padding | `var(--space-1) var(--space-2)` (4px 8px) |
| border | `1px solid transparent` |
| 圆角 | `--radius-md` (6px) |
| 文字色 | `--fg-secondary` |
| hover 文字色 | `--fg-primary` |
| hover 背景 | `--bg-hover` |
| font-size | 12px |
| SVG icon | 16×16px |
| icon-only SVG | 18×18px |
| icon-only padding | `var(--space-2)` (8px) → 32×32px 按钮 |

#### 编辑器按钮 `.editor-btn` (styles.css:877-899)

| 属性 | 值 |
|------|-----|
| width/height | 28×28px |
| 圆角 | `--radius-sm` (4px) |
| hover 背景 | `--bg-hover` |
| hover 文字色 | `--accent-primary` |
| SVG icon | 14×14px |

#### 数据视图按钮 `.dv-btn` (styles.css:2660-2688)

| 属性 | 值 |
|------|-----|
| width/height | 28×28px |
| 背景 | `--bg-primary` |
| 边框 | `1px solid --border-color` |
| 圆角 | `--radius-sm` (4px) |
| hover 背景 | `--bg-hover` |
| active 背景 | `--accent-primary` + white text |
| SVG icon | 14×14px |

#### 其他按钮

| 组件 | 尺寸 | 备注 |
|------|------|------|
| `.window-btn` | 32×32px | 关闭按钮 hover 为 `--accent-danger` |
| `.tab-close` | 16×16px | opacity: 0 → hover 时 1 |
| `.sidebar-action-btn` | 24×24px | hover 时 color → `--accent-primary` |
| `.action-btn` | 24×24px | 通用行操作 |
| `.action-btn-sm` | 24×24px | 索引/外键操作，danger hover 红色 |
| `.pagination-btn` | 28×28px | 结果集分页 |
| `.dv-page-btn` | 22×22px | 数据视图分页 |
| `.dv-btn-sm` | height: 26px | 筛选应用/清除按钮 |
| `.dv-btn-icon` | 26×26px | 排序方向切换 |

---

### 2.2 输入框 (Inputs)

#### 表单输入 `.form-group input/select` (styles.css:2089-2109)

| 属性 | 值 |
|------|-----|
| height | 自适应（无固定值） |
| padding | `var(--space-2) var(--space-3)` (8px 12px) |
| background | `--bg-secondary` |
| border | `1px solid --border-color` |
| 圆角 | `--radius-md` (6px) |
| font-size | 13px |
| focus border | `--accent-primary` |
| focus shadow | `--shadow-glow` |
| placeholder | `--fg-muted` |

#### 筛选栏控件 (styles.css:2722-2744)

| 控件 | height | padding | font-size | min-width |
|------|--------|---------|-----------|-----------|
| `.filter-column` / `.filter-operator` / `.sort-column` | 26px | `0 var(--space-2)` | 12px | 100px |
| `.filter-value` | 26px | `0 var(--space-2)` | 12px | width: 150px |

#### 数据视图跳转输入 `.dv-go-input` (styles.css:3244-3254)

| 属性 | 值 |
|------|-----|
| width | 50px |
| height | 22px |
| font-size | 11px |
| text-align | center |

---

### 2.3 表格 (Tables)

项目中有两套表格：

#### 查询结果表 `.results-table` (styles.css:1381-1729)

| 属性 | 值 |
|------|-----|
| font-size | 12px |
| border-collapse | collapse |
| th padding | `var(--space-2) var(--space-3)` (8px 12px) |
| th background | `--table-header-bg` / `--bg-tertiary` |
| th font-weight | 600 |
| th 文字色 | `--fg-secondary` / `--fg-primary` |
| th 位置 | `sticky; top: 0; z-index: 1` |
| td padding | `var(--space-2) var(--space-3)` (8px 12px) |
| td max-width | 250px |
| td overflow | hidden; text-overflow: ellipsis |
| tbody 奇数行 | `--table-row-alt` |
| tbody hover | `--table-row-hover` |
| checkbox | 14×14px, `accent-color: var(--accent-primary)` |
| sort-icon | 12×12px, hover 时 opacity 0.5 → 1 |

#### 数据视图表 `.dv-table` (styles.css:2791-2892)

| 属性 | 值 |
|------|-----|
| font-size | 12px |
| border-collapse | collapse |
| table-layout | auto (min-width: 100%) |
| th background | `--bg-secondary` |
| th border | `1px solid --border-color` |
| th font-weight | 500 |
| th padding | `var(--space-2) var(--space-3)` |
| th min-width | 80px |
| th max-width | 400px |
| td border | `1px solid --border-color` |
| td padding | `var(--space-1) var(--space-2)` (4px 8px) |
| tr:hover td | `--bg-hover` |
| tr.selected td | `rgba(88, 166, 255, 0.15)` |
| td.null-value | `--fg-muted`, italic |
| td.editing | padding: 0; 内嵌 input border `2px solid --accent-primary` |
| resize-handle | 5px 宽，悬停时 `--accent-primary` |

---

### 2.4 模态框 (Modals)

styles.css:1914-2011

| 属性 | 值 |
|------|-----|
| overlay | `rgba(0, 0, 0, 0.6)`, flex center |
| container max-width | 520px（连接对话框） |
| container max-height | 90vh |
| container width | 90% |
| container background | `--bg-elevated` |
| container border | `1px solid --border-color` |
| container 圆角 | `--radius-lg` (8px) |
| container shadow | `--shadow-lg` |
| 进入动画 | scale(0.95) → scale(1), `--transition-normal` |
| header padding | `var(--space-4) var(--space-5)` (16px 20px) |
| header border-bottom | `1px solid --border-color` |
| header h2 | 16px, font-weight: 600, `--fg-primary` |
| close btn | 28×28px, hover `--accent-danger` |
| body padding | `var(--space-5)` (20px) |
| footer | flex space-between, `--bg-tertiary` |
| footer padding | `var(--space-4) var(--space-5)` |
| z-index | 9999 |

**各 Modal 宽度**:

| Modal | max-width |
|-------|-----------|
| 连接对话框 `.modal-container` | 520px |
| 语言对话框 | 400px (inline style) |
| 设置对话框 `.settings-modal` | 700px |

---

### 2.5 标签页 (Tabs)

#### 主标签栏 `.tab-bar` (styles.css:727-848)

| 属性 | 值 |
|------|-----|
| height | `--tab-height` (36px) |
| background | `--bg-secondary` |
| border-bottom | `1px solid --border-color` |
| tab padding | `0 var(--space-4)` (0 16px) |
| tab font-size | 12px |
| tab 文字色 (inactive) | `--fg-secondary` |
| tab 文字色 (active) | `--fg-primary` |
| tab active 指示器 | `2px solid --accent-primary`, absolute bottom |
| tab hover 背景 | `--bg-hover` |
| tab-active 背景 | `--bg-primary` |
| tab SVG icon | 14×14px |
| tab-close | 16×16px, opacity: 0 → hover/active 1 |
| tab-close SVG | 10×10px |
| tab-action-btn | 24×24px |

#### 结果视图标签 `.rv-tab` (styles.css:1139-1158, 1436-1455)

| 属性 | 值 |
|------|-----|
| padding | `var(--space-2) var(--space-3)` |
| border-bottom | `2px solid transparent` |
| active border-bottom | `2px solid --accent-primary` |
| 文字色 (inactive) | `--fg-secondary` |
| 文字色 (active) | `--fg-primary` |
| font-size | 12px |

#### 数据视图标签 `.data-view-tab` (styles.css:2633-2652)

| 属性 | 值 |
|------|-----|
| padding | `var(--space-1) var(--space-3)` |
| 圆角 | `--radius-sm` (4px) |
| 文字色 (inactive) | `--fg-secondary` |
| 文字色 (active) | white |
| active 背景 | `--accent-primary` |
| font-size | 12px |
| 容器背景 | `--bg-primary` with `--radius-md` pill |

---

### 2.6 侧边栏 (Sidebar)

styles.css:361-651

| 属性 | 值 |
|------|-----|
| width | `--sidebar-width` (260px) |
| min-width | `--sidebar-min-width` (180px) |
| max-width | `--sidebar-max-width` (400px) |
| background | `--bg-secondary` |
| border-right | `1px solid --border-color` |
| resize transition | `width var(--transition-normal)` |

**Sidebar Header**:
- padding: `var(--space-3) var(--space-4)` (12px 16px)
- title: 11px, font-weight: 600, uppercase, letter-spacing: 0.5px, `--fg-muted`

**Connection Item**:
- padding: `var(--space-2) var(--space-3)` (8px 12px)
- 圆角: `--radius-md` (6px)
- icon: 28×28px, gradient 背景, SVG 16×16px
- name: 13px, font-weight: 500
- type: 11px, `--fg-muted`
- status icon: 14×14px (connected: `--accent-success`, disconnected: `--fg-muted`)

**Tree Item**:
- padding: `var(--space-1) var(--space-2)` (4px 8px)
- 圆角: `--radius-sm` (4px)
- font-size: 12px
- icon: 14×14px
- chevron: 12×12px, rotate(90deg) 展开
- indent: `var(--space-4)` (16px) per level
- branch-item: 11px, `--fg-muted`
- db-icon: 16×16px, `--accent-primary`

---

### 2.7 工具栏 (Toolbar)

styles.css:195-281

| 属性 | 值 |
|------|-----|
| height | `--toolbar-height` (48px) |
| padding | `0 var(--space-3)` |
| background | `--bg-secondary` |
| border-bottom | `1px solid --border-color` |
| app-region | drag（可拖动窗口） |
| divider | 1px × 24px, `--border-color` |
| logo icon | 24×24px, `--accent-primary` |
| logo text | 14px, font-weight: 600, letter-spacing: -0.3px |

---

### 2.8 状态栏 (Status Bar)

styles.css:1867-1909

| 属性 | 值 |
|------|-----|
| height | `--statusbar-height` (28px) |
| padding | `0 var(--space-3)` |
| background | `--bg-secondary` |
| border-top | `1px solid --border-color` |
| font-size | 11px |
| status-item SVG | 12×12px |
| divider | 1px × 16px |

**状态栏内容** (index.html:530-563):
- 左侧：连接状态（SVG icon + 文字）、当前连接名
- 右侧：语言、窗口尺寸（SVG icon + "1280 × 800"）、时间（SVG icon + HH:MM:SS）

---

### 2.9 数据视图面板 (Data View Panel)

styles.css:2605-3255, index.html:273-525

#### 整体结构

Navicat 风格，flex column 布局，`--bg-primary` 背景。

| 子面板 | height |
|--------|--------|
| `.data-view-toolbar` | 40px |
| `.data-view-filter` | 36px |
| `.data-view-grid` | flex: 1 (auto) |
| `.data-view-status` | 28px |

#### 标签页

Content（内容）、Structure（表结构）、Indexes（索引）、Foreign Keys（外键）

#### 筛选栏

- 列选择器 + 运算符 (=, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL) + 值输入
- 排序：列选择 + 升降序切换
- 控件高度统一 26px

#### 分页

styles.css:2918-2961, index.html:373-408

- 页大小选项：50 / 100（默认） / 200 / 500 / 1000 条/页
- 分页按钮：22×22px
- 页码信息：11px
- 首页/上一页/下一页/末页导航
- 跳转输入框：50px 宽, 22px 高

#### 列宽调整

- `.resize-handle`：5px 宽，absolute 定位于 th 右侧
- hover 时 `--accent-primary` 背景
- 伪元素指示器：3px × 20px 居中

#### 表结构视图

11 列：#(40px), 列名(180px), 数据类型(150px), 长度(80px), 小数点(80px), Not Null(80px), 主键(80px), 自增(80px), 默认值(auto), 注释(150px), 字符集(80px), 排序规则(120px)

#### 索引视图

8 列：checkbox(40px), 索引名(180px), 类型(100px), 唯一(80px), 列(auto), 基数(120px), 注释(150px), 操作(100px)

#### 外键视图

9 列：checkbox(40px), 外键名(180px), 列名(150px), →(50px), 引用表(150px), 引用列(150px), 更新规则(100px), 删除规则(100px), 操作(100px)

---

### 2.10 SQL 编辑器 (SQL Editor)

styles.css:853-1093, index.html:200-243

| 属性 | 值 |
|------|-----|
| 编辑器容器 | flex: 1, min-height: 80px, `--editor-bg` |
| Monaco Editor | absolute 定位，z-index: 10 |
| 回退 textarea | `.fallback-sql-editor`（Monaco 加载失败时显示） |
| toolbar height | 自适应 |
| toolbar 背景 | `--bg-tertiary` |
| editor-btn | 28×28px |
| db-selector select | `--bg-secondary`, font-size: 12px |

**Toolbar 按钮**（左→右）：Format、Execute、Explain、| 分隔符 | Save、Load

**右侧**：数据库选择器 (label + select)

**自动补全弹窗** (styles.css:1002-1058):
- z-index: 100
- max-height: 200px, min-width: 200px, max-width: 350px
- `--shadow-glow` 风格: `0 4px 12px rgba(0, 0, 0, 0.3)`
- 选中项: `--accent-primary` 背景, white 文字
- 类型标签: 10px, uppercase

---

### 2.11 右键菜单 (Context Menu)

styles.css:2344-2389

| 属性 | 值 |
|------|-----|
| min-width | 160px |
| background | `--bg-elevated` |
| border | `1px solid --border-color` |
| 圆角 | `--radius-md` (6px) |
| shadow | `--shadow-lg` |
| z-index | 1100 |
| item padding | `var(--space-2) var(--space-3)` |
| item font-size | 12px |
| item hover | `--accent-primary` 背景, white 文字 |
| item.danger hover | `--accent-danger` 背景 |
| divider | 1px, `--border-color` |

---

### 2.12 通知 (Notifications)

styles.css:680-696

| 变体 | 背景 | 文字色 |
|------|------|--------|
| `.notification-error` | `linear-gradient(135deg, #dc3545, #c82333)` | white (推断) |
| `.notification-success` | `linear-gradient(135deg, #28a745, #218838)` | white (推断) |
| `.notification-warning` | `linear-gradient(135deg, #ffc107, #e0a800)` | `#212529` |

max-width: 400px

---

## 3. 图标系统 (Icon System)

### 3.1 规范

- **全部 inline SVG**，无 icon library 依赖
- viewBox 统一: `0 0 24 24`
- 风格: stroke-based, `fill: none`, `stroke: currentcolor`, `stroke-width: 2`
- 颜色继承父元素 `color` 属性

### 3.2 尺寸体系

| 场景 | 尺寸 | 示例 |
|------|------|------|
| 欢迎页/空状态大图标 | 80×80px, 40×40px | welcome panel SVG |
| logo | 24×24px | `.logo-icon` |
| db-icon (tree) | 16×16px | `.db-icon` |
| connection icon | 16×16px (inside 28×28 container) | `.connection-icon svg` |
| toolbar icon (文字按钮) | 16×16px | `.toolbar-btn svg` |
| toolbar icon (icon-only) | 18×18px | `.toolbar-btn.icon-only svg` |
| editor-btn | 14×14px | `.editor-btn svg` |
| tab icon | 14×14px | `.tab svg` |
| tree-item icon | 14×14px | `.tree-item svg` |
| expand-btn chevron | 12×12px | `.expand-btn svg` |
| sort-icon | 12×12px | `.sort-icon` |
| status-item | 12×12px | `.status-item svg` |
| window-btn | 14×14px | `.window-btn svg` |
| tab-close | 10×10px | `.tab-close svg` |
| page-btn (results) | 14×14px | `.pagination-btn svg` |
| page-btn (data view) | 12×12px | `.dv-page-btn svg` |

### 3.3 特殊 SVG

- 主题切换：`.sun-icon` / `.moon-icon`，通过 `[data-theme]` 选择器显示/隐藏
- 窗口最大化：`.maximize-icon` / `.restore-icon`，通过 `style="display: none"` 切换

---

## 4. 动画 (Animations)

### 4.1 过渡

| 场景 | 过渡 |
|------|------|
| hover/focus 态 | `var(--transition-fast)` = 150ms ease |
| modal 开关 | `var(--transition-normal)` = 250ms ease, scale transform |
| sidebar 宽度变化 | `var(--transition-normal)` = 250ms ease |
| 主题切换图标 | `var(--transition-normal)` = 250ms ease, transform + opacity |
| chevron 展开 | `var(--transition-fast)` = 150ms ease, rotate(90deg) |

### 4.2 无动画场景

- Resize handle：无过渡
- Split handle：仅背景色过渡
- Tab 拖拽：无动画
- 数据网格滚动：无动画

### 4.3 CSS Animation 类

| 类名 | 效果 |
|------|------|
| `.fade-in` | `fadeIn 250ms ease` |
| `.slide-in` | `slideIn 250ms ease` |

---

## 5. 响应式策略 (Responsive Strategy)

### 5.1 断点

styles.css:2394-2483

| 断点 | 调整 |
|------|------|
| ≤1024px | sidebar → 220px; connection-type-selector → 2 列 grid |
| ≤768px | toolbar-btn 文字隐藏(仅 icon); sidebar → 180px(最小 150px); connection-info 隐藏; form-row → 单列; status-bar font → 10px; modal → 95% 宽/95vh 高; settings sidebar → 水平滚动 |
| ≤480px | toolbar → 44px; logo 文字隐藏; sidebar → absolute + translateX(-100%); modal → 全屏无圆角 |

### 5.2 布局约束

| 属性 | 值 |
|------|-----|
| 最小宽度 | 无硬性限制（480px 仍可用） |
| 桌面优先 | 是 |
| 移动适配 | 最小化（sidebar 可滑动隐藏） |
| 框架 | Wails v2 desktop app, `100vh × 100vw` |

### 5.3 可调整区域

| 区域 | 手柄 | 方向 | 范围 |
|------|------|------|------|
| Sidebar ↔ Workspace | `.resize-handle` (4px) | col-resize | 180-400px |
| Editor ↔ Results | `.split-handle` (6px) | row-resize | 任意 |
| 数据网格列宽 | `th .resize-handle` (5px) | col-resize | 80-400px |
| 窗口边框 | 8 个隐形 handle | 各方向 | 8px/12px |

---

## 6. 主题系统 (Theme System)

### 6.1 机制

- 通过 `<html data-theme="dark|light">` 属性切换
- 所有视觉值通过 CSS Custom Properties 定义
- 默认：`data-theme="dark"`（index.html:2）
- 切换按钮：toolbar 右侧 sun/moon 图标

### 6.2 切换逻辑

```javascript
// app.js 中 toggleTheme() 函数
// 切换 data-theme 属性
// sun-icon/moon-icon 通过 CSS display 控制
```

styles.css:297-311:
- `[data-theme="dark"] .moon-icon { display: none }` — 暗色显示太阳
- `[data-theme="light"] .sun-icon { display: none }` — 亮色显示月亮

### 6.3 设置中的主题选项

index.html:822-826:
- 深色 (dark)
- 浅色 (light)
- 跟随系统 (system)

### 6.4 持久化

主题偏好通过 `setThemeFromSettings()` 保存到 `~/.db-client/config.json`

### 6.5 Focus/Selection 主题适配

```css
:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
}

::selection {
    background-color: var(--accent-primary);
    color: white;
}
```

---

## 7. 无障碍 (Accessibility)

### 7.1 当前状态

| 特性 | 状态 | 备注 |
|------|------|------|
| `:focus-visible` | ✅ 已实现 | styles.css:2531-2534, 2px solid `--accent-primary` |
| `::selection` | ✅ 已实现 | styles.css:2537-2540 |
| ARIA roles | ❌ 缺失 | tree 无 `role="tree"/"treeitem"` |
| ARIA labels | ❌ 缺失 | 按钮仅有 `data-i18n-title`，无 `aria-label` |
| 键盘导航 (tree) | ❌ 缺失 | 无法用方向键导航树节点 |
| 键盘导航 (grid) | ❌ 缺失 | 数据网格无 arrow key 导航 |
| Skip links | ❌ 缺失 | 无跳转到主内容的链接 |
| 屏幕阅读器 | ❌ 缺失 | 动态内容更新无 `aria-live` |
| 颜色对比 | ⚠️ 部分不足 | `--fg-muted: #6e7681` 在 `#0d1117` 上对比度 ~4.2:1 (AA 通过) |
| 字体缩放 | ⚠️ 部分支持 | body 用 px 单位，不随浏览器字体缩放 |

### 7.2 改进建议

1. **Tree**: 添加 `role="tree"`, `role="treeitem"`, `aria-expanded`, 键盘方向键导航
2. **Data Grid**: 添加 `role="grid"`, `role="gridcell"`, arrow key + Tab 导航
3. **Modal**: 添加 `role="dialog"`, `aria-modal="true"`, `aria-labelledby`，焦点陷阱
4. **Buttons**: 所有 icon-only 按钮添加 `aria-label`
5. **Live regions**: 查询结果、通知添加 `aria-live="polite"`
6. **Font scaling**: 将 body font-size 改为 `rem` 单位

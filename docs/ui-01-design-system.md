# U01 — 设计系统

> **设计方向**: Terminal Noir — 暗色、精致，源于终端美学的现代数据库工具
> **核心原则**: 数据至上、信息密度可控、视觉冷静、交互即时
> **文档版本**: v2.0 | 完全重新设计 | 2026-05-09

---

## 目录

1. [设计语言与美学方向](#1-设计语言与美学方向)
2. [色彩系统](#2-色彩系统)
3. [字体系统](#3-字体系统)
4. [间距与网格](#4-间距与网格)
5. [圆角与阴影](#5-圆角与阴影)
6. [运动与动画](#6-运动与动画)
7. [图标系统](#7-图标系统)
8. [组件设计规格](#8-组件设计规格)
9. [状态系统](#9-状态系统)
10. [无障碍规范](#10-无障碍规范)
11. [响应式策略](#11-响应式策略)
12. [设计令牌↔CSS变量对照表](#12-设计令牌css变量对照表)

---

## 1. 设计语言与美学方向

### 1.1 Terminal Noir

DB Client 的设计语言定义为 **Terminal Noir**：

| 维度 | 定义 |
|------|------|
| **视觉来源** | 经典CRT终端显示器、老式绿色荧光屏、现代暗色IDE |
| **情感目标** | 专业可信、数据权威、冷静专注、技术质感 |
| **核心手法** | 暗色底色 + 单色文字 + 极小彩色点缀（数据状态） |
| **记忆点** | 数据的**微光感**——NULL值呈现为暗绿色闪烁点；选中行有微弱的水平扫描线效果 |
| **反设计** | 拒绝：圆润大按钮、渐变卡片、毛玻璃、过度阴影、emoji装饰 |

### 1.2 三大设计原则

1. **数据至上（Data First）**: UI chrome 最小化。数据表格占据最大视觉权重。工具栏/侧边栏默认紧凑，需要时才展开。
2. **信息密度可控**: 提供三种密度模式——Relaxed（14px行高）/ Compact（28px行高）/ Dense（24px行高）。默认Compact。
3. **视觉冷静（Calm Visuals）**: 不使用鲜艳色彩。所有UI元素（按钮、边框、分隔线）使用`--fg-*`系列灰度色。仅数据状态使用语义色（绿色=成功/已连接，红色=错误/断开）。

### 1.3 竞品差异化

| 特点 | DB Client (Terminal Noir) | Navicat | DBeaver | TablePlus |
|------|--------------------------|---------|---------|-----------|
| 设计语言 | 终端美学/暗色 | macOS原生 | Eclipse风格 | macOS原生 |
| 色彩策略 | 灰度+微光点缀 | 多彩图标 | 系统默认 | 青色调 |
| 字体 | 等宽优先（数据）+ 人文无衬线（UI） | 系统默认 | 系统默认 | SF Mono |
| 信息密度 | 三档可调 | 固定 | 拥挤 | 固定 |
| 动效 | 扫描线/AI过渡 | 系统过渡 | 无 | macOS过渡 |

---

## 2. 色彩系统

### 2.1 设计哲学

整个色彩系统遵循 **"灰度90%，彩色10%"** 原则：
- **UI元素**：全部使用灰度色 `--fg-*` / `--bg-*` 系列。无彩色UI。
- **数据状态**：仅数据相关状态使用语义色（连接状态、查询成功/失败、NULL值、数据变更标记）。
- **代码编辑器**：独立色彩空间，不污染UI变量。

### 2.2 主色板：暗色主题 (Dark — 默认)

```
┌─── 背景层级 (Bg Layers) ───────────────────────────────────┐
│                                                              │
│  #08090d ── Bg-Root       最底层，页面底色                    │
│  #0e1117 ── Bg-Primary    主工作区背景 (≈GitHub dark)        │
│  #161b22 ── Bg-Secondary  侧边栏/工具栏/页脚                  │
│  #1c2129 ── Bg-Tertiary   卡片/面板/编辑器工具栏               │
│  #21262d ── Bg-Elevated   浮层/模态框/弹出菜单                 │
│  #282e38 ── Bg-Hover      悬停态                              │
│  #2f3642 ── Bg-Active     激活/选中态                         │
│  #1a1f2a ── Bg-Selected   表行选中（微蓝色调）                 │
│                                                              │
├─── 前景层级 (Fg Layers) ───────────────────────────────────┤
│                                                              │
│  #e6edf3 ── Fg-Primary    主文字                             │
│  #8b949e ── Fg-Secondary  辅助文字/标签                       │
│  #6e7681 ── Fg-Muted      弱化文字/placeholder                │
│  #484f58 ── Fg-Disabled   禁用态文字                          │
│  #30363d ── Border        所有边框/分隔线（统一）              │
│  #388bfd ── Border-Focus  焦点环                              │
│                                                              │
├─── 语义色 (Semantic — 仅用于数据状态) ──────────────────────┤
│                                                              │
│  #3fb950 ── Success       连接成功/INSERT成功/匹配行           │
│  #f85149 ── Danger        连接失败/DELETE/差异行               │
│  #d29922 ── Warning       慢查询/事务未提交                    │
│  #58a6ff ── Info          连接中/UPDATE/中性状态               │
│  #8b949e ── Neutral       NULL值/"无数据"                     │
│                                                              │
├─── 终端微光色 (Terminal Glow — UI点缀) ────────────────────│
│                                                              │
│  #58a6ff ── Accent-Primary    蓝色：焦点/选中/链接             │
│  #1f6feb ── Accent-Secondary  深蓝：hover-active               │
│  #3fb950 ── Glow-Green        数据NULL值微光 (#3fb950, 20%透明度)│
│  #7ee787 ── Glow-Green-Bright 行选中边缘光（几乎不可见）        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 CSS Custom Properties

```css
:root {
  /* == 背景 == */
  --bg-root:         #08090d;  /* 页面最底层，几乎不可见 */
  --bg-primary:      #0e1117;  /* 主工作区 */
  --bg-secondary:    #161b22;  /* 侧边栏 */
  --bg-tertiary:     #1c2129;  /* 工具栏/表头 */
  --bg-elevated:     #21262d;  /* 模态框 */
  --bg-hover:        #282e38;  /* 悬停 */
  --bg-active:       #2f3642;  /* 激活 */
  --bg-selected:     #1a1f2a;  /* 行选中（蓝色） */
  --bg-input:        #0d1117;  /* 输入框背景 */
  --bg-overlay:      rgba(0,0,0,0.65); /* 遮罩 */

  /* == 前景 == */
  --fg-primary:      #e6edf3;
  --fg-secondary:    #8b949e;
  --fg-muted:        #6e7681;
  --fg-disabled:     #484f58;
  --fg-inverse:      #0d1117;  /* 深色文字（用于浅色区域） */

  /* == 边框 == */
  --border:          #30363d;
  --border-focus:    #388bfd;
  --border-subtle:   rgba(48,54,61,0.5); /* 内部微妙分隔 */
  --border-glow:     rgba(56,139,253,0.35); /* 焦点辉光 */

  /* == 语义色 == */
  --success:         #3fb950;
  --danger:          #f85149;
  --warning:         #d29922;
  --info:            #58a6ff;
  --neutral:         #8b949e;

  /* == 强调色 == */
  --accent:          #58a6ff;
  --accent-hover:    #1f6feb;
  --accent-muted:    rgba(88,166,255,0.1);
  --accent-subtle:   rgba(88,166,255,0.05);

  /* == 微光 == */
  --glow-green:      rgba(63,185,80,0.20);
  --glow-green-edge: #3fb95033;
  --glow-blue:       rgba(88,166,255,0.15);
  --glow-red:        rgba(248,81,73,0.15);

  /* == 编辑 == */
  --editor-bg:       #0d1117;
  --editor-gutter:   #161b22;
  --editor-line:     #6e7681;
  --editor-select:   rgba(56,139,253,0.25);
  --editor-cursor:   #58a6ff;

  /* == 数据表 == */
  --table-header-bg: #161b22;
  --table-row-even:  transparent;
  --table-row-odd:   rgba(22,27,34,0.4);
  --table-row-hover: rgba(40,46,56,0.8);
  --table-row-select: rgba(26,31,42,0.9);
  --table-grid:      rgba(48,54,61,0.3); /* 网格线 — 仅Compact/Dense模式 */
  --table-added:     rgba(63,185,80,0.08); /* 新增行 */
  --table-changed:   rgba(88,166,255,0.08); /* 修改行 */
  --table-deleted:   rgba(248,81,73,0.08); /* 删除行 */

  /* == 滚动条 == */
  --scrollbar-track: transparent;
  --scrollbar-thumb: #30363d;
  --scrollbar-thumb-hover: #484f58;

  /* == 阴影 == */
  --shadow-popup:    0 4px 16px rgba(0,0,0,0.4);
  --shadow-modal:    0 8px 32px rgba(0,0,0,0.55);
  --shadow-glow:     0 0 0 3px rgba(56,139,253,0.3);
  --shadow-tooltip:  0 2px 8px rgba(0,0,0,0.5);
}
```

### 2.4 Light Theme

```css
[data-theme="light"] {
  --bg-root:         #f6f8fa;
  --bg-primary:      #ffffff;
  --bg-secondary:    #f3f4f6;
  --bg-tertiary:     #e5e7eb;
  --bg-elevated:     #ffffff;
  --bg-hover:        #e8eaed;
  --bg-active:       #dde0e4;
  --bg-selected:     #e8f0fe;
  --bg-input:        #ffffff;
  --bg-overlay:      rgba(0,0,0,0.35);

  --fg-primary:      #1f2328;
  --fg-secondary:    #59636e;
  --fg-muted:        #848d97;
  --fg-disabled:     #b0b8c2;
  --fg-inverse:      #ffffff;

  --border:          #d0d7de;
  --border-focus:    #0969da;
  --border-subtle:   rgba(208,215,222,0.6);
  --border-glow:     rgba(9,105,218,0.25);

  --success:         #1a7f37;
  --danger:          #cf222e;
  --warning:         #9a6700;
  --info:            #0969da;

  --accent:          #0969da;
  --accent-hover:    #0550ae;
  --accent-muted:    rgba(9,105,218,0.08);
  --accent-subtle:   rgba(9,105,218,0.04);

  --table-row-odd:   rgba(243,244,246,0.6);
  --table-grid:      rgba(208,215,222,0.4);
  --table-added:     rgba(26,127,55,0.06);
  --table-changed:   rgba(9,105,218,0.06);
  --table-deleted:   rgba(207,34,46,0.06);

  --scrollbar-thumb: #d0d7de;
  --scrollbar-thumb-hover: #b0b8c2;

  --shadow-popup:    0 2px 12px rgba(0,0,0,0.1);
  --shadow-modal:    0 4px 24px rgba(0,0,0,0.18);
  --shadow-tooltip:  0 1px 4px rgba(0,0,0,0.12);
}
```

### 2.5 色彩使用规则

| 规则 | 说明 |
|------|------|
| **UI元素禁用语义色** | 按钮、标签、边框 — 只用 `--fg-*` / `--bg-*`。唯一的彩色UI元素是：①焦点环(accent) ②已连接指示灯(success) ③断开指示灯(danger) ④Stop/取消按钮(danger bg例外) |
| **数据用语义色** | 查询结果中的NULL值、错误行、新增/修改/删除行、事务状态 — 使用语义色标记 |
| **强调色仅用于：** ①选中态背景 `--accent-subtle` ②焦点环 `--border-glow` ③链接/按钮hover ④当前标签页下划线 |
| **禁止硬编码色值** | 所有颜色必须通过 `var(--token)` 引用。违反此规则 = bug |

---

## 3. 字体系统

### 3.1 字体选择

| 分类 | 字体 | 用途 |
|------|------|------|
| **UI正文** | `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` | 工具栏、侧边栏、对话框、状态栏 — 所有非数据文字 |
| **代码/数据** | `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace` | SQL编辑器、数据单元格、连接字符串、日志 |
| **显示标题** | `'Inter', sans-serif` (Semibold 600) | 模态框标题、"DB Client" logo |

> **为什么不用 Inter 替代？** Inter 是当前最优跨平台 UI 字体家族。数据库工具不需要花哨的显示字体 — 用户看重的是清晰的数据识别和长时阅读舒适度。JetBrains Mono 用于等宽场景（代码/数据），与 Inter 形成干净的视觉对比。

### 3.2 字体大小阶梯

| 标识 | 大小 | 行高 | 用途 |
|------|------|------|------|
| `--text-2xs` | 10px | 1.4 | 树节点子标签 (如 "(3列)") |
| `--text-xs` | 11px | 1.4 | 状态栏、工具栏提示、badge |
| `--text-sm` | 12px | 1.5 | 侧边栏树节点、表头、标签页 |
| `--text-base` | 13px | 1.55 | **正文默认**、数据单元格、按钮、输入框 |
| `--text-md` | 14px | 1.5 | 模态框标题、连接名 |
| `--text-lg` | 16px | 1.5 | 欢迎页标题 |
| `--text-xl` | 20px | 1.4 | Logo "DB Client" |

### 3.3 字体粗细

| 标识 | 粗细 | 用途 |
|------|------|------|
| `--weight-normal` | 400 | 正文、数据单元格 |
| `--weight-medium` | 500 | 按钮、标签、表头 |
| `--weight-semibold` | 600 | 标题、激活的标签页 |
| `--weight-bold` | 700 | 不推荐使用（破坏Terminal Noir的冷静感） |

> **禁止使用 Bold (700)**。Terminal Noir 设计中，强调通过**颜色深度**而非**字体粗细**来表达。Semibold (600) 是最高可用粗细。

### 3.4 字体加载策略

```html
<!-- 关键路径：预连接到 Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Inter: 仅加载需要的粗细 -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<!-- JetBrains Mono: 代码场景 -->
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**后备字体策略**:
- Inter 加载失败时：回退到系统 sans-serif (`-apple-system, BlinkMacSystemFont`)
- JetBrains Mono 加载失败时：回退到系统等宽 (`Consolas, monospace`)

---

## 4. 间距与网格

### 4.1 间距令牌

基于 4px 基础单位，使用 CSS `rem` 单位（1rem = 16px = 4倍基础单位）。

```css
:root {
  --space-0:  0;
  --space-1:  0.25rem;   /*  4px — 图标↔文字、内边距微调 */
  --space-2:  0.5rem;    /*  8px — 按钮内边距、树节点间隙 */
  --space-3:  0.75rem;   /* 12px — 面板内边距、表单元格内边距 */
  --space-4:  1rem;      /* 16px — 主要内容间距、模态框内边距 */
  --space-5:  1.25rem;   /* 20px — 节之间 */
  --space-6:  1.5rem;    /* 24px — 模态框 body 边距 */
  --space-8:  2rem;      /* 32px — 大块间距 */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px — 欢迎页垂直间隙 */
}
```

### 4.2 布局常量

```css
:root {
  --toolbar-height:    44px;   /* 工具栏高度（从48px降低，节约垂直空间） */
  --statusbar-height:  26px;   /* 状态栏（从28px降低） */
  --sidebar-width:     260px;  /* 默认宽度 */
  --sidebar-min:       180px;
  --sidebar-max:       420px;
  --tab-height:        34px;   /* 标签页（从36px降低） */
  --editor-min-height: 120px;
  --result-min-height: 80px;
}
```

### 4.3 信息密度三档

这是 DB Client 独有的交互：用户随时切换信息密度。

| 模式 | 行高 | 表单元格padding | 树节点高度 | 适用场景 |
|------|------|----------------|-----------|----------|
| **Relaxed** | 36px | 10px 12px | 32px | 演示/截图/首次使用 |
| **Compact** (默认) | 28px | 6px 8px | 26px | 日常数据浏览 |
| **Dense** | 22px | 3px 6px | 22px | 大量数据对比/DBA |

### 4.4 DPI/缩放适配

| DPI范围 | 处理策略 |
|---------|---------|
| 96dpi (100%) | 基准尺寸，无需调整 |
| 120-144dpi (125-150%) | CSS rem自动缩放，图标用SVG无影响 |
| 168-192dpi (175-200%) | Monaco Editor字体+2px，表格行高+4px，工具栏图标24→28px |
| >200dpi | 全局 `--base-font-size` 调整为18px (默认16px) |

关键规则：
- 所有尺寸使用rem/em，禁止px硬编码（图标尺寸除外）
- SVG图标自适应，不设固定width/height
- Monaco Editor: `fontSize` 根据DPI动态调整
- 图片资源: 仅SVG，无PNG/JPG固定尺寸
- 窗口最小尺寸: 800×600 (逻辑px)，物理px随DPI放大

实现方式：`<body>` 上设置 `data-density="compact"`，所有组件通过 CSS 变量响应。

```css
[data-density="relaxed"] { --row-height: 36px; --cell-padding: 10px 12px; }
[data-density="compact"] { --row-height: 28px; --cell-padding: 6px 8px; }
[data-density="dense"]   { --row-height: 22px; --cell-padding: 3px 6px; }

.dv-table td { padding: var(--cell-padding); height: var(--row-height); }
```

---

## 5. 圆角与阴影

### 5.1 圆角

| 标识 | 值 | 用途 |
|------|-----|------|
| `--radius-none` | 0 | 表头（无圆角）、拆分线 |
| `--radius-sm` | 3px | 输入框、树节点hover、badge |
| `--radius-md` | 5px | 按钮、卡片、标签页hover |
| `--radius-lg` | 8px | 模态框、弹出菜单 |
| `--radius-full` | 9999px | 仅状态指示灯（连接状态圆点） |

> **Terminal Noir 核心规则**：圆角**极小化**。数据区域（表格）**零圆角**。圆角仅用于"非数据"UI元素（按钮、模态框）。

### 5.2 阴影

Terminal Noir 的阴影极其克制：

```css
--shadow-popup:   0 2px 12px rgba(0,0,0,0.35);
--shadow-modal:   0 4px 28px rgba(0,0,0,0.5);
--shadow-tooltip: 0 1px 6px rgba(0,0,0,0.4);
--shadow-glow:    0 0 0 3px var(--accent-muted);  /* 焦点环 — 唯一带颜色的阴影 */
```

**不使用阴影的场景**：
- 工具栏（用底部border分隔）
- 侧边栏（用右侧border分隔）
- 状态栏（用顶部border分隔）
- 表格（用border分隔）
- 欢迎页（无阴影，纯色背景）

---

## 6. 运动与动画

### 6.1 动画哲学

Terminal Noir 的动画哲学是：**即时的、锐利的、无延迟的**。反对iOS风格的"弹性"和"缓入缓出"长时间过渡。

| 类型 | 时长 | 缓动 | 适用 |
|------|------|------|------|
| **Instant** | 0ms | none | 文本变化、数据刷新、状态指示变化 |
| **Micro** | 80ms | ease-out | 悬停态切换(hover on/off) |
| **Quick** | 120ms | cubic-bezier(0.2,0,0,1) | 焦点切换、标签页切换 |
| **Expand** | 180ms | cubic-bezier(0.2,0,0,1) | 树展开/折叠、面板展开 |
| **Enter** | 200ms | cubic-bezier(0.2,0,0,1) | 模态框进入、弹出菜单出现 |
| **Exit** | 120ms | ease-in | 模态框退出、弹出菜单消失 |

### 6.2 CSS Transition 标准

```css
/* 悬停态 — 任何交互元素的hover */
.xxx { transition: background-color 80ms ease-out, color 80ms ease-out, border-color 80ms ease-out; }

/* 模态框进入 */
.modal-overlay.active .modal-container {
  animation: modal-enter 200ms cubic-bezier(0.2,0,0,1);
}

/* 焦点环 — 瞬间出现，渐变消失 */
input:focus { box-shadow: var(--shadow-glow); transition: box-shadow 80ms ease-out; }
input:not(:focus) { box-shadow: none; transition: box-shadow 120ms ease-in; }
```

### 6.3 关键动画

**1. 查询执行中 — 状态栏微光脉冲**
```css
@keyframes query-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.query-running .status-indicator {
  animation: query-pulse 600ms ease-in-out infinite;
  color: var(--info);
}
```

**2. NULL值 — 静态微光（不闪烁，仅是微妙的淡绿色）**
```css
.null-value { color: var(--glow-green); font-style: italic; }
```

**3. 新增行标记 — 从透明渐入**
```css
@keyframes row-insert {
  from { background-color: var(--success); }
  to { background-color: transparent; }
}
.row-inserted { animation: row-insert 1.5s ease-out; }
```

### 6.4 禁止的动画

| 禁止项 | 原因 |
|--------|------|
| 页面切换的"翻页"效果 | 数据库工具不需要花哨 |
| 弹性缓动 (spring/ease-out-back) | 破坏Terminal Noir的锐利感 |
| 自动轮播/滚动 | 打断用户专注 |
| 淡入超过300ms | 数据查询结果应立即呈现 |
| 鼠标跟随光晕 | 数据库工具不是游戏 |

---

## 7. 图标系统

### 7.1 图标策略

**全部使用 SVG inline**。不使用图标字体、不使用图标库（Feather/Lucide等库禁止引入 — 保持零外部图标依赖）。

**原则**：
- 所有图标 16×16px viewBox，stroke-width=2，stroke-linecap=round，stroke-linejoin=round
- 数据库对象图标使用 14×14px
- 工具栏图标使用 16×16px
- 状态指示器使用 12×12px

### 7.2 图标分类

| 分类 | 图标 | SVG |
|------|------|-----|
| **数据库类型** | PostgreSQL, MySQL, Redis, SQLite, PolarDB, GaussDB | 简洁的轮廓icon，不使用logo原色 |
| **对象类型** | Database, Table, View, Function, Index, FK, Column, Key | 14px，stroke |
| **操作** | Play(Run), Stop, Plus, Minus, Refresh, Settings, Close, Edit, Delete, Copy, Search, Filter, Sort, Download, Upload | 16px |
| **状态** | Connected(circle+check), Disconnected(circle+x), Warning(triangle), Error(x-circle) | 12px |
| **导航** | Chevron-Right, Chevron-Down, Folder-Open, Folder-Closed | 12px |

### 7.3 SVG 颜色规则

所有 SVG 图标的 `stroke="currentColor"` 继承父元素文字颜色。**禁止硬编码 fill/stroke 色**。

```html
<!-- 正确: -->
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
  <path d="..."/>
</svg>

<!-- 错误: 硬编码色 -->
<svg viewBox="0 0 16 16" fill="none" stroke="#58a6ff"> ✗
```

**唯一例外**：连接状态指示灯 — 使用 `var(--success)` / `var(--danger)`。

---

## 8. 组件设计规格

### 8.1 按钮 (Buttons)

三种类型，统一 32px 高度。

| 类型 | 背景 | 边框 | 文字 | 用途 |
|------|------|------|------|------|
| **Primary** | `--accent` | `--accent` | `--fg-inverse` | 主要操作（保存、连接） |
| **Secondary** | `--bg-tertiary` | `--border` | `--fg-primary` | 次要操作（取消、测试连接） |
| **Ghost** | transparent | transparent | `--fg-secondary` | 低优先级（关闭、更多） |

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  height: 32px; padding: 0 var(--space-4); border-radius: var(--radius-md);
  font-size: var(--text-base); font-weight: var(--weight-medium); cursor: pointer;
  transition: background-color 80ms ease-out, color 80ms ease-out, border-color 80ms ease-out, box-shadow 80ms ease-out;
}
.btn:focus-visible { box-shadow: var(--shadow-glow); outline: none; }
.btn-primary   { background: var(--accent); color: var(--fg-inverse); border: 1px solid var(--accent); }
.btn-secondary { background: var(--bg-tertiary); color: var(--fg-primary); border: 1px solid var(--border); }
.btn-ghost     { background: transparent; color: var(--fg-secondary); border: 1px solid transparent; }
```

**图标按钮 (Icon-only)**: 32×32px，文字=图标=0 gap。用于工具栏、editor操作栏。

```css
.btn-icon { width: 32px; padding: 0; }
.btn-icon svg { width: 16px; height: 16px; }
```

**尺寸变体**:
- `btn-sm`: 28px 高，12px 字号 — 用于过滤栏、分页
- `btn-xs`: 24px 高，11px 字号 — 用于行内操作（编辑/删除图标按钮）

### 8.2 输入框 (Input)

```css
input, select, textarea {
  height: 32px; padding: 0 var(--space-3); border: 1px solid var(--border);
  border-radius: var(--radius-sm); background: var(--bg-input); color: var(--fg-primary);
  font-size: var(--text-base); font-family: inherit; transition: border-color 80ms ease-out, box-shadow 80ms ease-out;
}
input:focus, select:focus, textarea:focus {
  outline: none; border-color: var(--border-focus); box-shadow: var(--shadow-glow);
}
input::placeholder { color: var(--fg-muted); }
```

**select 暗色适配**：
```css
select option {
  background: var(--bg-elevated); color: var(--fg-primary);
}
```

### 8.3 数据表格 (Data Table / Data Grid)

这是 DB Client 的核心组件，设计规格最详细。

```
┌── 列调整手柄 (resize handle on column border) ─────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │ # │ id(▾) │ name       │ email            │ status │   │ ← 表头（sticky）
│  │───┼───────┼────────────┼─────────────────┼────────│   │
│  │ 1 │ 1     │ Alice      │ alice@test.com   │ ●active│   │ ← 数据行
│  │ 2 │ 2     │ Bob        │ bob@test.com     │ ○inact │   │ ← 奇数行微暗
│  │ 3 │ 3     │ Charlie    │ charlie@test.com │ ●active│   │ ← hover高亮
│  └───┴───────┴────────────┴─────────────────┴────────┘   │
│  ▲ 行号列(40px) 可排序(▾/▴)  文本溢出→省略号  NULL→斜体暗绿  │
│                                                             │
│  ☐ 1 ☐ 2 ☒ 3  已选: 3 | 共 1000 条  [◀◀ ◀ 1/20 ▶ ▶▶]    │ ← 底部选择栏+分页
└─────────────────────────────────────────────────────────────┘
```

**规范细节**:

| 属性 | 值 |
|------|-----|
| 表头高度 | 32px (Compact模式) |
| 数据行高度 | `var(--row-height)` (Compact=28px) |
| 单元格padding | `var(--cell-padding)` (Compact=6px 8px) |
| 表头背景 | `--table-header-bg` |
| 表头sticky | `position: sticky; top: 0; z-index: 2;` |
| 行号列宽 | 40px，不可调整 |
| 复选框列宽 | 32px |
| 最小列宽 | 60px（小于此宽度隐藏文字，仅显示省略号） |
| 最大列宽 | 500px（超出省略号） |
| 文本溢出 | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` |
| 列调整大小 | drag右侧边缘，cursor=col-resize，最小60px |
| 列排序 | 点击表头 → 升序(▴) → 降序(▾) → 无排序 |
| 行选中 | 单击→单选，Ctrl+Click→多选追加，Shift+Click→范围选择 |
| NULL值 | `<span class="null-value">NULL</span>` → italic, `--neutral` |
| 数字列 | 右对齐，等宽字体 `font-variant-numeric: tabular-nums;` |
| 连接线 | Dense/Compact模式显示 `--table-grid` 颜色的1px横线 |

**新增/修改/删除行标记**:

| 状态 | 背景色 | 左侧标记 |
|------|--------|----------|
| Inserted | `--table-added` | 绿色竖线 3px |
| Modified | `--table-changed` | 蓝色竖线 3px |
| Deleted | `--table-deleted` | 红色竖线 3px + 文字删除线 |

**分页器**:

```
[◀◀] [◀]  第 3 页，共 20 页  [▶] [▶▶]    显示 [50▼] 条/页    跳转到 [__] 页
```

### 8.4 侧边栏连接列表 (Connection List)

```
┌──────────────────────────┐
│ 连接                 [+] │  ← sidebar-header
├──────────────────────────┤
│ ● My PostgreSQL    [▸] │  ← connection-item
│   localhost:5432        │     ● = status indicator (success/danger/neutral)
│ ○ Dev MySQL        [▸] │     背景: hover→bg-hover, selected→bg-active
│   192.168.1.10:3306    │     右键→context menu: 连接/断开/编辑/删除
│ ● Redis Cache      [▸] │
├──────────────────────────┤
│ ▸ 数据库                │  ← tree-header
│   ▸ postgres            │     ▸ = expand-btn (chevron)
│     ▸ Tables (12)       │
│       · users           │     点击table→ 右侧打开Data View
│       · orders          │     右键table→ context menu
│       · products        │
│     ▸ Views (3)         │
│     ▸ Functions (8)     │
│       · fn_calc_tax()   │
│       · fn_generate_id()│
│     ▸ Indexes           │
│     ▸ Foreign Keys      │
│   ▸ analytics           │
└──────────────────────────┘
```

### 8.5 标签页 (Tabs)

```
┌──────────────────────────────────────────────────────────┐
│ [● Query 1  ×]  [○ Query 2  ×]  [○ Data: users  ×]  [+] │ ← tab-bar
│ ──────────────────────────────────────────────────────── │ ← border-bottom
│                                                           │
│ [SQL Editor ...                                          ]│
│ [            ...                                          ]│
│                                                           │
│ ───── 结果 1 ──── 行数: 42  耗时: 12ms ────────────────────── │
│ ┌───────────────────────────────────────────────────────┐│
│ │ id │ name │ email...                                  ││
│ ├────┼──────┼───────────────────────────────────────────┤│
│ │ 1  │ ...  │ ...                                       ││
│ └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

- 标签宽度：最小100px，最大240px，文字溢出省略号
- ● = 未保存修改标记
- × = 关闭按钮（hover时显示，始终可见在active tab）
- + = 新建标签
- 拖拽排序标签
- 关闭最后一个标签 → 显示 Welcome Panel

### 8.6 模态框 (Modal)

```
┌─────── Overlay (bg-overlay, opacity transition) ────────┐
│                                                           │
│     ┌──────────────────────────────────────┐             │
│     │  标题                          [✕]   │ ← header    │
│     ├──────────────────────────────────────┤             │
│     │                                      │             │
│     │  Body content                        │ ← body      │
│     │                                      │             │
│     ├──────────────────────────────────────┤             │
│     │            [取消]  [保存/确认]        │ ← footer    │
│     └──────────────────────────────────────┘             │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- 最大宽度：560px (连接对话框) / 400px (语言) / 720px (设置)
- 最大高度：90vh，超出body部分滚动
- Header固定顶部，Footer固定底部
- 动画进入：overlay opacity 0→1 (120ms)，container scale(0.97)→1 + opacity(200ms)
- 动画退出：反向，100ms
- ESC关闭，点击overlay关闭
- Focus trap：Tab键在模态框内循环

### 8.7 上下文菜单 (Context Menu)

```
┌──────────────────┐
│ 🔗  打开          │
│ 📄  新建查询       │
│ ─────────────── │ ← divider
│ 📋  复制名称       │
│ 🔄  刷新          │
│ ─────────────── │
│ 🗑  删除  (红色)   │ ← danger item
└──────────────────┘
```

- 最小宽度：160px
- 菜单项高度：32px
- hover：`--accent` 背景 + white文字（不是整行高亮，精确到padding区域）
- 分隔线：`--border-subtle` 1px
- 定位：鼠标点击位置 + 4px offset，避免超出视口（自动翻转方向）
- 点击外部/ESC关闭
- 仅一级菜单，不支持子菜单（保持Terminal Noir简洁）

### 8.8 状态栏 (Status Bar)

```
┌──────────────────────────────────────────────────────────┐
│ ● 已连接: My PG │ PostgreSQL 14  │  中文 │ ▣ 1280×800 │ 14:32:05 │
└──────────────────────────────────────────────────────────┘
  │              │                 │       │            │
  │              │                 语言    窗口尺寸      时钟
  │              连接信息
  连接状态 (success/danger/neutral icon)
```

- 高度：26px
- 字体：11px, `--fg-secondary`
- 分隔：`--border` 1px竖线
- 左侧：连接状态 + 当前连接名 + 数据库版本
- 右侧：语言 + 窗口尺寸 + 系统时钟 (HH:MM:SS)
- 查询执行中：连接状态图标变为蓝色脉冲

### 8.9 树组件 (Tree)

树组件用于侧边栏数据库对象浏览。

```
▸ postgres                    ← expanded + database icon
  ▸ Tables (12)              ← expanded + folder icon
    · users       [table]    ← leaf node + table icon
    · orders      [table]    ← hover → bg-hover
    · products    [table]    ← 右键 → context menu
  ▸ Views (3)                ← collapsed + folder icon
  ▸ Functions (8)
    · fn_calc_tax() [fn]    ← leaf node + function icon
```

- 节点高度：26px (Compact) / 28px (Relaxed) / 22px (Dense)
- 缩进层级：每级16px
- 展开/折叠：点击chevron或双击节点名
- 选中态：`--bg-active` 背景 + `--fg-primary` 文字
- 选中节点时：右侧工作区刷新为对应内容
- 加载中：显示旋转的refresh图标
- 空状态："无数据" + `--fg-muted` + italic
- 拖拽支持：表节点可拖入SQL编辑器（生成表名）

---

## 9. 状态系统

### 9.1 空状态 (Empty States)

每个区域都必须定义空状态，不使用通用的"无数据"。

| 区域 | 空状态 | 图标 |
|------|--------|------|
| 连接列表 | "暂无连接，点击 [+] 新建" | database icon |
| 数据库树 | "选择连接以查看数据库" | folder icon |
| SQL编辑器(欢迎页) | Logo + "DB Client" + 新建连接/新建查询按钮 | logo icon |
| 查询结果 | "执行查询后结果在此显示" | table icon |
| 表数据 | "表为空，点击 [+] 添加行" | plus icon |
| 审计日志 | "暂无日志记录" | clock icon |
| 对比结果 | "选择两个数据源进行对比" | diff icon |
| 搜索结果 | "未找到匹配项" | search icon |

### 9.2 加载状态

| 组件 | 加载状态描述 | 视觉 |
|------|-------------|------|
| 连接测试 | 按钮文字变为"测试中..."，不可点击 | spinner + disabled |
| 数据库树加载 | 展开节点时显示loading spinner | tree-loading item |
| 查询执行 | ①工具栏Run按钮变灰色不可点击 ②状态栏连接指示脉冲蓝色 ③编辑器底部出现细进度条(不确定模式) | 三个同时触发 |
| 表数据分页加载 | 表格区域显示骨架屏(3行灰色占位) | skeleton rows |
| 导出 | 模态框显示进度(已导出XXX行) | progress + cancel button |

**Spinner 规格**:
```css
.spinner {
  width: 14px; height: 14px; border: 2px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 500ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

### 9.3 错误状态

| 类型 | 展示方式 |
|------|---------|
| 连接失败 | ①测试按钮旁红色文字"连接失败: xxx" ②详细错误在可展开的details面板 ③提供常见解决建议(超时→检查防火墙, 拒绝→检查密码) |
| 查询错误 | ①结果面板显示错误消息(红色左边框) ②SQL语句回显 ③错误位置高亮(如Monaco支持) |
| 网络断连 | ①状态栏指示变红 ②自动重连(3次,5s间隔) ③重连失败弹提示"连接已断开,点击重新连接" |
| 文件读写失败 | 模态框显示错误详情 |

---

## 10. 无障碍规范

### 10.1 必须达标

| 标准 | 说明 |
|------|------|
| **WCAG 2.1 AA** | 最低达标线 |
| 颜色对比度 | 所有文字≥4.5:1 (常规), ≥3:1 (大文字≥18px) |
| 焦点可见 | `:focus-visible` 必须显示清晰的焦点环 (`--shadow-glow`) |
| 键盘导航 | Tab/Shift+Tab在控件间切换；Enter/Space激活；Escape关闭/取消；方向键在树/菜单/表格中导航 |
| 屏幕阅读器 | 关键元素添加 `aria-label` / `role` / `aria-expanded` |

### 10.2 具体措施

| 组件 | ARIA/焦点措施 |
|------|--------------|
| 树节点 | `role="tree"`, `role="treeitem"`, `aria-expanded="true/false"`, `aria-selected="true/false"` |
| 标签页 | `role="tablist"`, `role="tab"`, `aria-selected`, `←→`切换标签，`Ctrl+W`关闭 |
| 模态框 | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape关闭 |
| 数据表格 | `role="grid"`, `role="row"`, `aria-sort` |
| 上下文菜单 | `role="menu"`, `role="menuitem"`, `aria-selected`, `↑↓`导航 |
| 图标按钮 | 必须 `aria-label="功能描述"` |
| Live region | 查询结果加载完成 → `aria-live="polite"` 通知行数 |

### 10.3 键盘快捷键

| 快捷键 | 操作 | 范围 |
|--------|------|------|
| `Ctrl+Enter` | 执行当前查询 | 全局 |
| `Ctrl+N` | 新建连接 | 全局 |
| `Ctrl+T` | 新建查询标签 | 全局 |
| `Ctrl+W` | 关闭当前标签 | 全局 |
| `Ctrl+Shift+F` | 格式化SQL | 编辑器 |
| `Ctrl+Shift+M` | 压缩SQL | 编辑器 |
| `Ctrl+S` | 保存查询到文件 | 编辑器 |
| `Ctrl+D` | 复制当前行 | 编辑器 |
| `Ctrl+/` | 注释/取消注释 | 编辑器 |
| `F5` | 刷新当前连接 | 全局 |
| `Ctrl+1/2/3` | 切换标签页 1/2/3 | 全局 |
| `Ctrl+B` | 切换侧边栏 | 全局 |

---

## 11. 响应式策略

### 11.1 桌面端策略

DB Client 是桌面应用（Wails frameless window），但窗口可自由调整大小。**设计为宽屏优先，但支持最小800×600的窗口尺寸。**

| 断点 | 宽度 | 布局变化 |
|------|------|----------|
| **Wide** (默认) | ≥1100px | 完整布局：侧边栏(260px) + 工作区(840px+) |
| **Medium** | 800–1099px | 侧边栏缩小到200px；连接信息隐藏；工具栏文字隐藏(仅图标) |
| **Narrow** | 600–799px | 侧边栏最小化(180px)，仅显示连接列表；数据库树移到工作区上方 |
| **Tiny** | <600px | 不支持（Wails min window = 800×600） |

### 11.2 窗口resize处理

- 侧边栏通过拖拽分隔线调整宽度（180px–420px）
- 编辑器/结果面板通过水平拖拽调整高度比例
- 数据表列宽通过拖拽列边界调整
- 所有resize状态通过CSS transition平滑过渡（0ms，即时响应）

---

## 12. 设计令牌→CSS变量对照表

| 设计令牌 | CSS变量 | 说明 |
|----------|---------|------|
| 主背景 | `--bg-primary` | `#0e1117` dark / `#ffffff` light |
| 主文字 | `--fg-primary` | `#e6edf3` dark / `#1f2328` light |
| 通用边框 | `--border` | `#30363d` dark / `#d0d7de` light |
| 强调色 | `--accent` | 唯一彩色 |
| 成功 | `--success` | 仅数据状态 |
| 等宽字体 | `--font-mono` | JetBrains Mono → Cascadia Code → Consolas |
| UI字体 | `--font-sans` | Inter → system sans-serif |
| 间距基础 | `--space-n` (0–12) | 4px基础倍数 |
| 行高 | `--row-height` | 密度控制 |
| 动画时长 | `--duration-micro`/`quick`/`expand`/`enter`/`exit` | 80ms~200ms |
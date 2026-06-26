# Monaco Editor Local Files

This directory contains local copies of Monaco Editor files for offline use.

**Version:** 0.45.0

**Source:** https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/

## Files Included:

### Core Files
- `min/vs/loader.js` - AMD loader
- `min/vs/editor/editor.main.js` - Main editor module
- `min/vs/editor/editor.main.css` - Editor styles
- `min/vs/editor/editor.main.nls.js` - Localization

### Fonts
- `min/vs/base/browser/ui/codicons/codicon/codicon.ttf` - Icon font

### Language Support
- `min/vs/language/typescript/tsMode.js` - TypeScript/JavaScript support
- `min/vs/language/json/jsonMode.js` - JSON support
- `min/vs/language/html/htmlMode.js` - HTML support
- `min/vs/language/css/cssMode.js` - CSS support

## Why Local?

Using local files instead of CDN ensures:
1. **Offline capability** - Works without internet connection
2. **Faster loading** - No external network requests
3. **Stability** - No CDN downtime issues
4. **Privacy** - No external tracking

## Updating

To update to a newer version:

```powershell
# Download new version (replace 0.45.0 with desired version)
$version = "0.45.0"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/monaco-editor@$version/min/vs/loader.js" -OutFile "min/vs/loader.js"
# ... repeat for other files
```

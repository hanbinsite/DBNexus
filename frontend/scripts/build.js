/**
 * DBNexus TypeScript Build Script
 * Compiles all .ts files in src/modules/ to .js in dist/modules/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '..', 'src', 'modules');
const distDir = path.join(__dirname, '..', 'dist', 'modules');

function buildModules() {
    if (!fs.existsSync(srcDir)) {
        console.log('No src/modules directory found');
        return;
    }

    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const tsFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts'));
    console.log(`Found ${tsFiles.length} TypeScript files to compile`);

    try {
        execSync('npx tsc --project tsconfig.json', {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
        console.log('TypeScript compilation successful');
    } catch (error) {
        console.error('TypeScript compilation failed:', error.message);
        process.exit(1);
    }
}

buildModules();

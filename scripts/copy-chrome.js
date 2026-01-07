/**
 * Pre-build script to copy Puppeteer's Chromium to the project
 * Run before electron-builder: node scripts/copy-chrome.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEST_DIR = path.join(__dirname, '..', 'chrome-bundled');

async function copyChrome() {
    try {
        // Get Puppeteer's Chrome path
        const chromePath = puppeteer.executablePath();
        const chromeDir = path.dirname(chromePath);

        console.log('Source Chrome:', chromeDir);
        console.log('Destination:', DEST_DIR);

        // Remove old copy if exists
        if (fs.existsSync(DEST_DIR)) {
            fs.rmSync(DEST_DIR, { recursive: true });
        }

        // Copy Chrome folder
        fs.cpSync(chromeDir, DEST_DIR, { recursive: true });

        console.log('✓ Chrome copied successfully!');
        console.log('  Size:', getFolderSize(DEST_DIR));
    } catch (error) {
        console.error('Error copying Chrome:', error.message);
        process.exit(1);
    }
}

function getFolderSize(dir) {
    let size = 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            size += getFolderSize(filePath);
        } else {
            size += stat.size;
        }
    }
    return (size / 1024 / 1024).toFixed(1) + ' MB';
}

copyChrome();

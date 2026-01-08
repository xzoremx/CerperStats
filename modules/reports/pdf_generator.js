const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Cache Paged.js polyfill source to avoid re-reading from disk for every report
let pagedJsPolyfillSource = null;

function getPagedJsPolyfillSource() {
    if (pagedJsPolyfillSource) return pagedJsPolyfillSource;

    try {
        // pagedjs uses "exports", so we locate the package root from its main entry.
        const pagedMain = require.resolve('pagedjs');
        const pagedRoot = path.resolve(path.dirname(pagedMain), '..');
        const polyfillPath = path.join(pagedRoot, 'dist', 'paged.polyfill.min.js');
        pagedJsPolyfillSource = fs.readFileSync(polyfillPath, 'utf8');
        console.log('[PDF] Paged.js polyfill loaded from:', polyfillPath);
        return pagedJsPolyfillSource;
    } catch (err) {
        console.warn('[PDF] Paged.js not available, continuing without it:', err.message);
        pagedJsPolyfillSource = null;
        return null;
    }
}

function parseLengthToMm(value) {
    if (value == null) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|in)?$/i);
    if (!match) return null;

    const num = Number(match[1]);
    if (!Number.isFinite(num)) return null;

    const unit = (match[2] || 'px').toLowerCase();
    if (unit === 'mm') return num;
    if (unit === 'cm') return num * 10;
    if (unit === 'in') return num * 25.4;

    // Unsupported (px, pt, etc.) – skip conversion
    return null;
}

function buildPagedJsOverridesCss(pdfOptions) {
    const format = String(pdfOptions?.format || '').toUpperCase();
    if (format !== 'A4') return null;

    // A4 size in mm
    const pageWidthMm = 210;
    const pageHeightMm = 297;

    const margin = pdfOptions?.margin || {};
    const topMm = parseLengthToMm(margin.top);
    const bottomMm = parseLengthToMm(margin.bottom);
    const leftMm = parseLengthToMm(margin.left);
    const rightMm = parseLengthToMm(margin.right);

    if ([topMm, bottomMm, leftMm, rightMm].some(v => typeof v !== 'number')) return null;

    const contentWidthMm = pageWidthMm - leftMm - rightMm;
    const contentHeightMm = pageHeightMm - topMm - bottomMm;

    if (!(contentWidthMm > 0 && contentHeightMm > 0)) return null;

    // Paged.js creates its own "pages". We size those pages to the *printable content area*
    // (i.e., A4 minus Puppeteer's margins), so the paginated output fits exactly inside
    // Puppeteer's header/footer margin box without overflowing into extra pages.
    return `
@page { size: ${contentWidthMm}mm ${contentHeightMm}mm; margin: 0; }

/* Remove preview-only decorations */
.pagedjs_pagebox { box-shadow: none !important; }
.pagedjs_margin-top,
.pagedjs_margin-bottom,
.pagedjs_margin-left,
.pagedjs_margin-right { display: none !important; }
`.trim();
}

async function runPagedJsPagination(page) {
    return page.evaluate(async () => {
        if (!window.PagedPolyfill || typeof window.PagedPolyfill.preview !== 'function') {
            return { ok: false, reason: 'no_pagedjs' };
        }

        // Wait for fonts (best-effort)
        try {
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }
        } catch (_) { }

        // Wait for images (best-effort)
        try {
            const images = Array.from(document.images || []);
            await Promise.all(
                images
                    .filter(img => !img.complete)
                    .map(img =>
                        new Promise(resolve => {
                            img.addEventListener('load', resolve, { once: true });
                            img.addEventListener('error', resolve, { once: true });
                        })
                    )
            );
        } catch (_) { }

        await window.PagedPolyfill.preview();
        return { ok: true };
    });
}

/**
 * Get the Chrome executable path.
 * In packaged app: uses bundled Chrome from resources folder.
 * In development: uses Puppeteer's default Chrome.
 */
function getChromePath() {
    // Check if we're in a packaged Electron app
    const isPackaged = process.resourcesPath && !process.resourcesPath.includes('node_modules');

    if (isPackaged) {
        // Look for bundled Chrome in resources folder
        const bundledChrome = path.join(process.resourcesPath, 'chrome-win64', 'chrome.exe');
        if (fs.existsSync(bundledChrome)) {
            console.log('[PDF] Using bundled Chrome:', bundledChrome);
            return bundledChrome;
        }
        console.log('[PDF] Bundled Chrome not found at:', bundledChrome);
    }

    // Fall back to Puppeteer's default Chrome (development mode)
    try {
        const defaultPath = puppeteer.executablePath();
        console.log('[PDF] Using Puppeteer Chrome:', defaultPath);
        return defaultPath;
    } catch (e) {
        console.error('[PDF] Could not find Chrome:', e.message);
        return null;
    }
}

/**
 * Generate PDF reports from structured data.
 * @param {Object} reportData - Data for the report (cover, sections, etc.)
 * @param {String} outputPath - Full path to save the PDF
 * @param {Object} options - Additional options
 * @param {Boolean} options.includeHeaderFooter - Whether to include header/footer (default: true)
 * @param {String} options.templateType - 'cover' or 'content' (default: 'content')
 */
async function generatePDF(reportData, outputPath, options = {}) {
    const includeHeaderFooter = options.includeHeaderFooter !== false; // Default to true
    const templateType = options.templateType || 'content'; // 'cover' or 'content'
    let browser = null;
    try {
        // Get Chrome executable path
        const executablePath = getChromePath();
        if (!executablePath) {
            throw new Error('Chrome not found. Please ensure Chrome is bundled with the app.');
        }

        // Launch browser
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        page.setDefaultTimeout(180000);
        page.setDefaultNavigationTimeout(180000);
        await page.emulateMediaType('print');

        // Generate PDF with or without header/footer
        const pdfOptions = {
            path: outputPath,
            format: 'A4',
            margin: {
                top: '2cm',
                bottom: '2cm',
                left: '2cm',
                right: '2cm'
            },
            printBackground: true,
            displayHeaderFooter: includeHeaderFooter, // Show header/footer only if includeHeaderFooter is true
        };

        // Resolve path to template
        // In packaged app: templates are in extraResources/modules/reports/templates/
        // In development: templates are in __dirname/templates/
        const isPackaged = process.resourcesPath && !process.resourcesPath.includes('node_modules');
        const templatesBase = isPackaged
            ? path.join(process.resourcesPath, 'modules', 'reports', 'templates')
            : path.join(__dirname, 'templates');

        // cover.html for cover page
        // content_monoanalito.html for monoanalito content pages
        // content_multianalito.html for multianalito content pages
        let templateName;
        if (templateType === 'cover') {
            templateName = 'cover.html';
        } else {
            // For content, check tipo_analisis to select the right template
            const tipoAnalisis = reportData.tipo_analisis || '';
            const isMultianalito = tipoAnalisis.toLowerCase() === 'multi' || tipoAnalisis.toLowerCase() === 'multianalito';
            templateName = isMultianalito ? 'content_multianalito.html' : 'content_monoanalito.html';
        }
        const templatePath = path.join(templatesBase, templateName);
        console.log('[PDF] Template path:', templatePath);

        // Note: Don't use fs.existsSync inside asar - it may not work correctly
        // Trust that the template exists (it's bundled with the app)

        // Load template via file protocol
        // We use 'file://' prefix and normalize path
        const fileUrl = 'file://' + templatePath.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'networkidle0' });

        // Inject Paged.js for better pagination (content templates only)
        const usePagedJs = templateType === 'content';
        if (usePagedJs) {
            const pagedSrc = getPagedJsPolyfillSource();
            if (pagedSrc) {
                // Must be injected BEFORE calling renderReport so it can paginate final DOM.
                // IMPORTANT: Disable auto-preview; we run preview manually after renderReport.
                await page.addScriptTag({
                    content: 'window.PagedConfig = window.PagedConfig || {}; window.PagedConfig.auto = false;'
                });
                await page.addScriptTag({ content: pagedSrc });

                // Make paged output fit inside Puppeteer's margin box (header/footer area).
                const overridesCss = buildPagedJsOverridesCss(pdfOptions);
                if (overridesCss) {
                    await page.addStyleTag({ content: overridesCss });
                }
            }
        }

        // Typographic logo HTML/CSS - text only
        // Corporate header - elegant, institutional style
        const typographicLogo = `<div style="width:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:20px;padding-top:8px;"><span style="font-family:'Times New Roman',serif;font-size:11px;font-weight:600;color:#0B2F56;letter-spacing:0.08em;text-transform:uppercase;">CERPER</span></div>`;

        // Inject data into the page
        // The template must have a window.renderReport(data) function
        await page.evaluate(async (data) => {
            if (window.renderReport) {
                const maybePromise = window.renderReport(data);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    await maybePromise;
                }
            } else {
                console.error("window.renderReport function missing in template");
            }
            // Update document title from cover data
            if (data.cover && data.cover.title) {
                document.title = data.cover.title;
            }
        }, reportData);

        // Run pagination after the DOM is fully rendered
        if (templateType === 'content') {
            try {
                const result = await runPagedJsPagination(page);
                if (!result?.ok) {
                    console.log('[PDF] Paged.js skipped:', result?.reason || 'unknown');
                } else {
                    console.log('[PDF] Paged.js pagination complete');
                }
            } catch (err) {
                console.warn('[PDF] Paged.js pagination failed, continuing without it:', err.message);
            }
        }

        // Header and footer only if includeHeaderFooter is true
        if (includeHeaderFooter) {
            // Footer for content PDF
            pdfOptions.footerTemplate = `
                <div style="font-size: 8px; font-family: 'Inter', sans-serif; color: #64748b; text-align: center; width: 100%;">
                    Página <span class="pageNumber"></span> | CerperStats
                </div>
            `;

            // Header with typographic logo (HTML/CSS only, no images)
            // Using fallback fonts since @import may not work in Puppeteer headerTemplate
            pdfOptions.headerTemplate = typographicLogo;
        } else {
            // No header/footer for cover page
            pdfOptions.headerTemplate = '<div></div>';
            pdfOptions.footerTemplate = '<div></div>';
        }

        await page.pdf(pdfOptions);

        return { ok: true, path: outputPath };

    } catch (error) {
        console.error("PDF Generation Error:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { generatePDF };

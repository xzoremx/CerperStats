const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

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

        // Typographic logo HTML/CSS - text only
        // Corporate header - elegant, institutional style
        const typographicLogo = `<div style="width:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:20px;padding-top:8px;"><span style="font-family:'Times New Roman',serif;font-size:11px;font-weight:600;color:#0B2F56;letter-spacing:0.08em;text-transform:uppercase;">CERPER</span></div>`;

        // Inject data into the page
        // The template must have a window.renderReport(data) function
        await page.evaluate((data) => {
            if (window.renderReport) {
                window.renderReport(data);
            } else {
                console.error("window.renderReport function missing in template");
            }
            // Update document title from cover data
            if (data.cover && data.cover.title) {
                document.title = data.cover.title;
            }
        }, reportData);

        // Wait for any rendering images to load if needed (networkidle0 might cover it)
        // But renderReport might inject img tags with data URIs which are instant.

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

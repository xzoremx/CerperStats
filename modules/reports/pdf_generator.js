const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

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
        // Launch browser
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Safer for Electron env
        });
        
        const page = await browser.newPage();
        
        // Resolve path to template
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
        const templatePath = path.join(__dirname, 'templates', templateName);
        
        // Check if template exists
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found at: ${templatePath}`);
        }
        
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

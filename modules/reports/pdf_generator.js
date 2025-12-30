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
        
        // Resolve path to template - always use the specified template type
        // cover.html for cover page, content.html for content pages
        const templateName = templateType === 'cover' ? 'cover.html' : 'content.html';
        const templatePath = path.join(__dirname, 'templates', templateName);
        
        // Check if template exists
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found at: ${templatePath}`);
        }
        
        // Load template via file protocol
        // We use 'file://' prefix and normalize path
        const fileUrl = 'file://' + templatePath.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'networkidle0' });
        
        // Resolve logo path and convert to base64 for header template (only if header/footer is enabled)
        // Header templates in Puppeteer need base64 data URIs, not file paths
        let logoBase64 = '';
        let logoDataUri = '';
        if (includeHeaderFooter) {
            const logoPath = path.join(__dirname, 'assets', 'logo_encabezado.png');
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                logoBase64 = logoBuffer.toString('base64');
                logoDataUri = `data:image/png;base64,${logoBase64}`;
            }
        }
        
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
            
            // Header with logo if logo exists
            if (logoBase64) {
                pdfOptions.headerTemplate = `
                    <div style="width: 100%; text-align: right; padding-right: 10px; padding-top: 5px;">
                        <img src="${logoDataUri}" style="height: 30px; width: auto; max-width: 80px; display: block; margin-left: auto;" alt="CERPER">
                    </div>
                `;
            } else {
                pdfOptions.headerTemplate = '<div></div>';
            }
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

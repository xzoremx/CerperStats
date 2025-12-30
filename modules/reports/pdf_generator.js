const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * Generate PDF reports from structured data.
 * @param {Object} reportData - Data for the report (cover, sections, etc.)
 * @param {String} outputPath - Full path to save the PDF
 * @param {Object} options - Additional options
 */
async function generatePDF(reportData, outputPath, options = {}) {
    let browser = null;
    try {
        // Launch browser
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Safer for Electron env
        });
        
        const page = await browser.newPage();
        
        // Resolve path to template
        // Using __dirname to find templates relative to this script
        const templatePath = path.join(__dirname, 'templates', 'report.html');
        
        // Check if template exists
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found at: ${templatePath}`);
        }
        
        // Load template via file protocol
        // We use 'file://' prefix and normalize path
        const fileUrl = 'file://' + templatePath.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'networkidle0' });
        
        // Inject data into the page
        // The template must have a window.renderReport(data) function
        await page.evaluate((data) => {
            if (window.renderReport) {
                window.renderReport(data);
            } else {
                console.error("window.renderReport function missing in template");
            }
        }, reportData);
        
        // Wait for any rendering images to load if needed (networkidle0 might cover it)
        // But renderReport might inject img tags with data URIs which are instant.
        
        // Generate PDF
        await page.pdf({
            path: outputPath,
            format: 'A4',
            margin: { 
                top: '2cm', 
                bottom: '2cm', 
                left: '2cm', 
                right: '2cm' 
            },
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>', // Empty header
            footerTemplate: `
                <div style="font-size: 8px; font-family: 'Inter', sans-serif; color: #64748b; text-align: center; width: 100%;">
                    Página <span class="pageNumber"></span> | Generado por CerperStats
                </div>
            `,
        });
        
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

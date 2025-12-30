/**
 * Test script for redesigned HTML->PDF report generation
 * Run with: node test_pdf_generation.js
 */

const path = require('path');
const fs = require('fs');
const { generatePDF } = require('./modules/reports/pdf_generator');

// Professional sample report data
const sampleReportData = {
    cover: {
        title: "INFORME ESTADÍSTICO",
        lab: "Laboratorio Central CERPER",
        expediente: "EXP-2024-0847",
        fecha: "30/12/2024",
        ensayo: "Ensayo de Calibración Analítica",
        metodo: "Método ISO-17025:2017",
        producto: "Agua Potable",
        unidad: "mg/L",
        parametro: "Analista",
        participants: [
            { index: "Analista 1", name: "Juan Carlos Pérez García" },
            { index: "Analista 2", name: "María Elena Rodríguez López" },
            { index: "Analista 3", name: "Carlos Alberto Mendoza Torres" },
            { index: "Analista 4", name: "Ana María Sánchez" }, // Extra to test height
            { index: "Analista 5", name: "Pedro Pablo Kuczynski" }
        ],
        tests_list: [
            {
                header: "PRUEBAS ESTADÍSTICAS APLICADAS A LOS RESULTADOS",
                tests: [
                    "Prueba de Normalidad (Shapiro-Wilk)",
                    "Prueba de Valores Atípicos (Grubbs)",
                    "Prueba de Homogeneidad de Varianzas (Levene)"
                ]
            },
            {
                header: "VERACIDAD",
                tests: [
                    "Test t de Student para sesgo",
                    "Análisis de Recuperación"
                ]
            },
            {
                header: "PRECISIÓN",
                tests: [
                    "Desviación Estándar Relativa (%RSD)",
                    "Coeficiente de Variación Horwitz"
                ]
            }
        ],
        signatures: {
            supervisor_name: "Ing. Carlos Manuel López Fernández",
            supervisor_role: "Supervisor de Laboratorio / Responsable Técnico"
        }
    },
    sections: []
};

async function runTest() {
    console.log("🧪 Starting professional PDF generation test...\n");
    const outputPath = path.join(__dirname, 'test_professional_report.pdf');
    try {
        await generatePDF(sampleReportData, outputPath);
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            console.log(`\n✅ SUCCESS! Professional PDF generated.`);
            console.log(`   📁 Path: ${outputPath}`);
            console.log(`   📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
            require('child_process').exec(`start "" "${outputPath}"`);
        } else {
            console.log("❌ FAILED: PDF file was not created.");
        }
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}

runTest();

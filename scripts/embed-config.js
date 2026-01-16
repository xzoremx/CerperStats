/**
 * Pre-build script to embed .env credentials into the app
 * This creates a config file that gets bundled into the asar
 * Run before electron-builder: node scripts/embed-config.js
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_PATH = path.join(__dirname, '..', '.env');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'embedded-env.js');

function embedConfig() {
    console.log('[embed-config] Reading .env...');

    // Validate .env exists
    if (!fs.existsSync(ENV_PATH)) {
        console.error('');
        console.error('❌ ERROR: Archivo .env no encontrado');
        console.error('');
        console.error('   Para generar el ejecutable necesitas crear un archivo ".env"');
        console.error('   con la configuración del servidor backend.');
        console.error('');
        console.error('   Pasos:');
        console.error('   1. Copia .env.example a .env');
        console.error('   2. Edita .env y configura CERPER_PROXY_URL con la URL real');
        console.error('   3. Vuelve a ejecutar npm run dist');
        console.error('');
        process.exit(1);
    }

    // Read and parse .env
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const parsed = dotenv.parse(envContent);

    // Validate CERPER_PROXY_URL is present (minimum required)
    if (!parsed.CERPER_PROXY_URL || parsed.CERPER_PROXY_URL.trim() === '') {
        console.error('');
        console.error('❌ ERROR: CERPER_PROXY_URL no está configurado en .env');
        console.error('');
        console.error('   El ejecutable necesita saber la URL del servidor backend.');
        console.error('   Edita el archivo .env y configura:');
        console.error('');
        console.error('   CERPER_PROXY_URL=https://tu-servidor.com');
        console.error('');
        process.exit(1);
    }

    // Warning if using localhost (won't work on other PCs)
    if (parsed.CERPER_PROXY_URL.includes('localhost') || parsed.CERPER_PROXY_URL.includes('127.0.0.1')) {
        console.warn('');
        console.warn('⚠️  ADVERTENCIA: CERPER_PROXY_URL está configurado con localhost');
        console.warn('');
        console.warn('   El ejecutable NO funcionará en otras PCs porque intentará');
        console.warn('   conectarse a localhost (que no existe en esas máquinas).');
        console.warn('');
        console.warn('   Para distribución, usa una URL pública:');
        console.warn('   CERPER_PROXY_URL=https://tu-servidor.com');
        console.warn('');
        console.warn('   Continuando en 5 segundos...');
        console.warn('');
        // Give time to read and cancel if needed
        const waitMs = 5000;
        const start = Date.now();
        while (Date.now() - start < waitMs) {
            // Busy wait
        }
    }

    // Only embed the necessary variables for the packaged app
    const keysToEmbed = [
        'CERPER_PROXY_URL',
        'CERPER_EVAL_URL',
        'CERPER_PROXY_TOKEN'
    ];

    const embedded = {};
    for (const key of keysToEmbed) {
        if (parsed[key]) {
            // Simple obfuscation: Base64 encode
            embedded[key] = Buffer.from(parsed[key]).toString('base64');
        }
    }

    // Generate the config file
    const configContent = `/**
 * AUTO-GENERATED - DO NOT EDIT
 * Embedded configuration for packaged app
 * Generated at: ${new Date().toISOString()}
 */
const _c = ${JSON.stringify(embedded, null, 2)};

// Decode function
const _d = (v) => v ? Buffer.from(v, 'base64').toString('utf8') : undefined;

module.exports = {
    CERPER_PROXY_URL: _d(_c.CERPER_PROXY_URL),
    CERPER_EVAL_URL: _d(_c.CERPER_EVAL_URL),
    CERPER_PROXY_TOKEN: _d(_c.CERPER_PROXY_TOKEN),
};
`;

    // Write config file
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, configContent);

    console.log('[embed-config] ✓ Created:', CONFIG_PATH);
    console.log('[embed-config] ✓ Embedded keys:', Object.keys(embedded).join(', '));
}

embedConfig();

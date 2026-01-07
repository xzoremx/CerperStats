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

    // Read and parse .env
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const parsed = dotenv.parse(envContent);

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

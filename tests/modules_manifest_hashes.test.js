/**
 * Regression test: ensure modules_manifest.json hashes stay in sync
 * for the RSD precision modules (11 and 14).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256Hex(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('modules/_common/modules_manifest.json sha256_module', () => {
    test('hashes match for python/11 and python/14', () => {
        const repoRoot = path.resolve(__dirname, '..');
        const manifestPath = path.join(repoRoot, 'modules', '_common', 'modules_manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

        const targets = ['python/11/principal.py', 'python/14/principal.py'];
        for (const moduleAsset of targets) {
            const entry = entries.find(e => e && e.module_asset === moduleAsset);
            expect(entry).toBeTruthy();
            expect(entry.sha256_module).toBeTruthy();

            const modulePath = path.join(repoRoot, 'modules', ...moduleAsset.split('/'));
            const actual = sha256Hex(fs.readFileSync(modulePath)).toLowerCase();
            expect(actual).toBe(String(entry.sha256_module).toLowerCase());

            const graphAsset = entry.script_grafico || entry.graph_asset;
            if (graphAsset) {
                const graphPath = path.join(repoRoot, 'modules', ...String(graphAsset).split('/'));
                const graphActual = sha256Hex(fs.readFileSync(graphPath)).toLowerCase();
                const expectedGraphHash = String(entry.sha256_script_grafico || entry.sha256_graph || '').toLowerCase();
                expect(expectedGraphHash).toBeTruthy();
                expect(graphActual).toBe(expectedGraphHash);
            }
        }
    });
});

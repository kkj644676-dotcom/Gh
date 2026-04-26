const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');

/**
 * Versión Restaurada: Mantiene todo tu parseo original 
 * corregido para que no pierda la conexión con el script.
 */
function deobfuscate(code) {
    return new Promise((resolve) => {

        const uid        = crypto.randomBytes(8).toString('hex');
        const tempLua    = path.join(os.tmpdir(), `deob_${uid}.lua`);
        const reportFile = tempLua + '.report.txt';
        // Aseguramos la ruta absoluta del script
        const scriptPath = path.join(__dirname, 'deobfuscator.py');

        try {
            fs.writeFileSync(tempLua, code, { encoding: 'utf8' });
        } catch (err) {
            return resolve({
                code: `[ERROR] No se pudo escribir el archivo temporal:\n${err.message}`,
                techniques: 'week point',
                status: 'Error'
            });
        }

        // Usamos 'python3' o 'python' según disponibilidad, apuntando al scriptPath
        const pyProc = spawn('python3', [scriptPath, tempLua], {
            cwd: __dirname,
        });

        let stderrBuf = '';
        pyProc.stderr.on('data', (chunk) => { stderrBuf += chunk.toString('utf8'); });

        pyProc.on('close', (exitCode) => {
            if (fs.existsSync(tempLua)) try { fs.unlinkSync(tempLua); } catch (_) {}

            let rawReport = '';
            if (fs.existsSync(reportFile)) {
                try { 
                    rawReport = fs.readFileSync(reportFile, 'utf8'); 
                    fs.unlinkSync(reportFile);
                } catch (_) {}
            }

            if (!rawReport) {
                const errMsg = [
                    `[ERROR] El Python no generó reporte. Exit code: ${exitCode}`,
                    stderrBuf.trim() ? `\nSTDERR:\n${stderrBuf.trim()}` : '\nRevisa si deobfuscator.py existe y funciona.',
                ].join('');
                return resolve({ code: errMsg, techniques: 'week point', status: 'Error' });
            }

            const parsed = parseReport(rawReport);
            const failed = exitCode !== 0 || parsed.hasError;
            let status = failed ? 'Failed' : 'Success';

            resolve({ 
                code: buildOutput(parsed), 
                techniques: parsed.techniques, 
                status: status 
            });
        });

        pyProc.on('error', (err) => {
            if (fs.existsSync(tempLua)) try { fs.unlinkSync(tempLua); } catch (_) {}
            resolve({
                code: `[ERROR] No se pudo iniciar Python: ${err.message}`,
                techniques: 'week point',
                status: 'Error'
            });
        });
    });
}

// RESTAURADO: Tu lógica original de detección completa
function parseReport(raw) {
    const lines = raw.split('\n');
    let inTrace = false, inConstants = false, inLoadstring = false;

    const traceLines = [], constantsLines = [], urls = [], globals = [], callResults = [];
    const propSets = [], accessed = [], tracePrints = [], loadstrings = [], closures = [], unpackEvents = [];
    let currentLoadstring = [], hasError = false;

    for (const line of lines) {
        if (line.includes('[ERROR]')) hasError = true;
        if (line.trim() === '--- TRACE ---') { inTrace = true; inConstants = false; continue; }
        if (line.trim() === '--- CONSTANTS ---') { inConstants = true; inTrace = false; continue; }
        
        if (inTrace) {
            if (!line.trim()) continue;
            traceLines.push(line);
            if (line.includes('URL DETECTED')) {
                const m = line.match(/https?:\/\/[^\s"']+/);
                if (m && !urls.includes(m[0])) urls.push(m[0]);
            }
            if (line.startsWith('SET GLOBAL -->')) globals.push(line.replace('SET GLOBAL --> ', '').trim());
            if (line.startsWith('CALL_RESULT -->')) callResults.push(line.replace('CALL_RESULT --> ', '').trim());
            if (line.startsWith('PROP_SET -->')) propSets.push(line.replace('PROP_SET --> ', '').trim());
            if (line.startsWith('ACCESSED -->')) {
                const acc = line.replace('ACCESSED --> ', '').trim();
                if (!accessed.includes(acc)) accessed.push(acc);
            }
            if (line.startsWith('TRACE_PRINT -->')) tracePrints.push(line.replace('TRACE_PRINT --> ', '').trim());
            if (line.startsWith('LOADSTRING DETECTED')) { inLoadstring = true; currentLoadstring = [line]; continue; }
            if (line === 'LOADSTRING CONTENT END') {
                if (currentLoadstring.length) loadstrings.push(currentLoadstring.join('\n'));
                inLoadstring = false; continue;
            }
            if (inLoadstring) { currentLoadstring.push(line); continue; }
            if (line.startsWith('--- ENTERING CLOSURE FOR')) closures.push(line.replace('--- ENTERING CLOSURE FOR ', '').replace(' ---', '').trim());
            if (line.startsWith('UNPACK CALLED') || line.startsWith('CAPTURED CHUNK')) unpackEvents.push(line.trim());
        }
        if (inConstants && line.trim()) constantsLines.push(line);
    }

    const techniqueSet = new Set();
    if (loadstrings.length > 0) techniqueSet.add('LoadString');
    if (constantsLines.length > 0) techniqueSet.add('Constants');
    if (urls.length > 0) techniqueSet.add('URLs');
    if (unpackEvents.length > 0) techniqueSet.add('Unpack');
    
    return {
        traceLines, constantsLines, urls, globals, callResults,
        propSets, accessed, tracePrints, loadstrings, closures,
        unpackEvents, techniques: techniqueSet.size > 0 ? [...techniqueSet].join(', ') : 'week point', 
        hasError,
    };
}

// RESTAURADO: Tu formato de salida original
function buildOutput(p) {
    const out = [];
    out.push('============================================================');
    out.push('           DEOBFUSCATION REPORT');
    out.push('============================================================');

    if (p.urls.length > 0) { out.push('\n[URLS DETECTADAS]'); p.urls.forEach(u => out.push('  ' + u)); }
    if (p.loadstrings.length > 0) {
        out.push('\n[LOADSTRINGS CAPTURADOS]');
        p.loadstrings.forEach((ls, i) => { out.push(`\n  --- LoadString #${i + 1} ---\n${ls}`); });
    }
    if (p.constantsLines.length > 0) { out.push('\n[CONSTANTS TABLE]'); p.constantsLines.forEach(c => out.push(c)); }

    out.push('\n============================================================');
    out.push('  RAW TRACE COMPLETO');
    out.push('============================================================');
    p.traceLines.forEach(l => out.push(l));

    return out.join('\n');
}

module.exports = { deobfuscate };


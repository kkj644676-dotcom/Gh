const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const express = require('express');
const { createPaste } = require('./pastefy.js');

// ---------------------------------------------------------------------------
// DEOBFUSCATOR (inlined — sin dependencia de ./deobfuscator.js)
// ---------------------------------------------------------------------------

/**
 * Llama al deobfuscator Python con el código Lua recibido.
 * Devuelve { code, techniques, status }.
 *
 * @param {string} luaCode  Código Lua ofuscado
 * @returns {Promise<{code: string, techniques: string, status: string}>}
 */
function deobfuscate(luaCode) {
    return new Promise((resolve, reject) => {
        // 1. Escribir el código en un archivo temporal .lua
        const tmpInput = path.join(os.tmpdir(), `deob_input_${Date.now()}.lua`);
        try {
            fs.writeFileSync(tmpInput, luaCode, 'utf8');
        } catch (err) {
            return reject(new Error(`No se pudo escribir el archivo temporal: ${err.message}`));
        }

        const reportFile = tmpInput + '.report.txt';

        // 2. Ejecutar el script Python pasándole la ruta del .lua
        //    El script guarda el reporte en <tmpInput>.report.txt
        const pythonBin = process.env.PYTHON_BIN || 'python3'; // override si hace falta
        const scriptPath = path.join(__dirname, 'deobfuscator__3_.py');

        execFile(
            pythonBin,
            [scriptPath, tmpInput],
            { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
                // 3. Limpiar input temporal sin importar el resultado
                try { fs.unlinkSync(tmpInput); } catch (_) {}

                if (error && !fs.existsSync(reportFile)) {
                    // Fallo total: ni siquiera se generó el reporte
                    return reject(new Error(
                        `Python falló (${error.code ?? 'timeout'}):\n${stderr || stdout}`
                    ));
                }

                // 4. Leer el reporte generado por Python
                let reportContent = '';
                try {
                    reportContent = fs.readFileSync(reportFile, 'utf8');
                    fs.unlinkSync(reportFile); // limpiar
                } catch (_) {
                    reportContent = stdout || '(sin salida)';
                }

                // 5. Parsear el reporte y construir la respuesta
                const { code, techniques, status } = parseReport(reportContent, stdout, stderr);
                resolve({ code, techniques, status });
            }
        );
    });
}

/**
 * Extrae las secciones del reporte de texto generado por el Python.
 * Devuelve { code, techniques, status }.
 */
function parseReport(reportContent, stdout = '', stderr = '') {
    // --- Constantes desofuscadas ---
    const constantsMatch = reportContent.match(
        /--- CONSTANTS ---\n([\s\S]*?)(?:$|--- [A-Z])/
    );
    const constants = constantsMatch ? constantsMatch[1].trim() : '';

    // --- Líneas de traza (ACCESSED, SET GLOBAL, URL DETECTED, etc.) ---
    const traceMatch = reportContent.match(
        /--- TRACE ---\n([\s\S]*?)(?:--- CONSTANTS ---)/
    );
    const traceRaw = traceMatch ? traceMatch[1].trim() : '';

    // Detectar técnicas de ofuscación a partir del trace
    const techniqueSet = new Set();
    if (traceRaw.includes('LOADSTRING'))       techniqueSet.add('loadstring');
    if (traceRaw.includes('UNPACK CALLED'))    techniqueSet.add('unpack-chunks');
    if (traceRaw.includes('URL DETECTED'))     techniqueSet.add('url-injection');
    if (traceRaw.includes('CLOSURE'))          techniqueSet.add('closures');
    if (traceRaw.includes('SET GLOBAL'))       techniqueSet.add('global-env-manipulation');
    if (constants.includes('local Constants')) techniqueSet.add('string-table');

    const techniques = techniqueSet.size > 0
        ? Array.from(techniqueSet).join(', ')
        : 'unknown';

    // --- Código final (constants + trace como contexto) ---
    const code = [
        constants || '-- (no se extrajeron constantes)',
        traceRaw  ? `\n-- == TRACE ==\n${traceRaw}` : ''
    ].join('\n').trim();

    // --- Estado ---
    const hasError = stderr && stderr.trim().length > 0;
    const status = hasError
        ? `⚠️ completado con advertencias`
        : '✅ completado';

    return { code, techniques, status };
}

// ---------------------------------------------------------------------------
// SERVIDOR EXPRESS (Railway keep-alive)
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3030;

app.get('/', (_req, res) => res.send('Bot Status: Online 🚀'));
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));

// ---------------------------------------------------------------------------
// BOT DE DISCORD
// ---------------------------------------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN   = process.env.DISCORD_TOKEN;
const API_KEY = process.env.PASTEFY_API_KEY;

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('.l') || message.author.bot) return;

    const startTime = Date.now();
    let code = '';

    try {
        // Obtener código — adjunto o inline
        if (message.attachments.size > 0) {
            const file = message.attachments.first();
            const res  = await fetch(file.url);
            code = await res.text();
        } else {
            code = message.content.slice(3).trim();
        }

        if (!code) return;

        // Ejecutar deobfuscator inlineado
        const result    = await deobfuscate(code);
        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3);

        // Guardar localmente y subir a Pastefy
        fs.writeFileSync('code.txt', result.code);
        const rawUrl = await createPaste(result.code, API_KEY);

        const preview = result.code.split('\n').slice(0, 3).join('\n') + '\n...';

        const greenEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('dump successfully')
            .setDescription(
                `**time**\n${timeTaken}s\n\n**techniques**\n${result.techniques}` +
                `\n\n**status**\n${result.status}\n\n\`\`\`js\n${preview}\n\`\`\``
            );

        const grayEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setDescription(`\n\n[open link](${rawUrl})`);

        await message.reply({
            embeds: [greenEmbed, grayEmbed],
            files:  [new AttachmentBuilder('./code.txt')]
        });

    } catch (error) {
        console.error('Error en el proceso:', error);
        message.reply('Ocurrió un error procesando el deobfuscate.');
    }
});

client.login(TOKEN);

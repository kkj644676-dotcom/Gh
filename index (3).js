const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { createPaste } = require('./pastefy.js');
const { deobfuscate } = require('./deobfuscator.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ── CONFIGURACIÓN ──────────────────────────────────────────────────────────────
const TOKEN   = "MTQ5NzMxNzM2MzUyNjEzOTk5NA.GMGhVh.BS20FiUWK_1l2pEb8mgqrXNDg8D0nsMCYDByP8";
const API_KEY = "ZMSzU3ohPPDKe80DkRBfbWkRp4lN65BySAcYmLY7CWateDIuVIljyp3JQuRT";

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('.l') || message.author.bot) return;

    const startTime = Date.now();
    let code = "";

    // ── Obtener el código: adjunto o texto inline ──────────────────────────────
    if (message.attachments.size > 0) {
        const file = message.attachments.first();
        const res  = await fetch(file.url);
        code       = await res.text();
    } else {
        code = message.content.slice(3).trim();
    }

    if (!code) return;

    // ── Ejecutar el deobfuscator (ahora asíncrono via Python) ──────────────────
    const result    = await deobfuscate(code);           // <-- await agregado
    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3);

    // ── Guardar resultado y subir a Pastefy ───────────────────────────────────
    fs.writeFileSync('code.txt', result.code);
    const rawUrl = await createPaste(result.code, API_KEY);

    // ── Preview: primeras 3 líneas del reporte ────────────────────────────────
    const preview = result.code.split('\n').slice(0, 3).join('\n') + "\n...";

    // ── EMBED VERDE ───────────────────────────────────────────────────────────
    const greenEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('dump suseffely')
        .setDescription(
            `\n\n\n\ntime\n${timeTaken}s\n\n\n\ntecniquinas\n${result.techniques}` +
            `\n\nstatus\n${result.status}\n\n\`\`\`js\n${preview}\n\`\`\``
        );

    // ── EMBED GRIS ────────────────────────────────────────────────────────────
    const grayEmbed = new EmbedBuilder()
        .setColor('#808080')
        .setDescription(`\n\n\n[open link](${rawUrl})`);

    await message.reply({
        embeds: [greenEmbed, grayEmbed],
        files:  [new AttachmentBuilder('./code.txt')]
    });
});

client.login(TOKEN);

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express'); // Necesario para Railway
const { createPaste } = require('./pastefy.js');
const { deobfuscate } = require('./deobfuscator.js');

// --- CONFIGURACIÓN DE SERVIDOR (PARA RAILWAY) ---
const app = express();
const PORT = process.env.PORT || 3030;

app.get('/', (req, res) => res.send('Bot online 🚀'));
app.listen(PORT, () => console.log(`Servidor web escuchando en puerto ${PORT}`));

// --- CONFIGURACIÓN DEL BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Variables desde el entorno (Configúralas en Railway)
const TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.PASTEFY_API_KEY;

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('.l') || message.author.bot) return;

    const startTime = Date.now();
    let code = "";

    try {
        // ── Obtener el código: adjunto o texto inline ──
        if (message.attachments.size > 0) {
            const file = message.attachments.first();
            const res = await fetch(file.url);
            code = await res.text();
        } else {
            code = message.content.slice(3).trim();
        }

        if (!code) return;

        // ── Ejecutar el deobfuscator ──
        const result = await deobfuscate(code);
        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3);

        // ── Guardar resultado y subir a Pastefy ──
        const fileName = 'code.txt';
        fs.writeFileSync(fileName, result.code);
        const rawUrl = await createPaste(result.code, API_KEY);

        // ── Preview: primeras 3 líneas del reporte ──
        const preview = result.code.split('\n').slice(0, 3).join('\n') + "\n...";

        // ── EMBED VERDE ──
        const greenEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Dump Successfully')
            .setDescription(
                `**Time:**\n${timeTaken}s\n\n**Techniques:**\n${result.techniques}` +
                `\n\n**Status:**\n${result.status}\n\n\`\`\`js\n${preview}\n\`\`\``
            );

        // ── EMBED GRIS ──
        const grayEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setDescription(`\n\n[Open Link](${rawUrl})`);

        await message.reply({
            embeds: [greenEmbed, grayEmbed],
            files: [new AttachmentBuilder(`./${fileName}`)]
        });

    } catch (error) {
        console.error("Error al procesar:", error);
        message.reply("Ocurrió un error al procesar el código.");
    }
});

client.login(TOKEN);


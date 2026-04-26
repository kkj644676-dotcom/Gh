const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express'); 
const { createPaste } = require('./pastefy.js');
const deobfuscate = require('./deobfuscatorWrapper.js');

const app = express();
const PORT = process.env.PORT || 3030; 

app.get('/', (req, res) => res.send('Bot Status: Online 🚀'));
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.DISCORD_TOKEN; 
const API_KEY = process.env.PASTEFY_API_KEY;

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('.l') || message.author.bot) return;

    const startTime = Date.now();
    let code = "";

    try {
        if (message.attachments.size > 0) {
            const file = message.attachments.first();
            const res = await fetch(file.url);
            code = await res.text();
        } else {
            code = message.content.slice(3).trim();
        }

        if (!code) return;

        // Llama al wrapper que ejecuta python3 deobfuscator.py --json
        const result = await deobfuscate(code); 
        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3);

        fs.writeFileSync('code.txt', result.code);
        const rawUrl = await createPaste(result.code, API_KEY);

        const preview = result.code.split('\n').slice(0, 3).join('\n') + "\n...";

        const greenEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('dump suseffely')
            .setDescription(
                `**time**\n${timeTaken}s\n\n**tecniquinas**\n${result.techniques}` +
                `\n\n**status**\n${result.status}\n\n\`\`\`js\n${preview}\n\`\`\``
            );

        const grayEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setDescription(`\n\n[open link](${rawUrl})`);

        await message.reply({
            embeds: [greenEmbed, grayEmbed],
            files: [new AttachmentBuilder('./code.txt')]
        });

    } catch (error) {
        console.error("Error:", error);
        message.reply("Ocurrió un error procesando el deobfuscate.");
    }
});

client.login(TOKEN);

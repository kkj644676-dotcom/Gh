const axios = require('axios');

async function createPaste(content, apiKey) {
    try {
        const response = await axios.post('https://pastefy.app/api/v2/item', {
            content: content,
            title: "Deobfuscated Code",
            type: "paste"
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return `https://pastefy.app/${response.data.item.id}/raw`;
    } catch (error) {
        return "https://pastefy.app/error";
    }
}

module.exports = { createPaste };

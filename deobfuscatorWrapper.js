const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = function(code) {
    return new Promise((resolve, reject) => {
        const tmpFile = path.join(__dirname, `temp_${Date.now()}.lua`);
        fs.writeFileSync(tmpFile, code);

        // Usamos el modo --json que ya existe en tu deobfuscator.py
        const pythonProcess = spawn('python3', ['deobfuscator.py', '--json', tmpFile]);
        
        let output = '';
        pythonProcess.stdout.on('data', (data) => output += data.toString());
        
        pythonProcess.on('close', (code) => {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            try {
                resolve(JSON.parse(output));
            } catch (e) {
                reject("Error parsing Python output: " + output);
            }
        });
    });
};


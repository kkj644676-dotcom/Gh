// deobfuscatorWrapper.js
const { spawn } = require('child_process');

module.exports = function ejecutarPython(inputData) {
    return new Promise((resolve, reject) => {
        // Ejecuta deobfuscator.py
        const pythonProcess = spawn('python3', ['deobfuscator.py', inputData]);
        
        let output = '';

        // Captura el resultado de Python
        pythonProcess.stdout.on('data', (data) => { 
            output += data.toString(); 
        });
        
        // Captura errores si los hay
        pythonProcess.stderr.on('data', (data) => { 
            console.error(`Error en Python: ${data}`); 
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                // Devolvemos el objeto que tu index.js espera
                resolve({
                    code: output.trim(),
                    techniques: "Auto-Detected",
                    status: "Success ✅"
                });
            } else {
                reject(`Python falló con código ${code}`);
            }
        });
    });
};


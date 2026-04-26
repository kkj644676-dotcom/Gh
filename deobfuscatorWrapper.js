// deobfuscatorWrapper.js
const { spawn } = require('child_process');

// Exportamos la ejecución de Python para que index.js la use
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
        
        // Cuando Python termine, devuelve el código limpio
        pythonProcess.on('close', (code) => {
            if (code === 0) resolve(output);
            else reject(`Python falló con código ${code}`);
        });
    });
};

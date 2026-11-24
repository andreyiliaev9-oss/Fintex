const fs=require('node:fs');
fs.mkdirSync('assets/ocr',{recursive:true});
for(const [from,to] of [
 ['tesseract.js/dist/tesseract.min.js','tesseract.min.js'],
 ['tesseract.js/dist/worker.min.js','worker.min.js'],
 ['tesseract.js/dist/tesseract.min.js.LICENSE.txt','tesseract-bundle.LICENSE.txt'],
 ['tesseract.js/dist/worker.min.js.LICENSE.txt','worker-bundle.LICENSE.txt'],
 ['tesseract.js/LICENSE.md','tesseract.LICENSE.md'],
 ['tesseract.js-core/tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm.js'],
 ['tesseract.js-core/LICENSE','tesseract-core.LICENSE'],
 ['jsqr/dist/jsQR.js','jsQR.js'],
 ['jsqr/LICENSE','jsQR.LICENSE'],
 ['pdfjs-dist/legacy/build/pdf.min.mjs','pdf.min.mjs'],
 ['pdfjs-dist/legacy/build/pdf.worker.min.mjs','pdf.worker.min.mjs'],
 ['pdfjs-dist/LICENSE','pdfjs.LICENSE']
]){
 const data=fs.readFileSync('node_modules/'+from);
 fs.writeFileSync('assets/ocr/'+to,to.includes('LICENSE')?data.toString().trimEnd()+'\n':data);
}

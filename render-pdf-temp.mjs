import { createCanvas } from 'canvas';
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const pdfPath = 'C:/Users/Shailesh.Dhuriya/Downloads/Ozee_Presentation.pdf';
const outDir  = 'C:/Users/SHAILE~1.DHU/AppData/Local/Temp/claude/C--Users-Shailesh-Dhuriya/4e254ef4-2c25-4d64-af0e-630f7a334bf2/scratchpad';

class NodeCanvasFactory {
  create(w, h) {
    const canvas = createCanvas(w, h);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(canvasAndCtx, w, h) {
    canvasAndCtx.canvas.width = w;
    canvasAndCtx.canvas.height = h;
  }
  destroy(canvasAndCtx) {
    canvasAndCtx.canvas.width = 0;
    canvasAndCtx.canvas.height = 0;
  }
}

const canvasFactory = new NodeCanvasFactory();
const data = new Uint8Array(readFileSync(pdfPath));
const loadTask = pdfjsLib.getDocument({ data, canvasFactory });
const doc = await loadTask.promise;
console.log('Pages:', doc.numPages);

async function renderPage(num, file) {
  const page = await doc.getPage(num);
  const viewport = page.getViewport({ scale: 2 });
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
  await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
  writeFileSync(file, canvas.toBuffer('image/png'));
  console.log('Saved:', file);
  page.cleanup();
}

await renderPage(1, outDir + '/ozee_p1.png');
await renderPage(doc.numPages, outDir + '/ozee_plast.png');
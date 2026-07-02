import { createCanvas } from 'canvas';
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const outDir = 'C:/Users/SHAILE~1.DHU/AppData/Local/Temp/claude/C--Users-Shailesh-Dhuriya/4e254ef4-2c25-4d64-af0e-630f7a334bf2/scratchpad';
class NodeCanvasFactory {
  create(w,h){const c=createCanvas(w,h);return{canvas:c,context:c.getContext('2d')};}
  reset(o,w,h){o.canvas.width=w;o.canvas.height=h;}
  destroy(o){o.canvas.width=0;o.canvas.height=0;}
}
const canvasFactory = new NodeCanvasFactory();
const data = new Uint8Array(readFileSync('C:/Users/Shailesh.Dhuriya/Downloads/Ozee_Presentation.pdf'));
const doc = await pdfjsLib.getDocument({data,canvasFactory}).promise;
for(let i=1;i<=doc.numPages;i++){
  const page=await doc.getPage(i);
  const vp=page.getViewport({scale:1.5});
  const {canvas,context}=canvasFactory.create(vp.width,vp.height);
  await page.render({canvasContext:context,viewport:vp,canvasFactory}).promise;
  writeFileSync(`${outDir}/ozee_slide${i}.png`,canvas.toBuffer('image/png'));
  console.log('page',i);
  page.cleanup();
}

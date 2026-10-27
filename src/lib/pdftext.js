// Reads text from a PDF on the device. Typed PDFs have a text layer; scanned PDFs are
// rendered to an image and read with the same on-device text reader used for photos.
import { prepareCanvas, recognizeCanvas } from './ocr.js';

const MAX_PAGES = 5;

export async function readPdf(file, onProgress = () => {}) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = Math.min(pdf.numPages, MAX_PAGES);
  const texts = [];
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let pageText = '';
    for (const item of content.items) {
      pageText += item.str;
      pageText += item.hasEOL ? '\n' : item.str.endsWith(' ') ? '' : ' ';
    }
    texts.push(pageText);
  }
  let text = texts.join('\n\n').replace(/[ \t]+\n/g, '\n');
  let usedOcr = false;

  if (text.replace(/\s/g, '').length < 40) {
    // Probably a scan: no text layer.
    usedOcr = true;
    const ocrPages = [];
    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const prepared = prepareCanvas(canvas, canvas.width, canvas.height);
      const { text: t } = await recognizeCanvas(prepared, (x) => onProgress((p - 1 + x) / pages));
      ocrPages.push(t);
    }
    text = ocrPages.join('\n\n');
  }
  return { text, pages: pdf.numPages, truncated: pdf.numPages > MAX_PAGES, usedOcr };
}

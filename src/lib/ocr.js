// Reads text from photos ON THE DEVICE with Tesseract.js — the photo is never uploaded.

let workerPromise = null;
let progressHandler = () => {};

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') progressHandler(m.progress);
        },
      });
    })();
  }
  return workerPromise;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened. Try a JPG or PNG photo.'));
    };
    img.src = url;
  });
}

// Phone photos are big and uneven. Resize, convert to grayscale and stretch the contrast
// so the text reader has an easier time.
export function prepareCanvas(source, width, height) {
  const longSide = Math.max(width, height);
  const scale = longSide > 2400 ? 2400 / longSide : longSide < 1400 ? 1400 / longSide : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  let min = 255;
  let max = 0;
  const gray = new Uint8ClampedArray(px.length / 4);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = ((gray[j] - min) / range) * 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export async function recognizeCanvas(canvas, onProgress = () => {}) {
  progressHandler = onProgress;
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  return { text: data.text || '', confidence: data.confidence ?? 0 };
}

export async function readImage(file, onProgress) {
  const img = await loadImage(file);
  const canvas = prepareCanvas(img, img.naturalWidth, img.naturalHeight);
  return recognizeCanvas(canvas, onProgress);
}

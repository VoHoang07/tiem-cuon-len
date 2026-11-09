import { Platform } from 'react-native';

export type StudioRetouchPreset =
  | 'vivid_stitch_1x1'
  | 'studio_cutout_cream'
  | 'studio_card_float'
  | 'studio_cutout_peach'
  | 'studio_warm_wood';

export type CoverCollageLayout = 'grid_auto' | 'hero_strip' | 'polaroid_fan';

export interface StudioPresetInfo {
  id: StudioRetouchPreset;
  label: string;
  shortLabel: string;
  description: string;
}

export const STUDIO_RETOUCH_PRESETS: StudioPresetInfo[] = [
  {
    id: 'vivid_stitch_1x1',
    label: '☀️ Làm Nét Mũi Len HD + Nắng Ấm 1:1',
    shortLabel: '☀️ Làm Nét HD 1:1',
    description:
      'Tự động cân bằng sáng, làm nổi từng mũi móc len (Unsharp Mask HD) và căn chuẩn khung vuông 1:1.',
  },
  {
    id: 'studio_cutout_cream',
    label: '✨ Tách Nền & Ghép Phông Studio Kem Ấm',
    shortLabel: '✨ Tách Nền Kem Ấm',
    description:
      'Tự động làm mờ/tách nền bàn xung quanh và ghép lên phông Studio Kem Sữa Hàn Quốc, giữ nguyên 100% sản phẩm ở giữa.',
  },
  {
    id: 'studio_card_float',
    label: '🖼️ Khung Studio Nổi 3D Trên Nền Kem',
    shortLabel: '🖼️ Khung Nổi 3D',
    description:
      'Làm nét sản phẩm và đặt trong khung bo tròn nổi 3D trên nền Studio Kem Ấm (đẹp với mọi ảnh, kể cả ảnh cầm trên tay).',
  },
  {
    id: 'studio_cutout_peach',
    label: '🌸 Ghép Phông Studio Hồng Đào Pastel',
    shortLabel: '🌸 Phông Hồng Đào',
    description:
      'Tách/hoà trộn viền nền sang phông Studio Hồng Đào ngọt ngào kèm làm nét sợi len HD.',
  },
  {
    id: 'studio_warm_wood',
    label: '🪵 Khung Studio Tone Nâu Gỗ Vintage',
    shortLabel: '🪵 Tone Gỗ Vintage',
    description:
      'Làm nét sản phẩm kèm phông nền tone Nâu Kem Vintage ấm áp chuẩn tiệm đồ thủ công.',
  },
];

function encodeCanvasHd(
  canvas: HTMLCanvasElement,
  quality: number = 0.93
): string {
  try {
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp && webp.startsWith('data:image/webp')) {
      return webp;
    }
  } catch {
    // Fallback to JPEG
  }
  return canvas.toDataURL('image/jpeg', quality);
}

function loadWebImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !src) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), 5000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Applies auto studio exposure lift + warm white balance + true 3x3 Unsharp Mask (USM)
 * so every yarn stitch and fiber pops with crystal-clear sharpness while keeping 100% of the real product intact.
 */
function applyYarnStitchSharpenAndLight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sharpenStrength: number = 0.56
) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    // 1. Sample average luminance to detect dim indoor lighting
    let lumSum = 0;
    let sampleCount = 0;
    const step = 16 * 4;
    for (let i = 0; i < len; i += step) {
      if (data[i + 3] < 128) continue;
      lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sampleCount++;
    }
    const avgLum = sampleCount > 0 ? lumSum / sampleCount : 135;
    // Gently brighten if indoor photo is dark (avgLum < 128), without blowing out highlights
    const needLift = avgLum < 128;
    const gamma = needLift
      ? Math.max(0.84, Math.min(0.96, avgLum / 142))
      : 0.97;

    // Lookup table for fast gamma + subtle warm studio contrast S-curve
    const lutR = new Uint8ClampedArray(256);
    const lutG = new Uint8ClampedArray(256);
    const lutB = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      const norm = Math.pow(v / 255, gamma);
      // Gentle S-curve contrast around midpoint
      const curved = norm + 0.045 * Math.sin((norm - 0.5) * Math.PI);
      const base = Math.max(0, Math.min(255, curved * 255));
      lutR[v] = Math.min(255, Math.round(base * 1.015)); // Warm studio highlight
      lutG[v] = Math.min(255, Math.round(base * 1.005));
      lutB[v] = Math.min(255, Math.round(base * 0.992));
    }

    const srcCopy = new Uint8ClampedArray(len);
    for (let i = 0; i < len; i += 4) {
      srcCopy[i] = lutR[data[i]];
      srcCopy[i + 1] = lutG[data[i + 1]];
      srcCopy[i + 2] = lutB[data[i + 2]];
      srcCopy[i + 3] = data[i + 3];
    }

    // 2. Fast 3x3 Unsharp Mask (USM) on yarn textures (with noise threshold = 4)
    const rowStride = width * 4;
    const threshold = 4;
    for (let y = 1; y < height - 1; y++) {
      let idx = (y * width + 1) * 4;
      for (let x = 1; x < width - 1; x++, idx += 4) {
        if (srcCopy[idx + 3] < 32) continue;
        for (let c = 0; c < 3; c++) {
          const i = idx + c;
          const center = srcCopy[i];
          const blur =
            (srcCopy[i - 4] +
              srcCopy[i + 4] +
              srcCopy[i - rowStride] +
              srcCopy[i + rowStride] +
              center * 4) >>
            3;
          const diff = center - blur;
          if (diff > threshold || diff < -threshold) {
            const val = center + diff * sharpenStrength * 1.85;
            data[i] = val < 0 ? 0 : val > 255 ? 255 : val;
          } else {
            data[i] = center;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Ignore if canvas security restricts getImageData
  }
}

/**
 * Performs smart border flood-segmentation + feathered subject mask
 * so uniform/table backgrounds around the product are smoothly replaced by the Studio Backdrop,
 * while 100% of the central product is strictly protected and never altered.
 */
function createSmartEdgeCutoutCanvas(
  sourceCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.drawImage(sourceCanvas, 0, 0);

  try {
    // Perform border flood detection on a fast 240x240 downsampled grid
    const gridW = 240;
    const gridH = 240;
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = gridW;
    smallCanvas.height = gridH;
    const sCtx = smallCanvas.getContext('2d');
    if (!sCtx) return out;
    sCtx.drawImage(sourceCanvas, 0, 0, gridW, gridH);
    const sData = sCtx.getImageData(0, 0, gridW, gridH).data;

    // Sample border colors along the 4 edges
    const borderSamples: Array<[number, number, number]> = [];
    const sampleStep = 6;
    for (let x = 0; x < gridW; x += sampleStep) {
      const topIdx = x * 4;
      const botIdx = ((gridH - 1) * gridW + x) * 4;
      borderSamples.push([sData[topIdx], sData[topIdx + 1], sData[topIdx + 2]]);
      borderSamples.push([sData[botIdx], sData[botIdx + 1], sData[botIdx + 2]]);
    }
    for (let y = 0; y < gridH; y += sampleStep) {
      const leftIdx = y * gridW * 4;
      const rightIdx = (y * gridW + (gridW - 1)) * 4;
      borderSamples.push([
        sData[leftIdx],
        sData[leftIdx + 1],
        sData[leftIdx + 2],
      ]);
      borderSamples.push([
        sData[rightIdx],
        sData[rightIdx + 1],
        sData[rightIdx + 2],
      ]);
    }

    const isCloseToBorderPalette = (r: number, g: number, b: number) => {
      for (let i = 0; i < borderSamples.length; i++) {
        const [br, bg, bb] = borderSamples[i];
        const distSq =
          (r - br) * (r - br) + (g - bg) * (g - bg) + (b - bb) * (b - bb);
        if (distSq < 1850) return true; // ~43 RGB distance
      }
      return false;
    };

    // BFS flood fill from the 4 edges, strictly protecting the central 54% product core
    const bgMask = new Uint8Array(gridW * gridH);
    const visited = new Uint8Array(gridW * gridH);
    const queue = new Int32Array(gridW * gridH);
    let qHead = 0;
    let qTail = 0;

    const pushIfBorderBg = (gx: number, gy: number) => {
      const pos = gy * gridW + gx;
      if (visited[pos]) return;
      visited[pos] = 1;
      const pIdx = pos * 4;
      if (isCloseToBorderPalette(sData[pIdx], sData[pIdx + 1], sData[pIdx + 2])) {
        bgMask[pos] = 1;
        queue[qTail++] = pos;
      }
    };

    for (let x = 0; x < gridW; x++) {
      pushIfBorderBg(x, 0);
      pushIfBorderBg(x, gridH - 1);
    }
    for (let y = 0; y < gridH; y++) {
      pushIfBorderBg(0, y);
      pushIfBorderBg(gridW - 1, y);
    }

    const centerX = gridW / 2;
    const centerY = gridH / 2;
    const protectRadiusX = gridW * 0.28;
    const protectRadiusY = gridH * 0.28;

    while (qHead < qTail) {
      const cur = queue[qHead++];
      const cx = cur % gridW;
      const cy = (cur / gridW) | 0;
      const curIdx = cur * 4;
      const cr = sData[curIdx];
      const cg = sData[curIdx + 1];
      const cb = sData[curIdx + 2];

      const neighbors = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ];
      for (let n = 0; n < 4; n++) {
        const nx = neighbors[n][0];
        const ny = neighbors[n][1];
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        const nPos = ny * gridW + nx;
        if (visited[nPos]) continue;

        // Strictly protect central product core so the product is 100% untouched
        const normDx = (nx - centerX) / protectRadiusX;
        const normDy = (ny - centerY) / protectRadiusY;
        if (normDx * normDx + normDy * normDy < 1.0) {
          visited[nPos] = 1;
          continue;
        }

        const nIdx = nPos * 4;
        const nr = sData[nIdx];
        const ng = sData[nIdx + 1];
        const nb = sData[nIdx + 2];
        const localDiff =
          (nr - cr) * (nr - cr) + (ng - cg) * (ng - cg) + (nb - cb) * (nb - cb);
        if (localDiff < 420 && isCloseToBorderPalette(nr, ng, nb)) {
          visited[nPos] = 1;
          bgMask[nPos] = 1;
          queue[qTail++] = nPos;
        }
      }
    }

    // Build feathered alpha mask on 240x240, then upscale smoothly with blur
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = gridW;
    maskCanvas.height = gridH;
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return out;
    const mImg = mCtx.createImageData(gridW, gridH);
    const mData = mImg.data;
    for (let i = 0; i < gridW * gridH; i++) {
      const alpha = bgMask[i] === 1 ? 0 : 255;
      const p = i * 4;
      mData[p] = 255;
      mData[p + 1] = 255;
      mData[p + 2] = 255;
      mData[p + 3] = alpha;
    }
    mCtx.putImageData(mImg, 0, 0);

    const fullMask = document.createElement('canvas');
    fullMask.width = w;
    fullMask.height = h;
    const fmCtx = fullMask.getContext('2d');
    if (!fmCtx) return out;
    try {
      fmCtx.filter = 'blur(14px)';
    } catch {
      // ignore
    }
    fmCtx.drawImage(maskCanvas, 0, 0, w, h);
    try {
      fmCtx.filter = 'none';
    } catch {
      // ignore
    }

    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(fullMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  } catch {
    // Fallback to unmasked image
  }
  return out;
}

function drawStudioBackdrop(
  ctx: CanvasRenderingContext2D,
  size: number,
  preset: StudioRetouchPreset
) {
  const grad = ctx.createLinearGradient(0, 0, size, size);
  if (preset === 'studio_cutout_peach') {
    grad.addColorStop(0, '#FFF8F6');
    grad.addColorStop(0.55, '#FDECE8');
    grad.addColorStop(1, '#F9DCD6');
  } else if (preset === 'studio_warm_wood') {
    grad.addColorStop(0, '#F7EFE6');
    grad.addColorStop(0.55, '#EAD8C5');
    grad.addColorStop(1, '#DBC3AA');
  } else {
    // Warm Cream-Latte Tiệm Cuộn Len Studio Backdrop
    grad.addColorStop(0, '#FFFDF9');
    grad.addColorStop(0.5, '#F7EFE4');
    grad.addColorStop(1, '#EDE0CE');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft radial studio spotlight in center
  const spot = ctx.createRadialGradient(
    size * 0.5,
    size * 0.46,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.62
  );
  spot.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
  spot.addColorStop(1, 'rgba(212, 163, 115, 0.0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, size, size);
}

/**
 * Main AI Studio Photo Retoucher & Backdrop Framer:
 * - Keeps 100% of the real product intact (zero generative distortion)
 * - Sharpens yarn stitches via Unsharp Mask (USM) + balances studio lighting
 * - Frames or blends onto the chosen 1440x1440 Studio Backdrop
 */
export async function processProductPhotoStudio(
  dataUri: string,
  options?: {
    maxSide?: number;
    quality?: number;
    frameMode?: 'auto' | 'contain_square' | 'cover_square';
    preset?: StudioRetouchPreset;
  }
): Promise<string> {
  const maxSide = options?.maxSide ?? 1440;
  const quality = options?.quality ?? 0.93;
  const frameMode = options?.frameMode ?? 'auto';
  const preset = options?.preset ?? 'vivid_stitch_1x1';

  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return dataUri;
  }

  const img = await loadWebImage(dataUri);
  if (!img) return dataUri;

  try {
    const origW = img.naturalWidth || img.width || maxSide;
    const origH = img.naturalHeight || img.height || maxSide;
    const aspectDiff = Math.abs(origW - origH) / Math.max(origW, origH);

    // Step 1: Progressive 2x scaling to crisp intermediate size
    let scaledW = origW;
    let scaledH = origH;
    if (origW < 960 && origH < 960) {
      const upScale = Math.min(2.5, Math.max(1.4, maxSide / Math.max(origW, origH)));
      scaledW = Math.round(origW * upScale);
      scaledH = Math.round(origH * upScale);
    } else if (origW > maxSide || origH > maxSide) {
      if (origW >= origH) {
        scaledH = Math.round((origH * maxSide) / origW);
        scaledW = maxSide;
      } else {
        scaledW = Math.round((origW * maxSide) / origH);
        scaledH = maxSide;
      }
    }

    let curW = origW;
    let curH = origH;
    let stepCanvas = document.createElement('canvas');
    stepCanvas.width = curW;
    stepCanvas.height = curH;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) return dataUri;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(img, 0, 0, curW, curH);

    while (curW * 0.5 > scaledW && curH * 0.5 > scaledH) {
      const nextW = Math.max(scaledW, Math.round(curW * 0.5));
      const nextH = Math.max(scaledH, Math.round(curH * 0.5));
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = nextW;
      nextCanvas.height = nextH;
      const nextCtx = nextCanvas.getContext('2d');
      if (!nextCtx) break;
      nextCtx.imageSmoothingEnabled = true;
      nextCtx.imageSmoothingQuality = 'high';
      nextCtx.drawImage(stepCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
      stepCanvas = nextCanvas;
      curW = nextW;
      curH = nextH;
    }

    const sharpCanvas = document.createElement('canvas');
    sharpCanvas.width = scaledW;
    sharpCanvas.height = scaledH;
    const sharpCtx = sharpCanvas.getContext('2d');
    if (!sharpCtx) return dataUri;
    sharpCtx.imageSmoothingEnabled = true;
    sharpCtx.imageSmoothingQuality = 'high';
    sharpCtx.drawImage(stepCanvas, 0, 0, curW, curH, 0, 0, scaledW, scaledH);

    // Apply Yarn Stitch Unsharp Mask + Auto Studio Lighting
    applyYarnStitchSharpenAndLight(sharpCtx, scaledW, scaledH, 0.58);

    // Step 2: Compose onto 1440x1440 Studio Output Canvas
    const squareSide = maxSide;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = squareSide;
    outCanvas.height = squareSide;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return dataUri;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';

    if (
      preset === 'studio_cutout_cream' ||
      preset === 'studio_cutout_peach'
    ) {
      // Draw Studio Backdrop + Smart Edge-Feathered Cutout of the Product
      drawStudioBackdrop(outCtx, squareSide, preset);
      const cutoutCanvas = createSmartEdgeCutoutCanvas(sharpCanvas);
      const targetPad = Math.round(squareSide * 0.04);
      const availSide = squareSide - targetPad * 2;
      const scaleFit = Math.min(availSide / scaledW, availSide / scaledH);
      const drawW = Math.round(scaledW * scaleFit);
      const drawH = Math.round(scaledH * scaleFit);
      const offsetX = Math.round((squareSide - drawW) / 2);
      const offsetY = Math.round((squareSide - drawH) / 2);

      outCtx.save();
      outCtx.shadowColor = 'rgba(74, 52, 39, 0.18)';
      outCtx.shadowBlur = 32;
      outCtx.shadowOffsetY = 14;
      outCtx.drawImage(cutoutCanvas, offsetX, offsetY, drawW, drawH);
      outCtx.restore();
    } else if (
      preset === 'studio_card_float' ||
      preset === 'studio_warm_wood'
    ) {
      // Floating Rounded 3D Studio Frame over Warm Studio Backdrop
      drawStudioBackdrop(outCtx, squareSide, preset);
      const pad = Math.round(squareSide * 0.065);
      const cardSide = squareSide - pad * 2;

      outCtx.save();
      outCtx.shadowColor = 'rgba(59, 40, 30, 0.18)';
      outCtx.shadowBlur = 36;
      outCtx.shadowOffsetY = 14;
      drawRoundedRect(outCtx, pad, pad, cardSide, cardSide, 48);
      outCtx.fillStyle = '#FFFDF9';
      outCtx.fill();
      outCtx.restore();

      const innerPad = pad + 14;
      const innerSide = squareSide - innerPad * 2;
      outCtx.save();
      drawRoundedRect(outCtx, innerPad, innerPad, innerSide, innerSide, 36);
      outCtx.clip();
      const scaleCover = Math.max(innerSide / scaledW, innerSide / scaledH);
      const drawW = Math.round(scaledW * scaleCover);
      const drawH = Math.round(scaledH * scaleCover);
      const offsetX = Math.round(innerPad + (innerSide - drawW) / 2);
      const offsetY = Math.round(innerPad + (innerSide - drawH) / 2);
      outCtx.drawImage(sharpCanvas, offsetX, offsetY, drawW, drawH);
      outCtx.restore();
    } else {
      // 'vivid_stitch_1x1': Full 1:1 Square with Studio Lighting + Smart Framing for rectangular photos
      const useCover =
        frameMode === 'cover_square' ||
        (frameMode === 'auto' && aspectDiff <= 0.14);

      if (useCover) {
        const scaleCover = Math.max(squareSide / scaledW, squareSide / scaledH);
        const drawW = Math.round(scaledW * scaleCover);
        const drawH = Math.round(scaledH * scaleCover);
        const offsetX = Math.round((squareSide - drawW) / 2);
        const offsetY = Math.round((squareSide - drawH) / 2);
        outCtx.fillStyle = '#FAF6F0';
        outCtx.fillRect(0, 0, squareSide, squareSide);
        outCtx.drawImage(sharpCanvas, offsetX, offsetY, drawW, drawH);
      } else {
        drawStudioBackdrop(outCtx, squareSide, 'studio_cutout_cream');
        try {
          const bgScale =
            Math.max(squareSide / scaledW, squareSide / scaledH) * 1.08;
          const bgW = Math.round(scaledW * bgScale);
          const bgH = Math.round(scaledH * bgScale);
          outCtx.save();
          outCtx.globalAlpha = 0.45;
          outCtx.filter = 'blur(34px) brightness(1.04)';
          outCtx.drawImage(
            sharpCanvas,
            Math.round((squareSide - bgW) / 2),
            Math.round((squareSide - bgH) / 2),
            bgW,
            bgH
          );
          outCtx.restore();
        } catch {
          // ignore
        }

        const scaleContain =
          Math.min(squareSide / scaledW, squareSide / scaledH) * 0.94;
        const drawW = Math.round(scaledW * scaleContain);
        const drawH = Math.round(scaledH * scaleContain);
        const offsetX = Math.round((squareSide - drawW) / 2);
        const offsetY = Math.round((squareSide - drawH) / 2);

        outCtx.save();
        outCtx.shadowColor = 'rgba(59, 40, 30, 0.16)';
        outCtx.shadowBlur = 28;
        outCtx.shadowOffsetY = 10;
        drawRoundedRect(outCtx, offsetX, offsetY, drawW, drawH, 32);
        outCtx.clip();
        outCtx.drawImage(sharpCanvas, offsetX, offsetY, drawW, drawH);
        outCtx.restore();
      }
    }

    return encodeCanvasHd(outCanvas, quality) || dataUri;
  } catch {
    return dataUri;
  }
}

function drawCoverCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  label?: string
) {
  ctx.save();
  ctx.shadowColor = 'rgba(59, 40, 30, 0.14)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  const pad = 10;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;

  ctx.save();
  drawRoundedRect(ctx, ix, iy, iw, ih, Math.max(8, r - 6));
  ctx.clip();
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;
  const scale = Math.max(iw / natW, ih / natH);
  const sw = iw / scale;
  const sh = ih / scale;
  const sx = (natW - sw) / 2;
  const sy = (natH - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, ix, iy, iw, ih);
  ctx.restore();

  if (label && label.trim() && !/^chưa chọn màu$/i.test(label.trim())) {
    const cleanLabel = label.trim().slice(0, 18);
    const pillW = Math.min(iw - 16, Math.max(110, cleanLabel.length * 14 + 28));
    const pillH = 36;
    const px = x + (w - pillW) / 2;
    const py = y + h - pillH - 16;
    ctx.save();
    drawRoundedRect(ctx, px, py, pillW, pillH, 18);
    ctx.fillStyle = 'rgba(59, 40, 30, 0.84)';
    ctx.fill();
    ctx.fillStyle = '#FFFDF9';
    ctx.font =
      '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanLabel, px + pillW / 2, py + pillH / 2 + 1);
    ctx.restore();
  }
}

/**
 * 1-Click Auto Cover Collage Generator:
 * Automatically merges multiple variant photos (2, 3, 4, 6, 9+) into a single 1440x1440 Ultra-HD
 * Cover Photo so Admin never has to manually stitch cover collages in Gemini/Canva!
 */
export async function generateAutoCoverCollage(
  items: Array<{ image: string; name?: string }>,
  options?: {
    layout?: CoverCollageLayout;
    productTitle?: string;
    preset?: StudioRetouchPreset;
  }
): Promise<string | null> {
  if (
    Platform.OS !== 'web' ||
    typeof document === 'undefined' ||
    items.length === 0
  ) {
    return items[0]?.image || null;
  }

  const validItems = items.filter((it) => Boolean(it.image)).slice(0, 9);
  if (validItems.length === 0) return null;
  if (validItems.length === 1) {
    return processProductPhotoStudio(validItems[0].image, {
      preset: options?.preset ?? 'studio_card_float',
    });
  }

  const loaded = await Promise.all(
    validItems.map(async (it) => ({
      img: await loadWebImage(it.image),
      name: it.name,
    }))
  );
  const ready = loaded.filter(
    (x): x is { img: HTMLImageElement; name?: string } => Boolean(x.img)
  );
  if (ready.length === 0) return validItems[0].image;

  const size = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return validItems[0].image;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawStudioBackdrop(ctx, size, options?.preset ?? 'studio_cutout_cream');

  const layout = options?.layout ?? 'grid_auto';
  const count = ready.length;

  // Top Header Badge
  const badgeText =
    options?.productTitle && options.productTitle.trim()
      ? `🧶 ${options.productTitle.trim().toUpperCase().slice(0, 32)} (${validItems.length} MẪU)`
      : `🧶 BỘ SƯU TẬP ${validItems.length} MẪU TỰ CHỌN • TIỆM CUỘN LEN`;

  drawRoundedRect(ctx, 180, 32, size - 360, 56, 28);
  ctx.fillStyle = '#4A3427';
  ctx.fill();
  ctx.fillStyle = '#FFFDF9';
  ctx.font =
    '800 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, size / 2, 60);

  const stageTop = 108;
  const stagePad = 38;
  const stageW = size - stagePad * 2;
  const stageH = size - stageTop - 38;

  if (layout === 'hero_strip') {
    // 1 Large Hero Photo on Top (66% height) + Strip of up to 4 thumbnails at Bottom (31% height)
    const heroH = Math.round(stageH * 0.66);
    drawCoverCell(
      ctx,
      ready[0].img,
      stagePad,
      stageTop,
      stageW,
      heroH,
      36,
      ready[0].name
    );

    const stripItems = ready.slice(1, 5);
    const stripCols = Math.max(1, stripItems.length);
    const gap = 18;
    const cellW = Math.floor((stageW - gap * (stripCols - 1)) / stripCols);
    const stripY = stageTop + heroH + 20;
    const stripH = stageH - heroH - 20;

    stripItems.forEach((item, idx) => {
      const cx = stagePad + idx * (cellW + gap);
      drawCoverCell(ctx, item.img, cx, stripY, cellW, stripH, 24, item.name);
    });
  } else if (layout === 'polaroid_fan') {
    // Artistic overlapping Polaroid cards (up to 4 cards)
    const fanItems = ready.slice(0, 4);
    const configs =
      fanItems.length === 2
        ? [
            { cx: 450, cy: 760, w: 620, h: 720, angle: -0.09 },
            { cx: 990, cy: 780, w: 620, h: 720, angle: 0.08 },
          ]
        : fanItems.length === 3
        ? [
            { cx: 380, cy: 800, w: 540, h: 640, angle: -0.12 },
            { cx: 720, cy: 720, w: 560, h: 660, angle: 0.0 },
            { cx: 1060, cy: 800, w: 540, h: 640, angle: 0.12 },
          ]
        : [
            { cx: 430, cy: 500, w: 520, h: 560, angle: -0.06 },
            { cx: 1010, cy: 500, w: 520, h: 560, angle: 0.06 },
            { cx: 430, cy: 1040, w: 520, h: 560, angle: 0.05 },
            { cx: 1010, cy: 1040, w: 520, h: 560, angle: -0.05 },
          ];

    fanItems.forEach((item, idx) => {
      const cfg = configs[idx];
      ctx.save();
      ctx.translate(cfg.cx, cfg.cy);
      ctx.rotate(cfg.angle);
      drawCoverCell(
        ctx,
        item.img,
        -cfg.w / 2,
        -cfg.h / 2,
        cfg.w,
        cfg.h,
        32,
        item.name
      );
      ctx.restore();
    });
  } else {
    // 'grid_auto': Balanced Studio Grid (2, 3, 4, 6, or 9 items)
    let cols = 2;
    let rows = 2;
    if (count === 2) {
      cols = 2;
      rows = 1;
    } else if (count === 3) {
      cols = 2;
      rows = 2;
    } else if (count === 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 3;
      rows = 2;
    } else {
      cols = 3;
      rows = 3;
    }

    const gap = 20;
    const cellW = Math.floor((stageW - gap * (cols - 1)) / cols);
    const cellH = Math.floor((stageH - gap * (rows - 1)) / rows);

    if (count === 3) {
      // Top row: 1 wide hero, Bottom row: 2 equal cells
      drawCoverCell(
        ctx,
        ready[0].img,
        stagePad,
        stageTop,
        stageW,
        cellH,
        28,
        ready[0].name
      );
      drawCoverCell(
        ctx,
        ready[1].img,
        stagePad,
        stageTop + cellH + gap,
        cellW,
        cellH,
        28,
        ready[1].name
      );
      drawCoverCell(
        ctx,
        ready[2].img,
        stagePad + cellW + gap,
        stageTop + cellH + gap,
        cellW,
        cellH,
        28,
        ready[2].name
      );
    } else {
      const maxCells = cols * rows;
      for (let i = 0; i < Math.min(count, maxCells); i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cx = stagePad + c * (cellW + gap);
        const cy = stageTop + r * (cellH + gap);
        drawCoverCell(
          ctx,
          ready[i].img,
          cx,
          cy,
          cellW,
          cellH,
          26,
          ready[i].name
        );
      }
    }
  }

  return encodeCanvasHd(canvas, 0.93);
}

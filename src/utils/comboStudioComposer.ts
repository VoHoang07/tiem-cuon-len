import { Platform } from 'react-native';

export function resolveImageUri(src: any): string | null {
  if (!src) return null;
  if (typeof src === 'string') return src;
  if (typeof src === 'object') {
    if (typeof src.uri === 'string') return src.uri;
    if (typeof src.default === 'string') return src.default;
    if (src.default && typeof src.default.uri === 'string') {
      return src.default.uri;
    }
  }
  return null;
}

export interface ComboSlotCandidate {
  id: string;
  label: string;
  productName: string;
  image: any;
  hex?: string;
}

const composedCache = new Map<string, string>();

function loadWebImage(rawSrc: any): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const src = resolveImageUri(rawSrc);
    if (typeof window === 'undefined' || !src) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), 3500);
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

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, r);
  ctx.clip();
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

/**
 * Generates a 960x960 studio composite image (data:image/jpeg) combining Slot 1 & Slot 2 photos
 * with polaroid frames, '+' badge, and model name captions.
 */
export async function composeComboStudioDataUrl(
  slot1: ComboSlotCandidate | null | undefined,
  slot2: ComboSlotCandidate | null | undefined,
  comboBadgeText = '🎁 COMBO TIẾT KIỆM • TIỆM CUỘN LEN'
): Promise<string | null> {
  if (
    Platform.OS !== 'web' ||
    typeof document === 'undefined' ||
    (!slot1?.image && !slot2?.image)
  ) {
    return slot1?.image || slot2?.image || null;
  }

  const cacheKey = `${slot1?.id || 's1'}_${slot1?.label || ''}__${
    slot2?.id || 's2'
  }_${slot2?.label || ''}__${comboBadgeText}`;
  const cached = composedCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [img1, img2] = await Promise.all([
      slot1?.image ? loadWebImage(slot1.image) : Promise.resolve(null),
      slot2?.image ? loadWebImage(slot2.image) : Promise.resolve(null),
    ]);

    if (!img1 && !img2) {
      return slot1?.image || slot2?.image || null;
    }

    const size = 960;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return slot1?.image || slot2?.image || null;

    // 1. Warm Studio Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, size, size);
    bgGrad.addColorStop(0, '#FDF8F2');
    bgGrad.addColorStop(0.5, '#F6EBDD');
    bgGrad.addColorStop(1, '#EFE0CE');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Subtle decorative studio circles
    ctx.fillStyle = 'rgba(212, 163, 115, 0.12)';
    ctx.beginPath();
    ctx.arc(140, 140, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(820, 820, 220, 0, Math.PI * 2);
    ctx.fill();

    // 2. Top Studio Header Pill
    drawRoundedRect(ctx, 210, 46, 540, 52, 26);
    ctx.fillStyle = '#4A3427';
    ctx.fill();
    ctx.fillStyle = '#FFFDF9';
    ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(comboBadgeText.slice(0, 38), size / 2, 72);

    // 3. Left & Right Polaroid Studio Cards
    const cardW = 420;
    const cardH = 560;
    const cardY = 148;
    const leftX = 42;
    const rightX = size - 42 - cardW;

    // Left Card Shadow + Frame
    ctx.save();
    ctx.shadowColor = 'rgba(59, 40, 30, 0.14)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    drawRoundedRect(ctx, leftX, cardY, cardW, cardH, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    // Right Card Shadow + Frame
    ctx.save();
    ctx.shadowColor = 'rgba(59, 40, 30, 0.14)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    drawRoundedRect(ctx, rightX, cardY, cardW, cardH, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    // Draw Photo 1 & Photo 2 inside cards
    const photoPad = 18;
    const photoSize = cardW - photoPad * 2;
    if (img1) {
      drawCoverImage(
        ctx,
        img1,
        leftX + photoPad,
        cardY + photoPad,
        photoSize,
        photoSize,
        20
      );
    }
    if (img2 || img1) {
      drawCoverImage(
        ctx,
        (img2 || img1)!,
        rightX + photoPad,
        cardY + photoPad,
        photoSize,
        photoSize,
        20
      );
    }

    // Slot 1 & Slot 2 Badges + Labels inside Polaroid Bottom
    const label1 = (slot1?.label || 'Mẫu 1').slice(0, 24);
    const label2 = (slot2?.label || 'Mẫu 2').slice(0, 24);

    ctx.fillStyle = '#B45309';
    ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MẪU CHỌN #1', leftX + cardW / 2, cardY + photoPad + photoSize + 40);
    ctx.fillText('MẪU CHỌN #2', rightX + cardW / 2, cardY + photoPad + photoSize + 40);

    ctx.fillStyle = '#3B281E';
    ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(label1, leftX + cardW / 2, cardY + photoPad + photoSize + 82);
    ctx.fillText(label2, rightX + cardW / 2, cardY + photoPad + photoSize + 82);

    // 4. Center '+' Connector Circle
    const centerX = size / 2;
    const centerY = cardY + cardH / 2 - 20;
    ctx.save();
    ctx.shadowColor = 'rgba(59, 40, 30, 0.22)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFDF9';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#D97706';
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#B45309';
    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', centerX, centerY + 2);

    // 5. Bottom Summary Banner
    drawRoundedRect(ctx, 64, 760, size - 128, 128, 24);
    ctx.fillStyle = '#FFFDF9';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#E5D5C5';
    ctx.stroke();

    ctx.fillStyle = '#78350F';
    ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✨ BỘ ĐÔI ĐÃ PHỐI TRONG COMBO CỦA BẠN:', size / 2, 802);

    ctx.fillStyle = '#3B281E';
    ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${label1}  +  ${label2}`.slice(0, 44), size / 2, 848);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    if (composedCache.size > 60) {
      const firstKey = composedCache.keys().next().value;
      if (firstKey) composedCache.delete(firstKey);
    }
    composedCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return slot1?.image || slot2?.image || null;
  }
}

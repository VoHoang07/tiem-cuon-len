import { recordSecurityAudit } from './securityGuard';

/**
 * Maximum allowed raw file upload size: 12 MB
 */
export const MAX_UPLOAD_FILE_BYTES = 12 * 1024 * 1024;

/**
 * Maximum allowed processed/compressed Data URI size: 2.5 MB
 */
export const MAX_PROCESSED_DATA_URI_BYTES = Math.floor(2.5 * 1024 * 1024);

export type AllowedImageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/avif';

export interface MagicBytesValidationResult {
  valid: boolean;
  mime?: AllowedImageMime;
  ext?: 'jpg' | 'png' | 'webp' | 'gif' | 'avif';
  uuidFileName?: string;
  byteLength?: number;
  error?: string;
}

/**
 * Generates a cryptographically random RFC-4122 UUID v4 filename.
 * Completely replaces user-supplied filenames to prevent Path Traversal & XSS in filenames.
 */
export function generateUuidFilename(ext: string = 'webp'): string {
  const safeExt = String(ext || 'webp')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || 'webp';

  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${crypto.randomUUID()}.${safeExt}`;
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // RFC 4122 v4 bits
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}.${safeExt}`;
    }
  } catch {
    // Fallback below
  }

  const fallbackUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return `${fallbackUuid}.${safeExt}`;
}

/**
 * Inspects binary header (Magic Bytes) and rejects disguised scripts/executables/polyglots.
 */
export function detectImageFormatByMagicBytes(
  bytes: Uint8Array
): { valid: boolean; mime?: AllowedImageMime; ext?: 'jpg' | 'png' | 'webp' | 'gif' | 'avif'; reason?: string } {
  if (!bytes || bytes.length < 12) {
    return { valid: false, reason: 'File quá nhỏ hoặc rỗng (dưới 12 bytes).' };
  }

  // 1. Scan initial bytes for polyglot script/SVG/HTML/PHP signatures
  const sampleLen = Math.min(bytes.length, 512);
  let asciiPreview = '';
  for (let i = 0; i < sampleLen; i++) {
    const code = bytes[i];
    if (code >= 32 && code <= 126) {
      asciiPreview += String.fromCharCode(code);
    } else {
      asciiPreview += ' ';
    }
  }
  const lowerPreview = asciiPreview.toLowerCase();
  if (
    lowerPreview.includes('<script') ||
    lowerPreview.includes('<svg') ||
    lowerPreview.includes('<?php') ||
    lowerPreview.includes('<!doctype html') ||
    lowerPreview.includes('<html') ||
    lowerPreview.includes('javascript:')
  ) {
    return {
      valid: false,
      reason: 'Phát hiện mã thực thi (Script/SVG/HTML/PHP) ẩn trong file ảnh.',
    };
  }

  // 2. Check genuine binary Magic Bytes:
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }

  // GIF: "GIF87a" (47 49 46 38 37 61) or "GIF89a" (47 49 46 38 39 61)
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { valid: true, mime: 'image/gif', ext: 'gif' };
  }

  // WebP: "RIFF" (52 49 46 46) at 0..3 and "WEBP" (57 45 42 50) at 8..11
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }

  // AVIF / HEIF ISO Base Media File Format: "ftyp" (66 74 79 70) at 4..7
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (
      brand === 'avif' ||
      brand === 'avis' ||
      brand === 'mif1' ||
      brand === 'heic' ||
      brand === 'heix'
    ) {
      return { valid: true, mime: 'image/avif', ext: 'avif' };
    }
  }

  return {
    valid: false,
    reason: 'Định dạng file không hợp lệ (Magic Bytes không khớp JPEG, PNG, WebP, GIF, AVIF).',
  };
}

/**
 * Decodes the initial bytes of a base64 string without allocating the entire buffer in memory
 */
export function decodeBase64PrefixToBytes(base64Chunk: string, maxBytes: number = 512): Uint8Array {
  const clean = base64Chunk.replace(/[^A-Za-z0-9+/=]/g, '');
  const charsNeeded = Math.min(clean.length, Math.ceil((maxBytes * 4) / 3) + 4);
  const alignedLen = charsNeeded - (charsNeeded % 4);
  const slice = clean.slice(0, alignedLen);
  if (!slice) return new Uint8Array(0);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out: number[] = [];

  for (let i = 0; i < slice.length; i += 4) {
    const c0 = alphabet.indexOf(slice[i]);
    const c1 = alphabet.indexOf(slice[i + 1]);
    const c2 = slice[i + 2] === '=' ? -1 : alphabet.indexOf(slice[i + 2]);
    const c3 = slice[i + 3] === '=' ? -1 : alphabet.indexOf(slice[i + 3]);

    if (c0 < 0 || c1 < 0) break;
    out.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) {
      out.push(((c1 & 15) << 4) | (c2 >> 2));
      if (c3 >= 0) {
        out.push(((c2 & 3) << 6) | c3);
      }
    }
  }

  return new Uint8Array(out.slice(0, maxBytes));
}

/**
 * Validates a browser `File` object before reading/displaying:
 * 1. Enforces max file size (default 8MB)
 * 2. Reads first 512 bytes and verifies genuine image Magic Bytes
 * 3. Generates a clean UUID v4 filename
 */
export async function validateWebFileUpload(
  file: File,
  maxBytes: number = MAX_UPLOAD_FILE_BYTES
): Promise<MagicBytesValidationResult> {
  if (!file) {
    return { valid: false, error: 'Không tìm thấy file tải lên.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'File tải lên bị rỗng (0 byte).' };
  }

  if (file.size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    const fileMb = (file.size / (1024 * 1024)).toFixed(2);
    void recordSecurityAudit({
      eventType: 'ADMIN_SECURITY_ACTION',
      severity: 'WARNING',
      method: 'FILE_UPLOAD_REJECTED',
      details: {
        reason: 'FILE_TOO_LARGE',
        fileSize: file.size,
        maxBytes,
      },
    });
    return {
      valid: false,
      byteLength: file.size,
      error: `Kích thước ảnh (${fileMb} MB) vượt quá giới hạn cho phép (${maxMb} MB).`,
    };
  }

  try {
    const headerSlice = file.slice(0, 512);
    const arrayBuffer = await headerSlice.arrayBuffer();
    const headerBytes = new Uint8Array(arrayBuffer);
    const magic = detectImageFormatByMagicBytes(headerBytes);

    if (!magic.valid || !magic.ext || !magic.mime) {
      void recordSecurityAudit({
        eventType: 'ADMIN_SECURITY_ACTION',
        severity: 'CRITICAL',
        method: 'FILE_UPLOAD_REJECTED',
        details: {
          reason: magic.reason || 'INVALID_MAGIC_BYTES',
          declaredMime: file.type,
          firstBytesHex: Array.from(headerBytes.slice(0, 8))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' '),
        },
      });
      return {
        valid: false,
        byteLength: file.size,
        error: magic.reason || 'File tải lên không phải là ảnh hợp lệ.',
      };
    }

    return {
      valid: true,
      mime: magic.mime,
      ext: magic.ext,
      uuidFileName: generateUuidFilename(magic.ext),
      byteLength: file.size,
    };
  } catch {
    return {
      valid: false,
      error: 'Không thể đọc dữ liệu kiểm tra Magic Bytes của file.',
    };
  }
}

/**
 * Validates a Data URI (`data:image/...;base64,...`) or raw Base64 payload:
 * 1. Verifies byte size <= maxBytes
 * 2. Decodes binary header and verifies Magic Bytes
 * 3. Generates a UUID v4 filename
 */
export function validateBase64ImageUpload(
  dataUriOrBase64: string,
  maxBytes: number = MAX_UPLOAD_FILE_BYTES
): MagicBytesValidationResult {
  if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') {
    return { valid: false, error: 'Dữ liệu ảnh không hợp lệ.' };
  }

  const trimmed = dataUriOrBase64.trim();
  const commaIdx = trimmed.indexOf(',');
  const base64Body = commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;

  // Estimate decoded byte size: (base64Length * 3) / 4
  const estimatedBytes = Math.floor((base64Body.length * 3) / 4);
  if (estimatedBytes <= 12) {
    return { valid: false, error: 'Dữ liệu ảnh quá ngắn hoặc bị hỏng.' };
  }

  if (estimatedBytes > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    const actualMb = (estimatedBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      byteLength: estimatedBytes,
      error: `Dung lượng ảnh (${actualMb} MB) vượt quá giới hạn tối đa (${maxMb} MB).`,
    };
  }

  const headerBytes = decodeBase64PrefixToBytes(base64Body, 512);
  const magic = detectImageFormatByMagicBytes(headerBytes);

  if (!magic.valid || !magic.ext || !magic.mime) {
    return {
      valid: false,
      byteLength: estimatedBytes,
      error: magic.reason || 'Định dạng ảnh không hợp lệ (Magic Bytes không khớp).',
    };
  }

  return {
    valid: true,
    mime: magic.mime,
    ext: magic.ext,
    uuidFileName: generateUuidFilename(magic.ext),
    byteLength: estimatedBytes,
  };
}

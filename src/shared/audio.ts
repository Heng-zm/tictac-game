/**
 * Shared validation for walkie-talkie voice payloads.
 *
 * Browsers record with different containers (WebM/Opus on Chromium, MP4/AAC on
 * Safari, Ogg/Opus on Firefox). The server must not trust the MIME label in the
 * data URL alone: several WebViews mislabel their output (Safari has emitted
 * MP4 bytes labelled as WebM). The first bytes are therefore treated as the
 * source of truth and the data URL is rewrapped with the detected MIME type
 * before a recording is relayed to the other player.
 */

export const VOICE_MAX_DURATION_MS = 11_000;
export const VOICE_MAX_AUDIO_BYTES = 512 * 1024;
/** Base64 expands by 4/3; leave room for the data-URL header and codec params. */
export const VOICE_MAX_DATA_URL_LENGTH = Math.ceil(VOICE_MAX_AUDIO_BYTES / 3) * 4 + 256;

export type VoiceContainer = 'webm' | 'ogg' | 'mp4' | 'wav' | 'mpeg';

/**
 * Labels we are willing to read from a recording data URL. The declared label
 * is only used to shape the URL; the actual bytes decide whether the payload is
 * a supported audio container. The aliases cover real-world WebView output.
 */
const DECLARED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/x-aac',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'video/webm',
  'video/mp4',
  'application/octet-stream',
]);

const CANONICAL_MIME: Record<VoiceContainer, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  mpeg: 'audio/mpeg',
};

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export interface VoiceDataInfo {
  mimeType: string;
  base64: string;
  byteLength: number;
}

/**
 * Parses and size-checks a base64 audio data URL. Container magic bytes are
 * checked separately by {@link validateVoiceDataUrl}.
 */
export function parseVoiceDataUrl(audioData: string): VoiceDataInfo | null {
  if (typeof audioData !== 'string' || audioData.length === 0) return null;
  if (audioData.length > VOICE_MAX_DATA_URL_LENGTH) return null;
  if (!audioData.startsWith('data:')) return null;

  const comma = audioData.indexOf(',');
  if (comma <= 'data:'.length) return null;

  const header = audioData.slice('data:'.length, comma);
  const parts = header.split(';').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[parts.length - 1]?.toLowerCase() !== 'base64') return null;

  const mimeType = parts[0]?.toLowerCase() ?? '';
  if (!DECLARED_MIME_TYPES.has(mimeType)) return null;

  const base64 = audioData.slice(comma + 1);
  if (!isValidBase64(base64)) return null;

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  if (byteLength <= 0 || byteLength > VOICE_MAX_AUDIO_BYTES) return null;

  return { mimeType, base64, byteLength };
}

/**
 * Detects the audio container from its leading bytes. Returns the canonical
 * MIME type, or `null` when the bytes are not a supported voice container.
 */
export function detectVoiceMimeType(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return null;

  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return CANONICAL_MIME.webm;
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) return CANONICAL_MIME.ogg; // "OggS"

  // MP4/M4A: a 4-byte box size followed by "ftyp". A few muxers emit "ftyp"
  // at offset zero instead, so accept both layouts.
  if (asciiAt(bytes, 4, 4) === 'ftyp' || asciiAt(bytes, 0, 4) === 'ftyp') {
    return CANONICAL_MIME.mp4;
  }

  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WAVE') {
    return CANONICAL_MIME.wav;
  }

  // ID3-tagged or a raw MPEG audio frame sync (0xFFE0 mask).
  if (
    startsWith(bytes, [0x49, 0x44, 0x33]) ||
    (bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
  ) {
    return CANONICAL_MIME.mpeg;
  }

  return null;
}

/**
 * Validates the data URL shape, declared MIME type, decoded size, and the
 * container signature. The returned `mimeType` is always the canonical type
 * detected from the bytes, which may differ from the label in the URL.
 */
export function validateVoiceDataUrl(audioData: string): VoiceDataInfo | null {
  const parsed = parseVoiceDataUrl(audioData);
  if (!parsed) return null;
  const prefix = decodeBase64Prefix(parsed.base64, 16);
  const detected = detectVoiceMimeType(prefix);
  return detected ? { ...parsed, mimeType: detected } : null;
}

/**
 * Rewraps a valid recording with the MIME type detected from its bytes. This
 * repairs recordings from WebViews that label MP4 output as WebM (or omit the
 * type entirely) so every receiving browser can play them.
 */
export function normalizeVoiceDataUrl(audioData: string): string | null {
  const info = validateVoiceDataUrl(audioData);
  return info ? `data:${info.mimeType};base64,${info.base64}` : null;
}

export function hasSupportedVoiceSignature(bytes: Uint8Array, mimeType: string): boolean {
  const detected = detectVoiceMimeType(bytes);
  if (!detected) return false;
  const declared = mimeType.trim().toLowerCase();
  const declaredContainer = containerForMime(declared);
  return declaredContainer === null || CANONICAL_MIME[declaredContainer] === detected;
}

export function containerForMime(mimeType: string): VoiceContainer | null {
  const type = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'audio/webm' || type === 'video/webm') return 'webm';
  if (type === 'audio/ogg') return 'ogg';
  if (
    type === 'audio/mp4' ||
    type === 'audio/m4a' ||
    type === 'audio/x-m4a' ||
    type === 'audio/aac' ||
    type === 'audio/x-aac' ||
    type === 'video/mp4'
  ) {
    return 'mp4';
  }
  if (type === 'audio/wav' || type === 'audio/wave' || type === 'audio/x-wav') return 'wav';
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'mpeg';
  return null;
}

function isValidBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function decodeBase64Prefix(base64: string, maxBytes: number): Uint8Array {
  const output = new Uint8Array(maxBytes);
  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (let index = 0; index < base64.length; index += 1) {
    const character = base64[index] ?? '';
    if (character === '=') break;
    const value = BASE64_ALPHABET.indexOf(character);
    if (value < 0) break;

    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[byteIndex] = (buffer >> bits) & 0xff;
      byteIndex += 1;
      if (byteIndex === maxBytes) break;
    }
  }

  return output.slice(0, byteIndex);
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index] ?? 0);
  }
  return value;
}

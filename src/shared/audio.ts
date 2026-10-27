/**
 * Shared validation for walkie-talkie voice payloads.
 *
 * Browsers record with different containers (WebM/Opus on Chromium, MP4/AAC on
 * Safari, Ogg/Opus on Firefox). The server must not trust the MIME label in the
 * data URL alone, so the first bytes are checked against the declared container
 * before a recording is relayed to the other player.
 */

export const VOICE_MAX_DURATION_MS = 11_000;
export const VOICE_MAX_AUDIO_BYTES = 512 * 1024;
/** Base64 expands by 4/3; leave room for the data-URL header and codec params. */
export const VOICE_MAX_DATA_URL_LENGTH = Math.ceil(VOICE_MAX_AUDIO_BYTES / 3) * 4 + 256;

const SUPPORTED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
]);

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
  const parts = header.split(';');
  if (parts.length < 2) return null;
  if (parts[parts.length - 1]?.toLowerCase() !== 'base64') return null;

  const mimeType = parts[0]?.trim().toLowerCase() ?? '';
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) return null;

  // Only allow parameter segments in `key=value` form (for example
  // `codecs=opus`). This keeps the header predictable without rejecting real
  // MediaRecorder output.
  for (let index = 1; index < parts.length - 1; index += 1) {
    const parameter = parts[index] ?? '';
    if (!/^[a-z0-9.+-]+=[a-z0-9.+-]+$/i.test(parameter)) return null;
  }

  const base64 = audioData.slice(comma + 1);
  if (!isValidBase64(base64)) return null;

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  if (byteLength <= 0 || byteLength > VOICE_MAX_AUDIO_BYTES) return null;

  return { mimeType, base64, byteLength };
}

/**
 * Validates the data URL shape, declared MIME type, decoded size, and the
 * container signature. Returns parsed metadata when the payload is safe to
 * relay, otherwise `null`.
 */
export function validateVoiceDataUrl(audioData: string): VoiceDataInfo | null {
  const parsed = parseVoiceDataUrl(audioData);
  if (!parsed) return null;
  const prefix = decodeBase64Prefix(parsed.base64, 16);
  return hasSupportedVoiceSignature(prefix, parsed.mimeType) ? parsed : null;
}

export function hasSupportedVoiceSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (bytes.length === 0) return false;

  if (mimeType === 'audio/webm') {
    return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  }
  if (mimeType === 'audio/ogg') {
    return startsWith(bytes, [0x4f, 0x67, 0x67, 0x53]); // "OggS"
  }
  if (mimeType === 'audio/mp4' || mimeType === 'audio/m4a' || mimeType === 'audio/x-m4a') {
    return bytes.length >= 8 && asciiAt(bytes, 4, 4) === 'ftyp';
  }
  if (mimeType === 'audio/wav' || mimeType === 'audio/wave' || mimeType === 'audio/x-wav') {
    return bytes.length >= 12 && asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WAVE';
  }
  if (mimeType === 'audio/mpeg') {
    // ID3-tagged or a raw MPEG audio frame sync (0xFFE0 mask).
    return (
      startsWith(bytes, [0x49, 0x44, 0x33]) ||
      (bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
    );
  }
  return false;
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

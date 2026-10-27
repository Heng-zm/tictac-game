// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  containerForMime,
  detectVoiceMimeType,
  normalizeVoiceDataUrl,
  parseVoiceDataUrl,
  validateVoiceDataUrl,
  VOICE_MAX_AUDIO_BYTES,
} from '../src/shared/audio';
import { arrayBufferToBase64, encodePcmWav } from '../src/client/lib/audio-radio';

const WEBM_HEADER = [0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81];
const OGG_HEADER = [0x4f, 0x67, 0x67, 0x53, 0x00, 0x02];
const MP4_HEADER = [
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20,
  0x00, 0x00, 0x00, 0x00,
];
const WAV_HEADER = [
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
];
const MP3_HEADER = [0x49, 0x44, 0x33, 0x04, 0x00, 0x00];

function toDataUrl(mimeType: string, bytes: number[]): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function readWavHeader(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const ascii = (offset: number, length: number) =>
    Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('');

  return {
    riff: ascii(0, 4),
    riffSize: view.getUint32(4, true),
    wave: ascii(8, 4),
    fmt: ascii(12, 4),
    audioFormat: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    data: ascii(36, 4),
    dataSize: view.getUint32(40, true),
  };
}

describe('Shared voice payload validation', () => {
  it('detects supported containers from magic bytes', () => {
    expect(detectVoiceMimeType(new Uint8Array(WEBM_HEADER))).toBe('audio/webm');
    expect(detectVoiceMimeType(new Uint8Array(OGG_HEADER))).toBe('audio/ogg');
    expect(detectVoiceMimeType(new Uint8Array(MP4_HEADER))).toBe('audio/mp4');
    expect(detectVoiceMimeType(new Uint8Array(WAV_HEADER))).toBe('audio/wav');
    expect(detectVoiceMimeType(new Uint8Array(MP3_HEADER))).toBe('audio/mpeg');
    expect(detectVoiceMimeType(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
    expect(detectVoiceMimeType(new Uint8Array())).toBeNull();
  });

  it('accepts MPEG frame sync without an ID3 tag', () => {
    expect(detectVoiceMimeType(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBe('audio/mpeg');
  });

  it('normalizes a mislabeled Safari/WebView recording to its real container', () => {
    // Safari has reported audio/webm while producing MP4 bytes.
    const mislabeled = toDataUrl('audio/webm', MP4_HEADER);
    expect(normalizeVoiceDataUrl(mislabeled)).toBe(
      `data:audio/mp4;base64,${Buffer.from(MP4_HEADER).toString('base64')}`,
    );

    const validated = validateVoiceDataUrl(mislabeled);
    expect(validated?.mimeType).toBe('audio/mp4');
  });

  it('keeps correctly labeled recordings unchanged and tolerates codec params', () => {
    const webm = toDataUrl('audio/webm;codecs=opus', WEBM_HEADER);
    expect(parseVoiceDataUrl(webm)).toMatchObject({ mimeType: 'audio/webm' });
    expect(normalizeVoiceDataUrl(webm)).toBe(toDataUrl('audio/webm', WEBM_HEADER));
  });

  it('rejects fake, oversized, and unsupported recordings', () => {
    expect(normalizeVoiceDataUrl('data:audio/webm;base64,bW9jaw==')).toBeNull();
    expect(normalizeVoiceDataUrl('data:text/plain;base64,aGVsbG8=')).toBeNull();
    expect(normalizeVoiceDataUrl('not-a-data-url')).toBeNull();

    const oversized = new Uint8Array(VOICE_MAX_AUDIO_BYTES + 1);
    oversized.set(WEBM_HEADER);
    expect(normalizeVoiceDataUrl(toDataUrl('audio/webm', [...oversized]))).toBeNull();
  });

  it('maps MIME aliases to containers, ignoring codec parameters', () => {
    expect(containerForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(containerForMime('video/mp4')).toBe('mp4');
    expect(containerForMime('audio/x-m4a')).toBe('mp4');
    expect(containerForMime('audio/x-wav')).toBe('wav');
    expect(containerForMime('audio/mp3')).toBe('mpeg');
    expect(containerForMime('text/plain')).toBeNull();
  });
});

describe('PCM WAV encoding', () => {
  it('writes a mono 16-bit PCM WAV header with the correct sizes', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodePcmWav(samples, 16_000);
    const header = readWavHeader(wav);

    expect(header.riff).toBe('RIFF');
    expect(header.riffSize).toBe(36 + samples.length * 2);
    expect(header.wave).toBe('WAVE');
    expect(header.fmt).toBe('fmt ');
    expect(header.audioFormat).toBe(1);
    expect(header.channels).toBe(1);
    expect(header.sampleRate).toBe(16_000);
    expect(header.byteRate).toBe(32_000);
    expect(header.blockAlign).toBe(2);
    expect(header.bitsPerSample).toBe(16);
    expect(header.data).toBe('data');
    expect(header.dataSize).toBe(samples.length * 2);

    const view = new DataView(wav, 44);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(16383);
    expect(view.getInt16(4, true)).toBe(-16384);
    expect(view.getInt16(6, true)).toBe(32767);
    expect(view.getInt16(8, true)).toBe(-32768);
  });

  it('clamps samples outside the valid audio range', () => {
    const wav = encodePcmWav(new Float32Array([2, -2]), 8_000);
    const view = new DataView(wav, 44);
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(-32768);
  });

  it('base64-encodes large buffers in chunks without corruption', () => {
    const bytes = new Uint8Array(100_000);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 251;
    }

    const base64 = arrayBufferToBase64(bytes.buffer);
    expect(Buffer.from(base64, 'base64')).toEqual(Buffer.from(bytes));
  });
});

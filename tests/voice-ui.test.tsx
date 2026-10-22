// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalkieTalkieButton } from '../src/client/components/voice/WalkieTalkieButton';
import { IncomingVoiceBubble } from '../src/client/components/voice/IncomingVoiceBubble';
import type { MatchVoiceEvent } from '../src/shared/events';
import * as audioRadio from '../src/client/lib/audio-radio';

describe('Walkie-Talkie Voice UI Components', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('WalkieTalkieButton', () => {
    it('renders initial idle PTT button', () => {
      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={vi.fn()}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to talk/i });
      expect(pttButton).toBeTruthy();
      expect(pttButton.textContent).toContain('PTT');
    });

    it('prevents mistake on accidental short tap (<500ms) and shows hold hint', async () => {
      const onSendVoice = vi.fn();

      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      const cancelMock = vi.fn();
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockResolvedValue({ success: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'cancel').mockImplementation(cancelMock);

      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={onSendVoice}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to talk/i });

      // 1. Pointer down
      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      // 2. Advance time only 200ms (accidental short tap)
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // 3. Pointer up
      await act(async () => {
        fireEvent.pointerUp(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      // Must cancel and NOT send
      expect(cancelMock).toHaveBeenCalled();
      expect(onSendVoice).not.toHaveBeenCalled();

      // Shows hint to prevent user confusion
      expect(screen.getByText(/hold to talk/i)).toBeTruthy();
    });

    it('cancels voice transmission when user slides finger up > 50px', async () => {
      const onSendVoice = vi.fn();

      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      const cancelMock = vi.fn();
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockResolvedValue({ success: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'cancel').mockImplementation(cancelMock);

      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={onSendVoice}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to talk/i });

      // Start holding
      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      act(() => {
        vi.advanceTimersByTime(800);
      });

      // Drag up by 70px (from 500 to 430)
      act(() => {
        fireEvent.pointerMove(pttButton, { clientX: 100, clientY: 430, pointerId: 1 });
      });

      // Verify cancellation UI is triggered
      expect(screen.getByText(/release to cancel/i)).toBeTruthy();

      // Release while in cancel zone
      await act(async () => {
        fireEvent.pointerUp(pttButton, { clientX: 100, clientY: 430, pointerId: 1 });
      });

      expect(cancelMock).toHaveBeenCalled();
      expect(onSendVoice).not.toHaveBeenCalled();
    });

    it('successfully records and sends voice when held and released normally', async () => {
      const onSendVoice = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockResolvedValue({ success: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'stop').mockResolvedValue({
        audioData: 'data:audio/webm;base64,mockVoiceAudio',
        durationMs: 1400,
        waveform: [0.1, 0.4, 0.8, 0.5],
      });

      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={onSendVoice}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to talk/i });

      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      act(() => {
        vi.advanceTimersByTime(1400);
      });

      await act(async () => {
        fireEvent.pointerUp(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      expect(onSendVoice).toHaveBeenCalledWith(
        'data:audio/webm;base64,mockVoiceAudio',
        1400,
        [0.1, 0.4, 0.8, 0.5],
      );
    });

    it('gracefully handles microphone permission denied error without crashing', async () => {
      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockResolvedValue({
        success: false,
        error: 'Microphone permission was denied in browser.',
      });

      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={vi.fn()}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to talk/i });

      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      // Error modal appears
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText(/Microphone permission was denied/i)).toBeTruthy();

      // Dismiss button
      const gotItBtn = screen.getByRole('button', { name: /got it/i });
      fireEvent.click(gotItBtn);

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('IncomingVoiceBubble', () => {
    const dummyVoice: MatchVoiceEvent = {
      matchId: 'test-match-1',
      senderSide: 'O',
      audioData: 'data:audio/webm;base64,mockVoiceAudio',
      durationMs: 2500,
      waveform: [0.2, 0.6, 0.9, 0.4, 0.7, 0.3],
      timestamp: new Date().toISOString(),
      voiceId: 'voice-123',
    };

    it('renders radio transceiver metadata and auto-plays on mount', () => {
      const stopMock = vi.fn();
      let stateCallback: ((s: { isPlaying: boolean; progress: number }) => void) | undefined;
      vi.spyOn(audioRadio, 'playVoiceAudio').mockImplementation((_url, cb) => {
        stateCallback = cb;
        return { stop: stopMock };
      });

      const onDismiss = vi.fn();

      render(
        <IncomingVoiceBubble
          voice={dummyVoice}
          onDismiss={onDismiss}
          senderName="Commander"
          isYou={false}
          align="right"
        />,
      );

      // Verify audio play was initiated
      expect(audioRadio.playVoiceAudio).toHaveBeenCalledWith(dummyVoice.audioData, expect.any(Function));

      // Verify metadata
      expect(screen.getByText(/Commander · RX/i)).toBeTruthy();
      expect(screen.getByText('2.5s')).toBeTruthy();

      // Simulate playback progress
      act(() => {
        stateCallback?.({ isPlaying: true, progress: 0.5 });
      });

      // Pause button should now be visible
      const pauseBtn = screen.getByRole('button', { name: /pause audio/i });
      expect(pauseBtn).toBeTruthy();

      // Toggle pause
      fireEvent.click(pauseBtn);
      expect(stopMock).toHaveBeenCalled();
    });

    it('allows manual dismiss of the incoming voice bubble', () => {
      vi.spyOn(audioRadio, 'playVoiceAudio').mockReturnValue({ stop: vi.fn() });
      const onDismiss = vi.fn();

      render(
        <IncomingVoiceBubble
          voice={dummyVoice}
          onDismiss={onDismiss}
          senderName="Alice"
          isYou={true}
          align="left"
        />,
      );

      const dismissBtn = screen.getByRole('button', { name: /dismiss voice message/i });
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalled();
    });
  });
});

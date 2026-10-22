// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalkieTalkieButton } from '../src/client/components/voice/WalkieTalkieButton';
import * as audioRadio from '../src/client/lib/audio-radio';

describe('Walkie-Talkie Voice UI Components (Popup-Free Audio Engine)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('WalkieTalkieButton', () => {
    it('renders initial idle PTT button without any popups', () => {
      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={vi.fn()}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to record/i });
      expect(pttButton).toBeTruthy();
      expect(pttButton.textContent).toContain('PTT');

      // Verify no floating popup overlays are rendered
      expect(screen.queryByRole('region')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('prevents mistake on accidental short tap (<500ms) without showing popup', async () => {
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

      const pttButton = screen.getByRole('button', { name: /hold to record/i });

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

      // No popup overlays
      expect(screen.queryByRole('region')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('cancels voice transmission when user slides finger up > 50px without popup', async () => {
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

      const pttButton = screen.getByRole('button', { name: /hold to record/i });

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

      // Button itself displays CANCEL state
      expect(pttButton.textContent).toContain('CANCEL');

      // Release while in cancel zone
      await act(async () => {
        fireEvent.pointerUp(pttButton, { clientX: 100, clientY: 430, pointerId: 1 });
      });

      expect(cancelMock).toHaveBeenCalled();
      expect(onSendVoice).not.toHaveBeenCalled();
      expect(screen.queryByRole('region')).toBeNull();
    });

    it('successfully records and sends voice when held and released normally without popup', async () => {
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

      const pttButton = screen.getByRole('button', { name: /hold to record/i });

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
      expect(screen.queryByRole('region')).toBeNull();
    });

    it('gracefully handles microphone permission denied error via callback with zero popup modals', async () => {
      const onError = vi.fn();
      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockResolvedValue({
        success: false,
        error: 'Microphone permission was denied in browser.',
      });

      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={vi.fn()}
          onError={onError}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to record/i });

      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      // No modal popup
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(onError).toHaveBeenCalledWith('Microphone permission was denied in browser.');
    });

    it('cancels and cleans up recorder when component is unmounted during recording', async () => {
      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      const cancelMock = vi.fn();
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockResolvedValue({ success: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'cancel').mockImplementation(cancelMock);

      const { unmount } = render(
        <WalkieTalkieButton matchId="test-match-1" onSendVoice={vi.fn()} />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to record/i });
      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      unmount();
      expect(cancelMock).toHaveBeenCalled();
    });

    it('cleans up when lostpointercapture event fires', async () => {
      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      const cancelMock = vi.fn();
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockResolvedValue({ success: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'cancel').mockImplementation(cancelMock);

      render(<WalkieTalkieButton matchId="test-match-1" onSendVoice={vi.fn()} />);

      const pttButton = screen.getByRole('button', { name: /hold to record/i });
      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      act(() => {
        fireEvent.lostPointerCapture(pttButton, { pointerId: 1 });
      });

      expect(cancelMock).toHaveBeenCalled();
      expect(pttButton.textContent).toContain('PTT');
    });

    it('ignores a second pointer while the first start is still pending', async () => {
      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'cancel').mockImplementation(() => {});
      let resolveStart!: (value: { success: boolean }) => void;
      const startSpy = vi
        .spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start')
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveStart = resolve;
            }),
        );

      render(<WalkieTalkieButton matchId="test-match-1" onSendVoice={vi.fn()} />);

      const pttButton = screen.getByRole('button', { name: /hold to record/i });

      act(() => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 2 });
      });

      expect(startSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveStart({ success: true });
      });

      expect(pttButton.textContent).toContain('REC');
    });

    it('does not surface an error when starting is cancelled during the permission prompt', async () => {
      const onError = vi.fn();
      vi.spyOn(audioRadio, 'checkMicrophoneSupport').mockReturnValue({ supported: true });
      const cancelMock = vi.fn();
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'cancel').mockImplementation(cancelMock);
      let resolveStart!: (value: { success: boolean; cancelled?: boolean }) => void;
      vi.spyOn(audioRadio.WalkieTalkieRecorder.prototype, 'start').mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStart = resolve;
          }),
      );

      render(
        <WalkieTalkieButton
          matchId="test-match-1"
          onSendVoice={vi.fn()}
          onError={onError}
        />,
      );

      const pttButton = screen.getByRole('button', { name: /hold to record/i });

      await act(async () => {
        fireEvent.pointerDown(pttButton, { clientX: 100, clientY: 500, pointerId: 1 });
      });

      act(() => {
        fireEvent.lostPointerCapture(pttButton, { pointerId: 1 });
      });
      expect(cancelMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveStart({ success: false, cancelled: true });
      });

      expect(onError).not.toHaveBeenCalled();
      expect(pttButton.textContent).toContain('PTT');
    });
  });

  describe('Auto-Play Audio Engine (Zero UI Popup)', () => {
    it('directly invokes playVoiceAudio when audio transmission is received', () => {
      const playSpy = vi.spyOn(audioRadio, 'playVoiceAudio').mockReturnValue({ stop: vi.fn() });

      audioRadio.playVoiceAudio('data:audio/webm;base64,mockAudio');

      expect(playSpy).toHaveBeenCalledWith('data:audio/webm;base64,mockAudio');
    });
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';

// Progress for "upload a file, then wait on an AI extraction" screens
// (SyllabusUploadModal, TimetableUploadModal, AI Coach attachments). Three
// phases, all on one bar:
//  1. preparing: reading the file off the device, before any bytes are sent
//  2. uploading: REAL progress from the request's upload events, filling the
//                   first UPLOAD_SHARE of the bar ("Uploading… 45%")
//  3. processing: the AI call itself, which reports nothing, so the bar
//                   climbs asymptotically toward (never reaching) a cap with
//                   rotating status text. A fake linear fill would either
//                   finish long before the real result or look stalled.
// Pass `onUploadProgress` to the request (see services/api.ts) to drive
// phase 2. If upload events never arrive (some platforms/requests don't emit
// them), the bar moves on to phase 3 after a short wait instead of stalling.
const UPLOAD_SHARE = 40;
const PROGRESS_CAP = 92;
const PROGRESS_TICK_MS = 400;
const STATUS_INTERVAL_MS = 3000;
const NO_UPLOAD_EVENTS_FALLBACK_MS = 3000;

type Phase = 'preparing' | 'uploading' | 'processing';

export function useFakeExtractionProgress(active: boolean, statusMessages: string[]) {
  const [phase, setPhase] = useState<Phase>('preparing');
  const [uploadFraction, setUploadFraction] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(UPLOAD_SHARE);
  const [statusIndex, setStatusIndex] = useState(0);
  const phaseRef = useRef<Phase>('preparing');

  const moveTo = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    if (!active) return;
    moveTo('preparing');
    setUploadFraction(0);
    setProcessingProgress(UPLOAD_SHARE);
    setStatusIndex(0);
  }, [active]);

  // Phase 3's climb and status rotation.
  useEffect(() => {
    if (!active || phase !== 'processing') return;
    const progressTimer = setInterval(() => {
      setProcessingProgress((p) => p + (PROGRESS_CAP - p) * 0.08);
    }, PROGRESS_TICK_MS);
    const statusTimer = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, statusMessages.length - 1));
    }, STATUS_INTERVAL_MS);
    return () => {
      clearInterval(progressTimer);
      clearInterval(statusTimer);
    };
    // statusMessages intentionally excluded — callers pass a module-level
    // constant array, and re-running this on every render if they didn't
    // would restart the climb/rotation for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phase]);

  // Upload started but no progress event has come in — don't sit at 0%.
  useEffect(() => {
    if (!active || phase !== 'uploading' || uploadFraction > 0) return;
    const timer = setTimeout(() => {
      if (phaseRef.current === 'uploading') moveTo('processing');
    }, NO_UPLOAD_EVENTS_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [active, phase, uploadFraction]);

  const onUploadProgress = useCallback((fraction: number) => {
    if (phaseRef.current === 'processing') return;
    if (fraction >= 1) {
      setUploadFraction(1);
      moveTo('processing');
      return;
    }
    if (phaseRef.current === 'preparing') moveTo('uploading');
    setUploadFraction(fraction);
  }, []);

  const uploadPct = Math.round(uploadFraction * 100);
  const progress =
    phase === 'preparing' ? 2 : phase === 'uploading' ? Math.max(2, UPLOAD_SHARE * uploadFraction) : processingProgress;
  const statusMessage =
    phase === 'preparing'
      ? 'Preparing your file…'
      : phase === 'uploading'
        ? `Uploading… ${uploadPct}%`
        : statusMessages[statusIndex] ?? statusMessages[0];

  return { progress, statusMessage, onUploadProgress };
}

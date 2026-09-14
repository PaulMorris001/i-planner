import { useEffect, useState } from 'react';

// There's no real progress to report for a one-shot AI extraction call — one
// request, one response, no incremental events to hook into — so this climbs
// asymptotically toward (never reaching) a cap instead of a fake linear
// fill, which would either finish long before the real result and then sit
// doing nothing, or look stalled once outpaced by a slow request.
const PROGRESS_CAP = 92;
const PROGRESS_TICK_MS = 400;
const STATUS_INTERVAL_MS = 3000;

// Shared by every "waiting on an AI extraction" screen (SyllabusUploadModal,
// TimetableUploadModal, ...) — same climbing-progress-bar + rotating-status-
// text idiom, just parameterized by each feature's own copy. `active` gates
// the interval (pass true only while the caller is actually in its
// extracting-equivalent step).
export function useFakeExtractionProgress(active: boolean, statusMessages: string[]) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    setProgress(0);
    setStatusIndex(0);
    const progressTimer = setInterval(() => {
      setProgress((p) => p + (PROGRESS_CAP - p) * 0.08);
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
  }, [active]);

  return { progress, statusMessage: statusMessages[statusIndex] ?? statusMessages[0] };
}

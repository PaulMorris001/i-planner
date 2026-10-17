import { useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { errorMessage } from '@/lib/api';
import type { AnnouncementOutcome, AnnouncementSegment, AnnouncementsOverview } from '@/lib/types';

export const TITLE_MAX = 65;
export const BODY_MAX = 500;

// The announcement being written and sent: the fields, which channels, the confirm step, the
// in-flight and error state, and the result. `onSent` receives a fresh overview (audience and
// history) after a successful send.
export function useAnnouncementComposer(onSent: (overview: AnnouncementsOverview) => void) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [segment, setSegmentState] = useState<AnnouncementSegment>('all');
  const [route, setRoute] = useState<string | undefined>();
  const [confirm, setConfirm] = useState<{ test: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnnouncementOutcome | null>(null);

  // People with no push device can only be reached by email, so choosing them switches push off.
  const setSegment = (next: AnnouncementSegment) => {
    setSegmentState(next);
    if (next === 'no_push') {
      setPush(false);
      setEmail(true);
    }
  };

  const hasChannel = push || email;
  const ready = title.trim().length > 0 && body.trim().length > 0 && hasChannel;

  const review = (test: boolean) => {
    if (!ready) return;
    setError('');
    setConfirm({ test });
  };

  const cancel = () => {
    if (!sending) setConfirm(null);
  };

  const send = async () => {
    if (!confirm || sending) return;
    setSending(true);
    setError('');
    try {
      const outcome = await adminApi.sendAnnouncement({ title: title.trim(), body: body.trim(), route, segment, push, email, test: confirm.test });
      setResult(outcome);
      setConfirm(null);
      // A real send starts the next one from a blank page; a test keeps the text for the real send.
      if (!confirm.test) {
        setTitle('');
        setBody('');
      }
      const overview = await adminApi.announcements().catch(() => null);
      if (overview) onSent(overview);
    } catch (err) {
      setError(errorMessage(err, 'Could not send. Try again.'));
    } finally {
      setSending(false);
    }
  };

  return {
    title,
    setTitle,
    body,
    setBody,
    push,
    togglePush: () => segment === 'all' && setPush((v) => !v),
    email,
    toggleEmail: () => setEmail((v) => !v),
    segment,
    setSegment,
    route,
    setRoute,
    hasChannel,
    ready,
    confirm,
    review,
    cancel,
    send,
    sending,
    error,
    result,
    dismissResult: () => setResult(null),
  };
}

import { Banner, Spinner } from '@/components/ui/Feedback';
import { Dialog } from '@/components/ui/Controls';
import { Card, Pill } from '@/components/ui/Display';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { formatCount, timeAgo } from '@/lib/format';
import type { AnnouncementRecord } from '@/lib/types';

// One way to send (push or email) as a tickable row.
export function ChannelToggle({ label, hint, icon, on, onClick }: { label: string; hint: string; icon: IconName; on: boolean; onClick: () => void }) {
  return (
    <button className={`channel${on ? ' on' : ''}`} onClick={onClick} role="checkbox" aria-checked={on}>
      <span className="icon-chip" style={{ width: 40, height: 40, background: on ? 'var(--accent)' : 'var(--accent-soft)', color: on ? '#fff' : 'var(--accent)' }}>
        <Icon name={icon} size={19} />
      </span>
      <span>
        <div className="label-main">{label}</div>
        <div className="hint">{hint}</div>
      </span>
      <span className="check">{on && <Icon name="check" size={14} />}</span>
    </button>
  );
}

// What the push will look like on a lock screen, as it is typed.
export function NotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="preview">
      <Logo size={40} />
      <div style={{ minWidth: 0 }}>
        <div className="app">I-PLANNER · now</div>
        <div className="title">{title.trim() || 'Your title appears here'}</div>
        <div className="body">{body.trim() || 'Your message appears here.'}</div>
      </div>
    </div>
  );
}

// What the email will look like: the same layout the backend sends (logo, title, message, and the
// line saying why they got it), so what is typed here is what lands in the inbox.
export function EmailPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="email-preview" aria-label="Email preview">
      <div className="email-card">
        <Logo size={56} />
        <h4>{title.trim() || 'Your title appears here'}</h4>
        <p>{body.trim() || 'Your message appears here.'}</p>
        <p className="why">
          You&apos;re getting this because &quot;Product updates&quot; is switched on in i-Planner. You can turn it off any time in the app under Profile.
        </p>
        <div className="sig">i-Planner</div>
      </div>
    </div>
  );
}

// One past announcement: what it said, when, and how many it reached on each channel.
export function AnnouncementHistoryCard({ item }: { item: AnnouncementRecord }) {
  return (
    <Card>
      <div className="history">
        <div className="top">
          <span className="title">{item.title}</span>
          <span className="time">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="body">{item.body}</div>
        <div className="meta">
          {item.test && <Pill label="TEST" color="#B45309" background="#FEF3E2" />}
          {item.channels.push && <Pill label={`PUSH ${formatCount(item.pushAccepted)}/${formatCount(item.pushDevices)}`} color="#2563EB" background="#E8EEFC" />}
          {item.channels.email && <Pill label={`EMAIL ${formatCount(item.emailSent)}/${formatCount(item.emailRecipients)}`} color="#7C3AED" background="#F1EBFD" />}
        </div>
      </div>
    </Card>
  );
}

interface SendConfirmDialogProps {
  // null = closed; `test` true = a test to the sender only.
  confirm: { test: boolean } | null;
  title: string;
  body: string;
  // Which ways it goes out, so the right previews are shown.
  push: boolean;
  email: boolean;
  // The plain-language "who will get this" sentence.
  reach: string;
  sending: boolean;
  error: string;
  onSend: () => void;
  onCancel: () => void;
}

// The last look before an announcement goes out: the preview, exactly who it reaches, and Send.
export function SendConfirmDialog({ confirm, title, body, push, email, reach, sending, error, onSend, onCancel }: SendConfirmDialogProps) {
  return (
    <Dialog open={!!confirm} title={confirm?.test ? 'Send a test to yourself?' : 'Send this announcement?'} onClose={onCancel} busy={sending}>
      {push && <NotificationPreview title={title} body={body} />}
      {email && <EmailPreview title={title} body={body} />}
      <p style={{ fontWeight: 700 }}>{reach}</p>
      {confirm && !confirm.test && <p className="muted">It can&apos;t be recalled once it&apos;s sent.</p>}
      {error && <Banner tone="error">{error}</Banner>}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onCancel} disabled={sending}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={onSend} disabled={sending}>
          {sending ? <Spinner /> : confirm?.test ? 'Send test' : 'Send now'}
        </button>
      </div>
    </Dialog>
  );
}

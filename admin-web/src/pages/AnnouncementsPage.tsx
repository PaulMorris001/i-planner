import { AnnouncementHistoryCard, ChannelToggle, NotificationPreview, SendConfirmDialog } from '@/components/announcements/AnnouncementBlocks';
import { Page } from '@/components/layout/Page';
import { FilterChips } from '@/components/ui/Controls';
import { Card, SectionTitle } from '@/components/ui/Display';
import { Banner, EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { BODY_MAX, TITLE_MAX, useAnnouncementComposer } from '@/hooks/useAnnouncementComposer';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { adminApi } from '@/lib/adminApi';
import { formatCount, plural } from '@/lib/format';

// Where a tapped announcement opens in the app ('' = the app's home).
const DESTINATIONS = [
  { value: '', label: 'App home' },
  { value: '/notes', label: 'Notes' },
  { value: '/plans', label: 'Plans' },
  { value: '/coach', label: 'AI Coach' },
  { value: '/study', label: 'Study' },
  { value: '/leaderboard', label: 'Leaderboard' },
  { value: '/profile', label: 'Profile' },
];

// Write and send an announcement by push, email or both. The pieces (channel rows, preview,
// confirmation, history) are components; the writing and sending flow is useAnnouncementComposer.
export function AnnouncementsPage() {
  const overview = useAsyncResource(() => adminApi.announcements(), []);
  const composer = useAnnouncementComposer((fresh) => overview.setData(fresh));
  const pushDevices = overview.data?.audience.pushDevices ?? 0;
  const emailRecipients = overview.data?.audience.emailRecipients ?? 0;

  const reach = (test: boolean) => {
    if (test) return 'Only you will receive this test.';
    const parts: string[] = [];
    if (composer.push) parts.push(`${formatCount(pushDevices)} ${plural(pushDevices, 'device', 'devices')}`);
    if (composer.email) parts.push(`${formatCount(emailRecipients)} ${plural(emailRecipients, 'inbox', 'inboxes')}`);
    return `This will reach ${parts.join(' and ')}.`;
  };

  const { result } = composer;

  return (
    <Page title="Announcements" subtitle="Reach users by push, email or both">
      {overview.loading && !overview.data ? (
        <LoadingBlock />
      ) : overview.error && !overview.data ? (
        <ErrorBlock message={overview.error} onRetry={overview.reload} />
      ) : (
        <>
          {result && (
            <Banner tone="success" onDismiss={composer.dismissResult}>
              <strong>{result.test ? 'Test sent to you. ' : 'Announcement sent. '}</strong>
              {result.pushDevices > 0 && `Push: ${formatCount(result.pushAccepted)} of ${formatCount(result.pushDevices)} devices accepted it. `}
              {result.emailRecipients > 0 && `Email: ${formatCount(result.emailSent)} of ${formatCount(result.emailRecipients)} inboxes. `}
              {result.pushDevices === 0 && result.emailRecipients === 0 && 'Nobody was eligible to receive it.'}
            </Banner>
          )}

          <div className="compose">
            <Card>
              <SectionTitle title="Write it" />
              <div className="stack" style={{ gap: 16 }}>
                <div className="field">
                  <div className="field-head">
                    <span className="label">Title</span>
                    <span className="counter">
                      {composer.title.length}/{TITLE_MAX}
                    </span>
                  </div>
                  <input className="input" value={composer.title} onChange={(e) => composer.setTitle(e.target.value)} placeholder="New: Study timer" maxLength={TITLE_MAX} aria-label="Title" />
                </div>
                <div className="field">
                  <div className="field-head">
                    <span className="label">Message</span>
                    <span className={`counter${composer.body.length > BODY_MAX - 40 ? ' warn' : ''}`}>
                      {composer.body.length}/{BODY_MAX}
                    </span>
                  </div>
                  <textarea
                    className="textarea"
                    value={composer.body}
                    onChange={(e) => composer.setBody(e.target.value)}
                    placeholder="Tell people what's new…"
                    maxLength={BODY_MAX}
                    aria-label="Message"
                  />
                </div>
                <div className="field">
                  <span className="label">Opens when tapped</span>
                  <FilterChips options={DESTINATIONS} value={composer.route ?? ''} onChange={(value) => composer.setRoute(value || undefined)} />
                </div>
              </div>
            </Card>

            <div className="stack">
              <Card>
                <SectionTitle title="Send as" hint="Only people who turned on “Product updates” are included" />
                <div className="stack" style={{ gap: 10 }}>
                  <ChannelToggle
                    label="Push notification"
                    hint={`${formatCount(pushDevices)} ${plural(pushDevices, 'device', 'devices')} can receive it`}
                    icon="bell"
                    on={composer.push}
                    onClick={composer.togglePush}
                  />
                  <ChannelToggle
                    label="Email"
                    hint={`${formatCount(emailRecipients)} ${plural(emailRecipients, 'inbox', 'inboxes')} can receive it`}
                    icon="mail"
                    on={composer.email}
                    onClick={composer.toggleEmail}
                  />
                </div>
                {!composer.hasChannel && <p className="footnote" style={{ color: 'var(--warning)' }}>Choose at least one way to send it.</p>}
              </Card>

              {composer.push && (
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Preview</div>
                  <NotificationPreview title={composer.title} body={composer.body} />
                </div>
              )}

              <div className="btn-row">
                <button className="btn btn-secondary" onClick={() => composer.review(true)} disabled={!composer.ready}>
                  Send test to me
                </button>
                <button className="btn btn-primary" onClick={() => composer.review(false)} disabled={!composer.ready}>
                  <Icon name="send" size={16} />
                  Send to users
                </button>
              </div>
            </div>
          </div>

          <SectionTitle title="Sent so far" />
          {overview.data && overview.data.history.length === 0 ? (
            <EmptyBlock icon="megaphone" title="Nothing sent yet" message="Announcements you send appear here, with who they reached." />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {overview.data?.history.map((item) => (
                <AnnouncementHistoryCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}

      <SendConfirmDialog
        confirm={composer.confirm}
        title={composer.title}
        body={composer.body}
        reach={reach(!!composer.confirm?.test)}
        sending={composer.sending}
        error={composer.error}
        onSend={composer.send}
        onCancel={composer.cancel}
      />
    </Page>
  );
}

import { useState, type FormEvent } from 'react';
import { friendlyPasswordError, MIN_PASSWORD_LENGTH, useAuth } from '@/auth/AuthProvider';
import { Page } from '@/components/layout/Page';
import { Card, SectionTitle } from '@/components/ui/Display';
import { Banner, Spinner } from '@/components/ui/Feedback';

// What is wrong with the typed passwords, in order of what to fix first; '' when they are fine.
export function passwordProblem(current: string, next: string, confirm: string): string {
  if (!current) return 'Enter your current password.';
  if (next.length < MIN_PASSWORD_LENGTH) return `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next === current) return 'The new password must be different from the current one.';
  if (next !== confirm) return "The new passwords don't match.";
  return '';
}

// Change your own password: confirm the current one, type the new one twice.
export function AccountPage() {
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const problem = passwordProblem(current, next, confirm);
  // Mismatch and length are worth saying while typing; "enter your current password" is not.
  const hint = next || confirm ? (problem === 'Enter your current password.' ? '' : problem) : '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem || submitting) return;
    setSubmitting(true);
    setError('');
    setDone(false);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(friendlyPasswordError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <Page title="Account" subtitle={user?.email ?? 'Your administrator account'}>
      <div style={{ maxWidth: 520 }}>
        <Card>
          <SectionTitle title="Change password" hint="You'll stay signed in on this device." />
          <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
            {done && <Banner tone="success" onDismiss={() => setDone(false)}>Your password has been changed.</Banner>}
            {error && <Banner tone="error">{error}</Banner>}

            <div className="field">
              <span className="label">Current password</span>
              <input className="input" type={type} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" aria-label="Current password" />
            </div>
            <div className="field">
              <span className="label">New password</span>
              <input className="input" type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-label="New password" />
            </div>
            <div className="field">
              <span className="label">Confirm new password</span>
              <input className="input" type={type} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-label="Confirm new password" />
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
            </label>

            {hint && <p className="footnote" style={{ color: 'var(--warning)', marginTop: 0 }}>{hint}</p>}

            <button className="btn btn-primary" type="submit" disabled={!!problem || submitting}>
              {submitting ? <Spinner /> : 'Change password'}
            </button>
          </form>
        </Card>
      </div>
    </Page>
  );
}

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { friendlySignInError, useAuth } from '@/auth/AuthProvider';
import { Banner, Spinner } from '@/components/ui/Feedback';
import { Logo } from '@/components/ui/Logo';

// Sign in with the account that was given the admin role. Anyone else who signs in here is told
// the account has no admin access and is signed straight back out.
export function LoginPage() {
  const { status, signIn, logout } = useAuth();
  const location = useLocation();
  const denied = status === 'notAdmin' || (location.state as { denied?: boolean } | null)?.denied === true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (status === 'admin') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(friendlySignInError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-head">
          <Logo size={72} />
          <h1>i-Planner Admin</h1>
          <p>Sign in with your administrator account.</p>
        </div>

        {denied && (
          <Banner tone="error">
            This account doesn&apos;t have admin access.{' '}
            <button type="button" onClick={() => logout()} style={{ color: 'inherit', textDecoration: 'underline', font: 'inherit' }}>
              Sign out
            </button>
          </Banner>
        )}
        {error && <Banner tone="error">{error}</Banner>}

        <div className="field">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@company.com" aria-label="Email" />
        </div>
        <div className="field">
          <span className="label">Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" aria-label="Password" />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={!email.trim() || !password || submitting}>
          {submitting ? <Spinner /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

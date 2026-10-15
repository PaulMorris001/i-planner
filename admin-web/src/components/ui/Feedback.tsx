import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="center-block">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="center-block">
      <span style={{ color: 'var(--danger)' }}>
        <Icon name="alert" size={28} />
      </span>
      <span>{message}</span>
      <button className="btn btn-secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyBlock({ icon = 'search', title, message }: { icon?: IconName; title: string; message?: ReactNode }) {
  return (
    <div className="center-block">
      <span className="icon-chip" style={{ width: 52, height: 52, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
        <Icon name={icon} size={24} />
      </span>
      <h4>{title}</h4>
      {message && <span>{message}</span>}
    </div>
  );
}

export function Banner({ tone, children, onDismiss }: { tone: 'error' | 'success'; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`banner ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={18} />
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" style={{ display: 'grid', color: 'inherit' }}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Feedback';
import { formatCount } from '@/lib/format';

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <span style={{ color: 'var(--text-3)', display: 'grid' }}>
        <Icon name="search" size={18} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {value && (
        <button className="clear" onClick={() => onChange('')} aria-label="Clear search">
          <Icon name="close" size={16} />
        </button>
      )}
    </label>
  );
}

// A row of pill buttons; the chosen one is filled. One choice at a time.
export function FilterChips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (next: T) => void }) {
  return (
    <div className="chips" role="group">
      {options.map((option) => (
        <button key={option.value} className={`chip${option.value === value ? ' active' : ''}`} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Two or three options in one rounded track; the chosen one is lifted.
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (next: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button key={option.value} role="tab" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function LoadMoreButton({ remaining, loading, onClick }: { remaining: number; loading: boolean; onClick: () => void }) {
  return (
    <button className="btn btn-ghost btn-block" onClick={onClick} disabled={loading}>
      {loading ? <Spinner /> : `Show more (${formatCount(remaining)} left)`}
    </button>
  );
}

// A centred dialog. Esc and a click on the backdrop close it (unless it is `busy`).
export function Dialog({ open, title, onClose, busy, children }: { open: boolean; title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

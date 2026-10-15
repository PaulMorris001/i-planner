import { Banner, Spinner } from '@/components/ui/Feedback';
import { Dialog } from '@/components/ui/Controls';
import type { AccountAction } from '@/hooks/useAccountModeration';

interface AccountDialogProps {
  action: AccountAction | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  acting: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// The "are you sure?" step for suspending or restoring an account (with an optional reason when
// suspending).
export function AccountDialog({ action, reason, onReasonChange, acting, error, onConfirm, onCancel }: AccountDialogProps) {
  const suspending = action?.mode === 'suspend';
  const who = action ? action.user.name || action.user.email : '';

  return (
    <Dialog open={!!action} title={suspending ? 'Suspend this account?' : 'Restore this account?'} onClose={onCancel} busy={acting}>
      <p className="muted">
        {suspending
          ? `${who} will be signed out and won't be able to use i-Planner until you restore them. Their data is kept.`
          : `${who} will be able to sign in and use i-Planner again.`}
      </p>
      {suspending && (
        <input className="input" value={reason} onChange={(e) => onReasonChange(e.target.value)} placeholder="Reason (only you can see it)" maxLength={200} aria-label="Reason" />
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onCancel} disabled={acting}>
          Cancel
        </button>
        <button className={`btn ${suspending ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={acting}>
          {acting ? <Spinner /> : suspending ? 'Suspend' : 'Restore'}
        </button>
      </div>
    </Dialog>
  );
}

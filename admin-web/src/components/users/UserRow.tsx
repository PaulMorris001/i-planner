import { useState } from 'react';
import { Avatar, Pill } from '@/components/ui/Display';
import { Icon } from '@/components/ui/Icon';
import { timeAgo } from '@/lib/format';
import type { AdminUserRow } from '@/lib/types';

const ACTIVE_NOW_MS = 5 * 60 * 1000;

const TIER_STYLE: Record<AdminUserRow['tier'], { label: string; color: string; background: string }> = {
  free: { label: 'FREE', color: '#6B6A80', background: '#ECECF4' },
  student: { label: 'STUDENT', color: '#2563EB', background: '#E8EEFC' },
  professional: { label: 'PROFESSIONAL', color: '#7C3AED', background: '#F1EBFD' },
  premium: { label: 'PREMIUM', color: '#B45309', background: '#FEF3E2' },
};

interface UserRowProps {
  user: AdminUserRow;
  onSuspend: (user: AdminUserRow) => void;
  onRestore: (user: AdminUserRow) => void;
}

// One account: who they are, their plan, when they were last around, and the suspend / restore
// button. Admins get no button (they can't be suspended from here).
export function UserRow({ user, onSuspend, onRestore }: UserRowProps) {
  const [copied, setCopied] = useState(false);
  const tier = TIER_STYLE[user.tier];
  const activeNow = user.lastActiveAt ? Date.now() - Date.parse(user.lastActiveAt) < ACTIVE_NOW_MS : false;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing useful to do.
    }
  };

  return (
    <article className={`user${user.suspended ? ' suspended' : ''}`}>
      <span className={activeNow ? 'online' : undefined}>
        <Avatar name={user.name || user.email} seed={user.uid} />
      </span>

      <div className="who">
        <div className="name">{user.name || 'No name'}</div>
        <div className="email">{user.email || 'No email'}</div>
        <div className="meta">
          <button className="id-chip" onClick={copyId} title="Copy user id" aria-label="Copy user id">
            {copied ? 'Copied' : `ID ${user.uid.slice(0, 10)}…`}
            <Icon name="copy" size={12} />
          </button>
          <span>{activeNow ? 'Active now' : user.lastActiveAt ? `Active ${timeAgo(user.lastActiveAt)}` : `Joined ${timeAgo(user.createdAt)}`}</span>
        </div>
      </div>

      <div className="actions">
        <Pill
          label={user.productUpdates ? 'UPDATES ON' : 'UPDATES OFF'}
          color={user.productUpdates ? '#15803D' : '#6B6A80'}
          background={user.productUpdates ? '#E7F6EC' : '#ECECF4'}
        />
        <Pill
          label={user.pushDevices > 0 ? `PUSH ${user.pushDevices}` : 'NO PUSH'}
          color={user.pushDevices > 0 ? '#2563EB' : '#B45309'}
          background={user.pushDevices > 0 ? '#E8EEFC' : '#FEF3E2'}
        />
        {user.isAdmin && <Pill label="ADMIN" color="#fff" background="var(--primary)" />}
        <Pill label={tier.label} color={tier.color} background={tier.background} />
        {!user.isAdmin &&
          (user.suspended ? (
            <button className="btn btn-success-soft" onClick={() => onRestore(user)}>
              Restore account
            </button>
          ) : (
            <button className="btn btn-danger-soft" onClick={() => onSuspend(user)}>
              Suspend account
            </button>
          ))}
      </div>

      {user.suspended && (
        <div className="reason">
          <Icon name="alert" size={15} />
          Suspended{user.suspendedReason ? ` · ${user.suspendedReason}` : ''}
        </div>
      )}
    </article>
  );
}

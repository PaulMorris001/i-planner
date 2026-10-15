import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { initials } from '@/lib/format';

export function Card({ children, flush, style }: { children: ReactNode; flush?: boolean; style?: CSSProperties }) {
  return (
    <section className={`card${flush ? ' flush' : ''}`} style={style}>
      {children}
    </section>
  );
}

export function SectionTitle({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="section-title">
      <div className="grow">
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </div>
      {right}
    </div>
  );
}

// A number with its label: the unit of the analytics grid.
export function StatTile({
  icon,
  label,
  value,
  caption,
  tint = 'var(--accent)',
  soft = 'var(--accent-soft)',
}: {
  icon: IconName;
  label: string;
  value: string;
  caption?: string;
  tint?: string;
  soft?: string;
}) {
  return (
    <div className="tile">
      <span className="icon-chip" style={{ width: 38, height: 38, background: soft, color: tint }}>
        <Icon name={icon} size={19} />
      </span>
      <div className="value">{value}</div>
      <div className="name">{label}</div>
      {caption && <div className="caption">{caption}</div>}
    </div>
  );
}

export function Pill({ label, color, background }: { label: string; color: string; background: string }) {
  return (
    <span className="pill" style={{ color, background }}>
      {label}
    </span>
  );
}

// Round badge with up to two initials; the colour comes from the id so a person always looks the same.
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#6366F1'];
export function Avatar({ name, seed, size = 44 }: { name: string; seed: string; size?: number }) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className="avatar" style={{ width: size, height: size, borderRadius: size / 2, fontSize: size * 0.38, background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}>
      {initials(name)}
    </span>
  );
}

// A horizontal bar filled to `fraction` (0..1).
export function MeterBar({ fraction, color = 'var(--accent)', height = 8 }: { fraction: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * 100;
  return (
    <div className="meter" style={{ height, borderRadius: height / 2 }} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%`, background: color, borderRadius: height / 2 }} />
    </div>
  );
}

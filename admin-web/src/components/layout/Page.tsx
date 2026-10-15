import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  subtitle?: string;
  // Something pinned to the right of the title (a refresh button, a count).
  actions?: ReactNode;
  children: ReactNode;
}

// The header and body of one dashboard section. On small screens the title makes room for the
// menu button that AppShell pins in the corner.
export function Page({ title, subtitle, actions, children }: PageProps) {
  return (
    <>
      <header className="topbar">
        <div className="menu-spacer" style={{ width: 'var(--menu-offset, 0px)' }} />
        <div className="grow">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="content">{children}</div>
    </>
  );
}

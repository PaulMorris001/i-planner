import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

interface Section {
  to: string;
  label: string;
  description: string;
  icon: IconName;
  end?: boolean;
}

// One entry per dashboard section. The first is the home page.
export const SECTIONS: Section[] = [
  { to: '/', label: 'Analytics', description: 'Users, plans and activity', icon: 'analytics', end: true },
  { to: '/announcements', label: 'Announcements', description: 'Push and email updates', icon: 'megaphone' },
  { to: '/users', label: 'Users', description: 'Search, plans and suspensions', icon: 'users' },
  { to: '/leaderboard', label: 'Leaderboard', description: 'The full points table', icon: 'trophy' },
];

// The frame around every section: the side menu (a slide-in drawer on small screens) and the page.
export function AppShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the drawer after choosing a section.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="shell">
      <div className={`scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Admin menu">
        <div className="brand">
          <Logo size={46} />
          <h1>i-Planner Admin</h1>
          <p>{user?.email ?? 'Administrator'}</p>
        </div>
        <nav className="nav">
          {SECTIONS.map((section) => (
            <NavLink key={section.to} to={section.to} end={section.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon">
                <Icon name={section.icon} size={18} />
              </span>
              <span>
                {section.label}
                <small>{section.description}</small>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={() => logout()}>
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <button className="menu-button" style={{ position: 'fixed', top: 16, left: 16, zIndex: 10 }} onClick={() => setOpen(true)} aria-label="Open menu">
          <Icon name="menu" size={22} />
        </button>
        <Outlet />
      </main>
    </div>
  );
}

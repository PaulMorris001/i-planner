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
  { to: '/account', label: 'Account', description: 'Change your password', icon: 'lock' },
];

export const SIDEBAR_STORAGE_KEY = 'iplanner-admin.sidebar';

// Remembered between visits. Storage can be blocked (private windows), so every access is guarded.
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Not remembered; still works for this visit.
  }
}

// The frame around every section: the side menu and the page.
//  - Wide screens: the menu can be collapsed to a narrow icon rail and opened again (remembered).
//  - Small screens: the menu is a drawer that slides in over the page from the menu button.
export function AppShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();

  // Close the drawer after choosing a section.
  useEffect(() => setOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });
  };

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <div className={`scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Admin menu">
        <div className="brand">
          <Logo size={46} />
          <h1>i-Planner Admin</h1>
          <p>{user?.email ?? 'Administrator'}</p>
          <button
            className="collapse-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={18} />
          </button>
        </div>
        <nav className="nav">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
              title={collapsed ? section.label : undefined}
              aria-label={section.label}
            >
              <span className="nav-icon">
                <Icon name={section.icon} size={18} />
              </span>
              <span className="nav-text">
                {section.label}
                <small>{section.description}</small>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={() => logout()} title={collapsed ? 'Sign out' : undefined} aria-label="Sign out">
            <Icon name="logout" size={18} />
            <span className="nav-text">Sign out</span>
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

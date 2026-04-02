import { useState, ReactNode } from "react";

interface SidebarLayoutProps {
  currentScreen: string;
  onNavigate: (screen: any) => void;
  children: ReactNode;
}

const IconMic = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
    <path d="M19 10a7 7 0 0 1-14 0"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>
);

const IconBarChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

const IconNotes = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconGlobe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconPeople = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const LINKS = [
  { id: "landing",      label: "Practice",        Icon: IconMic     },
  { id: "shared-setup", label: "Shared Session",  Icon: IconPeople  },
  { id: "reports",      label: "Reports",         Icon: IconBarChart },
  { id: "notes",        label: "Notes",           Icon: IconNotes   },
];


export function SidebarLayout({ currentScreen, onNavigate, children }: SidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="layout-wrapper fade-in">
      <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>

        {/* Brand */}
        {/* Brand + Toggle Row */}
        <div className="sidebar__top">
          {!collapsed && (
            <div className="sidebar__brand">
              <div className="sidebar__brand-dot" />
              <span>REHEARSE</span>
            </div>
          )}
          <button
            className="sidebar__toggle-bottom"
            style={{ width: "auto", marginTop: 0, padding: "0.5rem", marginLeft: collapsed ? 0 : "auto" }}
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="sidebar__nav" style={{ marginTop: collapsed ? "1rem" : "0" }}>
          {LINKS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`sidebar__link ${currentScreen === id ? "sidebar__link--active" : ""}`}
              onClick={() => onNavigate(id)}
              title={collapsed ? label : undefined}
            >
              <span className="sidebar__icon"><Icon /></span>
              {!collapsed && <span className="sidebar__label">{label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer — Dashboard only */}
        <div className="sidebar__footer">
          <button
            className={`sidebar__link ${currentScreen === "dashboard" ? "sidebar__link--active" : ""}`}
            onClick={() => onNavigate("dashboard")}
            title={collapsed ? "Judge's Dashboard" : undefined}
          >
            <span className="sidebar__icon"><IconGlobe /></span>
            {!collapsed && <span className="sidebar__label">Judge's Dashboard</span>}
          </button>
        </div>
      </aside>

      <main className="layout-content">
        {children}
      </main>

      {/* ── Mobile Bottom Nav (visible only on ≤640px via CSS) ── */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {LINKS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`bottom-nav__item ${currentScreen === id ? "bottom-nav__item--active" : ""}`}
            onClick={() => onNavigate(id)}
            aria-label={label}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <button
          className={`bottom-nav__item ${currentScreen === "dashboard" ? "bottom-nav__item--active" : ""}`}
          onClick={() => onNavigate("dashboard")}
          aria-label="Dashboard"
        >
          <IconGlobe />
          <span>Dashboard</span>
        </button>
      </nav>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';

type NavItem = {
  id: string;
  label: string;
  to: string;
};

const GV_LeftRail: React.FC = () => {
  // Collapsible rail state (local to this component)
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);

  // Router location to determine active item
  const location = useLocation();

  // Basic portfolio/site context (read-only for now, but available for future actions)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const user_id = useAppStore(state => state.portfolio_site_state.user_id);
  const isDarkMode = useAppStore(state => state.portfolio_site_state.is_dark_mode);
  const primary_color = useAppStore(state => state.portfolio_site_state.primary_color);

  // Nav items aligned with UV_* views in the UX map
  const navItems: NavItem[] = [
    { id: 'UV_Dashboard', label: 'Dashboard', to: '/dashboard' },
    { id: 'UV_HeroEditor', label: 'Hero', to: '/dashboard/hero' },
    { id: 'UV_AboutEditor', label: 'About', to: '/dashboard/about' },
    { id: 'UV_ProjectsEditor', label: 'Projects', to: '/dashboard/projects' },
    { id: 'UV_ProjectEditor', label: 'Project Editor', to: '/dashboard/projects' }, // dynamic project_id handled inside Projects view
    { id: 'UV_AssetManager', label: 'Assets', to: '/dashboard/assets' },
    { id: 'UV_ThemeEditor', label: 'Theme', to: '/dashboard/theme' },
    { id: 'UV_SEOEditor', label: 'SEO', to: '/dashboard/seo' },
    { id: 'UV_SettingsEditor', label: 'Settings', to: '/dashboard/settings' },
    { id: 'UV_Preview', label: 'Preview', to: '/dashboard/preview' },
    { id: 'UV_Publish', label: 'Publish', to: '/dashboard/publish' },
    { id: 'UV_ExportPanel', label: 'Export', to: '/dashboard/export' },
    { id: 'UV_ContactSubmissionsViewer', label: 'Submissions', to: '/dashboard/submissions' },
    { id: 'UV_HelpDocs', label: 'Help', to: '/help' }
  ];

  // Active state based on current path (support nested/project routes)
  const isActive = (to: string) => location.pathname.startsWith(to);

  // Toggle rail collapse; keep focus management for accessibility
  const toggleRail = () => {
    setCollapsed(prev => {
      const next = !prev;
      // Return focus to toggle button after a short tick
      setTimeout(() => {
        toggleBtnRef.current?.focus();
      }, 0);
      return next;
    });
  };

  // Styling: compact rail when collapsed; we keep labels hidden then
  const railWidth = collapsed ? 'w-14' : 'w-60';
  const activeAccent = primary_color || '#3b82f6';

  return (
    <>
      <aside
        aria-label="Editor Left Rail"
        className={`bg-white border-r border-gray-200 h-full ${railWidth} flex-shrink-0 transition-all duration-200`}
      >
        <div className="flex items-center justify-between h-12 px-2 border-b border-gray-200">
          <span className={`text-sm font-semibold ${collapsed ? 'sr-only' : 'block'}`}>
            PortfolioPro Editor
          </span>
          <button
            ref={toggleBtnRef}
            aria-label="Toggle navigation rail"
            onClick={toggleRail}
            className="p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100"
            style={{ color: '#374151' }}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav aria-label="Editor navigation" className="mt-2" role="navigation">
          {navItems.map(item => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 mx-2 my-1 rounded-md text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' : 'text-gray-700 hover:bg-gray-50'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="inline-block" aria-hidden="true">
                  {/* Lightweight inline icon as a placeholder; can swap with lucide-react icons later */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={active ? activeAccent : 'none'}
                    stroke={active ? activeAccent : 'currentColor'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-500"
                  >
                    <path d="M3 12h18" />
                    <path d="M12 3v18" />
                  </svg>
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default GV_LeftRail;
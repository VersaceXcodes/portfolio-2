import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

/**
 * GV_TopNav
 * Global Top Navigation - React.FC
 * Single, large render block (<>...</>) as required.
 */
const GV_TopNav: React.FC = () => {
  // 1) Auth state (CRITICAL: individual selectors)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isAuthenticated = useAppStore(state =>
    state.authentication_state.authentication_status.is_authenticated
  );
  const errorMessage = useAppStore(state => state.authentication_state.error_message);

  // 2) Actions
  const logoutUser = useAppStore(state => state.logout_user);
  const setSite = useAppStore(state => state.set_site); // if needed by nav interactions (not used directly here)

  // 3) UI state for responsive menu
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 4) UX helpers
  const toggleMobile = () => setMobileOpen(o => !o);
  const toggleUserMenu = () => setUserMenuOpen(o => !o);

  // Close user menu on outside click
  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  // 5) Handlers
  const handleSignOut = () => {
    logoutUser();
  };

  // 6) Derived display name / avatar fallback
  const displayName = useMemo(() => {
    if (!currentUser) return 'Guest';
    // Prefer full_name, then username
    // Zod/User types use id/username/email; map to display-friendly name
    // Values here are snake_case in store; adapt to common UI fields
    const name = (currentUser as any).full_name || (currentUser as any).username || '';
    return name;
  }, [currentUser]);

  // 7) ARIA live region for errors (polite)
  // Lightweight; GV_Notifications handles toasts, but add polite live region for auth errors here
  const ariaErrorId = 'gv-topnav-auth-error';

  return (
    <>
      <header className="bg-white shadow sticky top-0 z-50" role="banner" aria-label="Global Top Navigation">
        {/* Top bar container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand / Logo */}
            <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center space-x-2 text-blue-700 hover:text-blue-800">
              {/* Simple inline logo */}
              <span aria-label="PortfolioPro logo" className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold">
                PP
              </span>
              <span className="font-semibold text-gray-900 text-xl">PortfolioPro</span>
            </Link>

            {/* Desktop nav - visible on md+ */}
            {/** Primary editor navigation (authenticated) */}
            {isAuthenticated && (
              <nav className="hidden md:flex md:space-x-6" aria-label="Main editor navigation">
                <Link to="/dashboard" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </Link>
                <Link to="/dashboard/hero" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Hero
                </Link>
                <Link to="/dashboard/about" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  About
                </Link>
                <Link to="/dashboard/projects" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Projects
                </Link>
                <Link to="/dashboard/theme" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Theme
                </Link>
                <Link to="/dashboard/seo" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  SEO
                </Link>
                <Link to="/dashboard/settings" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Settings
                </Link>
                <Link to="/dashboard/preview" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Preview
                </Link>
                <Link to="/dashboard/publish" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Publish
                </Link>
                <Link to="/dashboard/export" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Export
                </Link>
                <Link to="/dashboard/submissions" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Submissions
                </Link>
                <Link to="/help" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Help
                </Link>
              </nav>
            )}

            {/* Right side: user actions */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-3" aria-label="User controls">
                {/* Live preview / quick access (optional quick links could be here) */}
                <Link to="/dashboard/preview" className="hidden md:inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Preview
                </Link>
                <Link to="/dashboard/publish" className="hidden md:inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-blue-700 hover:bg-gray-50">
                  Publish
                </Link>

                <div ref={menuRef} className="relative">
                  <button
                    onClick={toggleUserMenu}
                    aria-label="Open user menu"
                    aria-haspopup="true"
                    aria-expanded={userMenuOpen}
                    className="flex items-center space-x-2 rounded-full border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 px-2 py-1"
                  >
                    {currentUser?.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="User avatar" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-700 font-semibold">
                        {displayName.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                    <span className="hidden sm:inline text-gray-700">{displayName}</span>
                  </button>

                  {userMenuOpen && (
                    <div
                      ref={menuRef}
                      role="menu"
                      aria-label="User menu"
                      className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
                    >
                      <div className="py-1" role="none">
                        <Link
                          to="/dashboard/settings"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          Settings
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleSignOut();
                          }}
                          className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                          aria-label="Sign out"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Unauthenticated header area: small sign-in/sign-up prompts could go here
              <div className="hidden md:flex items-center space-x-2">
                <Link to="/signin" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                  Sign in
                </Link>
                <Link to="/signup" className="text-sm font-medium bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700">
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            {isAuthenticated && (
              <div className="-mr-2 flex md:hidden">
                <button
                  onClick={toggleMobile}
                  aria-label="Open main menu"
                  aria-expanded={mobileOpen}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <span className="sr-only">Open main menu</span>
                  {/* Hamburger icon */}
                  <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {isAuthenticated && mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1" role="menu" aria-label="Mobile menu">
              <Link to="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Dashboard
              </Link>
              <Link to="/dashboard/hero" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Hero
              </Link>
              <Link to="/dashboard/about" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                About
              </Link>
              <Link to="/dashboard/projects" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Projects
              </Link>
              <Link to="/dashboard/theme" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Theme
              </Link>
              <Link to="/dashboard/seo" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                SEO
              </Link>
              <Link to="/dashboard/settings" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Settings
              </Link>
              <Link to="/dashboard/preview" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Preview
              </Link>
              <Link to="/dashboard/publish" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Publish
              </Link>
              <Link to="/dashboard/export" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Export
              </Link>
              <Link to="/dashboard/submissions" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Submissions
              </Link>
              <Link to="/help" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50" role="menuitem" onClick={() => setMobileOpen(false)}>
                Help
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Accessibility live region for auth errors (polite) */}
      {errorMessage && (
        <div id={ariaErrorId} role="alert" aria-live="polite" className="sr-only">
          {errorMessage}
        </div>
      )}
    </>
  );
};

export default GV_TopNav;
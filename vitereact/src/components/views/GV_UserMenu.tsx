import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';

const GV_UserMenu: React.FC = () => {
  // Local UI state for dropdown visibility
  const [open, setOpen] = useState(false);

  // Refs for focus management (focus trap)
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // STATE: current user and token from Zustand (auth state)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const logoutUser = useAppStore(state => state.logout_user);

  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [open]);

  // Focus trap: when opened, focus first actionable item
  useEffect(() => {
    if (open && menuRef.current) {
      const firstMenuItem = menuRef.current.querySelector<HTMLElement>('[tabindex="0"], [role="menuitem"]');
      firstMenuItem?.focus();
    }
  }, [open]);

  // Sign out handler: call backend logout, then clear UI state
  const signOut = async () => {
    try {
      if (authToken) {
        const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';
        await axios.post(
          `${API_BASE}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      }
    } catch {
      // Swallow errors to ensure sign-out UI is consistent
    } finally {
      logoutUser();
      setOpen(false);
      // Redirect to sign-in for a clean session start
      navigate('/signin', { replace: true });
    }
  };

  // Keyboard navigation inside dropdown
  const onKeyDownMenu = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      toggleBtnRef.current?.focus();
    }
  };

  // Render: a single big fragment with all nodes
  return (
    <>
      <div className="ml-3 relative">
        <button
          ref={toggleBtnRef}
          onClick={() => setOpen(v => !v)}
          type="button"
          className="bg-white rounded-full flex items-center text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          id="user-menu-button"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Open user menu"
        >
          <span className="sr-only">Open user menu</span>
          {currentUser && currentUser.avatar_url ? (
            <img
              className="h-8 w-8 rounded-full object-cover"
              src={currentUser.avatar_url}
              alt="User avatar"
            />
          ) : (
            <span
              className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold"
              aria-label="User initials"
            >
              {currentUser?.username?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          )}
        </button>

        {open && (
          <div
            ref={menuRef}
            className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
            role="menu"
            aria-label="User menu"
            tabIndex={-1}
            onMouseDown={e => e.stopPropagation()}
            onKeyDown={onKeyDownMenu}
          >
            <div className="py-2 px-4 text-sm text-gray-700" role="none">
              {currentUser ? (
                <span className="font-semibold">
                  {currentUser.full_name ?? currentUser.username ?? currentUser.email}
                </span>
              ) : (
                <span className="text-gray-500">Guest</span>
              )}
            </div>
            <hr className="border-gray-200" />
            <Link
              to="/dashboard/settings"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            <Link
              to="/help"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Help
            </Link>
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-md"
              role="menuitem"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default GV_UserMenu;
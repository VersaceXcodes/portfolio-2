import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

/**
 * GV_OnboardingTips
 * - Inline, dismissible onboarding tips overlay/inline helper.
 * - Rendered as a single top-level fragment in this component.
 * - Persists dismissal for the current session via sessionStorage.
 * - Lightweight, non-blocking UX as specified.
 */
export const GV_OnboardingTips: React.FC<{ visibility?: boolean }> = ({ visibility = true }) => {
  // Local/session state for tips visibility. Do not rely on a non-existent store flag yet.
  const [tipsVisible, setTipsVisible] = useState<boolean>(true);

  // Optional: read from sessionStorage to persist dismissal within a session
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('onboarding_tips_visible') : null;
    if (stored !== null) {
      setTipsVisible(stored === 'true');
    } else {
      // initial visibility based on prop (true by default)
      setTipsVisible(visibility);
    }
  }, [visibility]);

  // Dismiss handler
  const dismissTip = () => {
    setTipsVisible(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('onboarding_tips_visible', 'false');
    }
  };

  // Optional: If you later want to derive trigger conditions from app state
  // (e.g., first project created or publish/export flows), you can hook into
  // the store here and toggle tipsVisible accordingly. For now, we honor
  // the session-based dismissal as a ready-to-run experience.

  // Example selectors (not required for current functionality, kept for extensibility)
  // const someAuthState = useAppStore(state => state.authentication_state);
  // const currentURL = window.location.pathname;

  return (
    <>
      {tipsVisible && (
        <div
          role="region"
          aria-label="Onboarding tips"
          className="fixed top-6 right-6 z-50 w-72 max-w-full bg-white border border-gray-200 rounded-lg shadow-lg p-4"
        >
          <div className="flex items-start justify-between">
            <span className="text-sm font-semibold text-gray-900">Onboarding Tips</span>
            <button
              aria-label="Dismiss onboarding tips"
              onClick={dismissTip}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 rounded"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <ul className="mt-3 space-y-2 text-xs text-gray-700" aria-live="polite">
            <li>Tip: Use the left rail to switch between Hero, About, Projects, Theme, and SEO editors.</li>
            <li>Tip: Preview your changes live in the Preview pane as you edit.</li>
            <li>Tip: When ready, use Publish to deploy to your subdomain or Export to get a ZIP build.</li>
          </ul>

          <div className="mt-3 flex items-center justify-between">
            <Link
              to="/dashboard/preview"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Open Preview
            </Link>
            <button
              onClick={dismissTip}
              className="text-xs font-medium text-gray-600 hover:text-gray-800 hover:underline"
              aria-label="Dismiss onboarding tips"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GV_OnboardingTips;
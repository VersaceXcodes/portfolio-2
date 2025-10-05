import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';

/*
  GV_Footer
  - Global Footer: present on editor UI and public/docs sections
  - Includes Help (fetches /api/help/docs), Documentation, Terms links
  - Accessible, responsive, and uses single top-level render block
*/

const GV_Footer: React.FC = () => {
  // Auth state: use individual selectors per the project guidance
  const token = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  // Help/docs panel state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpContent, setHelpContent] = useState<string | null>(null);
  const [loadingHelp, setLoadingHelp] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);

  // API base (from env) with safe fallback
  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

  // Fetch help docs from backend
  const fetchHelpDocs = useCallback(async () => {
    if (!token) {
      setHelpError('Please sign in to access Help / Docs.');
      return;
    }
    setLoadingHelp(true);
    setHelpError(null);
    try {
      const resp = await axios.get(`${API_BASE}/api/help/docs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Backend contract: HelpDocsResponse.content
      const content = (resp.data?.content ?? resp.data?.data?.content ?? '') as string;
      setHelpContent(content);
    } catch (err) {
      setHelpError('Failed to load help content. Please try again.');
    } finally {
      setLoadingHelp(false);
    }
  }, [API_BASE, token]);

  // When user toggles help, load content if needed
  const toggleHelp = () => {
    const willOpen = !helpOpen;
    setHelpOpen(willOpen);
    if (willOpen && helpContent === null && !loadingHelp) {
      fetchHelpDocs();
    }
  };

  // Accessible live region for status messages
  // (kept in DOM as a visually-hidden live region)
  const LiveRegion = (
    <div aria-live="polite" className="sr-only" role="status" aria-label="Footer status region">
      {helpError ?? ''}
    </div>
  );

  // Current year for copyright
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="bg-white border-t border-gray-200 mt-8" aria-label="Global footer">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">
            © {currentYear} PortfolioPro
          </span>
          <nav className="flex items-center space-x-6" aria-label="Footer links">
            <button
              onClick={toggleHelp}
              className="text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 px-2 py-1 rounded"
              aria-label="Open Help and documentation"
            >
              Help
            </button>
            <Link
              to="/help"
              className="text-sm text-gray-600 hover:text-gray-800"
              aria-label="Help and documentation"
            >
              Documentation
            </Link>
            <Link
              to="/terms"
              className="text-sm text-gray-600 hover:text-gray-800"
              aria-label="Terms of service"
            >
              Terms
            </Link>
          </nav>
        </div>

        {helpOpen && (
          <div className="bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8" role="region" aria-label="Help content panel">
              {loadingHelp ? (
                <div className="text-sm text-gray-700">Loading help content…</div>
              ) : helpContent ? (
                <div className="text-sm text-gray-700 whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>
                  {helpContent}
                </div>
              ) : helpError ? (
                <div className="text-sm text-red-700" role="alert" aria-live="polite">
                  {helpError}
                </div>
              ) : (
                <div className="text-sm text-gray-700">No help content available.</div>
              )}
            </div>
          </div>
        )}
        {LiveRegion}
      </footer>
    </>
  );
};

export default GV_Footer;
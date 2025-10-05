import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

/**
 * UV_HelpDocs
 * - Help & Quick Start (Docs)
 * - Lightweight onboarding content loaded from the backend
 * - Searchable, accessible, and contextual editor-tips links
 * - Rendered as a single, large React fragment
 */
const UV_HelpDocs: React.FC = () => {
  // Local UI state
  const [query, setQuery] = useState<string>('');

  // Auth token (selector-based)
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // API base URL (consistent with project conventions)
  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

  // Fetch help/docs content
  const fetchHelpDocs = async (): Promise<string> => {
    const url = `${API_BASE}/api/help/docs`;
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const resp = await axios.get(url, { headers });
    // API shape: { content: string } or { data: { content: string } } or { content: string } at root
    const data = resp.data ?? {};
    const content: string =
      (data?.content as string) ??
      (data?.data?.content as string) ??
      (typeof data === 'string' ? data : '');

    return content ?? '';
  };

  // Load help/docs content (React Query)
  const {
    data: content = '',
    isLoading,
    isError,
    error,
  } = useQuery<string, unknown>(
    ['help_docs'],
    fetchHelpDocs,
    {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    }
  );

  // Helpers (inline) for rendering without splitting the component into multiple helpers
  const escapeRegExp = (s: string) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Render content as lines/paragraphs with optional highlight
  const renderContentLines = () => {
    if (!content) {
      return (
        <p className="text-sm text-gray-600" role="note" aria-live="polite">
          No help content available at the moment.
        </p>
      );
    }

    // Split content into lines by newline for paragraph rendering
    const lines = content.split(/\n+/);

    // If there is no search query, render clean paragraphs
    if (!query.trim()) {
      return lines.map((line, idx) => (
        <p key={idx} className="mb-3 text-gray-700">
          {line}
        </p>
      ));
    }

    // Highlight query terms within lines
    const q = query.trim();
    return lines.map((line, idx) => {
      const reg = new RegExp(`(${escapeRegExp(q)})`, 'ig');
      const parts = line.split(reg);
      return (
        <p key={idx} className="mb-3 text-gray-700">
          {parts.map((part, i) =>
            part.toLowerCase() === q.toLowerCase() ? (
              <mark key={i} className="bg-yellow-200 rounded">
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>
      );
    });
  };

  // Big render block (single top-level fragment)
  return (
    <>
      <div className="min-h-screen bg-gray-50" aria-label="Help docs root">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-2">
              Help & Quick Start (Docs)
            </h1>
            <p className="text-sm text-gray-600">
              Lightweight onboarding and troubleshooting content. Includes quick-start steps, FAQs, and contextual tips linked to editor views. Searchable and accessible.
            </p>
          </header>

          <section aria-label="Help search" className="mb-6">
            <label htmlFor="help-search" className="sr-only">
              Search help topics
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                id="help-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search help topics..."
                aria-label="Search help docs"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
          </section>

          <section
            aria-label="Help content region"
            className="bg-white border border-gray-200 rounded-lg p-6"
            role="region"
          >
            {isLoading ? (
              <div className="text-sm text-gray-600" aria-live="polite">
                Loading help content...
              </div>
            ) : isError ? (
              <div role="alert" className="text-sm text-red-600" aria-live="polite">
                Error loading help content: {String(error)}
              </div>
            ) : (
              <div className="space-y-3" aria-live="polite">
                {renderContentLines()}
              </div>
            )}
          </section>

          <section aria-label="Helpful editor shortcuts and links" className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/dashboard/hero" className="group border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
              <div className="text-sm font-semibold text-blue-600">Hero Editor</div>
              <div className="text-sm text-gray-700">Edit hero content quickly</div>
            </Link>
            <Link to="/dashboard/about" className="group border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
              <div className="text-sm font-semibold text-blue-600">About Editor</div>
              <div className="text-sm text-gray-700">Update biography</div>
            </Link>
            <Link to="/dashboard/projects" className="group border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
              <div className="text-sm font-semibold text-blue-600">Projects Editor</div>
              <div className="text-sm text-gray-700">Manage projects</div>
            </Link>
            <Link to="/dashboard/theme" className="group border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
              <div className="text-sm font-semibold text-blue-600">Branding</div>
              <div className="text-sm text-gray-700">Theme & typography</div>
            </Link>
            <Link to="/dashboard/seo" className="group border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
              <div className="text-sm font-semibold text-blue-600">SEO</div>
              <div className="text-sm text-gray-700">Meta titles & descriptions</div>
            </Link>
            <Link to="/dashboard/settings" className="group border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
              <div className="text-sm font-semibold text-blue-600">Settings</div>
              <div className="text-sm text-gray-700">Account & subdomain</div>
            </Link>
          </section>
        </div>
      </div>
    </>
  );
};

export default UV_HelpDocs;
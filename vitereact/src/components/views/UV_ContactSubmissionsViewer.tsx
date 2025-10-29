import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

// Types aligned to OpenAPI/snake_case shapes
type ContactSubmission = {
  submission_id: string;
  site_id?: string | null;
  name?: string | null;
  email: string;
  message: string;
  created_at: string;
};

type ApiExportResponse = {
  export_zip_url?: string | null;
  export_path?: string | null;
};

// API base URL (frontend env prefix)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

const UV_ContactSubmissionsViewer: React.FC = () => {
  // Auth token from Zustand store (CRITICAL selectors)
  const auth_token = useAppStore(state => state.authentication_state.auth_token);

  // Local UI state
  const [selected_submission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [read_ids, setReadIds] = useState<Set<string>>(new Set<string>());
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Helper: mark as read
  const markAsRead = (submission_id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(submission_id);
      return next;
    });
  };

  // Fetch submissions (OpenAPI: GET /api/dashboard/submissions)
  const fetchSubmissions = async (): Promise<ContactSubmission[]> => {
    const resp = await axios.get(`${API_BASE}/api/dashboard/submissions`, {
      headers: { Authorization: `Bearer ${auth_token}` },
    });
    // Normalize shape to Submission[]
    const data = resp.data?.data ?? resp.data ?? [];
    return (data as any[]).map(item => ({
      submission_id: item.submission_id,
      site_id: item.site_id ?? null,
      name: item.name ?? null,
      email: item.email,
      message: item.message,
      created_at: item.created_at,
    }));
  };

  const {
    data: submissions,
    isLoading,
    isError,
    refetch,
  } = useQuery<ContactSubmission[]>(['dashboard_submissions', auth_token], fetchSubmissions, {
    enabled: !!auth_token,
    keepPreviousData: true,
    staleTime: 60 * 1000,
  });

  // On selecting a submission, mark as read and show details
  const handleSelectSubmission = (s: ContactSubmission) => {
    setSelectedSubmission(s);
    markAsRead(s.submission_id);
  };

  // Export submissions payload (GET /api/dashboard/export)
  const exportSubmissions = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const resp = await axios.get(`${API_BASE}/api/dashboard/export`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      const data: ApiExportResponse = (resp.data?.data ?? resp.data ?? {}) as any;
      // Normalize potential shapes
      const export_zip_url = (data.export_zip_url ?? resp.data?.export_zip_url ?? null) as string | null;
      const export_path = (data.export_path ?? resp.data?.export_path ?? null) as string | null;
      if (export_zip_url) {
        setExportUrl(export_zip_url);
      } else {
        // Fallback to provided path
        setExportUrl(export_path ?? null);
      }
      setExportPath(export_path);
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Export failed';
      setExportError(message);
      setExportUrl(null);
      setExportPath(null);
    } finally {
      setIsExporting(false);
    }
  };

  // Derived UI helpers
  const submissionsCount = useMemo(() => submissions?.length ?? 0, [submissions]);
  const snippetOf = (text: string, max = 120) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  // UI render: a single large fragment as required
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center">
            <h1 className="text-lg font-semibold text-gray-900">Contact Submissions</h1>
            <div className="ml-auto text-sm text-gray-500" aria-live="polite">
              {submissionsCount} submission{submissionsCount !== 1 ? 's' : ''}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Submissions List (Left) */}
            <section
              aria-label="Inbound submissions list"
              className="flex-1 bg-white shadow rounded-lg overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                  <h2 className="text-sm font-medium text-gray-900">Submissions Inbox</h2>
                </div>
                <button
                  onClick={exportSubmissions}
                  disabled={isExporting}
                  aria-label="Export submissions"
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? 'Exporting…' : 'Export'}
                </button>
              </div>

              <div className="max-h-96 sm:max-h-72 overflow-y-auto">
                {isLoading && (
                  <div className="p-4 text-sm text-gray-500" role="status" aria-live="polite">
                    Loading submissions...
                  </div>
                )}
                {isError && (
                  <div className="p-4 text-sm text-red-700" role="alert" aria-live="polite">
                    Failed to load submissions. Please try again.
                  </div>
                )}
                {!isLoading && submissions && submissions.length === 0 && (
                  <div className="p-4 text-sm text-gray-500" role="status" aria-live="polite">
                    No submissions yet. When visitors send messages, they will appear here.
                  </div>
                )}
                <ul role="list" className="Divide-y">
                  {submissions?.map((s) => {
                    const isUnread = !read_ids.has?.(s.submission_id);
                    const isSelected = selected_submission?.submission_id === s.submission_id;
                    return (
                      <li
                        key={s.submission_id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-gray-100' : ''
                          }`}
                        onClick={() => handleSelectSubmission(s)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectSubmission(s);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Submission from ${s.name ?? s.email} at ${s.created_at}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span
                              aria-label={isUnread ? 'Unread' : 'Read'}
                              className={`h-2 w-2 rounded-full ${isUnread ? 'bg-blue-500' : 'bg-gray-400'}`}
                            />
                            <span className="font-medium text-gray-900">
                              {s.name ?? s.email}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(s.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600 line-clamp-2" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {s.message}
                        </div>
                        {isUnread && (
                          <span className="sr-only">New submissions</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {/* Details View (Right) */}
            <section
              aria-label="Selected submission details"
              className="w-full md:w-1/3 bg-white shadow rounded-lg p-4 flex-shrink-0"
              style={{ minHeight: '320px' }}
            >
              {selected_submission ? (
                <div className="flex flex-col space-y-3 h-full">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Submission Details
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        read_ids.has(selected_submission.submission_id)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {read_ids.has(selected_submission.submission_id) ? 'Read' : 'Unread'}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 pt-2 text-sm text-gray-800">
                    <p>
                      <strong>Name:</strong> {selected_submission.name ?? 'Anonymous'}
                    </p>
                    <p className="mt-1">
                      <strong>Email:</strong> {selected_submission.email}
                    </p>
                    <p className="mt-1 text-gray-500">
                      <strong>Submitted:</strong>{' '}
                      {new Date(selected_submission.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex-1 border-t border-dashed border-gray-200 pt-2 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-sm text-gray-800">
                      {selected_submission.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      onClick={() => {
                        // No backend action required here; selection marks as read already
                        // Placeholder for "Reply" action or integration point
                      }}
                    >
                      Reply
                    </button>
                    <Link
                      to="/dashboard"
                      className="px-3 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200"
                    >
                      Back to Dashboard
                    </Link>
                    <button
                      className="ml-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      onClick={() => {
                        // Optional: mark as unread again (demo)
                        setReadIds(prev => {
                          const next = new Set(prev);
                          next.delete(selected_submission.submission_id);
                          return next;
                        });
                        // Keep detail visible
                      }}
                    >
                      Mark as Unread
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full" aria-live="polite">
                  <div className="text-sm text-gray-500 text-center">
                    Select a submission to view details
                    <div className="mt-2">
                      <span className="inline-block w-6 h-6 rounded-full bg-gray-200 animate-pulse" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Quick feedback area for export status/errors */}
          {exportError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md" role="alert" aria-live="polite">
              {exportError}
            </div>
          )}
          {exportUrl && (
            <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md" role="status" aria-live="polite">
              Export ready: <a href={exportUrl} className="underline">Download ZIP</a> {exportPath ? `(${exportPath})` : ''}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default UV_ContactSubmissionsViewer;
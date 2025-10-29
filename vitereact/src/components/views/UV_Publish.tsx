import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import type { Site } from '@/store/main';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const UV_Publish: React.FC = () => {
  // Base API URL (frontend-prefixed env)
  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

  // -- Zustand selectors (CRITICAL: individual selectors)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const subdomain = useAppStore(state => state.portfolio_site_state.subdomain);
  const published_at = useAppStore(state => state.portfolio_site_state.published_at);
  const export_zip_url = useAppStore(state => state.portfolio_site_state.export_zip_url);

  const token = useAppStore(state => state.authentication_state.auth_token);
  const current_site = useAppStore(state => state.portfolio_site_state);

  const set_site = useAppStore(state => state.set_site);
  const set_publish_status = useAppStore(state => state.set_publish_status);
  // Local UI state for transient errors and loading cues
  const [publishError, setPublishError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // React-Query helpers
  const queryClient = useQueryClient();

  // Publish mutation: PUT /api/sites/{site_id}/publish
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!site_id) throw new Error('Site ID is missing');
      const resp = await axios.put(
        `${API_BASE}/api/sites/${site_id}/publish`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return resp;
    },
      onMutate: () => {
        // clear prior errors and indicate provisioning
        setPublishError(null);
        setAuthError(null);
        set_publish_status('provisioning');
      },
      onSuccess: (resp) => {
        const data = (resp.data?.data ?? resp.data ?? {}) as {
          site_id?: string;
          published_at?: string;
          subdomain?: string;
          export_zip_url?: string;
        };
        const updated: Site = {
          ...current_site,
          site_id: data.site_id ?? site_id,
          published_at: data.published_at ?? current_site.published_at,
          subdomain: data.subdomain ?? current_site.subdomain,
          export_zip_url: data.export_zip_url ?? current_site.export_zip_url,
        } as Site;
        set_site(updated);
        set_publish_status('ready');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || 'Publish failed';
        setPublishError(msg);
        set_publish_status('failed');
      },
    },
  });

  // Export mutation: POST /api/sites/{site_id}/export
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!site_id) throw new Error('Site ID is missing');
      const resp = await axios.post(
        `${API_BASE}/api/sites/${site_id}/export`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return resp;
    },
      onMutate: () => {
        setExportError(null);
        setIsExporting(true);
      },
      onSuccess: (resp) => {
        const data = (resp.data?.data ?? resp.data ?? {}) as {
          export_zip_url?: string;
          export_path?: string;
        };
        // Update site with new export URL if provided
        const updated: Site = {
          ...current_site,
          export_zip_url: data.export_zip_url ?? current_site.export_zip_url,
        } as Site;
        set_site(updated);
        setIsExporting(false);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || 'Export failed';
        setExportError(msg);
        setIsExporting(false);
      },
    },
  });

  // Simple local auth error reset on user action
  const clearAuthError = () => setAuthError(null);

  // Optional: small helper to show a friendly, centralized message
  const provisioningNotice = published_at && subdomain
    ? `Published to ${subdomain}. DNS propagation in progress or complete.`
    : 'Publish to deploy hosting on a deterministic subdomain.';

  // Inline event handlers
  const handlePublish = () => {
    clearAuthError();
    publishMutation.mutate();
  };

  const handleExport = () => {
    exportMutation.mutate();
  };

  // Derived UI states
  const isPublishing = publishMutation.isPending;
  const canExport = !!site_id && !!published_at;
  const canPublish = !!site_id; // Site must exist in store

  // Accessibility live region content
  const liveRegionMessage = publishMutation.isPending
    ? 'Publishing to subdomain in progress.'
    : publishMutation.isSuccess
    ? 'Publish completed successfully.'
    : publishMutation.isError
    ? 'Publish failed.'
    : '';

  // Render: a single big fragment as required
  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header / page title */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Publish / Export</h1>
          <p className="text-sm text-gray-600 mt-1">Orchestrates site publishing to a generated subdomain and exporting a static ZIP.</p>
        </div>

        {/* Core two-column layout: Publish & Export */}
        <div className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Publish card */}
            <section className="bg-white shadow rounded-xl border border-gray-100 p-6" aria-label="Publish to Subdomain">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Publish to Subdomain</h2>

              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="font-semibold">Site ID:</span> {site_id || 'Not selected'}
                </div>
                <div>
                  <span className="font-semibold">Subdomain:</span> {subdomain ?? 'Not provisioned yet'}
                </div>
                <div>
                  <span className="font-semibold">Published at:</span> {published_at ?? 'Not published yet'}
                </div>
              </div>

              {/* DNS provisioning status */}
              {isPublishing && (
                <div className="mt-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm" role="status" aria-live="polite">
                  Provisioning hosting subdomain. DNS propagation may take a few minutes.
                </div>
              )}
              {publishMutation.isSuccess && (
                <div className="mt-4 p-3 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm" role="status" aria-live="polite">
                  Published successfully! Subdomain: {subdomain}.{" "}
                  {subdomain ? (
                    <a href={`https://${subdomain}`} target="_blank" rel="noreferrer" className="underline">
                      Visit
                    </a>
                  ) : null}
                </div>
              )}
              {publishMutation.isError && (
                <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm" role="status" aria-live="polite">
                  {publishError ?? 'Publish failed. Please try again.'}
                </div>
              )}
              {authError && (
                <div className="mt-2 text-sm text-red-600" aria-live="polite">{authError}</div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || !canPublish}
                  aria-label="Publish to hosting subdomain"
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isPublishing ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  {isPublishing ? 'Publishing...' : 'Publish to subdomain'}
                </button>

                <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">
                  Back to Dashboard
                </Link>
              </div>

              <div className="mt-3 text-sm text-gray-600" aria-live="polite">
                {provisioningNotice}
              </div>

              {/* Live region for status announcements (ARIA) */}
              <div aria-live="polite" className="sr-only">{liveRegionMessage}</div>
            </section>

            {/* Export card */}
            <section className="bg-white shadow rounded-xl border border-gray-100 p-6" aria-label="Export Static Site">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Export Static Site</h2>

              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="font-semibold">Export status:</span>{' '}
                  {export_zip_url ? 'Ready (URL available)' : 'Not yet exported'}
                </div>
                <div>
                  <span className="font-semibold">Export URL:</span> {export_zip_url ?? 'N/A'}
                </div>
              </div>

              {exportError && (
                <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm" role="status" aria-live="polite">
                  {exportError}
                </div>
              )}
              {isExporting && (
                <div className="mt-3 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm" role="status" aria-live="polite">
                  Generating static export. This may take a moment.
                </div>
              )}
              {export_zip_url && (
                <div className="mt-3">
                  <a href={export_zip_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    Download ZIP
                  </a>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={isExporting || !site_id}
                  aria-label="Export ZIP"
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors
                    ${(!site_id) ? 'bg-gray-300 text-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  {isExporting ? 'Exporting...' : 'Export ZIP'}
                </button>

                <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">
                  Cancel
                </Link>
              </div>
            </section>
          </div>

          <div className="mt-6">
            <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Publish;
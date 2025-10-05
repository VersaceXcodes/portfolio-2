import React, { useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

type PreviewResponse = {
  status: string;
  url: string;
};

const UV_Preview: React.FC = () => {
  // Persistent store data (selectors must be individual)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const site_title = useAppStore(state => state.portfolio_site_state.site_title);
  const tagline = useAppStore(state => state.portfolio_site_state.tagline);
  const hero_image_url = useAppStore(state => state.portfolio_site_state.hero_image_url);
  const about_text = useAppStore(state => state.portfolio_site_state.about_text);
  const template_id = useAppStore(state => state.portfolio_site_state.template_id);
  const primary_color = useAppStore(state => state.portfolio_site_state.primary_color);
  const font_family = useAppStore(state => state.portfolio_site_state.font_family);
  const is_dark_mode = useAppStore(state => state.portfolio_site_state.is_dark_mode);
  const seo_title = useAppStore(state => state.portfolio_site_state.seo_title);
  const seo_description = useAppStore(state => state.portfolio_site_state.seo_description);
  const subdomain = useAppStore(state => state.portfolio_site_state.subdomain);

  const projects = useAppStore(state => state.projects);
  const assets = useAppStore(state => state.assets);

  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // UI-related state (local, to keep the component self-contained)
  const [previewStatus, setPreviewStatus] = useState<string>('idle');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // API base
  const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:3000';
  // Normalize: ensure string
  const apiBase: string = API_BASE;

  // Data fetch: Live preview from backend
  const fetchPreview = useCallback(async (): Promise<PreviewResponse> => {
    // Require a site context to fetch preview
    if (!site_id) {
      return { status: 'idle', url: '' };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const resp = await axios.get(`${apiBase}/api/dashboard/preview`, {
        headers,
      });

      // OpenAPI shape: could be { status, url } or { data: { status, url } }
      const payload: any = resp.data?.data ?? resp.data ?? {};

      const status: string = payload.status ?? payload?.preview_status ?? 'idle';
      const url: string = payload.url ?? payload?.preview_url ?? '';

      return { status, url };
    } catch (e) {
      // Fail-safe: keep idle state on error
      return { status: 'idle', url: '' };
    }
  }, [site_id, authToken, apiBase]);

  // React Query for debounced preview fetch
  const { data: previewData, refetch, isFetching } = useQuery<PreviewResponse>(
    ['dashboard', 'preview', site_id ?? ''],
    fetchPreview,
    {
      enabled: false,
      staleTime: 60 * 1000,
      // Do not auto-run on mount
    }
  );

  // Debounced auto-refresh when core data changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (site_id) {
        refetch();
      }
    }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    site_id,
    site_title,
    tagline,
    hero_image_url,
    about_text,
    template_id,
    primary_color,
    font_family,
    is_dark_mode,
    seo_title,
    seo_description,
    subdomain,
    // projects/assets included to reflect changes
    projects,
    assets,
  ]);

  // Sync previewData into local state and possibly store
  const setPreviewFromResponse = useCallback((payload: PreviewResponse) => {
    setPreviewUrl(payload.url ?? '');
    setPreviewStatus(payload.status ?? 'idle');
    // Mirror into global store's ui.preview_url for downstream usage
    try {
      // Access setter lazily to avoid churn at module scope
      const setPreviewUrlInStore = useAppStore.getState().set_preview_url;
      if (typeof setPreviewUrlInStore === 'function') {
        setPreviewUrlInStore(payload.url ?? '');
      }
    } catch {
      // ignore if store setter isn't available in render scope
    }
  }, []);

  // Apply backend response to local state whenever previewData updates
  useEffect(() => {
    if (previewData) {
      setPreviewFromResponse(previewData);
    }
  }, [previewData, setPreviewFromResponse]);

  // Manual trigger
  const refreshPreview = () => {
    refetch();
  };

  // Open external preview URL must use a safe/open-in-new-tab UX
  const canOpenPreview = !!previewUrl;

  // Styles helpers (consistent with design system)
  const containerClass = "flex-1 p-4 bg-white min-h-screen";

  return (
    <>
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Live Preview</h2>
          <div className="flex items-center space-x-3" aria-live="polite">
            <span className="text-sm text-gray-600" role="status" aria-live="polite">
              {previewStatus}
            </span>
            {canOpenPreview && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-sm underline"
              >
                Open in new tab
              </a>
            )}
            <button
              onClick={refreshPreview}
              disabled={isFetching}
              aria-label="Refresh live preview"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isFetching ? 'Refreshing...' : 'Refresh Preview'}
            </button>
          </div>
        </div>

        <div className={containerClass}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview pane (in-editor mirror) - big single block rendering */}
            <section
              aria-label="Preview Mirror"
              className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-lg"
            >
              {/* Hero block */}
              <div
                className="relative h-72 w-full bg-cover bg-center"
                style={{
                  backgroundImage: hero_image_url ? `url('${hero_image_url}')` : undefined,
                  backgroundColor: primary_color ?? (is_dark_mode ? '#111' : '#e2e8f0'),
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
                <div className="absolute bottom-6 left-6 right-6 text-white z-10">
                  <h1
                    className="text-3xl md:text-4xl font-extrabold leading-tight"
                    style={{ fontFamily: font_family ?? 'inherit' }}
                  >
                    {site_title || 'Site Title'}
                  </h1>
                  {tagline && (
                    <p className="mt-2 text-sm md:text-base">{tagline}</p>
                  )}
                </div>
              </div>

              {/* Content sections */}
              <div className="p-6 space-y-6">
                {about_text && (
                  <section aria-label="About" className="prose prose-sm md:prose-base">
                    <h2 className="text-xl font-semibold text-gray-800">About</h2>
                    <p className="text-gray-700">{about_text}</p>
                  </section>
                )}

                <section aria-label="Projects" className="space-y-3">
                  <h3 className="text-xl font-semibold text-gray-800">Projects</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects?.length > 0
                      ? projects.map(p => (
                          <div key={p.project_id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <div className="h-28 w-full rounded-md overflow-hidden mb-2 bg-gray-100">
                              {p.images?.[0] ? (
                                <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" aria-label="No image" />
                              )}
                            </div>
                            <div className="font-semibold text-gray-900 text-sm">{p.title}</div>
                            <div className="text-gray-600 text-xs mt-1" title={p.description}>
                              {p.description}
                            </div>
                          </div>
                        ))
                      : (
                          <div className="text-sm text-gray-600 col-span-1">
                            No projects yet. Add some from the Projects editor.
                          </div>
                        )}
                  </div>
                </section>

                <section aria-label="Contact" className="space-y-3">
                  <h3 className="text-xl font-semibold text-gray-800">Contact</h3>
                  <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3">
                    <input aria-label="Name" placeholder="Your name (optional)" className="px-3 py-2 border rounded" />
                    <input aria-label="Email" placeholder="Email" className="px-3 py-2 border rounded" />
                    <textarea aria-label="Message" placeholder="Your message" rows={5} className="px-3 py-2 border rounded" />
                    <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled>
                      Preview-only form
                    </button>
                  </form>
                </section>
              </div>
            </section>

            {/* Live URL / export panel (secondary pane) */}
            <section
              aria-label="Live Preview URL"
              className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-lg"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Preview URL</h3>
                {previewUrl && (
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600">
                    Open
                  </a>
                )}
              </div>
              <div className="h-full w-full">
                {previewUrl ? (
                  <iframe title="Live Preview Frame" src={previewUrl} className="w-full h-full" frameBorder={0} />
                ) : (
                  <div className="p-4 text-sm text-gray-600">
                    No live preview URL yet. Click Refresh Preview to generate a URL after publishing.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Hidden ARIA live region for status updates (optional enhancement) */}
          <div aria-live="polite" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {previewStatus}
          </div>

          {/* Back to editor navigation (using a Link per requirement) */}
          <div className="mt-6">
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 rounded-md bg-gray-100 border border-gray-300 hover:bg-gray-200 text-sm font-medium"
            >
              Back to Editor
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Preview;
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type SeoPayload = {
  seo_title?: string;
  seo_description?: string;
};

const UV_SEOEditor: React.FC = () => {
  // State from global store (Zustand) - critical selectors (per instructions)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const seo_title_from_store = useAppStore(state => state.portfolio_site_state.seo_title);
  const seo_description_from_store = useAppStore(state => state.portfolio_site_state.seo_description);
  const token = useAppStore(state => state.authentication_state.auth_token);
  const setSite = useAppStore(state => state.set_site);

  // Local editable fields initialized from store
  const [seo_title, setSeoTitle] = useState<string>(seo_title_from_store ?? '');
  const [seo_description, setSeoDescription] = useState<string>(seo_description_from_store ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  // Debounced/redirect helpers
  const queryClient = useQueryClient();

  // Re-sync local fields if the store updates externally
  useEffect(() => {
    setSeoTitle(seo_title_from_store ?? '');
  }, [seo_title_from_store]);

  useEffect(() => {
    setSeoDescription(seo_description_from_store ?? '');
  }, [seo_description_from_store]);

  // Basic client-side validation constraints (as per FRD notes)
  const TITLE_MAX = 70;       // typical SEO title length cap
  const DESCRIPTION_MAX = 160; // typical meta description length

  // API interaction: update SEO via backend
  // We'll implement a local mutation and update the store on success
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

  const updateSeoMutation = useMutation({
    mutationFn: async (): Promise<any> => {
      const payload: SeoPayload = {
        seo_title: seo_title.trim(),
        seo_description: seo_description.trim(),
      };
      const resp = await axios.put(
        `${apiBase}/api/sites/${site_id}/seo`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      return resp.data;
    },
    onSuccess: (data) => {
        // Backend may return the full Site payload or a partial; handle both
        const siteFromResponse = data?.data ?? data ?? {};
        // Update local inputs to reflect backend values (if backend normalizes)
        const updatedSeoTitle = siteFromResponse?.seo_title ?? seo_title;
        const updatedSeoDescription = siteFromResponse?.seo_description ?? seo_description;

        // Best-effort: merge into global store's portfolio_site_state via set_site
        // If the backend returned a full site object, prefer that
        if (siteFromResponse?.site_id) {
          setSite(siteFromResponse);
        } else {
          // Fallback: shallow-merge only SEO fields with existing site object
          // Use a safer approach: read current site fields from the store and merge
          // (We avoid object-destructuring selectors; use individual setters)
          // Try to preserve existing known fields if accessible
          // We will reconstruct a minimal Site-like object containing essential required fields
          // Read essential fields individually (best effort)
          const existing_site_id = site_id;
          const existing_user_id = useAppStore(state => state.portfolio_site_state.user_id);
          const existing_site_title = seo_title_from_store ? seo_title_from_store : '';
          const existing_tagline = useAppStore(state => state.portfolio_site_state.tagline);
          // Build merged object
          const merged = {
            site_id: existing_site_id,
            user_id: existing_user_id,
            site_title: existing_site_title,
            tagline: existing_tagline,
            hero_image_url: useAppStore(state => state.portfolio_site_state.hero_image_url),
            about_text: useAppStore(state => state.portfolio_site_state.about_text),
            template_id: useAppStore(state => state.portfolio_site_state.template_id),
            primary_color: useAppStore(state => state.portfolio_site_state.primary_color),
            font_family: useAppStore(state => state.portfolio_site_state.font_family),
            is_dark_mode: useAppStore(state => state.portfolio_site_state.is_dark_mode),
            seo_title: updatedSeoTitle,
            seo_description: updatedSeoDescription,
            subdomain: useAppStore(state => state.portfolio_site_state.subdomain),
            published_at: useAppStore(state => state.portfolio_site_state.published_at),
            export_zip_url: useAppStore(state => state.portfolio_site_state.export_zip_url),
          } as any;
          setSite(merged);
        }

        // Also reflect changes in local UI
        setSeoTitle(updatedSeoTitle);
        setSeoDescription(updatedSeoDescription);
        setLocalError(null);

        // Optional: invalidate related queries to refresh data elsewhere
        try {
          queryClient.invalidateQueries({ queryKey: ['sites', site_id, 'seo'] });
        } catch {
          // no-op
        }
      },
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to update SEO. Please check your inputs.';
        setLocalError(msg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Basic inline validation
    if (seo_title.trim().length === 0 && (seo_description ?? '').trim().length === 0) {
      setLocalError('Please provide at least a SEO title or a meta description.');
      return;
    }
    if (seo_title.trim().length > TITLE_MAX) {
      setLocalError(`SEO title should be ${TITLE_MAX} characters or fewer.`);
      return;
    }
    if (seo_description?.trim().length > DESCRIPTION_MAX) {
      setLocalError(`Meta description should be ${DESCRIPTION_MAX} characters or fewer.`);
      return;
    }

    updateSeoMutation.mutate();
  };

  // Accessibility: aria-live polite for error messages
  const errorSectionId = 'seo-editor-error';

  // Render: a single big fragment as required
  return (
    <>
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl border border-gray-100 p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-4">
            SEO Editor
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Configure the SEO title and meta description for your portfolio site. These values are used in the
            head of the exported HTML and influence how search engines present your pages.
            Consider semantic headings and per-section alt-text guidance when composing content.
          </p>

          <form
            className="space-y-5"
            onSubmit={handleSubmit}
            aria-label="SEO editor form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="seo_title" className="block text-sm font-medium text-gray-700 mb-1">
                  SEO Title
                </label>
                <input
                  id="seo_title"
                  name="seo_title"
                  type="text"
                  value={seo_title}
                  onChange={(e) => {
                    setSeoTitle(e.target.value);
                    setLocalError(null); // Clear errors on input change
                  }}
                  placeholder="Page title for SEO"
                  aria-invalid={Boolean(localError)}
                  className="block w-full px-3 py-2 rounded-md border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {seo_title.length > 0 ? `${seo_title.length}/${TITLE_MAX}` : '0/70'} characters
                </p>
              </div>

              <div>
                <label htmlFor="seo_description" className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Description
                </label>
                <textarea
                  id="seo_description"
                  name="seo_description"
                  rows={4}
                  value={seo_description}
                  onChange={(e) => {
                    setSeoDescription(e.target.value);
                    setLocalError(null); // Clear errors on input change
                  }}
                  placeholder="A brief description for search results"
                  aria-invalid={Boolean(localError)}
                  className="block w-full px-3 py-2 rounded-md border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {seo_description.length > 0 ? `${seo_description.length}/${DESCRIPTION_MAX}` : '0/160'} characters
                </p>
              </div>
            </div>

            {/* Inline error messaging (aria-live polite) */}
            {localError && (
              <div id={errorSectionId} role="alert" aria-live="polite" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <span className="text-sm">{localError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-gray-600">
                Tip: Ensure your SEO title and description are concise and descriptive for better search results.
              </div>
              <button
                type="submit"
                disabled={updateSeoMutation.isPending}
                className="inline-flex items-center px-6 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Save SEO changes"
              >
                {updateSeoMutation.isPending ? (
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 01-4 4H4z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save SEO'
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-gray-200 mt-2">
              <p className="text-xs text-gray-500">
                Live preview and export will reflect updated SEO head tags after saving.
              </p>
            </div>

            <div className="mt-2">
              <p className="text-sm text-gray-700">
                Need to navigate to other SEO-related settings? You can return to
                <span className="mx-1" /> 
                <Link to="/dashboard/preview" className="text-blue-600 hover:underline">
                  Preview
                </Link>
                <span className="mx-1">or</span>
                <Link to="/dashboard" className="text-blue-600 hover:underline">
                  Dashboard
                </Link>.
              </p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_SEOEditor;
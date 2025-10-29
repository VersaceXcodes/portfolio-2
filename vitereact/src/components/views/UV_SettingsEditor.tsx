import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { Site } from '@/store/main'; // snake_case Site type from Zustand store

// API base URL (frontend env)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

// Site payload types (align with OpenAPI snake_case)
type SitePayload = Partial<Site> & { site_id: string };

const UV_SettingsEditor: React.FC = () => {
  // Basic selectors (CRITICAL: individual selectors)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const currentSite = useAppStore(state => state.portfolio_site_state);
  const set_site = useAppStore(state => state.set_site);

  const token = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  // Local form state for editing
  const [form, setForm] = useState<Partial<Site>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query client for cache invalidation if needed
  const queryClient = useQueryClient();

  // Fetch current settings when site_id exists
  const fetchSettings = async (sid: string, tkn: string | null) => {
    const resp = await axios.get(`${API_BASE}/api/sites/${sid}`, {
      headers: { Authorization: `Bearer ${tkn ?? ''}` },
    });
    // Backend returns { data: Site } per API spec
    return resp.data?.data ?? resp.data ?? {};
  };

  // API mutation for persisting settings
  const updateSiteSettings = async (payload: SitePayload) => {
    const sid = payload.site_id;
    const body = { ...payload } as any;
    // Ensure body doesn't include undefined values
    Object.keys(body).forEach(k => {
      if (body[k as keyof typeof body] === undefined) {
        delete (body as any)[k];
      }
    });
    const resp = await axios.put(`${API_BASE}/api/sites/${sid}`, body, {
      headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
    });
    return resp.data?.data ?? resp.data;
  };

  // useQuery to load settings (enabled once site_id exists)
  const { data: loadedSite, isLoading: isLoadingSettings, isError: settingsError } = useQuery(
    ['site_settings', site_id],
    () => fetchSettings(site_id, token),
    {
      enabled: !!site_id,
      staleTime: 60 * 1000,
      cacheTime: 5 * 60 * 1000,
      onSuccess: (data) => {
        // Merge into store and local form
        const dataAsSite = data as Site;
        if (dataAsSite) {
          // Merge into store to keep single source of truth for preview
          set_site({ ...currentSite, ...dataAsSite } as Site);
          // Also hydrate local form
          setForm({ ...form, ...dataAsSite });
        }
      },
    }
  );

  // Mutation hook for saving
  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: (payload: SitePayload) => updateSiteSettings(payload),
      onSuccess: (data) => {
        // Merge backend payload into store (crucial for state consistency)
        // We derive the merged object using the current store snapshot and API response
        const merged = { ...currentSite, ...(data as Site) };
        set_site(merged as Site);
        // Update local form to reflect persisted values
        setForm({ ...(merged as Site) });
        setSaveInfo('Settings saved successfully.');
        // Clear ephemeral messages after a moment
        setTimeout(() => setSaveInfo(null), 1800);
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || err?.message || 'Failed to save settings';
        setLocalError(message);
        setSaveInfo(null);
      },
      // No explicit retries; rely on global query options if needed
    },
  });

  // Initialize form from current store on mount (safe default)
  useEffect(() => {
    // If no data yet, ensure form mirrors current store (even before API fetch)
    setForm({ ...currentSite });
  }, []); // eslint-disable-line

  // Helpers
  const handleChange = (field: keyof Site, value: any) => {
    // Clear inline errors on any change
    setLocalError(null);
    // Update local form
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
    // Live preview: merge into store by field
    const mergedPartial = { [field]: value } as Partial<Site>;
    const mergedSite = { ...currentSite, ...mergedPartial } as Site;
    set_site(mergedSite);
  };

  // Build payload for Save (ensures snake_case keys)
  const canSave = useMemo(() => {
    // compare form vs currentSite shallowly
    const keys = [
      'site_title', 'tagline', 'hero_image_url', 'about_text', 'template_id',
      'primary_color', 'font_family', 'is_dark_mode', 'seo_title', 'seo_description', 'subdomain'
    ] as (keyof Site)[];
    // @ts-ignore
    for (const k of keys) {
      const fVal = (form as any)[k];
      const sVal = (currentSite as any)[k];
      if (fVal !== sVal) return true;
    }
    // If all same, nothing to save (but there could be changes in non-field items)
    return Boolean(site_id); // allow at least having an id to save
  }, [form, currentSite, site_id]);

  // Reset form to latest store values
  const resetForm = () => {
    setForm({ ...currentSite });
    setLocalError(null);
    setSaveInfo(null);
  };

  // Persist on explicit user action
  const onSave = () => {
    // Basic inline validation
    if (!form.site_title && !(form.site_title as string)) {
      setLocalError('Site title is required.');
      return;
    }

    if (!site_id) {
      setLocalError('Site ID is missing. Cannot save.');
      return;
    }

    // If nothing to save, inform user
    const hasChanges = canSave;
    if (!hasChanges) {
      setLocalError(null);
      setSaveInfo('No changes to save.');
      setTimeout(() => setSaveInfo(null), 1500);
      return;
    }

    const confirmMessage = 'Save changes to site settings?';
    // Security-conscious: explicit confirmation
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Build payload for API (snake_case keys)
    const payload: SitePayload = {
      site_id,
      site_title: form.site_title ?? '',
      tagline: form.tagline ?? null,
      hero_image_url: form.hero_image_url ?? null,
      about_text: form.about_text ?? null,
      template_id: form.template_id ?? null,
      primary_color: form.primary_color ?? null,
      font_family: form.font_family ?? null,
      is_dark_mode: form.is_dark_mode ?? false,
      seo_title: form.seo_title ?? null,
      seo_description: form.seo_description ?? null,
      subdomain: form.subdomain ?? null,
    };

    setIsSubmitting(true);
    setLocalError(null);
    // Trigger mutation
    saveSettings(payload);
    // After mutation resolves, onSuccess will update UI and show a brief notice
    setIsSubmitting(false);
  };

  // UI: ensure we always render a single top-level fragment
  return (
    <>
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-12 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className="inline-block w-3 h-3 bg-blue-600 rounded-full" aria-hidden="true" />
              <h2 className="text-2xl font-semibold text-gray-900">Settings Editor</h2>
            </div>
            <div className="flex items-center space-x-2">
              <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">
                Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Card: Settings Form */}
          <div className="bg-white shadow-lg rounded-xl border border-gray-100 p-6 lg:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Site ID (read-only) */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="site_id">
                  site_id
                </label>
                <input
                  id="site_id"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-700"
                  type="text"
                  value={site_id ?? ''}
                  readOnly
                  aria-label="Site ID"
                />
              </div>

              {/* Site Title (required) */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="site_title">
                  site_title
                </label>
                <input
                  id="site_title"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  type="text"
                  placeholder="Portfolio title"
                  value={form.site_title ?? ''}
                  onChange={(e) => handleChange('site_title', e.target.value)}
                  aria-label="Site Title"
                />
              </div>

              {/* Tagline */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="tagline">
                  tagline
                </label>
                <input
                  id="tagline"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  type="text"
                  placeholder="A short tagline"
                  value={form.tagline ?? ''}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  aria-label="Tagline"
                />
              </div>

              {/* Hero Image URL */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="hero_image_url">
                  hero_image_url
                </label>
                <input
                  id="hero_image_url"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  type="url"
                  placeholder="https://..."
                  value={form.hero_image_url ?? ''}
                  onChange={(e) => handleChange('hero_image_url', e.target.value)}
                  aria-label="Hero Image URL"
                />
              </div>

              {/* About Text */}
              <div className="md:col-span-2 flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="about_text">
                  about_text
                </label>
                <textarea
                  id="about_text"
                  rows={4}
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  placeholder="Write a short bio..."
                  value={form.about_text ?? ''}
                  onChange={(e) => handleChange('about_text', e.target.value)}
                  aria-label="About Text"
                />
              </div>

              {/* Template ID */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="template_id">
                  template_id
                </label>
                <select
                  id="template_id"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  value={form.template_id ?? 'template_A'}
                  onChange={(e) => handleChange('template_id', e.target.value)}
                  aria-label="Template"
                >
                  <option value="template_A">Template A</option>
                  <option value="template_B">Template B</option>
                </select>
              </div>

              {/* Primary Color */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="primary_color">
                  primary_color
                </label>
                <input
                  id="primary_color"
                  className="w-40 px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  type="color"
                  value={form.primary_color ?? '#4F46E5'}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  aria-label="Primary Color"
                />
              </div>

              {/* Font Family */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="font_family">
                  font_family
                </label>
                <select
                  id="font_family"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  value={form.font_family ?? 'Inter'}
                  onChange={(e) => handleChange('font_family', e.target.value)}
                  aria-label="Font Family"
                >
                  <option value="Inter">Inter</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                </select>
              </div>

              {/* Dark Mode */}
              <div className="flex items-center">
                <label className="mr-4 text-sm font-medium text-gray-700" htmlFor="is_dark_mode">
                  is_dark_mode
                </label>
                <input
                  id="is_dark_mode"
                  type="checkbox"
                  checked={!!form.is_dark_mode}
                  onChange={(e) => handleChange('is_dark_mode', e.target.checked)}
                  aria-label="Dark Mode"
                  className="h-5 w-5 rounded"
                />
              </div>

              {/* SEO Title */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="seo_title">
                  seo_title
                </label>
                <input
                  id="seo_title"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  type="text"
                  placeholder="SEO Title"
                  value={form.seo_title ?? ''}
                  onChange={(e) => handleChange('seo_title', e.target.value)}
                  aria-label="SEO Title"
                />
              </div>

              {/* SEO Description */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="seo_description">
                  seo_description
                </label>
                <input
                  id="seo_description"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  type="text"
                  placeholder="SEO Description"
                  value={form.seo_description ?? ''}
                  onChange={(e) => handleChange('seo_description', e.target.value)}
                  aria-label="SEO Description"
                />
              </div>

              {/* Subdomain */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="subdomain">
                  subdomain
                </label>
                <input
                  id="subdomain"
                  className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  type="text"
                  placeholder="subdomain.yourhost.app"
                  value={form.subdomain ?? ''}
                  onChange={(e) => handleChange('subdomain', e.target.value)}
                  aria-label="Subdomain"
                />
              </div>
            </div>

            {/* Validation/Status Row */}
            {localError && (
              <div role="alert" aria-live="polite" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {localError}
              </div>
            )}
            {saveInfo && (
              <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                {saveInfo}
              </div>
            )}
            {isLoadingSettings && (
              <div className="flex items-center text-sm text-gray-700">
                Loading settings...
                <span className="inline-block ml-2 animate-pulse bg-blue-200 rounded-full w-2 h-2" aria-label="loading-dot" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={onSave}
                disabled={!site_id || isSaving}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                aria-label="Save settings"
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <span className="mr-2 inline-block h-4 w-4 border-2 border-t-transparent border-l-transparent border-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200"
                aria-label="Reset changes"
              >
                Reset
              </button>

              <Link
                to="/dashboard"
                className="ml-auto text-sm text-blue-600 hover:underline"
              >
                Cancel
              </Link>
            </div>
          </div>

          {/* Live Preview Note */}
          <div className="mt-6 text-xs text-gray-500">
            Preview reflects in-editor changes in real-time as you edit; Save to persist to backend.
          </div>
        </div>
      </section>
    </>
  );
};

export default UV_SettingsEditor;
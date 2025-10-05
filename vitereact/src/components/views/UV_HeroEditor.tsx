import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';

/**
 * UV_HeroEditor
 * - React.FC, single-file implementation
 * - Edits hero: title, tagline, hero image URL
 * - Upload flow for hero image via assets endpoint, then apply URL to hero
 * - Live preview bridge via Zustand set_site (updates the editor's in-app preview)
 * - All rendering happens inside a single top-level fragment
 */

// API base (frontend env)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

const UV_HeroEditor: React.FC = () => {
  // 1) Global/auth/site data (via Zustand selectors, single-field selectors)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const current_site_title = useAppStore(state => state.portfolio_site_state.site_title);
  const current_tagline = useAppStore(state => state.portfolio_site_state.tagline);
  const current_hero_image_url = useAppStore(state => state.portfolio_site_state.hero_image_url);

  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const set_site = useAppStore(state => state.set_site);

  const [localTitle, setLocalTitle] = useState<string>(current_site_title || '');
  const [localTagline, setLocalTagline] = useState<string | null>(current_tagline || null);
  const [localHeroImageUrl, setLocalHeroImageUrl] = useState<string | null>(current_hero_image_url || null);

  // Local UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Debounced live-preview update (to avoid excessive re-renders)
  const previewDebounceMs = useAppStore(state => state.ui.preview_debounce_ms) ?? 250;
  const previewTimer = useRef<number | undefined>(undefined);

  // Hidden file input for hero image uploading
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize local fields when the site data changes
  useEffect(() => {
    setLocalTitle(current_site_title || '');
    setLocalTagline(current_tagline ?? null);
    setLocalHeroImageUrl(current_hero_image_url ?? null);
  }, [current_site_title, current_tagline, current_hero_image_url, site_id]);

  // Clear errors when user starts typing
  useEffect(() => {
    if (localError) {
      // Clear error on any change
      setLocalError(null);
    }
  }, [localTitle, localTagline, localHeroImageUrl]);

  // Bridge: update Live Preview in-editor when hero fields change (debounced)
  useEffect(() => {
    if (!site_id) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      // Merge changes into global portfolio_site_state to reflect in Preview pane
      set_site({
        ...{
          site_id: site_id,
          // other fields will be preserved by the server/store; we only merge needed ones
          // We cast to any to satisfy TypeScript for this inline update
        } as any,
        site_title: localTitle,
        tagline: localTagline,
        hero_image_url: localHeroImageUrl,
      } as any);
    }, previewDebounceMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site_id, localTitle, localTagline, localHeroImageUrl, set_site, previewDebounceMs]);

  // Handlers
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTitle(e.target.value);
  };

  const handleTaglineChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalTagline(e.target.value);
  };

  // Trigger hero update to backend
  const handleSubmitHero = async () => {
    setLocalError(null);
    if (!site_id) {
      setLocalError('Site is not selected. Save your site data first.');
      return;
    }

    // Basic validation: require title (as per FRD)
    if (!localTitle || localTitle.trim().length === 0) {
      setLocalError('Hero title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: localTitle,
        tagline: localTagline,
        hero_image_url: localHeroImageUrl,
      };

      const resp = await axios.put(
        `${API_BASE}/api/sites/${site_id}/hero`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(auth_token ? { Authorization: `Bearer ${auth_token}` } : {}),
          },
        }
      );

      // Map response to local site state (snake_case keys as in backend)
      const data = (resp.data && resp.data.data) || resp.data || {};
      const siteFromResp = data as any;

      // Map function to align with store's Site shape
      const mapHeroUpdateResponse = (site: any) => ({
        site_id: site.site_id,
        user_id: site.user_id,
        site_title: site.site_title,
        tagline: site.tagline,
        hero_image_url: site.hero_image_url,
        about_text: site.about_text,
        template_id: site.template_id,
        primary_color: site.primary_color,
        font_family: site.font_family,
        is_dark_mode: site.is_dark_mode,
        seo_title: site.seo_title,
        seo_description: site.seo_description,
        subdomain: site.subdomain,
        published_at: site.published_at,
        export_zip_url: site.export_zip_url,
      });

      // Update global site state
      set_site(mapHeroUpdateResponse(siteFromResp));

      // Optional: we could reset local copy or keep in sync with store
      // For deterministic behavior we rely on store syncing via debounced preview bridge
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update hero';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle hero image file upload
  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleHeroFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: size/type validation (client-side)
    if (!file.type.startsWith('image/')) {
      setLocalError('Please select a valid image file.');
      return;
    }

    // Read as Data URL for immediate preview and eventual upload
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      // Update local preview immediately
      setLocalHeroImageUrl(dataUrl);
      // Upload as asset to server (via assets endpoint) and use returned URL as hero_image_url
      try {
        if (!site_id) {
          setLocalError('Site is not selected. Save your site data first.');
          return;
        }
        // Upload asset (server expects url field as string)
        const assetPayload = {
          site_id,
          url: dataUrl,
          alt_text: 'Hero image',
        };
        const resp = await axios.post(
          `${API_BASE}/api/sites/${site_id}/assets`,
          assetPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(auth_token ? { Authorization: `Bearer ${auth_token}` } : {}),
            },
          }
        );
        const assetResp = (resp.data && resp.data.data) || resp.data;
        const uploadedUrl = assetResp?.url || dataUrl;

        // Apply the uploaded URL as hero image and trigger a hero update to persist
        setLocalHeroImageUrl(uploadedUrl);
        // Optionally auto-persist image URL with a debounced save (or require user click "Save Hero")
        // We'll auto-persist to hero after asset upload to improve UX
        setLocalTitle(prev => prev); // no-op to satisfy lints
        // Persist
        // Use the current title/tagline plus new hero url
        // Note: we'll debounce via the existing submit button to maintain explicit save flow.
        // But we can also auto-save here by calling update
        // Here, perform a lightweight save
        await handleSubmitHero();
      } catch (uploadErr: any) {
        const msg = uploadErr?.response?.data?.message || uploadErr?.message || 'Hero image upload failed';
        setLocalError(msg);
      }
    };
    reader.onerror = () => {
      setLocalError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  // UI rendering helpers (not separate components, just inline blocks)
  const isSubmitDisabled = isSubmitting || !site_id || !localTitle || localTitle.trim().length === 0;

  // Render
  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header / navigation crumb for context */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className="inline-block h-9 w-9 bg-blue-600 text-white rounded-md flex items-center justify-center font-semibold">
                HP
              </span>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Hero Editor</h1>
                <p className="text-sm text-gray-600">Edit the hero title, tagline, and hero media. Live preview updates as you edit.</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link to="/dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Validation / error banner */}
          {localError && (
            <div role="alert" aria-live="polite" className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <span className="block sm:inline">{localError}</span>
            </div>
          )}

          {/* Main two-column layout: Editor form (left) + Live Preview (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hero Editor Form */}
            <section aria-label="Hero Editor Form" className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
              <div className="mb-4">
                <label htmlFor="hero-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Hero Title
                </label>
                <input
                  id="hero-title"
                  type="text"
                  value={localTitle}
                  onChange={handleTitleChange}
                  placeholder="Enter hero title"
                  aria-label="Hero title"
                  className="w-full rounded-md border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 p-3 text-gray-900"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="hero-tagline" className="block text-sm font-medium text-gray-700 mb-1">
                  Tagline
                </label>
                <input
                  id="hero-tagline"
                  type="text"
                  value={localTagline ?? ''}
                  onChange={handleTaglineChange}
                  placeholder="Optional tagline"
                  aria-label="Hero tagline"
                  className="w-full rounded-md border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 p-3 text-gray-900"
                />
              </div>

              {/* Hero Image Uploader */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hero Image
                </label>
                <div className="flex items-center gap-4">
                  {localHeroImageUrl ? (
                    <img
                      src={localHeroImageUrl}
                      alt="Hero preview"
                      className="h-40 w-72 object-cover rounded-md border border-gray-200"
                    />
                  ) : (
                    <div className="h-40 w-72 flex items-center justify-center text-sm text-gray-500 border-2 border-dashed border-gray-200 rounded-md bg-gray-50">
                      No hero image selected
                    </div>
                  )}
                  <div className="flex flex-col space-y-2">
                    <button
                      type="button"
                      onClick={handleOpenFilePicker}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      aria-label="Upload hero image"
                    >
                      Upload hero image
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHeroFileSelected}
                      style={{ display: 'none' }}
                      aria-label="Hero image file input"
                    />
                    <span className="text-xs text-gray-500">Tip: You can upload 1–5 images. The first image will be used as the hero media. Data URL uploads are used for demo purposes.</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleSubmitHero}
                  disabled={isSubmitDisabled}
                  aria-label="Save hero changes"
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200
                    ${isSubmitDisabled
                      ? 'bg-blue-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Hero'}
                </button>
                <span className="text-sm text-gray-600">
                  Press Save to persist to the server. Live preview updates as you edit.
                </span>
              </div>
            </section>

            {/* Live Preview Bridge (inline live preview for hero) */}
            <section aria-label="Live Preview (Hero)" className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
              <div className="relative h-64 rounded-xl overflow-hidden bg-gray-200">
                {localHeroImageUrl ? (
                  <img
                    src={localHeroImageUrl}
                    alt="Hero live preview"
                    className="object-cover w-full h-full opacity-90"
                    style={{ filter: 'saturate(1.0)' }}
                  />
                ) : null}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
                  <h3 className="text-2xl font-bold">{localTitle || 'Hero Title'}</h3>
                  <p className="text-sm">{localTagline ?? ''}</p>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Live Preview reflects the hero configuration. This pane mirrors the global editor preview.
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_HeroEditor;
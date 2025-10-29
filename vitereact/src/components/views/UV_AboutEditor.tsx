import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';

/**
 * UV_AboutEditor
 * Editor for the About section: bio/about text and optional avatar URL.
 * - Uses individual Zustand selectors.
 * - Persists via PUT /api/sites/{site_id}/about with payload { bio, avatar_url }.
 * - Updates global site state on success to drive live Preview parity.
 * - Rendered as a single large React fragment per requirements.
 */
const UV_AboutEditor: React.FC = () => {
  // Global identifiers and tokens
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const token = useAppStore(state => state.authentication_state.auth_token);
  const currentSite = useAppStore(state => state.portfolio_site_state);
  const setSite = useAppStore(state => state.set_site);

  // Local editable fields
  const [aboutText, setAboutText] = useState<string>(currentSite.about_text ?? '');
  // Avatar URL is optional; keep local state for editing
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // UI state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Initialize local fields when store changes (e.g., on initial load or after a Save)
  useEffect(() => {
    setAboutText(currentSite.about_text ?? '');
    // Avatar URL isn't part of the Persisted Site shape by default in the store.
    // If backend returns avatar_url, we merge it into the global store; here we keep local field empty to start.
    // We preserve any existing local avatarUrl until user edits.
  }, [currentSite.about_text]);

  // Persist About section to backend
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic UX: prevent multiple submissions
    if (isSaving) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const payload = {
        bio: aboutText,
        avatar_url: avatarUrl || null,
      };

      const headers: any = token ? { Authorization: `Bearer ${token}` } : undefined;

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/sites/${site_id}/about`,
        payload,
        { headers }
      );

      const siteFromApi = (response.data?.data) ?? response.data ?? {};

      // Map API response to UI/SST (snaked)
      const mappedSite: any = {
        site_id: siteFromApi.site_id ?? site_id,
        user_id: siteFromApi.user_id ?? currentSite.user_id,
        site_title: siteFromApi.site_title ?? currentSite.site_title,
        tagline: siteFromApi.tagline ?? currentSite.tagline,
        hero_image_url: siteFromApi.hero_image_url ?? currentSite.hero_image_url ?? null,
        about_text: siteFromApi.bio ?? siteFromApi.about_text ?? aboutText ?? null,
        template_id: siteFromApi.template_id ?? currentSite.template_id ?? null,
        primary_color: siteFromApi.primary_color ?? currentSite.primary_color ?? null,
        font_family: siteFromApi.font_family ?? currentSite.font_family ?? null,
        is_dark_mode: siteFromApi.is_dark_mode ?? currentSite.is_dark_mode ?? false,
        seo_title: siteFromApi.seo_title ?? currentSite.seo_title ?? null,
        seo_description: siteFromApi.seo_description ?? currentSite.seo_description ?? null,
        subdomain: siteFromApi.subdomain ?? currentSite.subdomain ?? null,
        published_at: siteFromApi.published_at ?? currentSite.published_at ?? null,
        export_zip_url: siteFromApi.export_zip_url ?? currentSite.export_zip_url ?? null,
      };

      // Update global state to keep Preview in sync
      setSite(mappedSite);

      setSaveMessage('About updated successfully.');
      window.setTimeout(() => setSaveMessage(null), 2500);
    } catch (err) {
      // Basic error handling; real app would map status codes to messages
      setSaveMessage('Failed to save About. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // UI rendering - single large render block
  return (
    <>
      <div className="min-h-screen bg-gray-50 p-6" aria-label="About Editor wrapper">
        <section className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-6" aria-label="About Editor Card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900" id="about-editor-header">
              About Editor
            </h2>
            <Link to="/dashboard" className="text-sm text-blue-600 hover:underline" aria-label="Back to dashboard">
              Back to Dashboard
            </Link>
          </div>

          <form onSubmit={handleSave} className="space-y-4" aria-describedby="about-editor-desc">
            <p id="about-editor-desc" className="text-sm text-gray-600">
              Edit your bio/about text and optional avatar. Changes reflect in the live Preview and the exported site.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col">
                <label htmlFor="about_text" className="text-sm font-medium text-gray-700 mb-1">
                  Bio/About
                </label>
                <textarea
                  id="about_text"
                  name="about_text"
                  rows={8}
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  placeholder="Tell visitors about you..."
                  className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 resize-y"
                  aria-label="Bio/About text"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="avatar_url" className="text-sm font-medium text-gray-700 mb-1">
                  Avatar URL (optional)
                </label>
                <input
                  id="avatar_url"
                  name="avatar_url"
                  type="url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  aria-label="Avatar URL"
                />
                {avatarUrl ? (
                  <div className="mt-4">
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      className="h-14 w-14 rounded-full object-cover shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-gray-500">No avatar selected</div>
                )}
              </div>
            </div>

            {saveMessage && (
              <div role="status" aria-live="polite" className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                {saveMessage}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={isSaving}
                aria-label="Save About"
              >
                {isSaving ? 'Saving...' : 'Save About'}
              </button>

              <div className="text-sm text-gray-600" aria-live="polite">
                Site ID: {site_id || 'N/A'}
              </div>
            </div>
          </form>
        </section>
      </div>
    </>
  );
};

export default UV_AboutEditor;
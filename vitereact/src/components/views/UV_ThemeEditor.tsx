import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import type { Site } from '@/store/main';

type ThemePayload = {
  template_id: string;
  primary_color: string;
  font_family: string;
  is_dark_mode: boolean;
};

// API base from environment (consistent with Frontend routing rules)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (!hex) return null;
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
};

const rgbToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const getRelativeLuminance = (rgb: { r: number; g: number; b: number }) => {
  const R = rgbToLinear(rgb.r);
  const G = rgbToLinear(rgb.g);
  const B = rgbToLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrastAgainstWhite = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lum = getRelativeLuminance(rgb);
  // WCAG-inspired: contrast with white ~ (1.05) / (lum + 0.05)
  return (1.05) / (lum + 0.05);
};

const UV_ThemeEditor: React.FC = () => {
  // Global store access (Redux-style selectors)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const currentSite = useAppStore(state => state.portfolio_site_state) as Site;
  const setSite = useAppStore(state => state.set_site);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isLoading = useAppStore(state => state.ui.is_loading);

  // Local UI state derived from store (snake_case alignment)
  const [templateId, setTemplateId] = useState<string>(currentSite?.template_id ?? 'template_A');
  const [primaryColor, setPrimaryColor] = useState<string>(currentSite?.primary_color ?? '#4F46E5');
  const [fontFamily, setFontFamily] = useState<string>(currentSite?.font_family ?? 'Inter, system-ui, Arial');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(Boolean(currentSite?.is_dark_mode ?? false));

  const [error, setError] = useState<string | null>(null);

  // Sync local state if the store changes externally
  useEffect(() => {
    setTemplateId(currentSite?.template_id ?? 'template_A');
    setPrimaryColor(currentSite?.primary_color ?? '#4F46E5');
    setFontFamily(currentSite?.font_family ?? 'Inter, system-ui, Arial');
    setIsDarkMode(Boolean(currentSite?.is_dark_mode ?? false));
  }, [currentSite?.template_id, currentSite?.primary_color, currentSite?.font_family, currentSite?.is_dark_mode]);

  // Live preview update helper
  const updateLivePreview = (updates: Partial<Site>) => {
    const updatedSite: Site = {
      ...currentSite,
      ...updates,
      template_id: updates.template_id ?? currentSite.template_id,
      primary_color: updates.primary_color ?? currentSite.primary_color,
      font_family: updates.font_family ?? currentSite.font_family,
      is_dark_mode: updates.is_dark_mode ?? currentSite.is_dark_mode,
    } as Site;

    // Persist to store to drive Preview
    setSite(updatedSite);
  };

  // Theme commit to backend with overrides support
  const commitTheme = async (overrides?: Partial<ThemePayload>) => {
    if (!site_id) {
      setError('Site not loaded. Please save after the site is initialized.');
      return;
    }
    const payload: ThemePayload = {
      template_id: overrides?.template_id ?? templateId,
      primary_color: overrides?.primary_color ?? primaryColor,
      font_family: overrides?.font_family ?? fontFamily,
      is_dark_mode: overrides?.is_dark_mode ?? isDarkMode,
    };

    try {
      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await axios.put(`${API_BASE}/api/sites/${site_id}/theme`, payload, {
        headers,
      });

      // Map response into UI state if provided
      const data = (res.data?.data ?? res.data) as any;
      const updatedSiteFromApi = data?.site ?? data ?? null;
      // Fallback: if API returns full site in data
      const siteToApply = updatedSiteFromApi ?? data ?? null;

      if (siteToApply) {
        setSite(siteToApply as any);
        // Reflect changes locally too
        setTemplateId((siteToApply as any).template_id ?? templateId);
        setPrimaryColor((siteToApply as any).primary_color ?? primaryColor);
        setFontFamily((siteToApply as any).font_family ?? fontFamily);
        setIsDarkMode(Boolean((siteToApply as any).is_dark_mode ?? isDarkMode));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to save theme';
      setError(msg);
    }
  };

  // UI handlers with single-source-of-truth updates
  const handleTemplateChange = (newTemplateId: string) => {
    if (newTemplateId === templateId) return;
    setTemplateId(newTemplateId);
    updateLivePreview({ template_id: newTemplateId } as any);
    // Persist via backend (per UX map)
    commitTheme({ template_id: newTemplateId });
  };

  const handlePrimaryColorChange = (val: string) => {
    setPrimaryColor(val);
    updateLivePreview({ primary_color: val } as any);
    // Also persist on demand
    commitTheme({ primary_color: val });
  };

  const handleFontFamilyChange = (val: string) => {
    setFontFamily(val);
    updateLivePreview({ font_family: val } as any);
    commitTheme({ font_family: val });
  };

  const handleDarkModeToggle = (checked: boolean) => {
    setIsDarkMode(checked);
    updateLivePreview({ is_dark_mode: checked } as any);
    commitTheme({ is_dark_mode: checked });
  };

  // Derived for accessibility/contrast
  const contrastRatio = contrastAgainstWhite(primaryColor);
  const contrastOk = contrastRatio >= 4.5; // AA standard for normal text
  const contrastLabel = contrastOk ? 'Adequate contrast (AA)' : 'Low contrast (needs adjustment)';

  // Helper for "Live Preview" card font
  const previewFontFamily = fontFamily;

  // Ensure default site_id presence for button disable state
  const canSave = Boolean(site_id);

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">
              Back to Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Theme Editor
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor Controls Card */}
            <section aria-label="Theme controls" className="bg-white rounded-xl border border-gray-100 shadow-lg p-6 lg:p-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Branding and Theme</h2>
                <p className="text-sm text-gray-600">
                  Branding surface to shape templates, color palette, and typography. Live updates reflect in Preview and export output.
                </p>
              </div>

              <div className="space-y-6">
                {/* Template selection (two templates) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="template_select">
                    Template
                  </label>
                  <div id="template_select" role="group" aria-label="Template selection" className="inline-flex rounded-md border border-gray-300 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleTemplateChange('template_A')}
                      aria-pressed={templateId === 'template_A'}
                      className={`px-4 py-2 text-sm font-medium ${
                        templateId === 'template_A' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Template A
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTemplateChange('template_B')}
                      aria-pressed={templateId === 'template_B'}
                      className={`px-4 py-2 text-sm font-medium ${
                        templateId === 'template_B' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Template B
                    </button>
                  </div>
                </div>

                {/* Primary color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="primary_color">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="primary_color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => handlePrimaryColorChange(e.target.value)}
                      aria-label="Primary color"
                      className="h-9 w-9 rounded-md border border-gray-300"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        // naive guard to ensure hex-like string
                        if (/^#([0-9a-fA-F]{3}){1,2}$/.test(val) || val === '') {
                          handlePrimaryColorChange(val);
                        } else {
                          // keep local but don't crash
                          setPrimaryColor(val);
                          updateLivePreview({ primary_color: val } as any);
                        }
                      }}
                      aria-label="Primary color hex value"
                      placeholder="#4F46E5"
                      className="w-48 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <span
                      aria-live="polite"
                      className={`px-2 py-1 rounded text-xs font-semibold ${contrastOk ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                    >
                      {contrastLabel}
                    </span>
                  </div>
                </div>

                {/* Font family */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="font_family">
                    Font Family
                  </label>
                  <select
                    id="font_family"
                    value={fontFamily}
                    onChange={(e) => handleFontFamilyChange(e.target.value)}
                    className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm"
                    aria-label="Font family selection"
                  >
                    <option value="Inter, system-ui, Arial">Inter, system-ui, Arial</option>
                    <option value="'Roboto', sans-serif">Roboto, sans-serif</option>
                    <option value="'Poppins', sans-serif">Poppins, sans-serif</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Typography is applied site-wide to maintain branding consistency.
                  </p>
                </div>

                {/* Dark mode toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Appearance</label>
                  <div className="flex items-center space-x-4">
                    <button
                      type="button"
                      onClick={() => handleDarkModeToggle(!isDarkMode)}
                      className={`px-4 py-2 rounded-md border ${
                        isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
                      }`}
                      aria-label="Toggle dark mode"
                    >
                      {isDarkMode ? 'Dark mode: On' : 'Dark mode: Off'}
                    </button>
                    <span className="text-sm text-gray-600">
                      Live preview reflects theme mode. This affects background/contrast in the final export.
                    </span>
                  </div>
                </div>
              </div>

              {/* Save actions & status */}
              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                <div className="text-sm text-gray-600" aria-live="polite">
                  Changes apply to the in-editor Preview immediately. Saving persists to backend.
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => commitTheme()}
                    disabled={isLoading || !site_id}
                    className="inline-flex items-center px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Save Theme"
                  >
                    {isLoading ? 'Saving...' : 'Save Theme'}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded"
                >
                  {error}
                </div>
              )}
            </section>

            {/* Live Preview Card (visual reference) */}
            <section aria-label="Live Theme Preview" className="bg-white rounded-xl border border-gray-100 shadow-lg p-6 lg:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Live Preview</h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${contrastOk ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                  {contrastLabel}
                </span>
              </div>

              <div
                className={`rounded-lg p-6 border border-dashed ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
                style={{
                  fontFamily: previewFontFamily,
                }}
              >
                <h4 className="text-xl font-semibold mb-2" style={{ color: primaryColor }}>
                  Hero Title Preview
                </h4>
                <p className="mb-4" style={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}>
                  This is a live preview sample text. The primary color and font family chosen here reflect in the actual site export.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs" style={{ fontFamily }}>
                    Sample tag
                  </span>
                  <span className="px-2 py-1 rounded bg-green-50 text-green-700 text-xs" style={{ fontFamily }}>
                    Accent token
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_ThemeEditor;
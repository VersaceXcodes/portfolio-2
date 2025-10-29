import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

/**
 * UV_ExportPanel
 * - Displays generated static site artifacts
 * - Allows ZIP export, download, manifest view (inline placeholder), and directory structure visualization
 * - Shows asset references and export notes
 * - Fully self-contained render: returns a single top-level fragment
 */
const UV_ExportPanel: React.FC = () => {
  // Core state selections (CRITICAL: individual selectors)
  const site_id = useAppStore(state => state.portfolio_site_state.site_id) ?? '';
  const auth_token = useAppStore(state => state.authentication_state.auth_token);

  // Export state (local synthesis). We read from store but keep UI logic self-contained.
  const storeExportZipUrl = useAppStore(state => state.export_state.export_zip_url);
  const storeExportPath = useAppStore(state => state.export_state.export_path);

  // Local UI state
  const [exportZipUrl, setExportZipUrl] = useState<string | null>(storeExportZipUrl ?? null);
  const [exportPath, setExportPath] = useState<string | null>(storeExportPath ?? null);
  const [manifestVisible, setManifestVisible] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync export values if store updates (best effort; since we don't have a setter in the store for export_state, we reflect store value locally)
  useEffect(() => {
    if (storeExportZipUrl) {
      setExportZipUrl(storeExportZipUrl);
    }
  }, [storeExportZipUrl]);

  useEffect(() => {
    if (storeExportPath) {
      setExportPath(storeExportPath);
    }
  }, [storeExportPath]);

  // Asset references summary (from global assets)
  const assets = useAppStore(state => state.assets);
  const assetsForSiteCount = useMemo(() => {
    return assets.filter(a => a.site_id === site_id).length;
  }, [assets, site_id]);

  const totalAssetsCount = assets.length;

  // Trigger export (POST /api/sites/{site_id}/export)
  const performExport = async () => {
    if (!site_id) {
      setStatusMessage('Please save the site before exporting.');
      return;
    }
    setIsExporting(true);
    setStatusMessage(null);

    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';
      const resp = await axios.post(
        `${apiBase}/api/sites/${site_id}/export`,
        {},
        {
          headers: {
            'Authorization': auth_token ? `Bearer ${auth_token}` : '',
            'Content-Type': 'application/json',
          },
        }
      );

      const data = resp.data?.data ?? resp.data ?? {};
      const url: string | null = data.export_zip_url ?? null;
      const path: string | null = data.export_path ?? null;

      // Reflect results in local state (and optionally in store if a setter is exposed)
      setExportZipUrl(url);
      setExportPath(path);

      setStatusMessage(url ? 'Export ready. You can download the ZIP.' : 'Export initiated.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Export failed';
      setStatusMessage(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Manifest view toggle
  const toggleManifest = () => setManifestVisible(v => !v);

  // Simple directory structure visualization (static representation for MVP)
  const dirStructure = [
    { name: 'index.html' },
    { name: 'assets/', children: [
      { name: 'images/' },
      { name: 'fonts/' }
    ]},
    { name: 'scripts/', children: [
      { name: 'main.js' }
    ]},
    { name: 'styles/', children: [
      { name: 'styles.css' }
    ]},
    { name: 'templates/', children: [
      { name: 'template_A/' },
      { name: 'template_B/' }
    ]}
  ];

  // Render a single big fragment as required
  return (
    <>
      <section aria-label="Export Panel" className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Export Panel</h2>
          <div role="status" aria-live="polite" className="text-sm text-gray-500">
            {statusMessage ?? ''}
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Displays the static site artifacts generated for your portfolio. Provides ZIP download,
          a manifest view, and a directory-structure visualization. Asset references and export notes are summarized below.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Actions & Manifest */}
          <div className="bg-white border border-gray-100 rounded-lg p-4 lg:p-6" aria-label="Export actions and controls">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-800">Actions</span>
              <span className="text-xs text-gray-500">{exportZipUrl ? 'Export ready' : 'Not ready'}</span>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={performExport}
                disabled={isExporting}
                aria-label="Generate static site export"
                className={`px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50`}
              >
                {isExporting ? 'Exporting…' : 'Export ZIP'}
              </button>

              <a
                href={exportZipUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                aria-label="Download ZIP"
                className={`px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 ${exportZipUrl ? '' : 'opacity-50 cursor-not-allowed'}`}
              >
                Download ZIP
              </a>

              <button
                onClick={toggleManifest}
                aria-label="View export manifest"
                className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 border border-gray-300 hover:bg-gray-200"
              >
                View Manifest
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-500" aria-live="polite">
              Tip: After export, a ZIP bundle URL will be available for download. You can also view a manifest snapshot below.
            </div>
          </div>

          {/* Right: Summary */}
          <div className="bg-white border border-gray-100 rounded-lg p-4 lg:p-6" aria-label="Export summary">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-800">Export Summary</span>
            </div>

            <ul className="text-sm text-gray-700 space-y-1" aria-label="Export summary items">
              <li><strong>Site ID:</strong> {site_id || 'N/A'}</li>
              <li><strong>Assets in site:</strong> {assetsForSiteCount} of {totalAssetsCount}</li>
              <li><strong>Export path:</strong> {exportPath ?? 'N/A'}</li>
              <li><strong>Export ZIP URL:</strong> {exportZipUrl ?? 'Not generated yet'}</li>
            </ul>

            <p className="mt-3 text-xs text-gray-500" aria-live="polite">
              Exports generate static HTML/CSS/JS bundles suitable for hosting. Ensure assets are accessible from the export bundle.
            </p>
          </div>
        </div>

        {/* Manifest drawer (inline, accessible) */}
        {manifestVisible && (
          <div role="region" aria-label="Export manifest" className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-800">Export Manifest</span>
              <button onClick={toggleManifest} aria-label="Close manifest" className="text-sm text-blue-600 hover:underline">
                Close
              </button>
            </div>
            <pre className="bg-white border rounded-md p-3 text-xs overflow-auto" style={{ maxHeight: '260px' }} aria-label="Export manifest content">
{`{
  "site_id": "${site_id}",
  "export_zip_url": "${exportZipUrl ?? ''}",
  "export_path": "${exportPath ?? ''}",
  "structure": [
    "index.html",
    "assets/",
    "assets/images/",
    "scripts/main.js",
    "styles/styles.css",
    "templates/template_A/index.html",
    "templates/template_B/index.html"
  ]
}`}
            </pre>
          </div>
        )}
      </section>

      {/* Visualization spacer to align in page layouts when used alongside other panels */}
      <div aria-hidden="true" style={{ height: 20 }} />
      {/* Optional navigation aid back to dashboard for convenience */}
      <div className="mt-6">
        <Link to="/dashboard" className="text-blue-600 hover:underline text-sm font-medium">
          Back to Dashboard
        </Link>
      </div>
    </>
  );
};

export default UV_ExportPanel;
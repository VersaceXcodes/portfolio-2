import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

type SiteData = {
  site_id: string;
  user_id: string;
  site_title: string;
  tagline?: string | null;
  hero_image_url?: string | null;
  about_text?: string | null;
  template_id?: string | null;
  primary_color?: string | null;
  font_family?: string | null;
  is_dark_mode: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  subdomain?: string | null;
  published_at?: string | null;
  export_zip_url?: string | null;
};

type ProjectData = {
  project_id: string;
  site_id: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  demo_url?: string | null;
  code_url?: string | null;
  images: string[];
  order_index: number;
  created_at?: string;
  updated_at?: string;
};

type ProjectsListResponse = {
  data: ProjectData[];
  total?: number;
};

type SiteResponse = {
  data: SiteData;
};

// API base URL (frontend env)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

const UV_Dashboard: React.FC = () => {
  // --- Global/auth state (selectors only) ---
  const token = useAppStore(state => state.authentication_state.auth_token);
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const current_user = useAppStore(state => state.authentication_state.current_user);

  // Basic actions
  const logout = useAppStore(state => state.logout_user);
  const queryClient = useQueryClient();

  // Local UI state
  const [isPreviewOpen, setPreviewOpen] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // Quick add project form state
  const [newProj, setNewProj] = useState<{ title: string; description: string; date: string; tags: string }>({
    title: '',
    description: '',
    date: '',
    tags: '',
  });
  const [adding, setAdding] = useState(false);

  // Data fetchers (protected endpoints require a token)
  const siteQuery = useQuery<SiteData, Error>(
    ['site', site_id],
    async () => {
      const resp = await axios.get<SiteResponse>(`${API_BASE}/api/sites/${site_id}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      // OPENAPI: data is in resp.data.data
      return resp.data.data;
    },
    {
      enabled: !!site_id && !!token,
      staleTime: 60_000,
    }
  );

  const projectsQuery = useQuery<ProjectsListResponse, Error>(
    ['projects', site_id],
    async () => {
      const resp = await axios.get<ProjectsListResponse>(`${API_BASE}/api/sites/${site_id}/projects`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      // OPENAPI: data: Project[]; total
      return resp.data;
    },
    {
      enabled: !!site_id && !!token,
      keepPreviousData: true,
      staleTime: 60_000,
    }
  );

  // Derived data with safe guards
  const site = siteQuery.data;
  const projects = projectsQuery.data?.data ?? [];

  // Simple derived metrics
  const projectCount = projects.length;
  const lastUpdatedAt: string | null = useMemo(() => {
    const times: (string | undefined)[] = [];
    if (site?.published_at) times.push(site.published_at);
    projects.forEach(p => times.push(p.updated_at));
    if (!times.length) return null;
    // pick max by date
    return times
      .filter((t): t is string => typeof t === 'string' && !!t)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  }, [site, projects]);

  // Helper to trigger a simple toast
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  // Create a new project (inline quick-add)
  const createProject = async () => {
    if (!site_id) return;
    if (!newProj.title || !newProj.description || !newProj.date) {
      showToast('Please fill Title, Description and Date');
      return;
    }
    setAdding(true);
    try {
      const payload = {
        site_id,
        title: newProj.title,
        description: newProj.description,
        date: newProj.date,
        tags: newProj.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
        order_index: (projects.length > 0 ? Math.max(...projects.map(p => p.order_index)) : 0) + 1,
      };
      const resp = await axios.post(`${API_BASE}/api/sites/${site_id}/projects`, payload, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      // Expecting { data: Project }
      const created: ProjectData = resp.data?.data ?? resp.data ?? (resp.data as any);
      // Update UI state by refetching projects
      await queryClient.invalidateQueries(['projects', site_id]);
      // Clear quick-add form
      setNewProj({ title: '', description: '', date: '', tags: '' });
      showToast('Project created');
    } catch (err) {
      const msg = (err as any)?.response?.data?.message || (err as any)?.message || 'Failed to create project';
      showToast(msg);
    } finally {
      setAdding(false);
    }
  };

  // Live UI affordances when not authenticated? (the shell handles redirect; here just guard content)
  // If no site_id or token, show a polite message
  const isReady = !!site_id && !!token && !!site;

  // Render
  return (
    <>
      {/* Main dashboard content in a single fragment, as required */}
      <div className="min-h-screen bg-gray-50" role="main" aria-label="Editor Dashboard">
        {/* Overview header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Editor Dashboard</h1>
                <p className="text-sm text-gray-600">
                  {current_user?.full_name ? `Welcome back, ${current_user.full_name}!` : 'Manage your portfolio site'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Link to="/dashboard/preview" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  Open Preview
                </Link>
                <button
                  onClick={() => logout()}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
                  aria-label="Sign out"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Body content: left rail is provided by the global shell; here we render the main content area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Global status / toasts */}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-green-700"
            >
              {toast}
            </div>
          )}
          {!isReady && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-6" role="alert" aria-live="polite">
              Loading dashboard data...
            </div>
          )}

          {isReady && (
            <>
              {/* Dashboard overview tiles */}
              <section aria-label="Overview" className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Tile: Publish status */}
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-lg">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Publish</div>
                    <div className="mt-2 text-xl font-semibold text-gray-900">
                      {site?.subdomain ? 'Subdomain ready' : 'Not published'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Subdomain: {site?.subdomain ?? '—'}</div>
                  </div>

                  {/* Tile: Projects count */}
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-lg">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">{projectCount}</div>
                    <div className="text-xs text-gray-500 mt-1">Total projects</div>
                  </div>

                  {/* Tile: Last updated */}
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-lg">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">
                      {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Most recent change</div>
                  </div>

                  {/* Tile: Export status */}
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-lg">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Export</div>
                    <div className="mt-2 text-xl font-semibold text-gray-900">
                      {site?.export_zip_url ? 'Ready' : 'Not ready'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">ZIP export availability</div>
                  </div>
                </div>
              </section>

              {/* Quick Add Project */}
              <section aria-label="Quick Add Project" className="mb-6">
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Quick Add Project</h2>
                    <button
                      onClick={() => {
                        // toggle form visibility by resetting fields (no separate modal)
                        setNewProj(p => ({
                          ...p,
                          title: '',
                          description: '',
                          date: '',
                          tags: '',
                        }));
                        setAdding(false);
                        showToast('Fill in details to create a new project');
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Help
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                      placeholder="Project title"
                      value={newProj.title}
                      onChange={(e) => setNewProj({ ...newProj, title: e.target.value })}
                    />
                    <input
                      className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                      placeholder="Date (YYYY-MM-DD)"
                      type="date"
                      value={newProj.date}
                      onChange={(e) => setNewProj({ ...newProj, date: e.target.value })}
                    />
                    <input
                      className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                      placeholder="Description"
                      value={newProj.description}
                      onChange={(e) => setNewProj({ ...newProj, description: e.target.value })}
                    />
                    <input
                      className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                      placeholder="Tags (comma separated)"
                      value={newProj.tags}
                      onChange={(e) => setNewProj({ ...newProj, tags: e.target.value })}
                    />
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={createProject}
                      disabled={adding}
                      className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                        adding ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      aria-label="Create project"
                    >
                      {adding ? 'Creating...' : 'Add Project'}
                    </button>
                  </div>
                </div>
              </section>

              {/* Projects Quick List */}
              <section aria-label="Projects" className="mb-6">
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">Search</span>
                      <input
                        aria-label="Search projects"
                        className="px-3 py-1 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        placeholder="Search by title or description"
                        onChange={(e) => {
                          // store in URL or local; for simplicity, rely on local filtering
                          const v = e.target.value;
                          // Debounced search could be added; for MVP, applyImmediately using a local state
                          setSearchQuery(v);
                        }}
                        // local char filter
                        defaultValue={''}
                      />
                    </div>
                  </div>

                  <ProjectsList
                    projects={projects}
                    searchQuery={searchQuery}
                    onOpenProject={(id) => {
                      // navigate to project editor
                      // Locally use Link in list; provide id for programmatic navigation
                    }}
                  />
                </div>
              </section>

              {/* Editor Shortcuts & Preview toggle */}
              <section aria-label="Shortcuts and Preview" className="mb-6">
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-700">quick actions</span>
                      <Link to="/dashboard/hero" className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
                        Hero
                      </Link>
                      <Link to="/dashboard/about" className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
                        About
                      </Link>
                      <Link to="/dashboard/projects" className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
                        Projects
                      </Link>
                      <Link to="/dashboard/theme" className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
                        Theme
                      </Link>
                      <Link to="/dashboard/seo" className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
                        SEO
                      </Link>
                      <Link to="/dashboard/publish" className="px-3 py-2 rounded-md bg-blue-50 hover:bg-blue-100 text-sm">
                        Publish
                      </Link>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">Live Preview</span>
                      <button
                        aria-label="Toggle live preview"
                        onClick={() => setPreviewOpen(v => !v)}
                        className="w-14 h-6 rounded-full bg-gray-200 relative transition-colors"
                      >
                        <span
                          className={`block w-6 h-6 rounded-full bg-white shadow transform transition-transform ${
                            isPreviewOpen ? 'translate-x-8' : ''
                          }`}
                          style={{ top: '-1px', position: 'relative' }}
                        />
                      </button>
                    </div>
                  </div>

                  {isPreviewOpen && (
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-md" aria-live="polite">
                      <PreviewPane site={site} projects={projects} />
                    </div>
                  )}
                </div>
              </section>

              {/* Help/docs quick link */}
              <section aria-label="Help" className="mb-6">
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-semibold text-gray-900">Need help?</h3>
                    <Link to="/help" className="text-sm text-blue-600 hover:underline">
                      Documentation
                    </Link>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
};

// Inline sub-block for Projects list rendering (kept as a function to keep code compact but used inside single render block)
function ProjectsList({
  projects,
  searchQuery,
  onOpenProject,
}: {
  projects: ProjectData[];
  searchQuery: string;
  onOpenProject: (project_id: string) => void;
}) {
  // Local simple filtering; do not rely on extra components
  const filtered = useMemo(() => {
    if (!searchQuery) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p => (p.title + ' ' + (p.description ?? '')).toLowerCase().includes(q));
  }, [projects, searchQuery]);

  // Simple pagination UI local (page/size handled by UI kw)
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Navigate to project editor on click
  const goToEditor = (id: string) => {
    // use Link in UI instead; here we keep for extension
    // window.location.href = `/dashboard/projects/${id}`;
  };

  return (
    <div className="space-y-3" role="region" aria-label="Projects quick list">
      {paged.map((p) => (
        <div key={p.project_id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:shadow-md transition">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">{p.title}</div>
            <div className="text-xs text-gray-500 truncate" title={p.description}>
              {p.description}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(p.date).toLocaleDateString()} • Tags: {p.tags?.slice(0, 3).join(', ')}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link to={`/dashboard/projects/${p.project_id}`} className="text-blue-600 hover:underline text-sm">
              Edit
            </Link>
            <button
              onClick={() => goToEditor(p.project_id)}
              className="text-sm text-gray-700 hover:underline"
              aria-label={`Open editor for project ${p.project_id}`}
            >
              Open
            </button>
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-6" role="note">
          No projects found.
        </div>
      )}
      <div className="flex justify-end items-center space-x-2 pt-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1 bg-gray-100 rounded-md text-sm"
          disabled={page <= 1}
        >
          Prev
        </button>
        <span className="text-xs text-gray-600">Page {page} of {totalPages}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1 bg-gray-100 rounded-md text-sm"
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Simple inline Preview pane (basic rendering)
function PreviewPane({ site, projects }: { site?: SiteData; projects: ProjectData[] }) {
  const heroAlt = site?.site_title ?? 'Hero image';
  return (
    <div className="space-y-6">
      {/* Hero Preview */}
      <section aria-label="Preview Hero" className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-md p-4 border border-gray-200">
        <div className="flex items-center space-x-4">
          {site?.hero_image_url ? (
            <img src={site.hero_image_url} alt={heroAlt} className="h-20 w-20 object-cover rounded-md" />
          ) : (
            <div className="h-20 w-20 bg-gray-200 rounded-md" aria-label="No hero image" />
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{site?.site_title || 'Your Portfolio'}</h2>
            <p className="text-sm text-gray-600">{site?.tagline ?? 'Tagline'}</p>
          </div>
        </div>
      </section>

      {/* About Preview */}
      <section aria-label="Preview About" className="bg-white rounded-md p-4 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">About</h3>
        <p className="text-sm text-gray-700 mt-1">{site?.about_text ?? 'Your bio will appear here.'}</p>
      </section>

      {/* Projects Preview (basic tiles) */}
      <section aria-label="Preview Projects" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.slice(0, 6).map((p) => (
          <div key={p.project_id} className="bg-white border border-gray-100 rounded-md p-3 shadow-sm">
            <div className="font-semibold text-gray-900 text-sm mb-1">{p.title}</div>
            <div className="text-xs text-gray-600 mb-2">{p.description}</div>
            {p.images && p.images.length > 0 ? (
              <img src={p.images[0]} alt={p.title} className="h-24 w-full object-cover rounded" />
            ) : (
              <div className="h-24 bg-gray-100 rounded" aria-label="Project image placeholder" />
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

export default UV_Dashboard;
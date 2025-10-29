import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

// API base (consistent with store)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

// Type imports (from store's Zod-derived types)
import type { Project } from '@/store/main';

/**
 * UV_ProjectsEditor
 * - Fully self-contained Projects Editor view
 * - Allows listing, creating, editing, deleting, and reordering projects for the current site
 * - All rendering is done in a single top-level fragment per requirements
 */
const UV_ProjectsEditor: React.FC = () => {
  // ----------------------------
  // Zustand selectors (CRITICAL: single selectors)
  // ----------------------------
  const site_id = useAppStore(state => state.portfolio_site_state.site_id);
  const token = useAppStore(state => state.authentication_state.auth_token);
  const projects = useAppStore(state => state.projects);
  const set_projects = useAppStore(state => state.set_projects);
  const add_project = useAppStore(state => state.add_project);
  const update_project = useAppStore(state => state.update_project);
  const delete_project = useAppStore(state => state.delete_project);

  // Extra store refs for quick actions (optional UX niceties)
  const queryClient = useQueryClient();

  // Local draft state for creating a new project
  const [newProject, setNewProject] = useState<Partial<Project>>({
    title: '',
    description: '',
    date: '',
    tags: [],
    images: [],
    demo_url: '',
    code_url: '',
    order_index: 0,
  });

  // Local editing cache per-project
  const [draftProjects, setDraftProjects] = useState<Record<string, Project>>({});

  // Local UI helpers
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'order_index' | 'title' | 'date'>('order_index');

  // Fetch projects for the current site
  const { data: listResponse, isLoading: isLoadingProjects, isError: isProjectsError } = useQuery(
    ['api', 'sites', site_id, 'projects'],
    async () => {
      const resp = await axios.get(`${API_BASE}/api/sites/${site_id}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // API shape: { data: Project[], total: number }
      return resp.data;
    },
    {
      enabled: !!site_id && !!token,
      keepPreviousData: true,
      staleTime: 60 * 1000,
    }
  );

  // Map API response to store when available
  useEffect(() => {
    if (listResponse?.data) {
      // Normalize/accept API project payloads directly
      const apiProjects: Project[] = (listResponse.data as any[]) ?? [];
      set_projects(apiProjects);
      // Also populate drafts for editing
      const draftMap: Record<string, Project> = {};
      apiProjects.forEach(p => {
        draftMap[p.project_id] = { ...p };
      });
      setDraftProjects(draftMap);
    }
  }, [listResponse, set_projects]);

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: async (payload: Partial<Project>) => {
      const resp = await axios.post(
        `${API_BASE}/api/sites/${site_id}/projects`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return resp.data;
    },
      onSuccess: (data) => {
        const apiProj: Project = (data?.data ?? data) as Project;
        // Update local store
        add_project(apiProj);
        // Reset draft/new project form
        setNewProject({ title: '', description: '', date: '', tags: [], images: [], demo_url: '', code_url: '', order_index: 0 });
        // Clear draft for this id if existed
        if (apiProj?.project_id) {
          setDraftProjects(prev => ({ ...prev, [apiProj.project_id]: apiProj }));
        }
        queryClient.invalidateQueries({ queryKey: ['api', 'sites', site_id, 'projects'] });
      },
    },
  });

  // Update Project Mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (payload: Partial<Project> & { id?: string }) => {
      // API expects: PUT /api/sites/{site_id}/projects/{project_id}
      const project_id = payload.id;
      const resp = await axios.put(
        `${API_BASE}/api/sites/${site_id}/projects/${project_id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return resp.data;
    },
    {
      onSuccess: (data) => {
        const apiProj: Project = (data?.data ?? data) as Project;
        if (apiProj) {
          update_project(apiProj);
          setDraftProjects(prev => ({
            ...prev,
            [apiProj.project_id]: apiProj,
          }));
          queryClient.invalidateQueries({ queryKey: ['api', 'sites', site_id, 'projects'] });
        }
      },
    },
  });

  // Delete Project Mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (payload: { site_id: string; project_id: string }) => {
      const resp = await axios.delete(
        `${API_BASE}/api/sites/${payload.site_id}/projects/${payload.project_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return resp.data;
    },
      onSuccess: (data) => {
        const removed = (data?.data ?? data) as Project;
        if (removed?.project_id) {
          delete_project(removed.project_id);
          setDraftProjects(prev => {
            const next = { ...prev };
            delete next[removed.project_id];
            return next;
          });
          queryClient.invalidateQueries({ queryKey: ['api', 'sites', site_id, 'projects'] });
        }
      },
    },
  });

  // Helpers: update local draft for a project
  const updateDraft = (project_id: string, patch: Partial<Project>) => {
    setDraftProjects(prev => {
      const base = prev[project_id] || projects.find(p => p.project_id === project_id) || ({} as Project);
      const next = { ...base, ...patch };
      return { ...prev, [project_id]: next as Project };
    });
  };

  // Derived view: filtered/sorted list
  const visibleProjects: Project[] = useMemo(() => {
    const base = (projects ?? []).filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags?.join(',') ?? '').toLowerCase().includes(q)
      );
    });
    const sorted = base.slice().sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'date') return (new Date(a.date).getTime()) - (new Date(b.date).getTime());
      // default by order_index
      return (a.order_index ?? 0) - (b.order_index ?? 0);
    });
    return sorted;
  }, [projects, searchQuery, sortBy]);

  // Gate: publish requires at least hero or a notable project
  const siteTitle = useAppStore(state => state.portfolio_site_state.site_title);
  const hasNotableProjectOrHero = useMemo(() => {
    const hasHero = !!siteTitle && siteTitle.trim().length > 0;
    // hero_text notion is tagline; check if exists
    const tagline = useAppStore(state => state.portfolio_site_state.tagline);
    const hasHeroText = !!tagline && tagline.trim().length > 0;
    const hasProject = (projects ?? []).length > 0;
    return hasHeroText || hasHero || hasProject;
  }, [siteTitle, projects]);

  // Local small UX: loading indicator for mutations
  const isAnyMutating =
    createProjectMutation.isPending || updateProjectMutation.isPending || deleteProjectMutation.isPending;

  // UI render
  return (
    <>
      <section aria-label="Projects Editor" className="w-full p-4">
        <div className="bg-white shadow rounded-xl p-6">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Projects Editor</h2>
              <span className="text-sm text-gray-500">(manage portfolio projects for current site)</span>
            </div>
            <div className="flex items-center space-x-3">
              <Link to="/dashboard/assets" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                Assets
              </Link>
              <Link to="/dashboard/preview" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                Preview
              </Link>
            </div>
          </header>

          {/* Quick gating / publish readiness hint */}
          {!hasNotableProjectOrHero && (
            <div role="status" aria-live="polite" className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-md">
              <p className="text-sm text-yellow-700">
                Publish is disabled until you add at least one hero text or a notable project.
              </p>
            </div>
          )}

          {/* New project creator */}
          <div className="border border-dashed border-gray-200 rounded-lg p-4 mb-6" aria-label="Create new project">
            <div className="flex flex-col md:flex-row md:items-end md:gap-4">
              <div className="flex-1 mb-2 md:mb-0">
                <label className="block text-sm font-medium text-gray-700" htmlFor="new-title">
                  New Project Title
                </label>
                <input
                  id="new-title"
                  type="text"
                  placeholder="e.g., Amazing UI for XYZ"
                  value={newProject.title ?? ''}
                  onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="new-desc">
                  Description
                </label>
                <input
                  id="new-desc"
                  type="text"
                  placeholder="Short description"
                  value={newProject.description ?? ''}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="new-date">
                  Date
                </label>
                <input
                  id="new-date"
                  type="date"
                  value={newProject.date ?? ''}
                  onChange={(e) => setNewProject(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="self-end">
                <button
                  onClick={() => {
                    // basic validation
                    if (!newProject.title || !newProject.description) return;
                    const payload: Partial<Project> = {
                      site_id: site_id,
                      title: newProject.title,
                      description: newProject.description,
                      date: newProject.date ?? '',
                      tags: (newProject.tags as string[]) ?? [],
                      demo_url: newProject.demo_url ?? null,
                      code_url: newProject.code_url ?? null,
                      images: (newProject.images as string[]) ?? [],
                      order_index: newProject.order_index ?? projects.length,
                    };
                    createProjectMutation.mutate(payload);
                  }}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                  aria-label="Create project"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending ? 'Adding...' : 'Add Project'}
                </button>
              </div>
            </div>

            {/* Optional extra fields for new project */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="new-tags">
                  Tags (comma separated)
                </label>
                <input
                  id="new-tags"
                  type="text"
                  placeholder="design, frontend, react"
                  value={(newProject.tags ?? []).join(', ')}
                  onChange={(e) =>
                    setNewProject(prev => ({
                      ...prev,
                      tags: e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0),
                    }))
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="new-images">
                  Images (URLs, max 5)
                </label>
                <input
                  id="new-images"
                  type="text"
                  placeholder="https://.../image1.jpg, https://.../image2.png"
                  value={(newProject.images ?? []).join(', ')}
                  onChange={(e) =>
                    setNewProject(prev => ({
                      ...prev,
                      images: e.target.value
                        .split(',')
                        .map(u => u.trim())
                        .filter(u => u.length > 0)
                        .slice(0, 5),
                    }))
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* Projects list header controls */}
          <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600" id="search-label">Search</span>
              <input
                aria-label="Search projects"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, description, or tag"
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex items-center space-x-3 mt-3 md:mt-0">
              <span className="text-sm text-gray-600" id="sort-label">Sort by</span>
              <select
                aria-label="Sort projects"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="order_index">Order</option>
                <option value="title">Title</option>
                <option value="date">Date</option>
              </select>
            </div>
          </div>

          {/* Projects List */}
          <div className="grid grid-cols-1 gap-6" aria-label="Projects list">
            {visibleProjects.map((p, idx) => {
              const draft = draftProjects[p.project_id] ?? p;
              const canSave = true; // Enable save for each row when editing
              // Local editing fields
              const localTitle = draft.title ?? '';
              const localDesc = draft.description ?? '';
              const localDate = draft.date ?? '';
              const localTags = draft.tags ?? [];
              const localDemo = draft.demo_url ?? '';
              const localCode = draft.code_url ?? '';
              const localImages = draft.images ?? [];
              const localOrder = draft.order_index ?? p.order_index ?? idx;

              // Update draft on change
              const onChangeField = (field: keyof Project, value: any) => {
                updateDraft(p.project_id, { [field]: value } as Partial<Project>);
              };

              // Save updated project
              const onSave = () => {
                const updated = draft;
                // Build payload per API contract
                const payload: any = {
                  id: updated.project_id,
                  site_id: site_id,
                  title: updated.title,
                  description: updated.description,
                  date: updated.date,
                  tags: updated.tags,
                  demo_url: updated.demo_url,
                  code_url: updated.code_url,
                  images: updated.images,
                  order_index: updated.order_index,
                };
                updateProjectMutation.mutate(payload);
              };

              // Delete project
              const onDelete = () => {
                if (!p.project_id) return;
                deleteProjectMutation.mutate({ site_id, project_id: p.project_id });
              };

              // Up / Down reordering (basic local UX; updates order_index)
              const moveUp = () => {
                if (idx <= 0) return;
                const swapWith = visibleProjects[idx - 1];
                // swap order_index in draft
                const newA = { ...draft, order_index: swapWith.order_index };
                const newB = { ...swapWith, order_index: draft.order_index };
                updateDraft(p.project_id, { order_index: newA.order_index });
                // naive: reflect in store by swapping local drafts; rely on server save to finalize
                // We just trigger a quick update by mutating the draft and letting user press Save
              };

              const moveDown = () => {
                if (idx >= visibleProjects.length - 1) return;
                const swapWith = visibleProjects[idx + 1];
                const newA = { ...draft, order_index: swapWith.order_index };
                const newB = { ...swapWith, order_index: draft.order_index };
                updateDraft(p.project_id, { order_index: newA.order_index });
              };

              return (
                <div key={p.project_id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm" role="region" aria-label={`Project ${p.title}`}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`title-${p.project_id}`}>
                        Title
                      </label>
                      <input
                        id={`title-${p.project_id}`}
                        type="text"
                        value={localTitle}
                        onChange={(e) => {
                          onChangeField('title', e.target.value);
                          // reflect in draft as well
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, title: e.target.value },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project title"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`date-${p.project_id}`}>
                        Date
                      </label>
                      <input
                        id={`date-${p.project_id}`}
                        type="date"
                        value={localDate}
                        onChange={(e) => {
                          onChangeField('date', e.target.value);
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, date: e.target.value },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project date"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`order-${p.project_id}`}>
                        Order
                      </label>
                      <input
                        id={`order-${p.project_id}`}
                        type="number"
                        value={localOrder}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          onChangeField('order_index', val);
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, order_index: val },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project order index"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`desc-${p.project_id}`}>
                        Description
                      </label>
                      <textarea
                        id={`desc-${p.project_id}`}
                        rows={3}
                        value={localDesc}
                        onChange={(e) => {
                          onChangeField('description', e.target.value);
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, description: e.target.value },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project description"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`tags-${p.project_id}`}>
                        Tags (comma separated)
                      </label>
                      <input
                        id={`tags-${p.project_id}`}
                        type="text"
                        value={(localTags ?? []).join(', ')}
                        onChange={(e) => {
                          const parts = e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
                          onChangeField('tags', parts);
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, tags: parts },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project tags"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`images-${p.project_id}`}>
                        Images (URLs)
                      </label>
                      <input
                        id={`images-${p.project_id}`}
                        type="text"
                        placeholder="Comma-separated image URLs"
                        value={(localImages ?? []).join(', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(',').map(u => u.trim()).filter(u => u.length > 0);
                          onChangeField('images', arr);
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, images: arr },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project images"
                      />
                      <p className="text-xs text-gray-500 mt-1" aria-live="polite">
                        Max 5 images. Add image URLs separated by commas.
                      </p>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`demo-${p.project_id}`}>
                        Demo URL
                      </label>
                      <input
                        id={`demo-${p.project_id}`}
                        type="url"
                        value={localDemo ?? ''}
                        onChange={(e) => {
                          onChangeField('demo_url', e.target.value);
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, demo_url: e.target.value },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project demo URL"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700" htmlFor={`code-${p.project_id}`}>
                        Code URL
                      </label>
                      <input
                        id={`code-${p.project_id}`}
                        type="url"
                        value={localCode ?? ''}
                        onChange={(e) => {
                          onChangeField('code_url', e.target.value);
                          setDraftProjects(prev => ({
                            ...prev,
                            [p.project_id]: { ...draft, code_url: e.target.value },
                          }));
                        }}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                        aria-label="Project code URL"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      <span>Created: {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</span>
                      <span className="mx-3">Updated: {p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={onSave}
                        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        aria-label={`Save project ${p.title}`}
                        disabled={updateProjectMutation.isPending || isAnyMutating}
                      >
                        Save
                      </button>
                      <button
                        onClick={onDelete}
                        className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                        aria-label={`Delete project ${p.title}`}
                        disabled={deleteProjectMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {visibleProjects.length === 0 && (
              <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
                No projects yet. Add one above to get started.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Simple footer-like action row (optional) */}
      <section aria-label="Publish gating note" className="p-4">
        <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-700">
            Note: Publishing requires at least one hero/description and a minimum set of projects as outlined in the FRD.
            Use the Publish view to start hosting; this editor focuses on content management.
          </p>
        </div>
      </section>

      {/* Loading / error indicators for UI actions (non-blocking) */}
      {(isLoadingProjects || createProjectMutation.isPending || updateProjectMutation.isPending || deleteProjectMutation.isPending) && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg" aria-live="polite">
          Saving...
        </div>
      )}
      {isProjectsError && (
        <div role="status" aria-live="polite" className="sr-only">
          Something went wrong loading projects.
        </div>
      )}
    </>
  );
};

export default UV_ProjectsEditor;
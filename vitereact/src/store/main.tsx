import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// API base
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';

// Type Definitions (snake_case naming)
export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface ImageAsset {
  image_id: string;
  site_id?: string | null;
  project_id?: string | null;
  url: string;
  alt_text?: string | null;
  uploaded_at?: string;
}

export interface Project {
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
}

export interface Site {
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
}

export type PublishStatus = 'idle' | 'provisioning' | 'ready' | 'failed' | 'success';

interface AuthenticationState {
  current_user: User | null;
  auth_token: string | null;
  authentication_status: {
    is_authenticated: boolean;
    is_loading: boolean;
  };
  error_message: string | null;
}

export interface AppState {
  // Global state
  authentication_state: AuthenticationState;
  portfolio_site_state: Site;
  projects: Project[];
  assets: ImageAsset[];

  theme: {
    template_id: string;
    primary_color: string;
    font_family: string;
    is_dark_mode: boolean;
  };

  seo: {
    seo_title: string;
    seo_description: string;
  };

  ui: {
    is_loading: boolean;
    error: string | null;
    preview_debounce_ms: number;
    publish_status: PublishStatus;
    preview_url: string | null;
  };

  export_state: {
    export_zip_url: string | null;
    export_path: string | null;
    is_export_ready: boolean;
  };

  navigation_state: {
    active_view_id: string;
  };

  // Realtime (optional)
  socket?: Socket | undefined;

  // Actions
  login_user: (email: string, password: string) => Promise<void>;
  logout_user: () => void;
  register_user: (full_name: string, email: string, password: string) => Promise<void>;
  initialize_auth: () => Promise<void>;
  update_user_profile: (userData: Partial<User>) => void;

  // Portfolio/site helpers
  set_site: (site: Site) => void;
  set_projects: (projects: Project[]) => void;
  add_project: (p: Project) => void;
  update_project: (p: Project) => void;
  delete_project: (project_id: string) => void;

  set_assets: (assets: ImageAsset[]) => void;
  upload_asset: (a: ImageAsset) => void;
  update_asset: (a: ImageAsset) => void;
  delete_asset: (image_id: string) => void;

  set_preview_url: (url: string | null) => void;
  set_publish_status: (status: PublishStatus) => void;

  // Real-time lifecycle
  init_realtime: () => void;
  close_realtime: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial global state
      authentication_state: {
        current_user: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: false,
        },
        error_message: null,
      },
      portfolio_site_state: {
        site_id: '',
        user_id: '',
        site_title: '',
        tagline: null,
        hero_image_url: null,
        about_text: null,
        template_id: null,
        primary_color: null,
        font_family: null,
        is_dark_mode: false,
        seo_title: null,
        seo_description: null,
        subdomain: null,
        published_at: null,
        export_zip_url: null,
      },
      projects: [],
      assets: [],

      theme: {
        template_id: 'template_A',
        primary_color: '#4F46E5',
        font_family: 'Inter',
        is_dark_mode: false,
      },

      seo: {
        seo_title: '',
        seo_description: '',
      },

      ui: {
        is_loading: false,
        error: null,
        preview_debounce_ms: 250,
        publish_status: 'idle',
        preview_url: null,
      },

      export_state: {
        export_zip_url: null,
        export_path: null,
        is_export_ready: false,
      },

      navigation_state: {
        active_view_id: 'UV_Dashboard',
      },

      socket: undefined,

      // Actions

      login_user: async (email: string, password: string) => {
        // lightweight loading state
        set((state) => ({
          ui: { ...state.ui, is_loading: true, error: null },
        }));
        try {
          const response = await axios.post(
            `${API_BASE}/api/auth/login`,
            { email, password },
            { headers: { 'Content-Type': 'application/json' } }
          );

          // Normalize payload shapes to snake_case keys
          const data = response.data?.data ?? response.data ?? {};
          const user: User | null = data.user ?? null;
          const token: string | null = data.token ?? null;

          set((state) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: !!user && !!token,
                is_loading: false,
              },
              error_message: null,
            },
          }));
        } catch (err: any) {
          const msg = err?.response?.data?.message || err?.message || 'Login failed';
          set((state) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: { is_authenticated: false, is_loading: false },
              error_message: msg,
            },
          }));
          throw err;
        } finally {
          set((state) => ({
            ui: { ...state.ui, is_loading: false },
          }));
        }
      },

      logout_user: () => {
        set((state) => ({
          authentication_state: {
            current_user: null,
            auth_token: null,
            authentication_status: { is_authenticated: false, is_loading: false },
            error_message: null,
          },
        }));
      },

      register_user: async (full_name: string, email: string, password: string) => {
        set((state) => ({
          ui: { ...state.ui, is_loading: true, error: null },
        }));
        try {
          const payload = {
            username: full_name,
            email,
            password_hash: password,
            full_name,
            avatar_url: '',
            is_active: true,
          };
          const response = await axios.post(`${API_BASE}/api/auth/register`, payload, {
            headers: { 'Content-Type': 'application/json' },
          });

          const data = response.data?.data ?? response.data ?? {};
          const user: User | null = data.user ?? null;
          const token: string | null = data.token ?? null;

          set((state) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: { is_authenticated: !!user && !!token, is_loading: false },
              error_message: null,
            },
          }));
        } catch (err: any) {
          const msg = err?.response?.data?.message || err?.message || 'Registration failed';
          set((state) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: { is_authenticated: false, is_loading: false },
              error_message: msg,
            },
          }));
          throw err;
        } finally {
          set((state) => ({
            ui: { ...state.ui, is_loading: false },
          }));
        }
      },

      initialize_auth: async () => {
        // Start with persisted values via persist; ensure UI reflects authentication state
        const token = get().authentication_state.auth_token;
        const user = get().authentication_state.current_user;

        // If token and/or user exist, consider them as authenticated (derived in UI)
        if (token && user) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: { is_authenticated: true, is_loading: false },
            },
          }));
          return;
        }

        // If token exists but no user, attempt lightweight verify (best-effort; may rely on backend)
        if (token && !user) {
          // Attempt a lightweight fetch if endpoint exists; otherwise just mark not authenticated gracefully
          try {
            // No hard requirement to call a specific endpoint; keep safe
            // Example optional call (uncomment if backend provides a verify/me endpoint)
            // const resp = await axios.get(`${API_BASE}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}` } });
            // const u = resp.data?.data?.user ?? resp.data?.user;
            // set authentication_state accordingly if available
            set((state) => ({
              authentication_state: {
                current_user: null,
                auth_token: token,
                authentication_status: { is_authenticated: false, is_loading: false },
                error_message: null,
              },
            }));
          } catch {
            set((state) => ({
              authentication_state: {
                current_user: null,
                auth_token: token,
                authentication_status: { is_authenticated: false, is_loading: false },
                error_message: null,
              },
            }));
          }
          return;
        }

        // No token
        set((state) => ({
          authentication_state: {
            current_user: null,
            auth_token: null,
            authentication_status: { is_authenticated: false, is_loading: false },
            error_message: null,
          },
        }));
      },

      update_user_profile: (userData) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            current_user: {
              ...(state.authentication_state.current_user || ({} as User)),
              ...(userData as User),
            },
          },
        }));
      },

      set_site: (site) => set((state) => ({
        portfolio_site_state: site,
      })),

      set_projects: (projects) => set((state) => ({
        projects: projects,
      })),

      add_project: (p) => set((state) => ({
        projects: [...state.projects, p],
      })),

      update_project: (p) => set((state) => {
        const idx = state.projects.findIndex((proj) => proj.project_id === p.project_id);
        if (idx >= 0) {
          const next = [...state.projects];
          next[idx] = p;
          return { projects: next };
        }
        return {};
      }),

      delete_project: (project_id) => set((state) => ({
        projects: state.projects.filter((pr) => pr.project_id !== project_id),
      })),

      set_assets: (assets) => set((state) => ({
        assets,
      })),

      upload_asset: (a) => set((state) => ({
        assets: [...state.assets, a],
      })),

      update_asset: (a) => set((state) => ({
        assets: state.assets.map((it) => (it.image_id === a.image_id ? a : it)),
      })),

      delete_asset: (image_id) => set((state) => ({
        assets: state.assets.filter((a) => a.image_id !== image_id),
      })),

      set_preview_url: (url) => set((state) => ({
        ui: { ...state.ui, preview_url: url ?? null },
      })),

      set_publish_status: (status) => set((state) => ({
        ui: { ...state.ui, publish_status: status },
      })),

      init_realtime: () => {
        const token = get().authentication_state.auth_token;
        if (!token) return;
        if (get().socket) return;

        const socket = io(API_BASE, {
          autoConnect: true,
          auth: { token },
        } as any);

        set({ socket });

        socket.on('connect', () => {
          // connected
        });

        socket.on('project_updated', (payload: any) => {
          const { project_id, site_id } = payload;
          const current_site_id = get().portfolio_site_state.site_id;
          if (site_id && current_site_id && site_id !== current_site_id) return;

          set((state) => {
            const idx = state.projects.findIndex((p) => p.project_id === project_id);
            if (idx >= 0) {
              const next = [...state.projects];
              next[idx] = { ...(state.projects[idx]), ...payload };
              return { projects: next };
            } else {
              const newProj = payload as Project;
              return { projects: [...state.projects, newProj] };
            }
          });
        });

        socket.on('site_published', (payload: any) => {
          const { site_id, published_at, subdomain } = payload;
          const current_site_id = get().portfolio_site_state.site_id;
          if (site_id && current_site_id && site_id === current_site_id) {
            set((state) => ({
              portfolio_site_state: {
                ...state.portfolio_site_state,
                published_at: published_at ?? state.portfolio_site_state.published_at,
                subdomain: subdomain ?? state.portfolio_site_state.subdomain,
              },
            }));
          }
        });

        socket.on('export_ready', (payload: any) => {
          const { export_zip_url, export_path } = payload;
          set((state) => ({
            export_state: {
              export_zip_url: export_zip_url ?? state.export_state.export_zip_url,
              export_path: export_path ?? state.export_state.export_path,
              is_export_ready: true,
            },
          }));
        });
      },

      close_realtime: () => {
        const sock = get().socket;
        if (sock) {
          sock.disconnect();
          set({ socket: undefined });
        }
      },
    }),
    {
      name: 'portfoliopro-store',
      partialize: (state) => ({
        authentication_state: {
          current_user: state.authentication_state.current_user,
          auth_token: state.authentication_state.auth_token,
          authentication_status: {
            is_authenticated: state.authentication_state.authentication_status.is_authenticated,
            is_loading: false,
          },
          error_message: null,
        },
        portfolio_site_state: {
          site_id: state.portfolio_site_state.site_id,
          user_id: state.portfolio_site_state.user_id,
          site_title: state.portfolio_site_state.site_title,
          tagline: state.portfolio_site_state.tagline,
          hero_image_url: state.portfolio_site_state.hero_image_url,
          about_text: state.portfolio_site_state.about_text,
          template_id: state.portfolio_site_state.template_id,
          primary_color: state.portfolio_site_state.primary_color,
          font_family: state.portfolio_site_state.font_family,
          is_dark_mode: state.portfolio_site_state.is_dark_mode,
          seo_title: state.portfolio_site_state.seo_title,
          seo_description: state.portfolio_site_state.seo_description,
          subdomain: state.portfolio_site_state.subdomain,
          published_at: state.portfolio_site_state.published_at,
          export_zip_url: state.portfolio_site_state.export_zip_url,
        },
        // Arrays (projects/assets) intentionally not deeply persisted to simplify MVP fidelity
      }),
    }
  )
);
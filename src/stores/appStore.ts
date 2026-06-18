// ════════════════════════════════════════════════════════════════════════════
// LEMISPHERE — APP STORE (Global state)
// Sidebar, theme, active module, sync status, device ID
// ════════════════════════════════════════════════════════════════════════════
'use client';

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ModuleId, SyncState, DashboardWidget } from '@/types';
import { getDeviceId, generateId } from '@/utils';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase/client';
import { syncManager } from '@/lib/sync/SyncManager';

const pushPreferencesToDexie = async (state: AppState) => {
  if (!state.userId) return;
  const prefId = state.userId;
  
  const existing = await db.user_preferences.get(prefId);
  const prefs = {
    ...existing,
    id: prefId,
    user_id: state.userId,
    dashboard_layout: state.dashboardLayout,
    quick_nav_order: state.quickNavOrder,
    hidden_quick_nav: state.hiddenQuickNav,
    monitored_habit_id: state.monitoredHabitId,
    sync_status: 'pending',
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: (existing?.version || 0) + 1,
    device_id: state.deviceId || 'browser'
  };

  await db.user_preferences.put(prefs as any);
  syncManager.queueSync('dashboard');
};

interface AppState {
  // ── Identity ───────────────────────────────────────────────────────────
  deviceId: string;
  userId: string | null;
  username: string | null;
  profilePicture: string | null;
  isAuthenticated: boolean;

  // ── Preferences ─────────────────────────────────────────────────────────
  sidebarCollapsed: boolean;
  activeModule: ModuleId;
  dashboardLayout: DashboardWidget[];
  quickNavOrder: string[];
  hiddenQuickNav: string[];
  showTodoBubble: boolean;
  monitoredHabitId: string | null;

  // ── Sync ─────────────────────────────────────────────────────────────────
  sync: SyncState;

  // ── Command Palette ───────────────────────────────────────────────────────
  commandPaletteOpen: boolean;
}

interface AppActions {
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setActiveModule: (module: ModuleId) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setDashboardLayout: (layout: DashboardWidget[]) => void;
  setQuickNavOrder: (order: string[]) => void;
  toggleQuickNavVisibility: (key: string) => void;
  setShowTodoBubble: (show: boolean) => void;
  setMonitoredHabitId: (id: string | null) => void;
  setSyncState: (sync: Partial<SyncState>) => void;
  setUser: (userId: string | null, username: string | null) => void;
  setProfilePicture: (pic: string | null) => void;
  initDeviceId: () => void;
  
  // ── Auth (Supabase) ───────────────────────────────────────────────────
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  recoverSession: () => Promise<void>;
}

const defaultDashboardLayout: DashboardWidget[] = [
  { id: 'habit-streak', type: 'habit-streak',   position: 1, width: 'third', height: 'tall', visible: true },
  { id: 'goal-progress', type: 'goal-progress', position: 2, width: 'two-thirds', height: 'standard', visible: true },
  { id: 'fitness-today', type: 'fitness-today', position: 3, width: 'third', height: 'standard', visible: true },
  { id: 'gaming-now', type: 'gaming-now',       position: 4, width: 'third', height: 'standard', visible: true },

];

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ── State ──────────────────────────────────────────────────────────
        deviceId: '',
        userId: null,
        username: null,
        profilePicture: null,
        isAuthenticated: false,
        sidebarCollapsed: false,
        activeModule: 'dashboard',
        dashboardLayout: defaultDashboardLayout,
        quickNavOrder: ['fitness', 'goals', 'habits', 'gaming'],
        hiddenQuickNav: [],
        showTodoBubble: false,
        monitoredHabitId: null,
        commandPaletteOpen: false,
        sync: {
          isOnline: true,
          isSyncing: false,
          lastSyncAt: undefined,
          pendingChanges: 0,
          syncError: undefined,
        },

        // ── Actions ────────────────────────────────────────────────────────
        setSidebarCollapsed: (collapsed) =>
          set((state) => { state.sidebarCollapsed = collapsed; }),

        toggleSidebar: () =>
          set((state) => { state.sidebarCollapsed = !state.sidebarCollapsed; }),

        setActiveModule: (module) =>
          set((state) => { state.activeModule = module; }),

        setCommandPaletteOpen: (open) =>
          set((state) => { state.commandPaletteOpen = open; }),

        toggleCommandPalette: () =>
          set((state) => { state.commandPaletteOpen = !state.commandPaletteOpen; }),

        setDashboardLayout: (layout) => {
          set((state) => { state.dashboardLayout = layout; });
          pushPreferencesToDexie(get());
        },

        setQuickNavOrder: (order) => {
          set((state) => { state.quickNavOrder = order; });
          pushPreferencesToDexie(get());
        },

        toggleQuickNavVisibility: (key) => {
          set((state) => {
            if (state.hiddenQuickNav.includes(key)) {
              state.hiddenQuickNav = state.hiddenQuickNav.filter(k => k !== key);
            } else {
              state.hiddenQuickNav.push(key);
            }
          });
          pushPreferencesToDexie(get());
        },

        setShowTodoBubble: (show) =>
          set((state) => { state.showTodoBubble = show; }),

        setMonitoredHabitId: (id) => {
          set((state) => { state.monitoredHabitId = id; });
          pushPreferencesToDexie(get());
        },

        setSyncState: (sync) =>
          set((state) => { state.sync = { ...state.sync, ...sync }; }),

        setUser: (userId, username) =>
          set((state) => {
            state.userId = userId;
            state.username = username;
            state.isAuthenticated = !!userId;
          }),

        setProfilePicture: (pic) =>
          set((state) => { state.profilePicture = pic; }),

        initDeviceId: () =>
          set((state) => {
            if (!state.deviceId) {
              state.deviceId = getDeviceId();
            }
          }),

        login: async (emailOrUsername, pass) => {
          const cleanUsername = emailOrUsername.trim();
          const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername.replace(/[^a-zA-Z0-9]/g, '')}@example.com`;
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: pass,
          });

          if (error) {
            throw new Error(error.message);
          }

          set((state) => {
            state.isAuthenticated = true;
            state.username = data.user.user_metadata?.username || email.split('@')[0];
            state.userId = data.user.id;
          });
        },

        signup: async (emailOrUsername, pass, name) => {
          if (!emailOrUsername || !pass || !name) throw new Error('All fields required');
          
          const cleanUsername = emailOrUsername.trim();
          const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername.replace(/[^a-zA-Z0-9]/g, '')}@example.com`;
          const { data, error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: {
              data: {
                username: name,
              }
            }
          });

          if (error) {
            throw new Error(error.message);
          }

          set((state) => {
            state.isAuthenticated = true;
            state.username = name;
            state.userId = data.user?.id || null;
          });
        },

        logout: async () => {
          // Pause sync to prevent it from interfering with the wipe
          const { syncManager } = await import('@/lib/sync/SyncManager');
          syncManager.pause();
          
          await supabase.auth.signOut();
          
          set((state) => {
            state.isAuthenticated = false;
            state.userId = null;
            state.username = null;
            state.profilePicture = null;
          });

          // Wipe local database to guarantee cross-account isolation
          await db.delete();
          window.location.href = '/login';
        },

        recoverSession: async () => {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error recovering session:', error);
            return;
          }
          if (session) {
            set((state) => {
              state.isAuthenticated = true;
              state.username = session.user.user_metadata?.username || session.user.email?.split('@')[0];
              state.userId = session.user.id;
            });
          } else {
            set((state) => {
              state.isAuthenticated = false;
              state.userId = null;
              state.username = null;
            });
          }
        },
      })),
      {
        name: 'lemisphere-app',
        // Only persist preferences, not transient state
        partialize: (state) => ({
          deviceId: state.deviceId,
          userId: state.userId,
          username: state.username,
          isAuthenticated: state.isAuthenticated,
          sidebarCollapsed: state.sidebarCollapsed,
          activeModule: state.activeModule,
          dashboardLayout: state.dashboardLayout,
          quickNavOrder: state.quickNavOrder,
          hiddenQuickNav: state.hiddenQuickNav,
          showTodoBubble: state.showTodoBubble,
          monitoredHabitId: state.monitoredHabitId,
        }),
      }
    ),
    { name: 'AppStore' }
  )
);

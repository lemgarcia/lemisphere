// ════════════════════════════════════════════════════════════════════════════
// LEMISPHERE — SHARED BASE TYPES
// All records include sync metadata fields for Supabase-readiness
// ════════════════════════════════════════════════════════════════════════════

/** Sync status for any record */
export type SyncStatus = 'local' | 'synced' | 'pending' | 'conflict' | 'error';

/** Base record included on every stored entity */
export interface BaseRecord {
  id: string;
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
  version: number;          // incremented on every local write
  device_id: string;        // which device last wrote this
  sync_status: SyncStatus;
  synced_at?: string;       // ISO 8601 — when last synced to cloud
  user_id?: string;         // Supabase user ID (set when authenticated)
}

/** Module identifiers */
export type ModuleId =
  | 'dashboard'
  | 'fitness'
  | 'gaming'
  | 'budgie'
  | 'habits'
  | 'goals';

/** Sidebar nav item */
export interface NavItem {
  id: ModuleId;
  label: string;
  href: string;
  icon: string;             // Emoji icon for now
  accentColor: string;
}

/** Widget types for dashboard */
export type WidgetType =
  | 'quick-stats'
  | 'stat-streak'
  | 'stat-exp'
  | 'stat-consistency'
  | 'stat-progress'
  | 'habit-streak'
  | 'goal-progress'
  | 'fitness-ring'
  | 'fitness-today'
  | 'gaming-now'
  | 'budgie-status'
  | 'daily-progress';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  position: number;         // sort order
  width: 'half' | 'full' | 'third' | 'quarter' | 'two-thirds';
  height: 'short' | 'standard' | 'tall';
  visible: boolean;
}

/** User preferences */
export interface UserPreferences {
  theme: 'system' | 'light' | 'dark';
  sidebarCollapsed: boolean;
  dashboardLayout: DashboardWidget[];
  activeModule: ModuleId;
  accentColor: string;
}

/** App sync state */
export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: string;
  pendingChanges: number;
  syncError?: string;
}

/** Command palette action */
export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string[];
  category: string;
  onSelect: () => void;
}

/** Recurrence options for events */
export type RepeatFrequency = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

/** Weekly Routine item or Event */
export interface RoutineItem extends BaseRecord {
  day: string;
  date?: string;
  time: string;
  activity: string;
  type: string;
  notes?: string;
  repeat?: RepeatFrequency;
  remind_at?: string; // ISO string of reminder time
  event_notified?: boolean; // Flag to indicate if the actual event has been notified
}

import { db } from '../db';
import { useAppStore } from '@/stores/appStore';
import type { ModuleId } from '@/types';
import { supabase } from '../supabase/client';
import { Table } from 'dexie';

// ═══════════════════════════════════════════════════════════════════
// DATA LOSS PREVENTION CONSTANTS
// ═══════════════════════════════════════════════════════════════════

// Max deletions allowed per table in a single sync cycle.
// If more than this are queued, something is wrong — skip and warn.
const MAX_DELETIONS_PER_TABLE = 500;

// If the local DB has 0 records for a table, we ONLY pull from Supabase.
// We never push "nothing" or delete anything — that would wipe the cloud.
// This protects against: browser cache clear, db.delete(), import wipe, etc.

// ═══════════════════════════════════════════════════════════════════
// FIELD SANITIZATION
// ═══════════════════════════════════════════════════════════════════

// Whitelist of columns that exist in the Supabase schema.
// Only these fields will be sent to the cloud, preventing "column not found" errors.
const ALLOWED_COLUMNS_PER_TABLE: Record<string, string[]> = {
  fitness_programs: ['id', 'user_id', 'name', 'target_sets', 'current_set', 'status', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  fitness_program_days: ['id', 'user_id', 'program_id', 'name', 'order', 'linked_goal_id', 'linked_milestone_id', 'linked_task_id', 'linked_task_name', 'sync_direction', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  fitness_exercises: ['id', 'user_id', 'program_day_id', 'name', 'sets', 'target_reps', 'rest_sec', 'muscle_group', 'order', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  workout_logs: ['id', 'user_id', 'program_id', 'program_day_id', 'set_number', 'date', 'completed', 'duration', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  workout_exercise_logs: ['id', 'user_id', 'workout_log_id', 'exercise_id', 'weight', 'completed', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  body_metrics: ['id', 'user_id', 'date', 'weight', 'notes', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  
  game_series: ['id', 'user_id', 'name', 'description', 'cover_url', 'is_favorite', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  games: ['id', 'user_id', 'title', 'series_id', 'platform', 'status', 'cover_url', 'genre', 'release_year', 'chronological_order', 'personal_rating', 'notes', 'links', 'pardon_reason', 'gp_earned', 'started_at', 'completed_at', 'hours_played', 'is_favorite', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  game_sessions: ['id', 'user_id', 'game_id', 'date', 'duration', 'notes', 'gp_gained', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  gp_transactions: ['id', 'user_id', 'game_id', 'amount', 'reason', 'type', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  
  habits: ['id', 'user_id', 'name', 'description', 'icon', 'color', 'frequency', 'frequency_days', 'target_count', 'category', 'is_active', 'streak_current', 'streak_best', 'sort_order', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  habit_completions: ['id', 'user_id', 'habit_id', 'date', 'count', 'notes', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  skills: ['id', 'user_id', 'name', 'category', 'level', 'xp', 'notes', 'description', 'status', 'checklist', 'links', 'icon', 'sort_order', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  skill_entries: ['id', 'user_id', 'skill_id', 'date', 'xp_gained', 'notes', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  
  goals: ['id', 'user_id', 'title', 'description', 'category', 'status', 'progress', 'is_auto_progress', 'target_date', 'milestones', 'icon', 'color', 'reward', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  todos: ['id', 'user_id', 'text', 'is_completed', 'position', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  calendar_events: ['id', 'user_id', 'day', 'date', 'time', 'activity', 'type', 'notes', 'repeat', 'remind_at', 'event_notified', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
  user_preferences: ['id', 'user_id', 'dashboard_layout', 'quick_nav_order', 'hidden_quick_nav', 'budgie_food_rotation', 'budgie_daily_routine', 'monitored_habit_id', 'version', 'device_id', 'sync_status', 'created_at', 'updated_at'],
};

const DEFAULTS_PER_TABLE: Record<string, Record<string, unknown>> = {
  games: { gp_earned: 0, hours_played: 0 },
  game_sessions: { duration: 0 },
  fitness_programs: { target_sets: 1, current_set: 1 },
  fitness_program_days: { order: 0 },
  fitness_exercises: { sets: '3', target_reps: '10', rest_sec: 60, order: 0 },
  workout_logs: { date: '', set_number: 1, completed: false },
  workout_exercise_logs: { weight: 0, completed: false },
  habits: { icon: '', color: '#8b5cf6', frequency: 'daily', target_count: 1, category: 'other', is_active: true, streak_current: 0, streak_best: 0 },
  habit_completions: { date: '', count: 1 },
  skills: { level: 'beginner', xp: 0, status: 'learning', checklist: [], category: 'Technical' },
  skill_entries: { date: '', xp_gained: 0 },
  goals: { category: 'other', status: 'active', progress: 0, is_auto_progress: false, milestones: [] },
  todos: { text: '', is_completed: false, position: 0 },
  calendar_events: { day: '', time: '', activity: '', type: '', event_notified: false },
  user_preferences: { dashboard_layout: [], quick_nav_order: [], hidden_quick_nav: [], budgie_food_rotation: [], budgie_daily_routine: [] },
};

function sanitizeRecord(record: any, tableName: string, userId: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  // Only copy allowed columns
  const allowed = ALLOWED_COLUMNS_PER_TABLE[tableName] ?? [];
  for (const col of allowed) {
    if (record[col] !== undefined) {
      result[col] = record[col];
    }
  }

  // Apply defaults for missing/null required fields
  const defaults = DEFAULTS_PER_TABLE[tableName] ?? {};
  for (const [key, defaultVal] of Object.entries(defaults)) {
    if (result[key] === undefined || result[key] === null) {
      result[key] = defaultVal;
    }
  }

  // Always ensure user_id and sync_status are set
  result.user_id = userId;
  result.sync_status = 'synced';

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// SYNC MANAGER
// ═══════════════════════════════════════════════════════════════════

export class SyncManager {
  private static instance: SyncManager;
  private syncTimers: Map<ModuleId, ReturnType<typeof setTimeout>> = new Map();
  private _paused = false; // Can be paused during import/wipe operations

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /** Pause all sync operations (used during DB wipe/import) */
  public pause() {
    this._paused = true;
    this.syncTimers.forEach(timer => clearTimeout(timer));
    this.syncTimers.clear();
    console.log('[SyncManager] PAUSED — sync operations suspended.');
  }

  /** Resume sync operations */
  public resume() {
    this._paused = false;
    console.log('[SyncManager] RESUMED — sync operations active.');
  }

  public queueSync(module: ModuleId) {
    if (this._paused) return;
    if (this.syncTimers.has(module)) {
      clearTimeout(this.syncTimers.get(module)!);
    }
    this.syncTimers.set(
      module,
      setTimeout(() => this.performSync(module), 3000)
    );
  }

  /**
   * Syncs a single table. Returns true on success, false on failure.
   * 
   * DATA LOSS PREVENTION:
   * - If local table has 0 records, we ONLY pull (never push empty).
   *   This prevents cloud wipes when local DB is cleared/reset.
   */
  private async syncTable(
    dexieTable: Table<any, any>,
    supabaseTableName: string,
    userId: string,
    lastSyncAt?: string
  ): Promise<boolean> {
    try {
      const allRecords = await dexieTable.toArray();
      const userRecords = allRecords.filter(r => !r.user_id || r.user_id === userId);

      // SAFETY: If local table is empty, ONLY pull from cloud.
      // Never push 0 records — that means the local DB was wiped, not that the user deleted everything.
      if (userRecords.length === 0) {
        console.log(`[SyncManager] ${supabaseTableName}: Local empty — pull-only mode (data loss prevention).`);
        return await this.pullOnly(dexieTable, supabaseTableName, userId);
      }

      // PUSH: Only push pending or local records
      const pendingRecords = userRecords.filter(r => r.sync_status === 'pending' || r.sync_status === 'local');
      const recordsToPush = pendingRecords.map(r => sanitizeRecord(r, supabaseTableName, userId));

      if (recordsToPush.length > 0) {
        const BATCH_SIZE = 50;
        let batchFailed = false;

        for (let i = 0; i < recordsToPush.length; i += BATCH_SIZE) {
          const batch = recordsToPush.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from(supabaseTableName).upsert(batch, { onConflict: 'id' });

          if (error) {
            console.warn(`[SyncManager] Batch push failed for ${supabaseTableName}: ${error.message}. Retrying individually...`);
            batchFailed = true;
            
            // Fallback: push one by one to isolate and discard orphans
            for (const record of batch) {
              const { error: singleError } = await supabase.from(supabaseTableName).upsert(record, { onConflict: 'id' });
              if (singleError) {
                console.error(`[SyncManager] Discarding orphaned/invalid record ${record.id} in ${supabaseTableName}:`, singleError.message);
                // If it's a constraint error (orphan), delete it locally to clean up the DB
                if (singleError.code === '23503' || singleError.message.includes('Foreign key') || singleError.message.includes('not present in table')) {
                  await dexieTable.delete(record.id);
                }
              } else {
                await dexieTable.update(record.id, { sync_status: 'synced' });
              }
            }
          } else {
            // Batch succeeded, mark all as synced
            for (const record of batch) {
              await dexieTable.update(record.id, { sync_status: 'synced' });
            }
          }
        }
        
        if (batchFailed) {
          // If we had to fall back, we handled it, but let's log it.
          console.log(`[SyncManager] Individual fallback complete for ${supabaseTableName}.`);
        }
      }

      // PULL
      let query = supabase.from(supabaseTableName).select('*').eq('user_id', userId);
      if (lastSyncAt) {
        query = query.gt('updated_at', lastSyncAt);
      }

      const { data: remoteRecords, error: pullError } = await query;
      if (pullError) {
        console.error(`[SyncManager] Pull error for ${supabaseTableName}:`, pullError.message);
        return false;
      }

      if (remoteRecords && remoteRecords.length > 0) {
        const localRecords = await dexieTable.filter(r => (!r.user_id || r.user_id === userId)).toArray();
        const localRecordMap = new Map(localRecords.map(r => [r.id, r]));

        const recordsToPut = remoteRecords.map(r => ({ ...r, sync_status: 'synced' })).filter(r => {
          const local = localRecordMap.get(r.id);
          return !local || (local.sync_status !== 'pending' && local.sync_status !== 'local');
        });

        if (recordsToPut.length > 0) {
          await dexieTable.bulkPut(recordsToPut);
          
          if (supabaseTableName === 'user_preferences') {
            const latest = recordsToPut[recordsToPut.length - 1]; // Use most recent if multiple
            if (latest) {
              useAppStore.setState({
                dashboardLayout: latest.dashboard_layout || [],
                quickNavOrder: latest.quick_nav_order || [],
                hiddenQuickNav: latest.hidden_quick_nav || [],
                monitoredHabitId: latest.monitored_habit_id || null
              });
              // Update budgie store if there's budgie data
              if (latest.budgie_food_rotation || latest.budgie_daily_routine) {
                const { useBudgieStore } = require('@/stores/budgieStore');
                useBudgieStore.setState({
                  foodRotation: latest.budgie_food_rotation || [],
                  dailyRoutine: latest.budgie_daily_routine || []
                });
              }
            }
          }
        }
      }

      // DATA LOSS PREVENTION: Cross-device deletion detection
      // Fetch all remote IDs to see if any local 'synced' records were deleted on another device.
      // (Only check records belonging to this user)
      const { data: allRemoteIds } = await supabase.from(supabaseTableName).select('id').eq('user_id', userId);
      if (allRemoteIds) {
        const remoteIdSet = new Set(allRemoteIds.map(r => r.id));
        const localRecords = await dexieTable.filter(r => (!r.user_id || r.user_id === userId)).toArray();
        const idsToDelete = localRecords
          .filter(r => r.sync_status === 'synced' && !remoteIdSet.has(r.id))
          .map(r => r.id);
        
        if (idsToDelete.length > 0) {
          await dexieTable.bulkDelete(idsToDelete);
          console.log(`[SyncManager] Pruned ${idsToDelete.length} records from ${supabaseTableName} (deleted on another device)`);
        }
      }

      return true;
    } catch (e: any) {
      console.error(`[SyncManager] Unexpected error for ${supabaseTableName}:`, e?.message ?? e);
      return false;
    }
  }

  /** Pull-only mode: fetch all remote records into local DB without pushing anything. */
  private async pullOnly(
    dexieTable: Table<any, any>,
    supabaseTableName: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(supabaseTableName)
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error(`[SyncManager] Pull-only error for ${supabaseTableName}:`, error.message);
        return false;
      }

      if (data && data.length > 0) {
        await dexieTable.bulkPut(data.map(r => ({ ...r, sync_status: 'synced' })));
        console.log(`[SyncManager] Restored ${data.length} records to ${supabaseTableName} from cloud.`);

        if (supabaseTableName === 'user_preferences') {
          const latest = data[data.length - 1];
          if (latest) {
            useAppStore.setState({
              dashboardLayout: latest.dashboard_layout || [],
              quickNavOrder: latest.quick_nav_order || [],
              hiddenQuickNav: latest.hidden_quick_nav || [],
              monitoredHabitId: latest.monitored_habit_id || null
            });
            if (latest.budgie_food_rotation || latest.budgie_daily_routine) {
              const { useBudgieStore } = require('@/stores/budgieStore');
              useBudgieStore.setState({
                foodRotation: latest.budgie_food_rotation || [],
                dailyRoutine: latest.budgie_daily_routine || []
              });
            }
          }
        }
      }

      return true;
    } catch (e: any) {
      console.error(`[SyncManager] Pull-only unexpected error for ${supabaseTableName}:`, e?.message ?? e);
      return false;
    }
  }

  private getModuleTables(module: ModuleId): { dexie: Table<any, any>; supabase: string; dependsOn?: string }[] {
    switch (module) {
      case 'fitness':
        return [
          { dexie: db.body_metrics, supabase: 'body_metrics' },
          { dexie: db.fitness_programs, supabase: 'fitness_programs' },
          { dexie: db.fitness_program_days, supabase: 'fitness_program_days', dependsOn: 'fitness_programs' },
          { dexie: db.fitness_exercises, supabase: 'fitness_exercises', dependsOn: 'fitness_program_days' },
          { dexie: db.workout_logs, supabase: 'workout_logs', dependsOn: 'fitness_programs' },
          { dexie: db.workout_exercise_logs, supabase: 'workout_exercise_logs', dependsOn: 'workout_logs' },
        ];
      case 'gaming':
        return [
          { dexie: db.game_series, supabase: 'game_series' },
          { dexie: db.games, supabase: 'games' },
          { dexie: db.game_sessions, supabase: 'game_sessions', dependsOn: 'games' },
          { dexie: db.gp_transactions, supabase: 'gp_transactions', dependsOn: 'games' },
        ];
      case 'habits':
        return [
          { dexie: db.habits, supabase: 'habits' },
          { dexie: db.habit_completions, supabase: 'habit_completions', dependsOn: 'habits' },
          { dexie: db.skills, supabase: 'skills' },
          { dexie: db.skill_entries, supabase: 'skill_entries', dependsOn: 'skills' },
        ];
      case 'goals':
        return [{ dexie: db.goals, supabase: 'goals' }];
      case 'dashboard':
        return [
          { dexie: db.todos, supabase: 'todos' },
          { dexie: db.calendar_events, supabase: 'calendar_events' },
          { dexie: db.user_preferences, supabase: 'user_preferences' },
        ];
      default:
        return [];
    }
  }

  private async syncTables(
    tables: ReturnType<typeof this.getModuleTables>,
    userId: string,
    lastSyncAt?: string
  ): Promise<void> {
    const failedTables = new Set<string>();

    for (const t of tables) {
      if (t.dependsOn && failedTables.has(t.dependsOn)) {
        console.warn(`[SyncManager] Skipping ${t.supabase} — parent ${t.dependsOn} failed.`);
        failedTables.add(t.supabase);
        continue;
      }

      const success = await this.syncTable(t.dexie, t.supabase, userId, lastSyncAt);
      if (!success) {
        failedTables.add(t.supabase);
      }
    }
  }

  private async performSync(module: ModuleId) {
    if (this._paused) return;

    const appStore = useAppStore.getState();
    const userId = appStore.userId;
    if (!userId) return;

    appStore.setSyncState({ isSyncing: true });

    const tables = this.getModuleTables(module);
    const lastSyncAt = appStore.sync.lastSyncAt;

    await this.processDeletions();
    await this.syncTables(tables, userId, lastSyncAt);

    appStore.setSyncState({
      isSyncing: false,
      lastSyncAt: new Date().toISOString(),
      pendingChanges: 0,
      syncError: undefined,
    });
  }

  /**
   * Process queued deletions with DATA LOSS PREVENTION:
   * - If any single table has more than MAX_DELETIONS_PER_TABLE queued,
   *   refuse to process that table and log a critical warning.
   * - Only deletes explicitly tracked records (never bulk/mass deletes).
   */
  private async processDeletions(): Promise<void> {
    try {
      const deletions = await db.sync_deletions.toArray();
      if (deletions.length === 0) return;

      // Group by table
      const grouped: Record<string, string[]> = {};
      for (const d of deletions) {
        if (!grouped[d.table_name]) grouped[d.table_name] = [];
        grouped[d.table_name].push(d.record_id);
      }

      // Order deletions from deepest child to parent to prevent FK constraint errors on Supabase
      const DELETION_ORDER = [
        'workout_exercise_logs',
        'workout_logs',
        'fitness_exercises',
        'fitness_program_days',
        'fitness_programs',
        'skill_entries',
        'habit_completions',
        'game_sessions',
        'gp_transactions',
        'games',
        'game_series'
      ];

      const tableNames = Object.keys(grouped).sort((a, b) => {
        const idxA = DELETION_ORDER.indexOf(a);
        const idxB = DELETION_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

      const processedIds: string[] = [];

      for (const tableName of tableNames) {
        const recordIds = grouped[tableName];
        
        // SAFETY: Refuse mass deletions
        if (recordIds.length > MAX_DELETIONS_PER_TABLE) {
          console.error(
            `[SyncManager] BLOCKED: ${recordIds.length} deletions queued for ${tableName} ` +
            `(limit: ${MAX_DELETIONS_PER_TABLE}). This looks like an accidental mass delete. ` +
            `Skipping to protect your data. Clear sync_deletions manually if intentional.`
          );
          continue;
        }

        const { error } = await supabase
          .from(tableName)
          .delete()
          .in('id', recordIds);

        if (error) {
          console.warn(`[SyncManager] Batch delete error for ${tableName}: ${error.message}. Retrying individually...`);
          
          for (const recordId of recordIds) {
            const { error: singleError } = await supabase.from(tableName).delete().eq('id', recordId);
            if (singleError) {
              console.error(`[SyncManager] Failed to delete ${recordId} from ${tableName}:`, singleError.message);
              // If it's a constraint error, it's permanently blocked by Supabase.
              // We remove it from the local deletion queue to prevent infinite failing loops.
              // It will resurrect on the next pull, which accurately reflects the server state.
              if (singleError.code === '23503' || singleError.message.includes('Foreign key') || singleError.message.includes('violates foreign key constraint')) {
                const blockedDeletions = deletions.filter(d => d.table_name === tableName && d.record_id === recordId);
                processedIds.push(...blockedDeletions.map(d => d.id));
              }
            } else {
              const processed = deletions.filter(d => d.table_name === tableName && d.record_id === recordId);
              processedIds.push(...processed.map(d => d.id));
            }
          }
        } else {
          // Track which deletion entries were successfully processed
          const processed = deletions.filter(d => d.table_name === tableName);
          processedIds.push(...processed.map(d => d.id));
        }
      }

      // Only clear successfully processed deletions (not blocked ones)
      if (processedIds.length > 0) {
        await db.sync_deletions.bulkDelete(processedIds);
      }
    } catch (e: any) {
      console.error('[SyncManager] processDeletions error:', e?.message ?? e);
    }
  }

  public async syncAll() {
    if (this._paused) return;

    const modules: ModuleId[] = ['dashboard', 'fitness', 'gaming', 'habits', 'goals', 'settings'];

    this.syncTimers.forEach(timer => clearTimeout(timer));
    this.syncTimers.clear();

    const appStore = useAppStore.getState();
    const userId = appStore.userId;
    if (!userId) return;

    appStore.setSyncState({ isSyncing: true });

    await this.processDeletions();

    const lastSyncAt = appStore.sync.lastSyncAt;
    for (const module of modules) {
      const tables = this.getModuleTables(module);
      await this.syncTables(tables, userId, lastSyncAt);
    }

    appStore.setSyncState({
      isSyncing: false,
      lastSyncAt: new Date().toISOString(),
      pendingChanges: 0,
      syncError: undefined,
    });
    console.log('[SyncManager] Global sync complete');
  }
}

export const syncManager = SyncManager.getInstance();

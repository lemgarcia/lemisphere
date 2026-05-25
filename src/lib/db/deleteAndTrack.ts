import { db } from './index';
import { generateId } from '@/utils';

/**
 * Delete a record from a Dexie table AND log it for sync deletion.
 * All components should call this instead of db.table.delete() directly.
 */
export async function deleteAndTrack(tableName: string, recordId: string): Promise<void> {
  // Get the Dexie table dynamically
  const table = (db as any)[tableName];
  if (!table) {
    console.error(`[deleteAndTrack] Unknown table: ${tableName}`);
    return;
  }

  // Delete from local Dexie
  await table.delete(recordId);

  // Log the deletion so SyncManager can propagate it to Supabase
  await db.sync_deletions.add({
    id: generateId(),
    table_name: tableName,
    record_id: recordId,
    created_at: new Date().toISOString(),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// LEMISPHERE — CORE UTILITIES
// ════════════════════════════════════════════════════════════════════════════

import type { BaseRecord, SyncStatus } from '@/types';

/** Generate a UUID v4 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Get or generate a stable device ID stored in localStorage */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'lemisphere_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateId();
    localStorage.setItem(key, id);
  }
  return id;
}

/** Get current ISO 8601 timestamp */
export function now(): string {
  return new Date().toISOString();
}

/** Create a base record with all sync metadata filled */
export function createRecord<T extends object>(
  data: Omit<T, keyof BaseRecord>,
  overrides?: Partial<BaseRecord>
): T & BaseRecord {
  const timestamp = now();
  const base: BaseRecord = {
    id: generateId(),
    created_at: timestamp,
    updated_at: timestamp,
    version: 1,
    device_id: getDeviceId(),
    sync_status: 'local' as SyncStatus,
    ...overrides,
  };
  return { ...data, ...base } as T & BaseRecord;
}

/** Update a record (bumps version + updated_at) */
export function updateRecord<T extends BaseRecord>(
  record: T,
  updates: Partial<Omit<T, keyof BaseRecord>>
): T {
  return {
    ...record,
    ...updates,
    updated_at: now(),
    version: record.version + 1,
    device_id: getDeviceId(),
    sync_status: 'pending' as SyncStatus,
  };
}

/** Format a date string as "Month Day, Year" */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Format a date as "YYYY-MM-DD" */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/** Get today's date string */
export function today(): string {
  return toDateString();
}

/** Format duration in minutes to "Xh Ym" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Debounce a function */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Capitalize first letter */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Get greeting based on hour */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/** Format number with K suffix */
export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

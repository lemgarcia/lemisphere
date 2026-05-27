'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { useCurrentDay } from '@/hooks/useCurrentDay';
import { useAppStore } from '@/stores/appStore';
import { generateId } from '@/utils';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';

export function HabitStreakWidget() {
  const userId = useAppStore(s => s.userId) || 'default';
  const todayStr = useCurrentDay();

  const habitsData = useLiveQuery(async () => {
    const activeHabits = await db.habits
      .filter(h => h.is_active && h.user_id === userId)
      .toArray();
      
    const todayCompletions = await db.habit_completions
      .where('date').equals(todayStr)
      .filter(c => c.user_id === userId)
      .toArray();

    return {
      habits: activeHabits.slice(0, 5),
      completions: todayCompletions
    };
  }, [userId, todayStr]);

  const toggleHabit = async (habitId: string, isCompleted: boolean) => {
    if (isCompleted) {
      // Find completion to delete
      const completion = habitsData?.completions.find(c => c.habit_id === habitId);
      if (completion) {
        await deleteAndTrack('habit_completions', completion.id);
        const { recalculateHabitStreak } = await import('@/utils/habitUtils');
        await recalculateHabitStreak(habitId, userId);
      }
    } else {
      // Add completion
      await db.habit_completions.add({
        id: generateId(),
        user_id: userId,
        habit_id: habitId,
        date: todayStr,
        count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        device_id: 'browser',
        sync_status: 'local'
      });
      const { recalculateHabitStreak } = await import('@/utils/habitUtils');
      await recalculateHabitStreak(habitId, userId);
    }
    syncManager.queueSync('habits');
  };

  if (!habitsData) return null;

  return (
    <div className={styles.widget} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className={styles.widgetHeader}>
        <div className={styles.widgetTitle}>
          <span className={styles.widgetTitleIcon}>🔥</span>
          Today&apos;s Habits
        </div>
        <Link href="/habits" className={styles.widgetAction}>
          Manage <ArrowRight size={12} />
        </Link>
      </div>
      <div className={styles.widgetBody} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {habitsData.habits.length === 0 ? (
          <div className={styles.emptyState} style={{ margin: 'auto' }}>
            No habits yet.{' '}
            <Link href="/habits" className={styles.emptyStateAdd}>
              Add one →
            </Link>
          </div>
        ) : (
          habitsData.habits.map((habit) => {
            const isCompleted = habitsData.completions.some(c => c.habit_id === habit.id);
            return (
              <div 
                key={habit.id} 
                onClick={() => toggleHabit(habit.id, isCompleted)}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '12px', background: isCompleted ? 'var(--accent-violet-soft)' : 'var(--canvas-bg)', 
                  borderRadius: '8px', border: '1px solid var(--card-border)',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  opacity: isCompleted ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{habit.icon}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                      {habit.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{habit.streak_current} day streak</div>
                  </div>
                </div>
                <button 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCompleted ? 'var(--accent-violet)' : 'var(--text-tertiary)', padding: 0, display: 'flex' }}
                >
                  {isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

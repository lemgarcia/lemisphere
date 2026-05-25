'use client';

import React from 'react';
import Link from 'next/link';
import { Dumbbell, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';
import { useCurrentDay } from '@/hooks/useCurrentDay';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';

export function FitnessTodayWidget() {
  const userId = useAppStore(s => s.userId) || 'default';
  const todayStr = useCurrentDay();

  const fitnessData = useLiveQuery(async () => {
    // Get active program
    const activeProgram = await db.fitness_programs
      .filter(p => p.status === 'active' && p.user_id === userId)
      .first();

    if (!activeProgram) return null;

    // Check if there is a workout logged today
    const todaysLog = await db.workout_logs
      .where('date').equals(todayStr)
      .filter(l => l.user_id === userId && l.program_id === activeProgram.id)
      .first();

    // If there is a log, it's done for today!
    if (todaysLog) {
      return { program: activeProgram, status: 'completed' as const, day: null };
    }

    // Find the next active day. This logic could be complex depending on scheduling, but we can just say "Next Workout" or assume Day 1 if no logs
    // For simplicity, we just fetch the first incomplete day based on order, or just the program info.
    const days = await db.fitness_program_days
      .where('program_id').equals(activeProgram.id)
      .filter(d => d.user_id === userId)
      .sortBy('order');
      
    // Count how many logs exist to guess the current day index
    const logsCount = await db.workout_logs
      .where('program_id').equals(activeProgram.id)
      .filter(l => l.user_id === userId)
      .count();

    const currentDayIndex = logsCount % (days.length || 1);
    const nextDay = days[currentDayIndex];

    return { program: activeProgram, status: 'pending' as const, day: nextDay };
  }, [userId]);

  return (
    <div className={styles.widget} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className={styles.widgetHeader}>
        <div className={styles.widgetTitle}>
          <Dumbbell size={18} color="var(--accent-violet)" />
          Today&apos;s Workout
        </div>
        <Link href="/fitness" className={styles.widgetAction}>
          Open <ArrowRight size={12} />
        </Link>
      </div>
      <div className={styles.widgetBody} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!fitnessData ? (
          <div className={styles.emptyState}>
            No active program.{' '}
            <Link href="/fitness" className={styles.emptyStateAdd}>
              Start one →
            </Link>
          </div>
        ) : fitnessData.status === 'completed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--status-success)' }}>
            <CheckCircle2 size={32} />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Workout Completed!</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Great job today.</div>
          </div>
        ) : fitnessData.day ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fitnessData.program.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--canvas-bg)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{fitnessData.day.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Day {fitnessData.day.order + 1}</div>
              </div>
              <Link href="/fitness" style={{ padding: '6px 12px', background: 'var(--accent-violet)', color: '#fff', fontSize: '12px', fontWeight: 600, borderRadius: '6px', textDecoration: 'none' }}>
                Start
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>Program setup incomplete.</div>
        )}
      </div>
    </div>
  );
}

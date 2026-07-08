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

    // Check if there is a workout logged today that is FULLY completed
    const todaysCompletedLog = await db.workout_logs
      .where('date').equals(todayStr)
      .filter(l => l.user_id === userId && l.program_id === activeProgram.id && l.completed === true)
      .first();

    // If there is a completed log, it's done for today!
    if (todaysCompletedLog) {
      return { program: activeProgram, status: 'completed' as const, day: null };
    }

    // Check if there is a workout logged today that is IN PROGRESS
    const todaysInProgressLog = await db.workout_logs
      .where('date').equals(todayStr)
      .filter(l => l.user_id === userId && l.program_id === activeProgram.id && !l.completed)
      .first();

    // Find the next active day. This logic could be complex depending on scheduling, but we can just say "Next Workout" or assume Day 1 if no logs
    // For simplicity, we just fetch the first incomplete day based on order, or just the program info.
    const days = await db.fitness_program_days
      .where('program_id').equals(activeProgram.id)
      .filter(d => d.user_id === userId)
      .sortBy('order');
      
    // Get logs for the current set
    const currentSetLogs = await db.workout_logs
      .filter(l => l.program_id === activeProgram.id && l.set_number === activeProgram.current_set && l.user_id === userId)
      .toArray();

    const completedDayIds = new Set(currentSetLogs.filter(l => l.completed).map(l => l.program_day_id));
    
    let nextDay = days.find(d => !completedDayIds.has(d.id));
    
    // If we have an in-progress log for today, we should probably point to that specific day!
    if (todaysInProgressLog) {
      const inProgressDay = days.find(d => d.id === todaysInProgressLog.program_day_id);
      if (inProgressDay) {
        nextDay = inProgressDay;
      }
    }
    
    if (!nextDay) nextDay = days[0]; // If set is complete but not advanced yet

    const dayNumber = completedDayIds.size + 1;

    return { program: activeProgram, status: 'pending' as const, day: nextDay, dayNumber, inProgress: !!todaysInProgressLog };
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
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Day {fitnessData.dayNumber}</div>
              </div>
              <Link href="/fitness" style={{ padding: '6px 12px', background: 'var(--accent-violet)', color: '#fff', fontSize: '12px', fontWeight: 600, borderRadius: '6px', textDecoration: 'none' }}>
                {fitnessData.inProgress ? 'Resume' : 'Start'}
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

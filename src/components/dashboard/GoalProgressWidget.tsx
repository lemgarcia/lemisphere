'use client';

import React from 'react';
import Link from 'next/link';
import { Target, ArrowRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';

export function GoalProgressWidget() {
  const userId = useAppStore(s => s.userId) || 'default';

  const activeGoals = useLiveQuery(async () => {
    return await db.goals
      .filter(g => g.status === 'in-progress' && g.user_id === userId)
      .limit(3)
      .toArray();
  }, [userId]);

  return (
    <div className={styles.widget} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className={styles.widgetHeader}>
        <div className={styles.widgetTitle}>
          <Target size={18} color="var(--accent-violet)" />
          Active Goals
        </div>
        <Link href="/goals" className={styles.widgetAction}>
          All <ArrowRight size={12} />
        </Link>
      </div>
      <div className={styles.widgetBody} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!activeGoals || activeGoals.length === 0 ? (
          <div className={styles.emptyState}>
            No active goals.{' '}
            <Link href="/goals/new" className={styles.emptyStateAdd}>
              Set a goal →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {activeGoals.map((goal) => {
              // Calculate percentage if not directly stored or if tasks exist.
              // We'll use goal.progress if available, else 0
              const progress = goal.progress || 0;
              return (
                <div key={goal.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    <span>{goal.title}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{Math.round(progress)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--canvas-bg)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: goal.color || 'var(--accent-violet)', borderRadius: '4px', transition: 'width 0.5s ease-out' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

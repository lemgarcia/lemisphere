'use client';

import React from 'react';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';

export function StatPendingTodosWidget() {
  const userId = useAppStore(s => s.userId) || 'default';
  const count = useLiveQuery(async () => {
    return await db.todos.filter(t => !t.is_completed && t.user_id === userId).count();
  }, [userId]);

  return (
    <div className={`${styles.statCard} ${styles.cardGreen}`} style={{ height: '100%', margin: 0 }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>Pending Tasks</span>
        <span className={`${styles.statBadge} ${styles.positive}`}>📝</span>
      </div>
      <div className={styles.statValue}>{count ?? '...'}</div>
      <div className={styles.statSubtext}>To-dos remaining</div>
    </div>
  );
}

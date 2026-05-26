'use client';

import React from 'react';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';

export function StatActiveGoalsWidget() {
  const userId = useAppStore(s => s.userId) || 'default';
  const count = useLiveQuery(async () => {
    return await db.goals.filter(g => g.status === 'active' && g.user_id === userId).count();
  }, [userId]);

  return (
    <div className={`${styles.statCard} ${styles.cardBlue}`} style={{ height: '100%', margin: 0 }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>Active Goals</span>
        <span className={`${styles.statBadge} ${styles.neutral}`}>🎯</span>
      </div>
      <div className={styles.statValue}>{count ?? '...'}</div>
      <div className={styles.statSubtext}>Goals in progress</div>
    </div>
  );
}

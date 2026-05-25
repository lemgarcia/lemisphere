'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';

export function StatStreakWidget() {
  const topHabit = useLiveQuery(async () => {
    const habits = await db.habits.filter((h: any) => h.is_active).toArray();
    if (habits.length === 0) return null;
    return habits.reduce((prev: any, current: any) => 
      (current.streak_current > prev.streak_current) ? current : prev
    );
  });

  return (
    <div className={`${styles.statCard} ${styles.cardOrange}`} style={{ height: '100%', margin: 0 }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>Top Streak</span>
        <span className={`${styles.statBadge} ${styles.positive}`}>🔥</span>
      </div>
      <div className={styles.statValue}>
        {topHabit && topHabit.streak_current > 0 ? `${topHabit.streak_current} Days` : '0 Days'}
      </div>
      <div className={styles.statSubtext}>
        {topHabit ? topHabit.name : 'No active habits'}
      </div>
    </div>
  );
}

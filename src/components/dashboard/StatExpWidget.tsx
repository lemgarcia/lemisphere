'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';
import { useAppStore } from '@/stores/appStore';

export function StatExpWidget() {
  const totalExp = useLiveQuery(async () => {
    const skills = await db.skills.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
    return skills.reduce((sum: number, skill: any) => sum + skill.xp, 0);
  });

  const prefs = useLiveQuery(() => db.user_preferences.get(useAppStore.getState().userId || 'default'));
  const rewardXp = prefs?.reward_xp ?? 0;

  return (
    <div className={`${styles.statCard} ${styles.cardPurple}`} style={{ height: '100%', margin: 0 }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>Total EXP</span>
        <span className={`${styles.statBadge} ${styles.neutral}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <span style={{ fontSize: '12px' }}>✨</span> {rewardXp.toLocaleString()} RXP
        </span>
      </div>
      <div className={styles.statValue}>
        {totalExp?.toLocaleString() || '0'}
      </div>
      <div className={styles.statSubtext}>
        Across all skills
      </div>
    </div>
  );
}

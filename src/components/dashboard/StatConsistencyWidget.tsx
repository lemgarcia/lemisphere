'use client';

import React from 'react';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';

export function StatConsistencyWidget() {
  return (
    <div className={`${styles.statCard} ${styles.cardBlue}`} style={{ height: '100%', margin: 0 }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>Consistency</span>
        <span className={`${styles.statBadge} ${styles.neutral}`}>Last 7 days</span>
      </div>
      <div className={styles.statValue}>---</div>
      <div className={styles.statSubtext}>Populating...</div>
    </div>
  );
}

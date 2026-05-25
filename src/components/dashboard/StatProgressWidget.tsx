'use client';

import React from 'react';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';

export function StatProgressWidget() {
  return (
    <div className={`${styles.statCard} ${styles.cardGreen}`} style={{ height: '100%', margin: 0 }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>Weekly Progress</span>
        <span className={`${styles.statBadge} ${styles.positive}`}>🎯</span>
      </div>
      <div className={styles.statValue}>---</div>
      <div className={styles.statSubtext}>Tasks & Habits</div>
    </div>
  );
}

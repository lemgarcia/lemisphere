'use client';

import { motion } from 'framer-motion';
import { GoalsDashboard } from '@/components/goals/GoalsDashboard';
import styles from '@/styles/modulePage.module.css';

export function GoalsPage() {
  return (
    <motion.div className={styles.page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <div className={styles.pageTitleIcon} style={{ background: 'var(--mod-goals-light)' }}>🎯</div>
          <div>
            <div className={styles.pageTitleText}>Goals</div>
            <div className={styles.pageTitleSub}>Milestones & Progress</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <GoalsDashboard />
      </div>
    </motion.div>
  );
}

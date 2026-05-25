'use client';

import { motion } from 'framer-motion';
import styles from '@/styles/modulePage.module.css';
import fitnessStyles from './Fitness.module.css';

import { useFitnessStore } from '@/stores/fitnessStore';
import { ProgramsTab } from '@/components/fitness/ProgramsTab';
import { WorkoutsTab } from '@/components/fitness/WorkoutsTab';
import { StatsTab } from '@/components/fitness/StatsTab';

export function FitnessPage() {
  const activeTab = useFitnessStore((s) => s.activeTab);
  const setActiveTab = useFitnessStore((s) => s.setActiveTab);

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <div className={styles.pageHeader} style={{ flexDirection: 'column', gap: '0' }}>
        <div className={styles.pageTitle} style={{ width: '100%' }}>
          <div className={styles.pageTitleIcon} style={{ background: 'var(--mod-fitness-light)' }}>💪</div>
          <div>
            <div className={styles.pageTitleText}>Fitness</div>
            <div className={styles.pageTitleSub}>Programs & Workout Logs</div>
          </div>
        </div>

        <div className={fitnessStyles.pageTabs}>
          {(['programs', 'workouts', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              className={`${fitnessStyles.tabButton} ${activeTab === tab ? fitnessStyles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
              style={activeTab === tab ? { color: 'var(--mod-fitness-primary)', borderBottomColor: 'var(--mod-fitness-primary)' } : {}}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={fitnessStyles.tabContent}>
        {activeTab === 'programs' && <ProgramsTab />}
        {activeTab === 'workouts' && <WorkoutsTab />}
        {activeTab === 'stats' && <StatsTab />}
      </div>
    </motion.div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { useHabitsStore } from '@/stores/habitsStore';
import { HabitsTab } from '@/components/habits/HabitsTab';
import { SkillsTab } from '@/components/habits/SkillsTab';
import { OverviewTab } from '@/components/habits/OverviewTab';
import styles from '@/styles/modulePage.module.css';

export function HabitsPage() {
  const { activeTab, setActiveTab } = useHabitsStore();

  return (
    <motion.div className={styles.page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <div className={styles.pageTitleIcon} style={{ background: 'var(--mod-habits-light)' }}>🔥</div>
          <div>
            <div className={styles.pageTitleText}>Skills & Habits</div>
            <div className={styles.pageTitleSub}>Upskilling & Streaks</div>
          </div>
        </div>
      </div>

      <div className={styles.pageTabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'habits' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('habits')}
        >
          Habits Tracker
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'skills' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          Skill Progression
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'habits' && <HabitsTab />}
        {activeTab === 'skills' && <SkillsTab />}
      </div>
    </motion.div>
  );
}

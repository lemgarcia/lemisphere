'use client';

import { motion } from 'framer-motion';
import { useBudgieStore } from '@/stores/budgieStore';
import { ProfileTab } from '@/components/budgie/ProfileTab';
import { CareTab } from '@/components/budgie/CareTab';
import { TrainingTab } from '@/components/budgie/TrainingTab';
import styles from '@/styles/modulePage.module.css';
import budgieStyles from '@/components/budgie/Budgie.module.css';

export function BudgiePage() {
  const { activeTab, setActiveTab } = useBudgieStore();

  return (
    <motion.div className={styles.page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <div className={styles.pageTitleIcon} style={{ background: 'var(--mod-budgie-light)' }}>🦜</div>
          <div>
            <div className={styles.pageTitleText}>Budgie Care</div>
            <div className={styles.pageTitleSub}>Bird Profile · Care · Training</div>
          </div>
        </div>

        <div className={budgieStyles.pageTabs} style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--card-border)' }}>
          {(['profiles', 'care', 'training'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: 600,
                color: activeTab === tab ? 'var(--mod-budgie-primary)' : 'var(--text-tertiary)',
                borderBottom: activeTab === tab ? '2px solid var(--mod-budgie-primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        {activeTab === 'profiles' && <ProfileTab />}
        {activeTab === 'care' && <CareTab />}
        {activeTab === 'training' && <TrainingTab />}
      </div>
    </motion.div>
  );
}

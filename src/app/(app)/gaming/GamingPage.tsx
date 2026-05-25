'use client';

import { motion } from 'framer-motion';
import styles from '@/styles/modulePage.module.css';
import gamingStyles from '@/components/gaming/Gaming.module.css';

import { useGamingStore } from '@/stores/gamingStore';
import { LibraryTab } from '@/components/gaming/LibraryTab';
import { SeriesTab } from '@/components/gaming/SeriesTab';
import { GPTab } from '@/components/gaming/GPTab';
import { GameDetailsTab } from '@/components/gaming/GameDetailsTab';

export function GamingPage() {
  const activeTab = useGamingStore((s) => s.activeTab);
  const setActiveTab = useGamingStore((s) => s.setActiveTab);

  return (
    <motion.div className={styles.page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <div className={styles.pageTitleIcon} style={{ background: 'var(--mod-gaming-light)' }}>🎮</div>
          <div>
            <div className={styles.pageTitleText}>Gaming</div>
            <div className={styles.pageTitleSub}>Library, Sessions & GP Economy</div>
          </div>
        </div>

        {activeTab !== 'game_details' && (
          <div className={gamingStyles.pageTabs}>
            {(['library', 'series', 'gp'] as const).map((tab) => (
              <button
                key={tab}
                className={`${gamingStyles.tabButton} ${activeTab === tab ? gamingStyles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
                style={activeTab === tab ? { color: 'var(--mod-gaming-primary)', borderBottomColor: 'var(--mod-gaming-primary)' } : {}}
              >
                {tab === 'gp' ? 'GP Ledger' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={gamingStyles.tabContent}>
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'series' && <SeriesTab />}
        {activeTab === 'gp' && <GPTab />}
        {activeTab === 'game_details' && <GameDetailsTab />}
      </div>
    </motion.div>
  );
}

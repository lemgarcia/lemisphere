'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';
import { Settings } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export function StatStreakWidget() {
  const monitoredHabitId = useAppStore(s => s.monitoredHabitId);
  const setMonitoredHabitId = useAppStore(s => s.setMonitoredHabitId);
  const [showDropdown, setShowDropdown] = useState(false);

  const allHabits = useLiveQuery(async () => {
    return await db.habits.filter((h: any) => h.is_active).toArray();
  });

  const displayedHabit = allHabits?.find(h => h.id === monitoredHabitId) || 
    (allHabits && allHabits.length > 0 ? allHabits.reduce((prev: any, current: any) => 
      (current.streak_current > prev.streak_current) ? current : prev
    ) : null);

  return (
    <div className={`${styles.statCard} ${styles.cardOrange}`} style={{ height: '100%', margin: 0 }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>
          {monitoredHabitId ? 'Monitored Streak' : 'Top Streak'}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7, display: 'flex' }}
          >
            <Settings size={14} />
          </button>
          
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '4px',
              background: 'var(--bg-primary)', border: '1px solid var(--card-border)',
              borderRadius: '8px', padding: '4px', zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)', width: '160px',
              display: 'flex', flexDirection: 'column',
              maxHeight: '200px', overflowY: 'auto'
            }}>
              <button 
                onClick={() => { setMonitoredHabitId(null); setShowDropdown(false); }}
                style={{ padding: '6px 8px', textAlign: 'left', background: !monitoredHabitId ? 'var(--bg-secondary)' : 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
              >
                🔥 Top Streak (Auto)
              </button>
              {allHabits?.map(h => (
                <button 
                  key={h.id}
                  onClick={() => { setMonitoredHabitId(h.id); setShowDropdown(false); }}
                  style={{ padding: '6px 8px', textAlign: 'left', background: monitoredHabitId === h.id ? 'var(--bg-secondary)' : 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', gap: '6px', alignItems: 'center' }}
                >
                  <span style={{ flexShrink: 0 }}>{h.icon}</span> 
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                </button>
              ))}
            </div>
          )}
          
          <span className={`${styles.statBadge} ${styles.positive}`}>🔥</span>
        </div>
      </div>
      <div className={styles.statValue}>
        {displayedHabit && displayedHabit.streak_current > 0 ? `${displayedHabit.streak_current} Days` : '0 Days'}
      </div>
      <div className={styles.statSubtext}>
        {displayedHabit ? displayedHabit.name : 'No active habits'}
      </div>
    </div>
  );
}

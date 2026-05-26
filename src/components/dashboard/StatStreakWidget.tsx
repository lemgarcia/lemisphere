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
    <div className={`${styles.statCard} ${styles.cardOrange}`} style={{ height: '100%', margin: 0, overflow: 'visible' }}>
      <div className={styles.statCardHeader}>
        <span className={styles.statLabel}>
          {monitoredHabitId ? 'Monitored Streak' : 'Top Streak'}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ background: 'var(--canvas-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '6px', transition: 'all 0.2s' }}
            title="Select habit to monitor"
          >
            <Settings size={14} />
          </button>
          
          {showDropdown && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setShowDropdown(false)}
              />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--bg-primary)', border: '1px solid var(--card-border)',
                borderRadius: '12px', padding: '6px', zIndex: 50,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: '220px',
                display: 'flex', flexDirection: 'column', gap: '2px',
                maxHeight: '260px', overflowY: 'auto'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', padding: '6px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Monitor Habit
                </div>
                <button 
                  onClick={() => { setMonitoredHabitId(null); setShowDropdown(false); }}
                  style={{ 
                    padding: '8px 10px', textAlign: 'left', 
                    background: !monitoredHabitId ? 'var(--bg-secondary)' : 'transparent', 
                    border: 'none', borderRadius: '6px', cursor: 'pointer', 
                    fontSize: '13px', color: !monitoredHabitId ? 'var(--text-primary)' : 'var(--text-secondary)', 
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontWeight: !monitoredHabitId ? 600 : 500
                  }}
                  onMouseEnter={(e) => { if (monitoredHabitId) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={(e) => { if (monitoredHabitId) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '14px' }}>✨</span>
                  <span style={{ flex: 1 }}>Top Streak (Auto)</span>
                </button>
                <div style={{ height: '1px', background: 'var(--card-border)', margin: '4px 0' }} />
                {allHabits?.map(h => (
                  <button 
                    key={h.id}
                    onClick={() => { setMonitoredHabitId(h.id); setShowDropdown(false); }}
                    style={{ 
                      padding: '8px 10px', textAlign: 'left', 
                      background: monitoredHabitId === h.id ? 'var(--bg-secondary)' : 'transparent', 
                      border: 'none', borderRadius: '6px', cursor: 'pointer', 
                      fontSize: '13px', color: monitoredHabitId === h.id ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      display: 'flex', gap: '8px', alignItems: 'center',
                      fontWeight: monitoredHabitId === h.id ? 600 : 500
                    }}
                    onMouseEnter={(e) => { if (monitoredHabitId !== h.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { if (monitoredHabitId !== h.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ flexShrink: 0, fontSize: '14px' }}>{h.icon}</span> 
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{h.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--canvas-bg)', padding: '2px 6px', borderRadius: '4px' }}>{h.streak_current}</span>
                  </button>
                ))}
              </div>
            </>
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

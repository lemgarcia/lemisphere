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
                style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                onClick={() => setShowDropdown(false)}
              />
              <div 
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-primary)', border: '1px solid var(--card-border)',
                  borderRadius: '12px', padding: '12px', zIndex: 100,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.15)', width: '280px',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                  maxHeight: '300px', overflowY: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', paddingBottom: '8px', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
                  Select Habit to Monitor
                </div>
                <button 
                  onClick={() => { setMonitoredHabitId(null); setShowDropdown(false); }}
                  style={{ 
                    padding: '8px 12px', textAlign: 'left', 
                    background: !monitoredHabitId ? 'var(--bg-secondary)' : 'transparent', 
                    border: 'none', borderRadius: '6px', cursor: 'pointer', 
                    fontSize: '13px', color: !monitoredHabitId ? 'var(--text-primary)' : 'var(--text-secondary)', 
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontWeight: !monitoredHabitId ? 700 : 500,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { if (monitoredHabitId) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={(e) => { if (monitoredHabitId) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '16px' }}>✨</span>
                  <span style={{ flex: 1 }}>Top Streak (Auto)</span>
                </button>
                {allHabits?.map(h => (
                  <button 
                    key={h.id}
                    onClick={() => { setMonitoredHabitId(h.id); setShowDropdown(false); }}
                    style={{ 
                      padding: '8px 12px', textAlign: 'left', 
                      background: monitoredHabitId === h.id ? 'var(--bg-secondary)' : 'transparent', 
                      border: 'none', borderRadius: '6px', cursor: 'pointer', 
                      fontSize: '13px', color: monitoredHabitId === h.id ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      display: 'flex', gap: '8px', alignItems: 'center',
                      fontWeight: monitoredHabitId === h.id ? 700 : 500,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => { if (monitoredHabitId !== h.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { if (monitoredHabitId !== h.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ flexShrink: 0, fontSize: '16px' }}>{h.icon}</span> 
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{h.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--canvas-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      {h.streak_current} 🔥
                    </span>
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

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
          
          {showDropdown && typeof window !== 'undefined' && document.body && (
            require('react-dom').createPortal(
              <div 
                style={{ 
                  position: 'fixed', inset: 0, zIndex: 100000, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  background: 'rgba(0, 0, 0, 0.6)', padding: '20px' 
                }}
                onClick={() => setShowDropdown(false)}
              >
                <div 
                  style={{
                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                    borderRadius: '16px', width: '100%', maxWidth: '400px',
                    boxShadow: 'var(--card-shadow-elevated, 0 10px 25px rgba(0,0,0,0.2))',
                    display: 'flex', flexDirection: 'column',
                    maxHeight: '85vh', overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ 
                    padding: '20px 24px', borderBottom: '1px solid var(--card-border)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-secondary)'
                  }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Select Habit to Monitor
                    </div>
                    <button 
                      onClick={() => setShowDropdown(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                  
                  <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                      onClick={() => { setMonitoredHabitId(null); setShowDropdown(false); }}
                      style={{ 
                        padding: '16px', textAlign: 'left', 
                        background: !monitoredHabitId ? 'var(--mod-habits-light, rgba(99, 102, 241, 0.1))' : 'var(--canvas-surface)', 
                        border: !monitoredHabitId ? '1px solid var(--mod-habits-primary, #6366f1)' : '1px solid var(--card-border)', 
                        borderRadius: '12px', cursor: 'pointer', 
                        fontSize: '15px', color: !monitoredHabitId ? 'var(--mod-habits-primary, #6366f1)' : 'var(--text-primary)', 
                        display: 'flex', alignItems: 'center', gap: '16px',
                        fontWeight: !monitoredHabitId ? 700 : 600,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { if (monitoredHabitId) e.currentTarget.style.borderColor = 'var(--text-tertiary)'; }}
                      onMouseLeave={(e) => { if (monitoredHabitId) e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                    >
                      <span style={{ fontSize: '24px' }}>✨</span>
                      <span style={{ flex: 1 }}>Top Streak (Auto)</span>
                    </button>
                    
                    {allHabits?.map(h => (
                      <button 
                        key={h.id}
                        onClick={() => { setMonitoredHabitId(h.id); setShowDropdown(false); }}
                        style={{ 
                          padding: '16px', textAlign: 'left', 
                          background: monitoredHabitId === h.id ? 'var(--mod-habits-light, rgba(99, 102, 241, 0.1))' : 'var(--canvas-surface)', 
                          border: monitoredHabitId === h.id ? '1px solid var(--mod-habits-primary, #6366f1)' : '1px solid var(--card-border)', 
                          borderRadius: '12px', cursor: 'pointer', 
                          fontSize: '15px', color: monitoredHabitId === h.id ? 'var(--mod-habits-primary, #6366f1)' : 'var(--text-primary)', 
                          display: 'flex', gap: '16px', alignItems: 'center',
                          fontWeight: monitoredHabitId === h.id ? 700 : 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { if (monitoredHabitId !== h.id) e.currentTarget.style.borderColor = 'var(--text-tertiary)'; }}
                        onMouseLeave={(e) => { if (monitoredHabitId !== h.id) e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                      >
                        <span style={{ flexShrink: 0, fontSize: '24px' }}>{h.icon}</span> 
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{h.name}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', border: '1px solid var(--card-border)', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                          {h.streak_current} 🔥
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>,
              document.body
            )
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

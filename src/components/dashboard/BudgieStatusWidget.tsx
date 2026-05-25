'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';
import { useAppStore } from '@/stores/appStore';
import { useCurrentDay } from '@/hooks/useCurrentDay';
import { CheckCircle2, Circle } from 'lucide-react';

export function BudgieStatusWidget() {
  const userId = useAppStore((s) => s.userId) || 'default';
  const todayStr = useCurrentDay();
  const [selectedBirdId, setSelectedBirdId] = useState<string | null>(null);

  const birds = useLiveQuery(
    async () => await db.bird_profiles.filter(b => b.is_active && b.user_id === userId).toArray(),
    [userId]
  );

  const activeBirdId = selectedBirdId || (birds && birds.length > 0 ? birds[0].id : null);

  const careEvents = useLiveQuery(
    async () => {
      if (!activeBirdId) return [];
      return await db.care_events
        .where({ bird_id: activeBirdId, date: todayStr })
        .filter(x => x.user_id === userId)
        .toArray();
    },
    [activeBirdId, userId, todayStr]
  );

  // Removed toggleEvent as CareEvents are inherently logs of completed actions

  return (
    <div className={styles.widget} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className={styles.widgetHeader}>
        <div className={styles.widgetTitle}>
          <span className={styles.widgetTitleIcon}>🦜</span>
          <div className={styles.birdSelector}>
            <select
              value={activeBirdId || ''}
              onChange={(e) => setSelectedBirdId(e.target.value)}
              style={{
                background: 'none', border: 'none', font: 'inherit', color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit', cursor: 'pointer', outline: 'none',
              }}
            >
              {!birds || birds.length === 0 ? (
                <option>No birds</option>
              ) : (
                birds.map((bird: any) => (
                  <option key={bird.id} value={bird.id}>{bird.name}</option>
                ))
              )}
            </select>
          </div>
          &apos;s Care
        </div>
        <Link href="/budgie" className={styles.widgetAction}>
          Manage →
        </Link>
      </div>
      <div className={styles.widgetBody} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!careEvents || careEvents.length === 0 ? (
          <div className={styles.emptyState}>
            No care events logged today.{' '}
            <Link href="/budgie" className={styles.emptyStateAdd}>Log one →</Link>
          </div>
        ) : (
          careEvents.map((event: any) => {
            return (
              <div 
                key={event.id}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '12px', background: 'var(--canvas-bg)', 
                  borderRadius: '8px', border: '1px solid var(--card-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: event.color || 'var(--accent-violet)' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {event.type}
                    </div>
                    {event.time && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{event.time}</div>}
                  </div>
                </div>
                <CheckCircle2 size={16} color="var(--status-success)" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

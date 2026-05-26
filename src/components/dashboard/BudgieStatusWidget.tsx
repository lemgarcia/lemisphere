'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';
import { useAppStore } from '@/stores/appStore';
import { useCurrentDay } from '@/hooks/useCurrentDay';
import { CheckCircle2, Circle, Droplets, Utensils, Scale, Stethoscope, Pill, Bath, Scissors, Heart, Carrot } from 'lucide-react';

const CARE_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  'feeding': { label: 'Feeding', icon: Utensils, color: '#f59e0b' },
  'water': { label: 'Water Change', icon: Droplets, color: '#3b82f6' },
  'weight_check': { label: 'Weight Check', icon: Scale, color: '#8b5cf6' },
  'vet_visit': { label: 'Vet Visit', icon: Stethoscope, color: '#ef4444' },
  'medication': { label: 'Medication', icon: Pill, color: '#ec4899' },
  'bath': { label: 'Bath', icon: Bath, color: '#06b6d4' },
  'nail_trim': { label: 'Nail Trim', icon: Scissors, color: '#64748b' },
  'health_note': { label: 'Health Note', icon: Heart, color: '#10b981' },
};

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
      if (!activeBirdId || !birds) return [];
      
      // Find the active bird and its linked bird
      const activeBird = birds.find(b => b.id === activeBirdId);
      const linkedBird = activeBird ? birds.find(b => 
        b.id === activeBird.linked_bird_id || 
        (b.linked_bird_id === activeBird.id && b.id !== activeBird.id)
      ) : null;
      
      // Query events for the active bird
      const events = await db.care_events
        .where({ bird_id: activeBirdId, date: todayStr })
        .filter(x => x.user_id === userId)
        .toArray();
      
      // If linked, also get events for the linked bird and merge (deduplicate by type+time)
      if (linkedBird) {
        const linkedEvents = await db.care_events
          .where({ bird_id: linkedBird.id, date: todayStr })
          .filter(x => x.user_id === userId)
          .toArray();
        
        const existingKeys = new Set(events.map(e => `${e.type}|${e.time || ''}|${e.notes || ''}`));
        for (const le of linkedEvents) {
          const key = `${le.type}|${le.time || ''}|${le.notes || ''}`;
          if (!existingKeys.has(key)) {
            events.push(le);
            existingKeys.add(key);
          }
        }
        
        // Sort by created_at so they appear in the same sequence
        events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      
      return events;
    },
    [activeBirdId, userId, todayStr, birds]
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
            const typeInfo = CARE_TYPES[event.type] || { label: event.type, icon: Circle, color: 'var(--accent-violet)' };
            const Icon = event.food_type && event.type === 'feeding' && event.food_type.toLowerCase().includes('veggi') ? Carrot : typeInfo.icon;
            const displayLabel = event.food_type || typeInfo.label;
            const iconColor = event.food_type && event.type === 'feeding' && event.food_type.toLowerCase().includes('veggi') ? '#22c55e' : typeInfo.color;
            
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
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', 
                    background: `${iconColor}20`, color: iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {displayLabel}
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

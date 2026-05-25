import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from './Habits.module.css';
import { Flame, Star, Target, Zap, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export function OverviewTab() {
  const habits = useLiveQuery(() => db.habits.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const skills = useLiveQuery(() => db.skills.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());

  if (!habits || !skills) return <div style={{ padding: '20px' }}>Loading Overview...</div>;

  const totalHabits = habits.length;
  const highestStreak = habits.reduce((max, h) => Math.max(max, h.streak_current), 0);
  const totalSkills = skills.length;
  const totalXp = skills.reduce((sum, s) => sum + s.xp, 0);

  const skillTiers = { beginner: 0, intermediate: 0, advanced: 0, expert: 0, master: 0 };
  skills.forEach(s => {
    if (skillTiers[s.level] !== undefined) skillTiers[s.level]++;
  });

  const onFireHabits = habits.filter(h => h.streak_current >= 3).sort((a,b) => b.streak_current - a.streak_current);
  const needsAttentionHabits = habits.filter(h => h.streak_current === 0).sort((a,b) => b.sort_order! - a.sort_order!);

  return (
    <div className={styles.container}>
      
      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase' }}>
            <Target size={16} /> Total Habits
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalHabits}</div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase' }}>
            <Flame size={16} /> Highest Streak
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#f97316' }}>{highestStreak} <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Days</span></div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase' }}>
            <Zap size={16} /> Active Skills
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalSkills}</div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase' }}>
            <Star size={16} /> Total XP Earned
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#8b5cf6' }}>{totalXp.toLocaleString()}</div>
        </div>

      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: Mastery Breakdown & On Fire */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Skill Mastery Breakdown
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Master', count: skillTiers.master, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
                { label: 'Expert', count: skillTiers.expert, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
                { label: 'Advanced', count: skillTiers.advanced, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
                { label: 'Intermediate', count: skillTiers.intermediate, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                { label: 'Beginner', count: skillTiers.beginner, color: 'var(--text-tertiary)', bg: 'var(--canvas-surface)' }
              ].map(tier => (
                <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '90px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{tier.label}</div>
                  <div style={{ flex: 1, height: '12px', background: 'var(--canvas-surface)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${totalSkills > 0 ? (tier.count / totalSkills) * 100 : 0}%`, height: '100%', background: tier.color, borderRadius: '6px' }} />
                  </div>
                  <div style={{ width: '30px', textAlign: 'right', fontSize: '14px', fontWeight: 700, color: tier.color }}>{tier.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316' }}>
              <Flame size={20} /> Habits On Fire!
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {onFireHabits.length > 0 ? onFireHabits.slice(0, 5).map(habit => (
                <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--canvas-surface)', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                  <div style={{ fontSize: '24px' }}>{habit.icon}</div>
                  <div style={{ flex: 1, fontWeight: 600 }}>{habit.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f97316', fontWeight: 800 }}>
                    {habit.streak_current} <Flame size={14} />
                  </div>
                </div>
              )) : (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', fontStyle: 'italic' }}>No habits are currently on fire. Build up those streaks!</div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Needs Attention */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
              <AlertCircle size={20} /> Needs Attention
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: 0, marginBottom: '16px' }}>
              These habits currently have a streak of 0. Time to get them back on track!
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {needsAttentionHabits.length > 0 ? needsAttentionHabits.map(habit => (
                <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--canvas-surface)', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontSize: '24px', opacity: 0.5 }}>{habit.icon}</div>
                  <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-secondary)' }}>{habit.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>
                    0 Streak
                  </div>
                </div>
              )) : (
                <div style={{ color: '#10b981', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={16} /> All habits are active! Great job.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

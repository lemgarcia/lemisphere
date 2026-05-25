'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';
import { useAppStore } from '@/stores/appStore';

export function QuickStatsWidget() {
  // Query 1: Find highest streak habit
  const topHabit = useLiveQuery(async () => {
    const habits = await db.habits.filter(h => h.is_active).toArray();
    if (habits.length === 0) return null;
    return habits.reduce((prev, current) => 
      (current.streak_current > prev.streak_current) ? current : prev
    );
  });

  // Query 2: Calculate total EXP
  const totalExp = useLiveQuery(async () => {
    const skills = await db.skills.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
    return skills.reduce((sum, skill) => sum + skill.xp, 0);
  });

  // Since we are mocking some logic for consistency and weekly progress, 
  // we'll just display placeholders that will populate as we build out the rest of the app.
  const statCards = [
    { 
      key: 'streak', 
      label: 'Top Streak', 
      value: topHabit && topHabit.streak_current > 0 ? `${topHabit.streak_current} Days` : '0 Days', 
      badge: '🔥', 
      badgeClass: 'positive', 
      subtext: topHabit ? topHabit.name : 'No active habits', 
      className: 'cardOrange' 
    },
    { 
      key: 'exp', 
      label: 'Total EXP', 
      value: totalExp?.toLocaleString() || '0', 
      badge: 'Level ' + Math.floor((totalExp || 0) / 1000 + 1), 
      badgeClass: 'neutral', 
      subtext: 'Across all skills', 
      className: 'cardPurple' 
    },
    { 
      key: 'consistency', 
      label: 'Consistency', 
      value: '---', 
      badge: 'Last 7 days', 
      badgeClass: 'neutral', 
      subtext: 'Populating...', 
      className: 'cardBlue' 
    },
    { 
      key: 'progress', 
      label: 'Weekly Progress', 
      value: '---', 
      badge: '🎯', 
      badgeClass: 'positive', 
      subtext: 'Tasks & Habits', 
      className: 'cardGreen' 
    },
  ];

  return (
    <div className={styles.statsRow}>
      {statCards.map((card) => (
        <div key={card.key} className={`${styles.statCard} ${styles[card.className]}`}>
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>{card.label}</span>
            <span className={`${styles.statBadge} ${styles[card.badgeClass]}`}>
              {card.badge}
            </span>
          </div>
          <div className={styles.statValue}>{card.value}</div>
          <div className={styles.statSubtext}>{card.subtext}</div>
        </div>
      ))}
    </div>
  );
}


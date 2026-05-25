'use client';

import React from 'react';
import Link from 'next/link';
import { Gamepad2, ArrowRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';
import styles from '@/app/(app)/dashboard/Dashboard.module.css';

export function GamingNowWidget() {
  const userId = useAppStore(s => s.userId) || 'default';

  const gamingData = useLiveQuery(async () => {
    const playingGames = await db.games
      .filter(g => g.status === 'playing' && g.user_id === userId)
      .limit(3)
      .toArray();
      
    const allGp = await db.gp_transactions
      .filter(tx => tx.user_id === userId)
      .toArray();
    
    const balance = allGp.reduce((acc, tx) => acc + tx.amount, 0);

    return { playingGames, balance };
  }, [userId]);

  return (
    <div className={styles.widget} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className={styles.widgetHeader}>
        <div className={styles.widgetTitle}>
          <Gamepad2 size={18} color="var(--accent-violet)" />
          Gaming
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {gamingData && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-violet)', background: 'var(--accent-violet-soft)', padding: '2px 8px', borderRadius: '12px' }}>
              {gamingData.balance} GP
            </span>
          )}
          <Link href="/gaming" className={styles.widgetAction}>
            Open <ArrowRight size={12} />
          </Link>
        </div>
      </div>
      <div className={styles.widgetBody} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!gamingData?.playingGames || gamingData.playingGames.length === 0 ? (
          <div className={styles.emptyState}>
            Not playing any games.{' '}
            <Link href="/gaming" className={styles.emptyStateAdd}>
              Browse Library →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {gamingData.playingGames.map((game) => (
              <div key={game.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)' }}>
                {game.cover_url ? (
                  <img src={game.cover_url} alt={game.title} style={{ width: '32px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                ) : (
                  <div style={{ width: '32px', height: '40px', background: 'var(--card-bg)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Gamepad2 size={16} color="var(--text-tertiary)" />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{game.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{game.platform}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

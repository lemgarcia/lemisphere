import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { Trash2, HelpCircle, X } from 'lucide-react';
import styles from './Gaming.module.css';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';

export function GPTab() {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const transactions = useLiveQuery(async () => {
    const txns = await db.gp_transactions.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
    return txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });
  const games = useLiveQuery(() => db.games.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  
  const totalGP = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

  const confirmDeleteTransaction = async () => {
    if (logToDelete) {
      await deleteAndTrack('gp_transactions', logToDelete);
      setLogToDelete(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>GP Ledger</div>
        <button 
          className={styles.primaryButton}
          onClick={() => setShowInfoModal(true)}
        >
          <HelpCircle size={16} /> GP Pointing System
        </button>
      </div>

      <div className={styles.gpDisplay}>
        <div className={styles.gpTotal}>{totalGP} GP</div>
        <div className={styles.gpLabel}>Total Game Points</div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', fontWeight: 600 }}>
          Transaction Ledger
        </div>
        {transactions?.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            No transactions yet. Add games and log sessions to earn GP!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {transactions?.map((t) => {
              const game = games?.find(g => g.id === t.game_id);
              return (
                <div key={t.id} className={styles.ledgerRow}>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.reason}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {game && (
                        <>
                          <span style={{ color: 'var(--mod-gaming-primary)', fontWeight: 600 }}>{game.title}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{new Date(t.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className={t.amount >= 0 ? styles.ledgerAmountPositive : styles.ledgerAmountNegative}>
                      {t.amount > 0 ? '+' : ''}{t.amount}
                    </div>
                  <button 
                    onClick={() => setLogToDelete(t.id)} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
                    title="Delete log"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {showInfoModal && (
        <div className={styles.modalOverlay} style={{ backdropFilter: 'blur(8px)' }}>
          <div className={styles.modalContent} style={{ maxWidth: '440px', padding: 0, overflow: 'hidden', border: 'none', borderRadius: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--mod-gaming-primary), #3b2c85)', padding: '32px 24px', textAlign: 'center', position: 'relative' }}>
              <button onClick={() => setShowInfoModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'white' }}><X size={18} /></button>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '4px solid rgba(255,255,255,0.4)' }}>
                <HelpCircle size={32} />
              </div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '24px', fontWeight: 800 }}>GP Pointing System</h3>
              <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>How you earn and spend Game Points</p>
            </div>
            
            <div className={styles.modalBody} style={{ padding: '24px', background: 'var(--card-bg)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                
                {/* PlayWish */}
                <div style={{ background: 'var(--canvas-surface)', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px' }}>Add to PlayWish</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Save a game for later</span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--text-secondary)', background: 'var(--card-bg)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--card-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>Free</span>
                </div>
                
                {/* Start Playing (New Game) */}
                <div style={{ background: 'var(--canvas-surface)', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '16px' }}>Start Playing</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Begin a new game directly</span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--text-secondary)', background: 'var(--card-bg)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--card-border)' }}>FREE</span>
                </div>

                {/* PlayWish to Playing */}
                <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fecaca' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: '#991b1b', fontSize: '16px' }}>PlayWish → Playing</span>
                    <span style={{ fontSize: '13px', color: '#b91c1c' }}>Start a game from your wishlist</span>
                  </div>
                  <span style={{ fontWeight: 900, color: 'white', background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '6px 14px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>−10 GP</span>
                </div>
                
                {/* Played / Tested */}
                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #dcfce7' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: '#166534', fontSize: '16px' }}>Played / Tested</span>
                    <span style={{ fontSize: '13px', color: '#10b981' }}>Play for &gt;1 hour</span>
                  </div>
                  <span style={{ fontWeight: 900, color: 'white', background: 'linear-gradient(135deg, #34d399, #10b981)', padding: '6px 14px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>+1 GP</span>
                </div>
                
                {/* Finished */}
                <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: '#065f46', fontSize: '16px' }}>Finish Game</span>
                    <span style={{ fontSize: '13px', color: '#059669' }}>Roll credits</span>
                  </div>
                  <span style={{ fontWeight: 900, color: 'white', background: 'linear-gradient(135deg, #10b981, #059669)', padding: '6px 14px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>+2 GP</span>
                </div>
                
                {/* Completed */}
                <div style={{ background: '#ecfeff', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #a5f3fc' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: '#164e63', fontSize: '16px' }}>Complete Game</span>
                    <span style={{ fontSize: '13px', color: '#06b6d4' }}>100% / Platinum</span>
                  </div>
                  <span style={{ fontWeight: 900, color: 'white', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', padding: '6px 14px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(6, 182, 212, 0.4)' }}>+5 GP</span>
                </div>
                
                {/* Skipped */}
                <div style={{ background: 'var(--canvas-surface)', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '16px' }}>Skip / Abandon</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Drop a game you started</span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--text-secondary)', background: 'var(--card-bg)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--card-border)' }}>−5 GP</span>
                </div>
                
              </div>
              
              <button 
                className={styles.primaryButton} 
                onClick={() => setShowInfoModal(false)} 
                style={{ width: '100%', justifyContent: 'center', marginTop: '24px', padding: '14px', fontSize: '16px', borderRadius: '12px', background: 'var(--mod-gaming-primary)', fontWeight: 700, boxShadow: '0 4px 12px rgba(92, 92, 191, 0.3)' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {logToDelete && (
        <DeleteConfirmationModal
          isOpen={!!logToDelete}
          title="Delete GP Log"
          message="Are you sure you want to delete this log? Your Total GP will automatically reflect this change."
          onConfirm={confirmDeleteTransaction}
          onCancel={() => setLogToDelete(null)}
        />
      )}
    </div>
  );
}

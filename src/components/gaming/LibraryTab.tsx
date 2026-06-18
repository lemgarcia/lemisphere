import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/utils';
import { syncManager } from '@/lib/sync/SyncManager';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { useGamingStore } from '@/stores/gamingStore';
import { Search, Plus, X, Trash2, Edit2, Play, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { Game, GamePlatform, GameStatus, GameSeries } from '@/types/modules';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Gaming.module.css';

const STATUSES: { value: GameStatus; label: string }[] = [
  { value: 'playwish', label: 'PlayWish' },
  { value: 'playing', label: 'Playing' },
  { value: 'played', label: 'Played' },
  { value: 'completed', label: 'Finished' },
  { value: 'mastered', label: 'Completed' },
  { value: 'pardoned', label: 'Pardoned' },
  { value: 'skipped', label: 'Skipped' },
];

const PLATFORMS: GamePlatform[] = ['PC', 'PS5', 'PS4', 'Switch', 'Xbox', 'Mobile', 'Other'];

function getStatusBadgeClass(status: GameStatus) {
  if (status === 'playing') return `${styles.badge} ${styles.statusPlaying}`;
  if (status === 'played') return `${styles.badge} ${styles.statusPlayed}`;
  if (status === 'completed') return `${styles.badge} ${styles.statusCompleted}`;
  if (status === 'mastered') return `${styles.badge} ${styles.statusMastered}`;
  if (status === 'pardoned') return `${styles.badge} ${styles.statusPardoned}`;
  return `${styles.badge} ${styles.statusBadge}`;
}

export function LibraryTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState<Game | null>(null);
  const [gameToDelete, setGameToDelete] = useState<string | null>(null);
  const [gpWarningModal, setGpWarningModal] = useState<{ required: number, current: number, action: string } | null>(null);
  const [newGame, setNewGame] = useState<Partial<Game> | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const { searchQuery, setSearchQuery } = useGamingStore();
  const games = useLiveQuery(() => db.games.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const seriesList = useLiveQuery(() => db.game_series.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const gpTransactions = useLiveQuery(() => db.gp_transactions.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  
  // Derive total GP
  const totalGP = gpTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

  const groupedGames = (STATUSES.map(s => s.value) as GameStatus[]).reduce((acc, status) => {
    acc[status] = games?.filter(g => g.status === status && g.title.toLowerCase().includes(searchQuery.toLowerCase())) || [];
    return acc;
  }, {} as Record<GameStatus, Game[]>);

  const handleAddGame = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const status = formData.get('status') as GameStatus;
    
    // "add currently playing games (0 gp)" -> new games added directly to playing are free.
    const newGame: Game = {
      id: generateId(),
      user_id: useAppStore.getState().userId || 'default',
      title: formData.get('title') as string,
      platform: formData.get('platform') as GamePlatform,
      status: status,
      series_id: formData.get('series_id') as string || undefined,
      cover_url: coverPreview || (formData.get('cover_url') as string) || undefined,
      chronological_order: formData.get('chronological_order') ? Number(formData.get('chronological_order')) : undefined,
      hours_played: 0,
      gp_earned: 0,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'default',
    };

    await db.games.add(newGame);
    syncManager.queueSync('gaming');
    setShowAddModal(false);
    setCoverPreview(null);
  };

  const handleUpdateStatus = async (gameId: string, currentStatus: GameStatus, newStatus: GameStatus, gameTitle: string) => {
    if (currentStatus === newStatus) return;

    // Get all past transactions for this game to know what milestones we've already hit
    const txns = await db.gp_transactions.where('game_id').equals(gameId).toArray();
    const hasStarted = txns.some(t => t.type === 'started');
    const hasPlayed = txns.some(t => t.type === 'played');
    const hasFinished = txns.some(t => t.type === 'completed');
    const hasCompleted = txns.some(t => t.type === 'hundred_percent');
    const hasSkipped = txns.some(t => t.type === 'skipped');

    const newTxns: any[] = [];
    let netGpChange = 0;

    const addTxn = (amount: number, reason: string, type: string) => {
      newTxns.push({
        id: generateId(),
        user_id: useAppStore.getState().userId || 'default',
        game_id: gameId,
        amount,
        reason,
        type,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        device_id: 'default',
      });
      netGpChange += amount;
    };

    // 1. Start Playing Entry Fee
    // Only charge if transitioning OUT of playwish/pardoned into an active state
    if (['playing', 'played', 'completed', 'mastered'].includes(newStatus)) {
      if ((currentStatus === 'playwish' || currentStatus === 'pardoned') && !hasStarted) {
        addTxn(-50, 'Started Playing', 'started');
      }
    }

    // 2. Reward Pool (Max 5 GP)
    let maxReward = 0;
    if (newStatus === 'played') maxReward = 1;
    if (newStatus === 'completed') maxReward = 2; // Finished
    if (newStatus === 'mastered') maxReward = 5;  // Completed

    // Calculate how much positive reward GP this game has already granted
    const totalEarned = txns
      .filter(t => t.amount > 0 && ['played', 'completed', 'hundred_percent'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);

    if (maxReward > totalEarned) {
      const grantAmount = maxReward - totalEarned;
      let rewardType = 'played';
      let rewardReason = 'Played / Tested';
      
      if (newStatus === 'completed') {
        rewardType = 'completed';
        rewardReason = 'Finished Game';
      } else if (newStatus === 'mastered') {
        rewardType = 'hundred_percent';
        rewardReason = 'Completed Game';
      }

      addTxn(grantAmount, rewardReason, rewardType);
    }

    // 3. Penalties
    if (newStatus === 'skipped') {
      if (!hasSkipped) addTxn(-5, 'Skipped / Abandoned', 'skipped');
    }

    if (netGpChange < 0 && totalGP < Math.abs(netGpChange)) {
      setGpWarningModal({ required: Math.abs(netGpChange), current: totalGP, action: `change status to ${STATUSES.find(s => s.value === newStatus)?.label || newStatus}` });
      return;
    }

    const updates: Partial<Game> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'completed' || newStatus === 'mastered') {
      updates.completed_at = new Date().toISOString();
    }
    if (newStatus === 'pardoned') {
      const pardonReason = window.prompt("Why are you pardoning this game? Was it too hard, boring, or just not for you? (Optional)");
      if (pardonReason !== null) {
        updates.pardon_reason = pardonReason;
      }
    }

    await db.transaction('rw', db.games, db.gp_transactions, async () => {
      await db.games.update(gameId, updates);
      for (const t of newTxns) {
        await db.gp_transactions.add(t);
      }
    });

    if (showGameModal) {
      setShowGameModal({ ...showGameModal, ...updates } as Game);
    }
    syncManager.queueSync('gaming');
  };

  const confirmDeleteGame = async () => {
    if (gameToDelete) {
      const gpTxns = await db.gp_transactions.where('game_id').equals(gameToDelete).toArray();
      for (const t of gpTxns) await deleteAndTrack('gp_transactions', t.id);
      await deleteAndTrack('games', gameToDelete);
      syncManager.queueSync('gaming');
      setShowGameModal(null);
      setGameToDelete(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Game Library</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input 
              className={styles.input} 
              style={{ paddingLeft: '32px', width: '200px', padding: '6px 12px 6px 32px' }} 
              placeholder="Search games..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className={styles.primaryButton} onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Game
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {STATUSES.map(statusObj => {
          const statusGames = groupedGames[statusObj.value];
          if (!statusGames || statusGames.length === 0) return null;

          return (
            <div key={statusObj.value}>
              <h2 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                {statusObj.label} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-tertiary)' }}>({statusGames.length})</span>
              </h2>
              <div className={styles.grid}>
                {statusGames.map((game) => (
                  <div key={game.id} className={styles.card} onClick={() => setShowGameModal(game)}>
                    {game.cover_url ? (
                      <img src={game.cover_url} alt={game.title} className={styles.coverImage} />
                    ) : (
                      <div className={styles.coverPlaceholder} style={{ flexDirection: 'column', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', lineHeight: '1.2', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{game.title}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {games?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
            Your library is empty. Click "Add Game" to get started!
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          >
            <motion.div 
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden' }}
            >
              <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, var(--card-bg), var(--bg-secondary))', borderBottom: '1px solid var(--card-border)' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Add New Game</h3>
                <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => { setShowAddModal(false); setCoverPreview(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} />
                </motion.button>
              </div>
              <form onSubmit={handleAddGame} className={styles.modalBody} style={{ padding: '24px' }}>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Title *</label>
                  <input required name="title" className={styles.input} placeholder="e.g. Elden Ring" style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Platform *</label>
                    <select name="platform" className={styles.input} required style={{ background: 'var(--bg-secondary)' }}>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Status *</label>
                    <select name="status" className={styles.input} required defaultValue="playing" style={{ background: 'var(--bg-secondary)' }}>
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Game Series (Optional)</label>
                  <select name="series_id" className={styles.input} style={{ background: 'var(--bg-secondary)' }}>
                    <option value="">-- None --</option>
                    {seriesList?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Cover Image</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {coverPreview && (
                      <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                        <img src={coverPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}><ImageIcon size={16} /></div>
                      <input name="cover_url" className={styles.input} placeholder="URL or..." disabled={!!coverPreview} style={{ paddingLeft: '36px', background: 'var(--bg-secondary)', width: '100%' }} />
                    </div>
                    <label style={{ cursor: 'pointer', padding: '10px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', transition: 'background 0.2s' }}>
                      Upload
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--card-border)' }}>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', fontWeight: 700 }}>Lore Order</label>
                    <input name="chronological_order" type="number" step="any" className={styles.input} placeholder="e.g. 1" style={{ background: 'var(--card-bg)' }} />
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className={styles.primaryButton} style={{ marginTop: '16px', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px' }}>
                  Add Game to Library
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGameModal && (
          <motion.div 
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          >
            <motion.div 
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden' }}
            >
              <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, var(--card-bg), var(--bg-secondary))', borderBottom: '1px solid var(--card-border)' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{showGameModal.title}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <motion.button whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.1)' }} whileTap={{ scale: 0.9 }} onClick={() => setGameToDelete(showGameModal.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete Game">
                    <Trash2 size={20} />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => setShowGameModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={20} />
                  </motion.button>
                </div>
              </div>
              <div className={styles.modalBody} style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  {showGameModal.cover_url ? (
                    <img src={showGameModal.cover_url} alt="Cover" style={{ width: '100px', height: '133px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }} />
                  ) : (
                    <div style={{ width: '100px', height: '133px', background: 'linear-gradient(135deg, var(--mod-gaming-primary), #4338ca)', color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                      {showGameModal.title.substring(0,2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px' }}>Status Update</label>
                    <select 
                      className={styles.input} 
                      style={{ width: '100%', background: 'var(--bg-secondary)' }}
                      value={showGameModal.status}
                      onChange={(e) => handleUpdateStatus(showGameModal.id, showGameModal.status, e.target.value as GameStatus, showGameModal.title)}
                    >
                      {STATUSES.filter(s => showGameModal.status !== 'playwish' || s.value === 'playwish' || s.value === 'playing').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: '1.4' }}>
                      Note: Moving from PlayWish to Playing costs 50 GP. Completing gives +5 GP.
                    </div>
                  </div>
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className={styles.primaryButton}
                  style={{ width: '100%', marginTop: '24px', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px' }}
                  onClick={() => {
                    useGamingStore.getState().setSelectedGameId(showGameModal.id);
                    useGamingStore.getState().setActiveTab('game_details');
                  }}
                >
                  View Full Details & Guides
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameToDelete && (
        <DeleteConfirmationModal
          isOpen={!!gameToDelete}
          title="Delete Game"
          message="Are you sure you want to delete this game? All associated GP transactions will be lost. This cannot be undone."
          onConfirm={confirmDeleteGame}
          onCancel={() => setGameToDelete(null)}
        />
      )}
      {gpWarningModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 10001, backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
          <div className={styles.modalContent} style={{ maxWidth: '420px', border: 'none', borderRadius: '24px', padding: '0', overflow: 'hidden', boxShadow: '0 24px 64px rgba(244, 63, 94, 0.2)' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--accent-rose), #e11d48)', padding: '32px 24px', textAlign: 'center', position: 'relative' }}>
              <button onClick={() => setGpWarningModal(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'white' }}><X size={18} /></button>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '4px solid rgba(255,255,255,0.4)' }}>
                <span style={{ fontSize: '32px', fontWeight: 900 }}>!</span>
              </div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '24px', fontWeight: 800 }}>Not Enough GP</h3>
            </div>
            <div className={styles.modalBody} style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--card-bg)' }}>
              <p style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '12px', fontWeight: 600 }}>
                You need <span style={{ color: 'var(--accent-rose)', fontWeight: 800 }}>{gpWarningModal.required} GP</span> to {gpWarningModal.action}.
              </p>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.5' }}>
                You currently have <strong>{gpWarningModal.current} GP</strong>. Play games and log your gaming sessions to earn more!
              </p>
              <button 
                className={styles.primaryButton} 
                onClick={() => setGpWarningModal(null)}
                style={{ width: '100%', padding: '14px', background: 'var(--accent-rose)', color: 'white', fontSize: '16px', borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)' }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

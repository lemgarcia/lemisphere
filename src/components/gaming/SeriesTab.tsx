import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/utils';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { useGamingStore } from '@/stores/gamingStore';
import { Plus, X, Star, Search, Trash2, Edit2, Folder, Image as ImageIcon } from 'lucide-react';
import styles from './Gaming.module.css';
import type { GameStatus, GamePlatform, GameSeries } from '@/types/modules';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

const PLATFORMS: GamePlatform[] = ['PC', 'PS5', 'PS4', 'Switch', 'Xbox', 'Mobile', 'Other'];

const STATUSES: { value: GameStatus; label: string }[] = [
  { value: 'playwish', label: 'PlayWish' },
  { value: 'playing', label: 'Playing' },
  { value: 'played', label: 'Played' },
  { value: 'completed', label: 'Finished' },
  { value: 'mastered', label: 'Completed' },
  { value: 'pardoned', label: 'Pardoned' },
  { value: 'skipped', label: 'Skipped' },
];

function getStatusBadgeClass(status: GameStatus) {
  if (status === 'playing') return `${styles.badge} ${styles.statusPlaying}`;
  if (status === 'played') return `${styles.badge} ${styles.statusPlayed}`;
  if (status === 'completed') return `${styles.badge} ${styles.statusCompleted}`;
  if (status === 'mastered') return `${styles.badge} ${styles.statusMastered}`;
  if (status === 'pardoned') return `${styles.badge} ${styles.statusPardoned}`;
  return `${styles.badge} ${styles.statusBadge}`;
}

export function SeriesTab() {
  const { searchQuery, selectedSeriesId, setSelectedSeriesId } = useGamingStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState<GameSeries | null>(null);
  const [seriesToDelete, setSeriesToDelete] = useState<string | null>(null);
  const [existingSearchQuery, setExistingSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'date_added' | 'chronological' | 'release_year'>('date_added');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [editingLoreOrderGame, setEditingLoreOrderGame] = useState<any>(null);

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

  const seriesList = useLiveQuery(() => db.game_series.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const games = useLiveQuery(() => db.games.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());

  const handleAddSeries = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await db.game_series.add({
      id: generateId(),
      user_id: useAppStore.getState().userId || 'default',
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      cover_url: coverPreview || (formData.get('cover_url') as string) || undefined,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'default'
    });
    setShowAddModal(false);
    setCoverPreview(null);
  };

  const handleEditSeries = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSeriesId) return;
    const formData = new FormData(e.currentTarget);
    await db.game_series.update(selectedSeriesId, {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      cover_url: coverPreview || (formData.get('cover_url') as string) || undefined,
      updated_at: new Date().toISOString()
    });
    setShowEditModal(false);
    setCoverPreview(null);
  };

  const confirmDeleteSeries = async () => {
    if (seriesToDelete) {
      try {
        await db.games.where('series_id').equals(seriesToDelete).modify(game => {
          delete game.series_id;
        });
        await deleteAndTrack('game_series', seriesToDelete);
        syncManager.queueSync('gaming');
        if (selectedSeriesId === seriesToDelete) setSelectedSeriesId(null);
        if (showSeriesModal?.id === seriesToDelete) setShowSeriesModal(null);
        setSeriesToDelete(null);
      } catch (error) {
        console.error('Failed to delete series:', error);
      }
    }
  };

  const handleAddGameToSeries = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSeriesId) return;
    const formData = new FormData(e.currentTarget);
    const status = formData.get('status') as GameStatus;
    
    await db.games.add({
      id: generateId(),
      user_id: useAppStore.getState().userId || 'default',
      title: formData.get('title') as string,
      platform: formData.get('platform') as GamePlatform,
      status: status,
      series_id: selectedSeriesId,
      cover_url: coverPreview || (formData.get('cover_url') as string) || undefined,
      genre: formData.get('genre') as string || undefined,
      release_year: formData.get('release_year') ? Number(formData.get('release_year')) : undefined,
      chronological_order: formData.get('chronological_order') ? Number(formData.get('chronological_order')) : undefined,
      hours_played: 0,
      gp_earned: 0,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'default',
    });
    setShowAddGameModal(false);
    setCoverPreview(null);
  };

  if (selectedSeriesId) {
    const series = seriesList?.find(s => s.id === selectedSeriesId);
    let seriesGames = games?.filter(g => g.series_id === selectedSeriesId) || [];
    if (sortOrder === 'release_year') {
      seriesGames = seriesGames.sort((a, b) => {
        const yearA = a.release_year || 9999;
        const yearB = b.release_year || 9999;
        return yearA - yearB;
      });
    } else if (sortOrder === 'chronological') {
      seriesGames = seriesGames.sort((a, b) => {
        const orderA = a.chronological_order ?? 9999;
        const orderB = b.chronological_order ?? 9999;
        return orderA - orderB;
      });
    }

    return (
      <div className={styles.container}>
        <div className={styles.header} style={{ alignItems: 'flex-start' }}>
          <div>
            <button onClick={() => setSelectedSeriesId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', marginBottom: '8px' }}>
              ← Back to Series
            </button>
            <div className={styles.title}>{series?.name}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{series?.description}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={styles.primaryButton} 
                style={{ background: series?.is_favorite ? 'var(--mod-gaming-light)' : 'rgba(255,255,255,0.5)', color: series?.is_favorite ? 'var(--mod-gaming-primary)' : 'var(--text-tertiary)', border: '1px solid var(--card-border)' }}
                onClick={() => db.game_series.update(series!.id, { is_favorite: !series?.is_favorite })}
                title="Toggle Favorite"
              >
                <Star size={14} fill={series?.is_favorite ? "currentColor" : "none"} />
              </button>
              <button className={styles.primaryButton} onClick={() => setShowAddGameModal(true)} style={{ background: 'rgba(255,255,255,0.5)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                <Plus size={14} /> New Game
              </button>
              <button className={styles.primaryButton} onClick={() => setShowAddExistingModal(true)}>
                <Folder size={14} /> Add Existing
              </button>
              <button className={styles.primaryButton} onClick={() => setShowEditModal(true)} style={{ background: 'rgba(255,255,255,0.5)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                <Edit2 size={14} /> Edit
              </button>
              <button className={styles.primaryButton} onClick={() => setSeriesToDelete(series!.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
            <select className={styles.input} value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'date_added' | 'chronological' | 'release_year')} style={{ padding: '6px 12px', fontSize: '13px' }}>
              <option value="date_added">Sort: Date Added</option>
              <option value="release_year">Sort: Release Year</option>
              <option value="chronological">Sort: Chronological (Lore)</option>
            </select>
          </div>
        </div>
        
        <div className={styles.grid}>
          {seriesGames.map((game) => (
            <div 
              key={game.id} 
              className={styles.card} 
              onClick={() => {
                setSelectedSeriesId(null);
                useGamingStore.getState().setSelectedGameId(game.id);
                useGamingStore.getState().setActiveTab('game_details');
              }}
            >
              {game.cover_url ? (
                <img src={game.cover_url} alt={game.title} className={styles.coverImage} />
              ) : (
                <div className={styles.coverPlaceholder}>
                  {game.title.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className={styles.cardInfo}>
                <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {game.title}
                  {game.is_favorite && <Star size={14} fill="var(--mod-gaming-primary)" color="var(--mod-gaming-primary)" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLoreOrderGame(game);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}
                    title="Edit Lore Order"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
                {game.status === 'pardoned' && game.pardon_reason && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '4px' }}>
                    "{game.pardon_reason}"
                  </div>
                )}
              </div>
              <div className={styles.cardFooter}>
                <span className={getStatusBadgeClass(game.status)}>
                  {STATUSES.find(s => s.value === game.status)?.label || game.status}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {Math.round(game.hours_played)}h
                </span>
              </div>
            </div>
          ))}
          {seriesGames.length === 0 && (
            <div style={{ padding: '24px', color: 'var(--text-tertiary)' }}>No games added to this series yet. Go to Library to add some.</div>
          )}
        </div>

      <AnimatePresence>
        {showEditModal && (
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
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Game Series</h3>
                <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => { setShowEditModal(false); setCoverPreview(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></motion.button>
              </div>
              <form onSubmit={handleEditSeries} className={styles.modalBody} style={{ padding: '24px' }}>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Series Name *</label>
                  <input required name="name" className={styles.input} defaultValue={series?.name} style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Description (Optional)</label>
                  <input name="description" className={styles.input} defaultValue={series?.description} style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Cover Image</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {(coverPreview || series?.cover_url) && (
                      <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                        <img src={coverPreview || series?.cover_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}><ImageIcon size={16} /></div>
                      <input name="cover_url" className={styles.input} defaultValue={series?.cover_url || ''} placeholder="URL or..." disabled={!!coverPreview} style={{ paddingLeft: '36px', background: 'var(--bg-secondary)', width: '100%' }} />
                    </div>
                    <label style={{ cursor: 'pointer', padding: '10px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', transition: 'background 0.2s' }}>
                      Upload
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className={styles.primaryButton} style={{ marginTop: '16px', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px' }}>
                  Save Changes
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddGameModal && (
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
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Add Game to {series?.name}</h3>
                <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => { setShowAddGameModal(false); setCoverPreview(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></motion.button>
              </div>
              <form onSubmit={handleAddGameToSeries} className={styles.modalBody} style={{ padding: '24px' }}>
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
                    <select name="status" className={styles.input} required style={{ background: 'var(--bg-secondary)' }}>
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
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
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', fontWeight: 700 }}>Genre</label>
                    <input name="genre" className={styles.input} placeholder="e.g. RPG" style={{ background: 'var(--card-bg)' }} />
                  </div>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', fontWeight: 700 }}>Release Year</label>
                    <input name="release_year" type="number" className={styles.input} placeholder="2022" style={{ background: 'var(--card-bg)' }} />
                  </div>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', fontWeight: 700 }}>Lore Order</label>
                    <input name="chronological_order" type="number" step="any" className={styles.input} placeholder="e.g. 1" style={{ background: 'var(--card-bg)' }} />
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className={styles.primaryButton} style={{ marginTop: '16px', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px' }}>
                  Save Game
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {showAddExistingModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
              <div className={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>Add Existing Games to {series?.name}</h3>
                <button onClick={() => setShowAddExistingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div className={styles.modalBody} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--card-border)', marginBottom: '16px' }}>
                  <input 
                    className={styles.input} 
                    style={{ width: '100%' }} 
                    placeholder="Search your library..." 
                    value={existingSearchQuery}
                    onChange={(e) => setExistingSearchQuery(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {games?.filter(g => g.series_id !== selectedSeriesId && g.title.toLowerCase().includes(existingSearchQuery.toLowerCase())).length === 0 && (
                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>
                      No games found.
                    </div>
                  )}
                  {games?.filter(g => g.series_id !== selectedSeriesId && g.title.toLowerCase().includes(existingSearchQuery.toLowerCase())).map(game => (
                    <div 
                      key={game.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 16px', 
                        background: 'var(--card-bg)', 
                        border: '1px solid var(--card-border)', 
                        borderRadius: '8px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {game.cover_url ? (
                          <img src={game.cover_url} alt={game.title} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--mod-gaming-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {game.title.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{game.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{game.platform}</div>
                        </div>
                      </div>
                      <button 
                        className={styles.primaryButton}
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={async () => {
                          await db.games.update(game.id, { series_id: selectedSeriesId, sync_status: 'pending', updated_at: new Date().toISOString() });
                        }}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {seriesToDelete && (
          <DeleteConfirmationModal
            isOpen={!!seriesToDelete}
            title="Delete Game Series"
            message="Are you sure you want to delete this series? The games will remain in your library."
            onConfirm={confirmDeleteSeries}
            onCancel={() => setSeriesToDelete(null)}
          />
        )}
      </div>
    );
  }

  const filteredSeries = seriesList?.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Game Series Collections</div>
        <button className={styles.primaryButton} onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> New Series
        </button>
      </div>

      <div className={styles.grid}>
        {filteredSeries?.map((series) => {
          const count = games?.filter(g => g.series_id === series.id).length || 0;
          return (
            <div key={series.id} className={styles.card} onClick={() => setShowSeriesModal(series)}>
              {series.cover_url ? (
                <img src={series.cover_url} alt={series.name} className={styles.coverImage} />
              ) : (
                <div className={styles.coverPlaceholder} style={{ flexDirection: 'column', padding: '16px', textAlign: 'center' }}>
                  <Folder size={48} color="white" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '16px', lineHeight: '1.2', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{series.name}</div>
                </div>
              )}
            </div>
          );
        })}
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
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Create Game Series</h3>
                <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => { setShowAddModal(false); setCoverPreview(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></motion.button>
              </div>
              <form onSubmit={handleAddSeries} className={styles.modalBody} style={{ padding: '24px' }}>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Series Name *</label>
                  <input required name="name" className={styles.input} placeholder="e.g. Final Fantasy" style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Description (Optional)</label>
                  <input name="description" className={styles.input} placeholder="Mainline and spin-offs" style={{ background: 'var(--bg-secondary)' }} />
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
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className={styles.primaryButton} style={{ marginTop: '16px', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px' }}>
                  Create Series
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSeriesModal && (
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
              style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden', maxWidth: '400px' }}
            >
              <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, var(--card-bg), var(--bg-secondary))', borderBottom: '1px solid var(--card-border)' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{showSeriesModal.name}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <motion.button whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.1)' }} whileTap={{ scale: 0.9 }} onClick={() => setSeriesToDelete(showSeriesModal.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete Series">
                    <Trash2 size={20} />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => setShowSeriesModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={20} />
                  </motion.button>
                </div>
              </div>
              <div className={styles.modalBody} style={{ textAlign: 'center', padding: '32px 24px' }}>
                {showSeriesModal.cover_url ? (
                  <img src={showSeriesModal.cover_url} alt={showSeriesModal.name} style={{ margin: '0 auto 20px', width: '140px', height: '140px', borderRadius: '20px', objectFit: 'cover', boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }} />
                ) : (
                  <div style={{ margin: '0 auto 20px', width: '140px', height: '140px', background: 'linear-gradient(135deg, var(--mod-gaming-primary), #4338ca)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }}>
                    <Folder size={64} color="white" />
                  </div>
                )}
                <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  {showSeriesModal.name}
                  {showSeriesModal.is_favorite && <Star size={20} fill="var(--mod-gaming-primary)" color="var(--mod-gaming-primary)" />}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '15px', lineHeight: '1.5' }}>
                  {showSeriesModal.description || 'No description provided.'}
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 20px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px', border: '1px solid var(--card-border)' }}>
                  <span style={{ color: 'var(--mod-gaming-primary)', fontWeight: 'bold', fontSize: '16px' }}>
                    {games?.filter(g => g.series_id === showSeriesModal.id).length || 0}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Games Included</span>
                </div>
                
                {games?.filter(g => g.series_id === showSeriesModal.id).length ? (
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '24px', maxWidth: '100%' }} className={styles.hideScrollbar}>
                    {games?.filter(g => g.series_id === showSeriesModal.id).map(game => (
                      <div key={game.id} style={{ flexShrink: 0, width: '70px', textAlign: 'center' }}>
                        {game.cover_url ? (
                          <img src={game.cover_url} alt={game.title} style={{ width: '70px', height: '95px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        ) : (
                          <div style={{ width: '70px', height: '95px', background: 'linear-gradient(135deg, var(--mod-gaming-primary), #4338ca)', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            {game.title.substring(0,2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', marginTop: '8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }} title={game.title}>
                          {game.title}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className={styles.primaryButton}
                  style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px' }}
                  onClick={() => {
                    setSelectedSeriesId(showSeriesModal.id);
                    setShowSeriesModal(null);
                  }}
                >
                  Open Series Folder
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {seriesToDelete && (
        <DeleteConfirmationModal
          isOpen={!!seriesToDelete}
          title="Delete Game Series"
          message="Are you sure you want to delete this series? The games will remain in your library."
          onConfirm={confirmDeleteSeries}
          onCancel={() => setSeriesToDelete(null)}
        />
      )}

      <AnimatePresence>
        {editingLoreOrderGame && (
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
              style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden', maxWidth: '350px' }}
            >
              <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, var(--card-bg), var(--bg-secondary))', borderBottom: '1px solid var(--card-border)' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Lore Order</h3>
                <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => setEditingLoreOrderGame(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} />
                </motion.button>
              </div>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const newOrderStr = formData.get('chronological_order') as string;
                  const newOrder = newOrderStr ? Number(newOrderStr) : undefined;
                  await db.games.update(editingLoreOrderGame.id, { chronological_order: newOrder, sync_status: 'pending', updated_at: new Date().toISOString() });
                  syncManager.queueSync('gaming');
                  setEditingLoreOrderGame(null);
                }} 
                className={styles.modalBody} 
                style={{ padding: '24px' }}
              >
                <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Set the lore order for <strong>{editingLoreOrderGame.title}</strong>
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Lore Order</label>
                  <input name="chronological_order" type="number" step="any" className={styles.input} defaultValue={editingLoreOrderGame.chronological_order || ''} placeholder="e.g. 1" style={{ background: 'var(--bg-secondary)' }} autoFocus />
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className={styles.primaryButton} style={{ marginTop: '16px', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px', width: '100%' }}>
                  Save
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

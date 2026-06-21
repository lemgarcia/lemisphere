import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { useGamingStore } from '@/stores/gamingStore';
import { ChevronLeft, Plus, X, Edit2, Trash2, ExternalLink, Calendar, Gamepad2, Award, ArrowRight, Play, Image as ImageIcon, Star } from 'lucide-react';
import type { GamePlatform, GameLink } from '@/types/modules';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Gaming.module.css';

const PLATFORMS: GamePlatform[] = ['PC', 'PS5', 'PS4', 'Switch', 'Xbox', 'Mobile', 'Other'];

const STATUSES: { value: import('@/types/modules').GameStatus; label: string }[] = [
  { value: 'playwish', label: 'PlayWish' },
  { value: 'playing', label: 'Playing' },
  { value: 'played', label: 'Played' },
  { value: 'completed', label: 'Finished' },
  { value: 'mastered', label: 'Completed' },
  { value: 'pardoned', label: 'Pardoned' },
  { value: 'skipped', label: 'Skipped' },
];
export function GameDetailsTab() {
  const { selectedGameId, setActiveTab, setSelectedGameId } = useGamingStore();
  
  const game = useLiveQuery(() => selectedGameId ? db.games.get(selectedGameId) : undefined, [selectedGameId]);
  const seriesList = useLiveQuery(() => db.game_series.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  
  const [notes, setNotes] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  useEffect(() => {
    if (game && game.notes !== undefined) {
      setNotes(game.notes);
    }
  }, [game?.id]); // Only update when switching games to avoid overwriting typing

  const handleSaveNotes = async () => {
    if (selectedGameId) {
      await db.games.update(selectedGameId, { notes, sync_status: 'pending', updated_at: new Date().toISOString() });
      // Show some temporary success state if needed
    }
  };

  const handleToggleFavorite = async () => {
    if (!game) return;
    await db.games.update(game.id, { is_favorite: !game.is_favorite, sync_status: 'pending', updated_at: new Date().toISOString() });
  };

  const confirmDeleteGame = async () => {
    if (!game) return;
    const gpTxns = await db.gp_transactions.where('game_id').equals(game.id).toArray();
    for (const t of gpTxns) await deleteAndTrack('gp_transactions', t.id);
    await deleteAndTrack('games', game.id);
    syncManager.queueSync('gaming');
    setSelectedGameId(null);
    setActiveTab('library');
    setShowDeleteModal(false);
  };

  const handleEditGame = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!game) return;
    
    const formData = new FormData(e.currentTarget);
    const updates = {
      title: formData.get('title') as string,
      platform: formData.get('platform') as GamePlatform,
      series_id: formData.get('series_id') as string || undefined,
      cover_url: coverPreview || (formData.get('cover_url') as string) || undefined,
      genre: formData.get('genre') as string || undefined,
      release_year: formData.get('release_year') ? Number(formData.get('release_year')) : undefined,
      chronological_order: formData.get('chronological_order') ? Number(formData.get('chronological_order')) : undefined,
      sync_status: 'pending' as const,
      updated_at: new Date().toISOString(),
    };

    await db.games.update(game.id, updates);
    setShowEditModal(false);
    setCoverPreview(null);
  };

  const handleAddLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!game) return;
    const formData = new FormData(e.currentTarget);
    const newLink: GameLink = {
      id: generateId(),
      title: formData.get('title') as string,
      url: formData.get('url') as string,
    };
    const updatedLinks = [...(game.links || []), newLink];
    await db.games.update(game.id, { links: updatedLinks, sync_status: 'pending', updated_at: new Date().toISOString() });
    setShowLinkModal(false);
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!game) return;
    const updatedLinks = (game.links || []).filter(l => l.id !== linkId);
    await db.games.update(game.id, { links: updatedLinks, sync_status: 'pending', updated_at: new Date().toISOString() });
  };

  if (!game) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
          Game not found or loading...
        </div>
        <button className={styles.primaryButton} onClick={() => setActiveTab('library')} style={{ margin: '0 auto' }}>
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <button 
          onClick={() => {
            setSelectedGameId(null);
            setActiveTab('library');
          }} 
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}
        >
          ← Back to Library
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={styles.primaryButton} 
            style={{ background: game.is_favorite ? 'var(--mod-gaming-light)' : 'rgba(255,255,255,0.5)', color: game.is_favorite ? 'var(--mod-gaming-primary)' : 'var(--text-tertiary)', border: '1px solid var(--card-border)' }}
            onClick={handleToggleFavorite}
          >
            <Star size={16} fill={game.is_favorite ? "currentColor" : "none"} />
          </button>
          <button 
            className={styles.primaryButton} 
            style={{ background: 'rgba(255,255,255,0.5)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
            onClick={() => setShowEditModal(true)}
          >
            <Edit2 size={16} /> Edit
          </button>
          <button 
            className={styles.primaryButton} 
            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Game Meta Column */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {game.cover_url ? (
            <img src={game.cover_url} alt={game.title} style={{ width: '100%', borderRadius: '16px', objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} />
          ) : (
            <div style={{ width: '100%', height: '300px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--mod-gaming-primary), #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 900, color: 'white', textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>
              {game.title.substring(0, 2).toUpperCase()}
            </div>
          )}

          <div style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 800 }}>{game.title}</h1>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {game.platform} {game.genre ? `• ${game.genre}` : ''} {game.release_year ? `• ${game.release_year}` : ''}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{game.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>GP Earned</span>
                <span style={{ fontWeight: 600, color: '#10b981' }}>+{game.gp_earned}</span>
              </div>
              {game.pardon_reason && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Pardon Reason:</span>
                  <div style={{ fontStyle: 'italic', fontSize: '14px', color: 'var(--text-secondary)' }}>"{game.pardon_reason}"</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Guides & Tips Column */}
        <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Guides, Tips & Notes</h2>
              <button className={styles.primaryButton} onClick={handleSaveNotes} style={{ padding: '6px 12px', fontSize: '13px' }}>
                Save Notes
              </button>
            </div>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write down strategy guides, boss tips, build notes, or checklists here..."
              style={{
                flex: 1,
                minHeight: '400px',
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--card-border)',
                background: 'rgba(0,0,0,0.02)',
                fontSize: '15px',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none'
              }}
              onBlur={handleSaveNotes}
            />
          </div>

          <div style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Helpful Links</h2>
              <button className={styles.primaryButton} onClick={() => setShowLinkModal(true)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                <Plus size={14} /> Add Link
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!game.links || game.links.length === 0) && (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', fontStyle: 'italic' }}>No links added yet. Save wikis, guides, or builds here!</div>
              )}
              {game.links?.map(link => (
                <div key={link.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mod-gaming-primary)', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                    <ExternalLink size={16} />
                    {link.title}
                  </a>
                  <button onClick={() => handleDeleteLink(link.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Game</h3>
                <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => { setShowEditModal(false); setCoverPreview(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></motion.button>
              </div>
              <form onSubmit={handleEditGame} className={styles.modalBody} style={{ padding: '24px' }}>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Title *</label>
                  <input required name="title" className={styles.input} defaultValue={game.title} style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Platform *</label>
                    <select name="platform" className={styles.input} required defaultValue={game.platform} style={{ background: 'var(--bg-secondary)' }}>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Status</label>
                    <input disabled className={styles.input} value={STATUSES.find(s => s.value === game.status)?.label || game.status} style={{ background: 'var(--bg-secondary)', opacity: 0.7 }} />
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Game Series (Optional)</label>
                  <select name="series_id" className={styles.input} defaultValue={game.series_id || ''} style={{ background: 'var(--bg-secondary)' }}>
                    <option value="">-- None --</option>
                    {seriesList?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Cover Image</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {(coverPreview || game?.cover_url) && (
                      <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                        <img src={coverPreview || game?.cover_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}><ImageIcon size={16} /></div>
                      <input name="cover_url" className={styles.input} defaultValue={game.cover_url || ''} placeholder="URL or..." disabled={!!coverPreview} style={{ paddingLeft: '36px', background: 'var(--bg-secondary)', width: '100%' }} />
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
                    <input name="genre" className={styles.input} defaultValue={game.genre || ''} style={{ background: 'var(--card-bg)' }} />
                  </div>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', fontWeight: 700 }}>Release Year</label>
                    <input name="release_year" type="number" className={styles.input} defaultValue={game.release_year || ''} style={{ background: 'var(--card-bg)' }} />
                  </div>
                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', fontWeight: 700 }}>Timeline Position</label>
                    <input name="chronological_order" type="number" step="any" className={styles.input} defaultValue={game.chronological_order || ''} placeholder="e.g. 1" style={{ background: 'var(--card-bg)' }} />
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
        {showLinkModal && (
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
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Add Link</h3>
                <motion.button whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-secondary)' }} whileTap={{ scale: 0.9 }} onClick={() => setShowLinkModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></motion.button>
              </div>
              <form onSubmit={handleAddLink} className={styles.modalBody} style={{ padding: '24px' }}>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>Link Title *</label>
                  <input required name="title" className={styles.input} placeholder="e.g. IGN 100% Walkthrough" style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <div className={styles.inputGroup}>
                  <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>URL *</label>
                  <input required type="url" name="url" className={styles.input} placeholder="https://..." style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className={styles.primaryButton} style={{ marginTop: '16px', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 700, borderRadius: '12px' }}>
                  Save Link
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showDeleteModal && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          title="Delete Game"
          message={`Are you sure you want to delete "${game.title}"? All associated GP transactions will be lost. This cannot be undone.`}
          onConfirm={confirmDeleteGame}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

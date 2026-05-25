import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { useBudgieStore } from '@/stores/budgieStore';
import { Plus, X, Camera, Pencil, Trash2, Check, ExternalLink, Calendar, Heart } from 'lucide-react';
import type { BirdProfile } from '@/types/modules';
import styles from './Budgie.module.css';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

export function ProfileTab() {
  const { selectedBirdId, setSelectedBirdId, setActiveTab } = useBudgieStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBird, setEditingBird] = useState<BirdProfile | null>(null);
  const [viewingBird, setViewingBird] = useState<BirdProfile | null>(null);
  const [birdToDelete, setBirdToDelete] = useState<string | null>(null);

  const birds = useLiveQuery(() => db.bird_profiles.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = useLiveQuery(() => db.care_events.where('date').equals(todayStr).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray(), [todayStr]);

  const viewingBirdCareEvents = useLiveQuery(() => {
    if (!viewingBird) return [];
    return db.care_events.where('bird_id').equals(viewingBird.id).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
  }, [viewingBird?.id]);

  const viewingBirdTrainingSessions = useLiveQuery(() => {
    if (!viewingBird) return [];
    return db.training_sessions.where('bird_id').equals(viewingBird.id).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
  }, [viewingBird?.id]);

  const [isSaving, setIsSaving] = useState(false);

  const handleAddBird = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      
      let photo_url = undefined;
      const file = formData.get('photo') as File;
      if (file && file.size > 0) {
        photo_url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      } else if (editingBird) {
        photo_url = editingBird.photo_url;
      }

      const newBird: BirdProfile = {
        id: editingBird ? editingBird.id : generateId(),
        user_id: useAppStore.getState().userId || 'default',
        name: formData.get('name') as string,
        species: 'Budgerigar',
        color_mutation: formData.get('color_mutation') as string,
        gender: formData.get('gender') as 'male' | 'female' | 'unknown',
        adopt_date: formData.get('adopt_date') as string || undefined,
        linked_bird_id: formData.get('linked_bird_id') as string || undefined,
        photo_url: photo_url,
        is_active: true,
        sync_status: 'local', // Must be local so it gets pushed!
        created_at: editingBird ? editingBird.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: editingBird ? editingBird.version + 1 : 1,
        device_id: 'browser'
      };
      
      if (editingBird) {
        await db.bird_profiles.update(editingBird.id, newBird);
      } else {
        await db.bird_profiles.add(newBird);
      }
      syncManager.queueSync('budgie');
      
      setShowAddModal(false);
      setEditingBird(null);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteBird = async () => {
    if (birdToDelete) {
      const careEvents = await db.care_events.where('bird_id').equals(birdToDelete).toArray();
      for (const e of careEvents) await deleteAndTrack('care_events', e.id);
      const sessions = await db.training_sessions.where('bird_id').equals(birdToDelete).toArray();
      for (const s of sessions) await deleteAndTrack('training_sessions', s.id);
      const tricks = await db.trick_progress.where('bird_id').equals(birdToDelete).toArray();
      for (const t of tricks) await deleteAndTrack('trick_progress', t.id);
      const blueprints = await db.training_blueprints.where('bird_id').equals(birdToDelete).toArray();
      for (const bp of blueprints) await deleteAndTrack('training_blueprints', bp.id);
      await deleteAndTrack('bird_profiles', birdToDelete);
      if (selectedBirdId === birdToDelete) setSelectedBirdId(null);
      setBirdToDelete(null);
      syncManager.queueSync('budgie');
    }
  };

  const handleEditBird = (e: React.MouseEvent, bird: BirdProfile) => {
    e.stopPropagation();
    setEditingBird(bird);
    setShowAddModal(true);
    
    // Auto-populate photo preview
    setTimeout(() => {
      const img = document.getElementById('photo-preview') as HTMLImageElement;
      if (img && bird.photo_url) {
        img.src = bird.photo_url;
        img.style.display = 'block';
      }
    }, 50);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>My Flock</div>
        <button className={styles.primaryButton} onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Bird
        </button>
      </div>

      <div className={styles.grid}>
        {birds?.map((bird) => (
          <div 
            key={bird.id} 
            className={styles.card} 
            style={{ border: selectedBirdId === bird.id ? '2px solid var(--mod-budgie-primary)' : '', cursor: 'pointer' }}
            onClick={() => setViewingBird(bird)}
          >
            
            {(() => {
               const birdEvents = todayEvents?.filter(e => e.bird_id === bird.id) || [];
               const uniqueChecklists = new Set(birdEvents.filter(e => {
                 if (e.notes === '[Checklist: veggies]' && e.food_type === 'Veggies / Chop') return false;
                 return e.notes?.startsWith('[Checklist:');
               }).map(e => e.notes)).size;
               const progressPercent = (uniqueChecklists / 5) * 100;
               return (
                 <div style={{ position: 'relative', width: '136px', height: '136px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <svg width="136" height="136" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                      <circle cx="68" cy="68" r="64" fill="none" stroke="var(--canvas-surface)" strokeWidth="6" />
                      <circle cx="68" cy="68" r="64" fill="none" stroke="var(--mod-budgie-primary)" strokeWidth="6" 
                        strokeDasharray={2 * Math.PI * 64} 
                        strokeDashoffset={2 * Math.PI * 64 * (1 - progressPercent / 100)} 
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        strokeLinecap="round" />
                    </svg>
                    {bird.photo_url ? (
                      <img src={bird.photo_url} alt={bird.name} style={{ width: '116px', height: '116px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--card-bg)', zIndex: 1 }} />
                    ) : (
                      <div style={{ width: '116px', height: '116px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--mod-budgie-light), #17a085)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', border: '4px solid var(--card-bg)', zIndex: 1, color: 'white' }}>
                        🦜
                      </div>
                    )}
                    {progressPercent === 100 && (
                       <div style={{ position: 'absolute', bottom: '0px', right: '0px', background: 'var(--mod-budgie-primary)', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, border: '4px solid var(--card-bg)' }}>
                          <Check size={16} strokeWidth={3} />
                       </div>
                    )}
                 </div>
               );
            })()}
            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{bird.name}</div>
              <div className={styles.cardSubtitle}>{bird.color_mutation} • <span style={{ textTransform: 'capitalize' }}>{bird.gender}</span>{bird.adopt_date ? ` • Adopted ${bird.adopt_date}` : ''}</div>
              {(() => {
                if (!birds) return null;
                const linkedBird = birds.find(b => b.id === bird.linked_bird_id || b.linked_bird_id === bird.id);
                if (linkedBird && linkedBird.id !== bird.id) {
                  return (
                    <div style={{ fontSize: '12px', color: 'var(--mod-budgie-primary)', marginTop: '4px' }}>
                      🔗 Linked to {linkedBird.name}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        ))}
        {birds?.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
            No birds added yet. Add your first feathered friend!
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewingBird && (
          <motion.div 
            className={styles.modalOverlay} 
            onClick={() => setViewingBird(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <motion.div 
              className={styles.modalContent} 
              onClick={e => e.stopPropagation()} 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ 
                maxWidth: '420px', 
                textAlign: 'center', 
                position: 'relative',
                background: 'var(--card-bg)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                borderRadius: '24px',
                padding: '0',
                overflow: 'hidden'
              }}
            >
              {/* Header Gradient Banner */}
              <div style={{ height: '100px', background: 'linear-gradient(135deg, var(--mod-budgie-primary), #0d9488)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.3)' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setViewingBird(null); 
                      setTimeout(() => {
                        setEditingBird(viewingBird);
                        setShowAddModal(true);
                        setTimeout(() => {
                          const img = document.getElementById('photo-preview') as HTMLImageElement;
                          if (img && viewingBird.photo_url) {
                            img.src = viewingBird.photo_url;
                            img.style.display = 'block';
                          }
                        }, 50);
                      }, 250); 
                    }}
                    style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', outline: 'none' }}
                  >
                    <Pencil size={16} />
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(239,68,68,0.5)', borderColor: 'rgba(239,68,68,0.5)' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setViewingBird(null); 
                      setTimeout(() => setBirdToDelete(viewingBird.id), 250); 
                    }}
                    style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fef08a', outline: 'none' }}
                  >
                    <Trash2 size={16} />
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.3)' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); setViewingBird(null); }} 
                    style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '4px', color: 'white', outline: 'none' }}>
                    <X size={20} />
                  </motion.button>
                </div>
              </div>

              {/* Profile Image */}
              <div style={{ marginTop: '-60px', position: 'relative', zIndex: 10 }}>
                {viewingBird.photo_url ? (
                  <img src={viewingBird.photo_url} alt={viewingBird.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto', display: 'block', border: '4px solid var(--card-bg)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }} />
                ) : (
                  <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--mod-budgie-light), #17a085)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', margin: '0 auto', border: '4px solid var(--card-bg)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                    🦜
                  </div>
                )}
              </div>

              <div style={{ padding: '24px 32px' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{viewingBird.name}</h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                  <span style={{ background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', border: '1px solid var(--card-border)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {viewingBird.color_mutation} • <span style={{ textTransform: 'capitalize' }}>{viewingBird.gender}</span>
                  </span>
                  
                  {viewingBird.adopt_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '14px', marginTop: '4px' }}>
                      <Calendar size={14} /> Adopted {viewingBird.adopt_date}
                    </div>
                  )}

                  {(() => {
                    if (!birds) return null;
                    const linkedBird = birds.find(b => b.id === viewingBird.linked_bird_id || b.linked_bird_id === viewingBird.id);
                    if (linkedBird && linkedBird.id !== viewingBird.id) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--mod-budgie-primary)', marginTop: '4px', fontWeight: 500, fontSize: '14px' }}>
                          <Heart size={14} fill="currentColor" /> Linked to {linkedBird.name}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '20px', margin: '0 0 24px 0', textAlign: 'left', border: '1px solid var(--card-border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Quick Stats</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--mod-budgie-primary)', marginBottom: '2px' }}>{viewingBirdTrainingSessions?.length || 0}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Training Sessions</div>
                    </div>
                    <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--mod-budgie-primary)', marginBottom: '2px' }}>{viewingBirdCareEvents?.length || 0}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Care Events</div>
                    </div>
                    {(() => {
                      const lastWeight = viewingBirdCareEvents?.filter(e => e.type === 'weight_check').sort((a,b) => b.date.localeCompare(a.date))[0];
                      if (lastWeight && lastWeight.value) {
                        return (
                          <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: 500 }}>Last Weight ({lastWeight.date})</div>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{lastWeight.value}g</div>
                            </div>
                            <div style={{ background: 'var(--mod-budgie-primary)', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                              Weight
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      if (!viewingBirdTrainingSessions || viewingBirdTrainingSessions.length === 0) return null;
                      const counts: Record<string, number> = {};
                      let maxCount = 0;
                      let topCode = '';
                      viewingBirdTrainingSessions.forEach(s => {
                        counts[s.training_code] = (counts[s.training_code] || 0) + 1;
                        if (counts[s.training_code] > maxCount) {
                          maxCount = counts[s.training_code];
                          topCode = s.training_code;
                        }
                      });
                      if (topCode) {
                        return (
                          <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: 500 }}>Most Practiced ({maxCount}x)</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topCode}</div>
                            </div>
                            <div style={{ background: 'var(--mod-budgie-secondary)', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                              Trick
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button 
                    className={styles.primaryButton} 
                    style={{ justifyContent: 'center', padding: '14px', borderRadius: '12px', fontWeight: 600, background: 'var(--mod-budgie-primary)', color: 'white' }}
                    onClick={() => { setSelectedBirdId(viewingBird.id); setActiveTab('care'); setViewingBird(null); }}
                  >
                    View Care Log
                  </button>
                  <button 
                    className={styles.primaryButton} 
                    style={{ justifyContent: 'center', padding: '14px', borderRadius: '12px', background: 'transparent', color: 'var(--mod-budgie-primary)', border: '2px solid var(--mod-budgie-primary)', fontWeight: 600 }}
                    onClick={() => { setSelectedBirdId(viewingBird.id); setActiveTab('training'); setViewingBird(null); }}
                  >
                    View Training
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {(showAddModal || editingBird) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{editingBird ? 'Edit Bird Profile' : 'Add Bird Profile'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingBird(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddBird} className={styles.modalBody}>
              <div className={styles.inputGroup} style={{ alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--mod-budgie-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={() => document.getElementById('photo-upload')?.click()}>
                  <Camera size={24} color="white" />
                  <input id="photo-upload" type="file" name="photo" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const img = document.getElementById('photo-preview') as HTMLImageElement;
                        if (img && e.target?.result) {
                          img.src = e.target.result as string;
                          img.style.display = 'block';
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
                  <img id="photo-preview" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'none' }} />
                </div>
                <label style={{ fontSize: '12px', marginTop: '8px', cursor: 'pointer', color: 'var(--mod-budgie-primary)' }} onClick={() => document.getElementById('photo-upload')?.click()}>Upload Photo</label>
              </div>

              <div className={styles.inputGroup}>
                <label>Name *</label>
                <input required name="name" className={styles.input} placeholder="e.g. Lemon" defaultValue={editingBird?.name} />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Gender *</label>
                  <select required name="gender" className={styles.input} defaultValue={editingBird?.gender || 'unknown'}>
                    <option value="unknown">Unknown</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Color Mutation</label>
                  <input name="color_mutation" className={styles.input} placeholder="e.g. Lutino, Sky Blue" defaultValue={editingBird?.color_mutation} />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label>Adopt Date</label>
                <input type="date" name="adopt_date" className={styles.input} defaultValue={editingBird?.adopt_date} />
              </div>
              
              {birds && birds.length > (editingBird ? 1 : 0) && (
                <div className={styles.inputGroup}>
                  <label>Link Care Events With (Cage Mate)</label>
                  <select name="linked_bird_id" className={styles.input} defaultValue={editingBird ? (editingBird.linked_bird_id || birds.find(b => b.linked_bird_id === editingBird.id)?.id || '') : ''}>
                    <option value="">-- None --</option>
                    {birds.filter(b => b.id !== editingBird?.id).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>If linked, adding care events (like feeding) for one bird can automatically be applied to the other.</span>
                </div>
              )}
              
              <button type="submit" className={styles.primaryButton} style={{ marginTop: '8px', justifyContent: 'center' }}>
                Save Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {birdToDelete && (
        <DeleteConfirmationModal
          isOpen={!!birdToDelete}
          title="Delete Bird Profile"
          message="Are you sure you want to delete this profile? All associated care and training logs will be lost."
          onConfirm={confirmDeleteBird}
          onCancel={() => setBirdToDelete(null)}
        />
      )}
    </div>
  );
}

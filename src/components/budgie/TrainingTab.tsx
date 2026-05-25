import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { useBudgieStore } from '@/stores/budgieStore';
import { Plus, X, Brain, CheckCircle, ListChecks, Pencil, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import type { TrainingBlueprint, TrainingSession } from '@/types/modules';
import * as XLSX from 'xlsx';
import styles from './Budgie.module.css';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';

export function TrainingTab() {
  const { selectedBirdId, setSelectedBirdId } = useBudgieStore();
  const collapsed = useAppStore(s => s.sidebarCollapsed);
  const [showBlueprintTableModal, setShowBlueprintTableModal] = useState(false);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [editingBlueprint, setEditingBlueprint] = useState<TrainingBlueprint | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const birds = useLiveQuery(() => db.bird_profiles.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const selectedBird = birds?.find(b => b.id === selectedBirdId);

  const blueprints = useLiveQuery(async () => {
    if (!selectedBirdId) return [];
    const bps = await db.training_blueprints.where('bird_id').equals(selectedBirdId).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
    return bps.sort((a, b) => {
      const orderA = a.sort_order ?? 999999;
      const orderB = b.sort_order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [selectedBirdId]);

  const sessions = useLiveQuery(() => {
    if (!selectedBirdId) return [];
    return db.training_sessions.where('bird_id').equals(selectedBirdId).reverse().filter(x => x.user_id === (useAppStore.getState().userId || 'default')).sortBy('date');
  }, [selectedBirdId]);

  const handleAddEditBlueprint = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBirdId) return;

    const formData = new FormData(e.currentTarget);
    const payload = {
      code: formData.get('code') as string,
      category: formData.get('category') as string,
      training_name: formData.get('training_name') as string,
      description: formData.get('description') as string,
      next_step: formData.get('next_step') as string,
    };

    if (editingBlueprint) {
      await db.training_blueprints.update(editingBlueprint.id, { 
        ...payload, 
        sync_status: 'pending', 
        updated_at: new Date().toISOString() 
      });
    } else {
      await db.training_blueprints.add({
        id: generateId(),
        user_id: useAppStore.getState().userId || 'default',
        bird_id: selectedBirdId,
        ...payload,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        device_id: 'default',
        sort_order: blueprints ? blueprints.length : 0
      });
    }

    syncManager.queueSync('budgie');
    setShowBlueprintModal(false);
    setEditingBlueprint(null);
  };

  const handleDeleteBlueprint = (id: string) => {
    setDeleteConfirmation({
      isOpen: true,
      title: "Delete Blueprint",
      message: "Are you sure you want to delete this Training Blueprint?",
      onConfirm: async () => {
        await deleteAndTrack('training_blueprints', id);
        syncManager.queueSync('budgie');
        setDeleteConfirmation(null);
      }
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBirdId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let foundData = false;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet) as any[];
          if (!json.length) continue;

          // Normalize keys
          const normalizedJson = json.map(row => {
            const normRow: Record<string, any> = {};
            for (const key of Object.keys(row)) {
              normRow[key.toLowerCase().trim()] = row[key];
            }
            return normRow;
          });

          const hasHeaders = normalizedJson.some(r => Object.keys(r).some(k => k.includes('name') || k.includes('training') || k.includes('code') || k.includes('cat')));
          
          if (hasHeaders) {
            foundData = true;
            await db.transaction('rw', db.training_blueprints, async () => {
              let i = 0;
              for (const row of normalizedJson) {
                const keys = Object.keys(row);
                const codeKey = keys.find(k => k === 'code' || k === 'id' || k === '#') || keys.find(k => k.includes('code'));
                const catKey = keys.find(k => k === 'category' || k === 'type') || keys.find(k => k.includes('cat') || k.includes('type'));
                const nameKey = keys.find(k => k === 'training name' || k === 'name' || k === 'trick name') || keys.find(k => k.includes('name') && !k.includes('cat'));
                const descKey = keys.find(k => k === 'description' || k === 'desc') || keys.find(k => k.includes('desc'));
                const nextKey = keys.find(k => k === 'next step' || k === 'next') || keys.find(k => k.includes('next') || k.includes('step'));

                const training_name = nameKey ? String(row[nameKey] || '') : '';
                if (!training_name) continue;

                await db.training_blueprints.add({
                  id: generateId(),
                  user_id: useAppStore.getState().userId || 'default',
                  bird_id: selectedBirdId,
                  code: codeKey ? String(row[codeKey] || '') : '',
                  category: catKey ? String(row[catKey] || '') : '',
                  training_name: training_name,
                  description: descKey ? String(row[descKey] || '') : '',
                  next_step: nextKey ? String(row[nextKey] || '') : '',
                  sync_status: 'pending',
                  created_at: new Date(Date.now() + i).toISOString(),
                  updated_at: new Date().toISOString(),
                  version: 1,
                  device_id: 'default',
                  sort_order: i
                });
                i++;
              }
            });
            syncManager.queueSync('budgie');
            break;
          }
        }
        
        if (!foundData) {
           alert("Couldn't find any columns like 'Training Name', 'Category', or 'Code' in the Excel file.");
        }
      } catch (err) {
        console.error(err);
        alert("There was an error reading the Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBirdId) return;

    const formData = new FormData(e.currentTarget);
    const payload = {
      date: formData.get('date') as string,
      day_no: Number(formData.get('day_no')),
      session_type: formData.get('session_type') as 'Training' | 'Mini Training',
      training_type: formData.get('training_type') as 'Introduction' | 'Reinforcement',
      training_code: formData.get('training_code') as string,
      notes: formData.get('notes') as string || undefined,
    };

    if (editingSession) {
      await db.training_sessions.update(editingSession.id, {
        ...payload,
        sync_status: 'pending',
        updated_at: new Date().toISOString()
      });
    } else {
      await db.training_sessions.add({
        id: generateId(),
        user_id: useAppStore.getState().userId || 'default',
        bird_id: selectedBirdId,
        ...payload,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        device_id: 'default'
      });
    }

    syncManager.queueSync('budgie');
    setShowSessionModal(false);
    setEditingSession(null);
  };

  const handleDeleteSession = (id: string) => {
    setDeleteConfirmation({
      isOpen: true,
      title: "Delete Training Session",
      message: "Are you sure you want to delete this training session?",
      onConfirm: async () => {
        await deleteAndTrack('training_sessions', id);
        syncManager.queueSync('budgie');
        setDeleteConfirmation(null);
      }
    });
  };

  if (!selectedBirdId) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
          Please select a bird from the Profiles tab to view their training log.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <select 
              value={selectedBirdId} 
              onChange={(e) => setSelectedBirdId(e.target.value)}
              style={{ fontSize: '18px', fontWeight: 700, border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', WebkitAppearance: 'none', paddingRight: '28px' }}
            >
              {birds?.map(b => (
                <option key={b.id} value={b.id}>{b.name}'s Training</option>
              ))}
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.primaryButton} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }} onClick={() => setShowBlueprintTableModal(true)}>
            <ListChecks size={16} /> Training Blueprints
          </button>
          <button className={styles.primaryButton} onClick={() => setShowSessionModal(true)}>
            <Plus size={16} /> Log Session
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Sessions Column */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={20} color="var(--mod-budgie-primary)" /> Training History
          </h3>
          <div className={styles.timeline}>
            {sessions?.length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No sessions logged yet.</div>
            )}
            {sessions?.map(session => {
              const relatedBlueprint = blueprints?.find(b => b.code === session.training_code);
              
              return (
                <div key={session.id} className={styles.timelineItem}>
                  <div className={styles.timelineIcon} style={{ background: session.session_type === 'Training' ? 'var(--mod-budgie-primary)' : 'var(--mod-budgie-secondary)' }}>
                    <Brain size={20} />
                  </div>
                  <div className={styles.timelineContent} onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)} style={{ cursor: 'pointer' }}>
                    <div className={styles.timelineHeader}>
                      <div className={styles.timelineTitle}>Day {session.day_no} • {session.training_code}</div>
                      <div className={styles.timelineTime} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {session.date}
                        {expandedSessionId === session.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: expandedSessionId === session.id ? '4px' : '0' }}>
                      {relatedBlueprint ? relatedBlueprint.training_name : 'Unknown Training'}
                    </div>
                    
                    {expandedSessionId === session.id && (
                      <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                          <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {session.session_type}
                          </span>
                          <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {session.training_type}
                          </span>
                        </div>
                        {session.notes && <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: '12px' }}>"{session.notes}"</div>}
                        
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--card-border)', paddingTop: '8px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setEditingSession(session); setShowSessionModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Pencil size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {showBlueprintTableModal && (
        <div className={styles.modalOverlay} style={{ paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent} style={{ maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListChecks size={20} color="var(--mod-budgie-primary)" /> Training Blueprints
              </h3>
              <button onClick={() => setShowBlueprintTableModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={handleExcelUpload} ref={fileInputRef} />
                <button className={styles.primaryButton} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }} onClick={() => fileInputRef.current?.click()}>
                  <Upload size={16} /> Excel Upload
                </button>
                <button className={styles.primaryButton} style={{ background: 'rgba(255,255,255,0.5)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }} onClick={() => setShowBlueprintModal(true)}>
                  <Plus size={16} /> New Blueprint
                </button>
                <div style={{ flex: 1 }}></div>
                {blueprints && blueprints.length > 0 && (
                  <button 
                    onClick={() => {
                      setDeleteConfirmation({
                        isOpen: true,
                        title: "Clear All Blueprints",
                        message: "Are you sure you want to clear ALL Training Blueprints?",
                        onConfirm: async () => {
                          await db.transaction('rw', db.training_blueprints, db.sync_deletions, async () => {
                            for(const b of blueprints) await deleteAndTrack('training_blueprints', b.id);
                          });
                          syncManager.queueSync('budgie');
                          setDeleteConfirmation(null);
                        }
                      });
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={14} /> Clear All
                  </button>
                )}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead style={{ background: 'var(--canvas-surface)', borderBottom: '2px solid var(--card-border)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', width: '80px', color: 'var(--text-secondary)' }}>Code</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Category / Name</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Description</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Next Step</th>
                    <th style={{ padding: '12px 16px', width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {blueprints?.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        No training blueprints added yet. Upload an Excel file or add one manually!
                      </td>
                    </tr>
                  )}
                  {blueprints?.map((bp, index) => (
                    <tr key={bp.id} style={{ borderBottom: '1px solid var(--card-border)', background: index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'monospace' }}>{bp.code}</td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>{bp.category}</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bp.training_name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top', color: 'var(--text-secondary)' }}>{bp.description}</td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top', color: 'var(--text-secondary)' }}>{bp.next_step}</td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditingBlueprint(bp); setShowBlueprintModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteBlueprint(bp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showBlueprintModal && (
        <div className={styles.modalOverlay} style={{ background: showBlueprintTableModal ? 'rgba(0,0,0,0.2)' : undefined, paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{editingBlueprint ? 'Edit' : 'Add'} Training Blueprint</h3>
              <button onClick={() => { setShowBlueprintModal(false); setEditingBlueprint(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEditBlueprint} className={styles.modalBody}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Code</label>
                  <input name="code" className={styles.input} placeholder="e.g. TR-001" defaultValue={editingBlueprint?.code} />
                </div>
                <div className={styles.inputGroup} style={{ flex: 2 }}>
                  <label>Category</label>
                  <input name="category" className={styles.input} placeholder="e.g. Foundation" defaultValue={editingBlueprint?.category} />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label>Training Name *</label>
                <input required name="training_name" className={styles.input} placeholder="e.g. Presence Training" defaultValue={editingBlueprint?.training_name} />
              </div>
              <div className={styles.inputGroup}>
                <label>Description</label>
                <input name="description" className={styles.input} placeholder="Describe the behavior" defaultValue={editingBlueprint?.description} />
              </div>
              <div className={styles.inputGroup}>
                <label>Next Step</label>
                <input name="next_step" className={styles.input} placeholder="What to practice next" defaultValue={editingBlueprint?.next_step} />
              </div>
              
              <button type="submit" className={styles.primaryButton} style={{ marginTop: '8px', justifyContent: 'center' }}>
                {editingBlueprint ? 'Save Changes' : 'Add Blueprint'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showSessionModal && (
        <div className={styles.modalOverlay} style={{ paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{editingSession ? 'Edit' : 'Log'} Training Session</h3>
              <button onClick={() => { setShowSessionModal(false); setEditingSession(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSession} className={styles.modalBody}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Date *</label>
                  <input type="date" required name="date" className={styles.input} defaultValue={editingSession?.date || new Date().toISOString().split('T')[0]} />
                </div>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Day No. *</label>
                  <input type="number" required name="day_no" className={styles.input} defaultValue={editingSession?.day_no || 1} min="1" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Session Type *</label>
                  <select required name="session_type" className={styles.input} defaultValue={editingSession?.session_type || 'Training'}>
                    <option value="Training">Training</option>
                    <option value="Mini Training">Mini Training</option>
                  </select>
                </div>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Training Type *</label>
                  <select required name="training_type" className={styles.input} defaultValue={editingSession?.training_type || 'Introduction'}>
                    <option value="Introduction">Introduction</option>
                    <option value="Reinforcement">Reinforcement</option>
                  </select>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Training Code *</label>
                <select required name="training_code" className={styles.input} defaultValue={editingSession?.training_code}>
                  <option value="" disabled>Select a Blueprint...</option>
                  {blueprints?.map(bp => (
                    <option key={bp.id} value={bp.code}>
                      {bp.code} - {bp.training_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Notes</label>
                <input name="notes" className={styles.input} placeholder="e.g. Needs more practice..." defaultValue={editingSession?.notes} />
              </div>

              <button type="submit" className={styles.primaryButton} style={{ marginTop: '8px', justifyContent: 'center' }}>
                {editingSession ? 'Save Changes' : 'Save Session'}
              </button>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmation && (
        <DeleteConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          title={deleteConfirmation.title}
          message={deleteConfirmation.message}
          onConfirm={deleteConfirmation.onConfirm}
          onCancel={() => setDeleteConfirmation(null)}
        />
      )}
    </div>
  );
}

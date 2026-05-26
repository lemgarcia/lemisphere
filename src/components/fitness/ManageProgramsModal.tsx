import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import * as XLSX from 'xlsx';
import { X, Plus, Trash2, UploadCloud } from 'lucide-react';
import styles from '@/app/(app)/fitness/Fitness.module.css';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { GoalLinkSelector } from '@/components/habits/GoalLinkSelector';

interface ManageProgramsModalProps {
  onClose: () => void;
}

export function ManageProgramsModal({ onClose }: ManageProgramsModalProps) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const allPrograms = useLiveQuery(async () => await db.fitness_programs.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const activeProgramId = allPrograms?.find(p => p.status === 'active')?.id;
  
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [programToDelete, setProgramToDelete] = useState<string | null>(null);

  // Set default selection
  useEffect(() => {
    if (allPrograms && allPrograms.length > 0 && !selectedProgramId) {
      setSelectedProgramId(activeProgramId || allPrograms[0].id);
    }
  }, [allPrograms, selectedProgramId, activeProgramId]);

  const selectedProgram = allPrograms?.find(p => p.id === selectedProgramId);

  const programDays = useLiveQuery(async () => {
    if (!selectedProgramId) return [];
    return await db.fitness_program_days.where('program_id').equals(selectedProgramId).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).sortBy('order');
  }, [selectedProgramId]);

  const programExercises = useLiveQuery(async () => {
    if (!selectedProgramId) return [];
    const days = await db.fitness_program_days.where('program_id').equals(selectedProgramId).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
    const dayIds = days.map(d => d.id);
    return await db.fitness_exercises.where('program_day_id').anyOf(dayIds).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
  }, [selectedProgramId]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json<any>(ws);

      const daysMap = new Map<string, any[]>();
      data.forEach((row) => {
        const dayName = row['Day'] || 'Unknown Day';
        if (!daysMap.has(dayName)) daysMap.set(dayName, []);
        daysMap.get(dayName)!.push(row);
      });

      const programId = generateId();
      await db.fitness_programs.add({
        id: programId,
        user_id: useAppStore.getState().userId || 'default',
        name: 'Uploaded Excel Program',
        target_sets: 12,
        current_set: 1,
        status: allPrograms?.length === 0 ? 'active' : 'archived',
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        device_id: 'default'
      });

      let dayOrder = 1;
      for (const [dayName, exercises] of daysMap.entries()) {
        const dayId = generateId();
        await db.fitness_program_days.add({
          id: dayId,
          user_id: useAppStore.getState().userId || 'default',
          program_id: programId,
          name: dayName,
          order: dayOrder++,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          device_id: 'default'
        });

        let exOrder = 1;
        for (const exRow of exercises) {
          await db.fitness_exercises.add({
            id: generateId(),
            user_id: useAppStore.getState().userId || 'default',
            program_day_id: dayId,
            name: exRow['Exercise'] || 'Unknown Exercise',
            sets: String(exRow['Sets'] || '3'),
            muscle_group: String(exRow['Muscle Group'] || ''),
            target_reps: String(exRow['Target Reps'] || '3x10'),
            rest_sec: Number(exRow['Rest (sec)']) || 90,
            order: exOrder++,
            sync_status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            version: 1,
            device_id: 'default'
          });
        }
      }

      setSelectedProgramId(programId);
      syncManager.queueSync('fitness');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateProgram = async () => {
    const id = generateId();
    await db.fitness_programs.add({
      id,
      user_id: useAppStore.getState().userId || 'default',
      name: 'New Program',
      target_sets: 12,
      current_set: 1,
      status: allPrograms?.length === 0 ? 'active' : 'archived',
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'default'
    });
    setSelectedProgramId(id);
    syncManager.queueSync('fitness');
  };

  const handleUpdateProgram = async (id: string, updates: any) => {
    await db.fitness_programs.update(id, { ...updates, updated_at: new Date().toISOString(), sync_status: 'pending' });
    syncManager.queueSync('fitness');
  };

  const handleDeleteProgram = (id: string) => {
    setProgramToDelete(id);
  };

  const confirmDeleteProgram = async () => {
    if (programToDelete) {
      await db.transaction('rw', [db.fitness_programs, db.fitness_program_days, db.fitness_exercises, db.workout_logs, db.workout_exercise_logs, db.sync_deletions], async () => {
        // Delete logs belonging to this program
        const progLogs = await db.workout_logs.where('program_id').equals(programToDelete).toArray();
        for (const log of progLogs) {
          const exLogs = await db.workout_exercise_logs.where('workout_log_id').equals(log.id).toArray();
          for (const exL of exLogs) await deleteAndTrack('workout_exercise_logs', exL.id);
          await deleteAndTrack('workout_logs', log.id);
        }

        // Delete exercises and days
        const days = await db.fitness_program_days.where('program_id').equals(programToDelete).toArray();
        for (const day of days) {
          const exercises = await db.fitness_exercises.where('program_day_id').equals(day.id).toArray();
          for (const ex of exercises) {
            await deleteAndTrack('fitness_exercises', ex.id);
          }
          await deleteAndTrack('fitness_program_days', day.id);
        }
        await deleteAndTrack('fitness_programs', programToDelete);
      });
      if (selectedProgramId === programToDelete) setSelectedProgramId(null);
      setProgramToDelete(null);
      syncManager.queueSync('fitness');
    }
  };

  const handleSetActive = async (id: string) => {
    if (activeProgramId) {
      await db.fitness_programs.update(activeProgramId, { status: 'archived', updated_at: new Date().toISOString(), sync_status: 'pending' });
    }
    await db.fitness_programs.update(id, { status: 'active', updated_at: new Date().toISOString(), sync_status: 'pending' });
    syncManager.queueSync('fitness');
  };

  const handleAddDay = async () => {
    if (!selectedProgramId) return;
    await db.fitness_program_days.add({
      id: generateId(),
      user_id: useAppStore.getState().userId || 'default',
      program_id: selectedProgramId,
      name: 'New Day',
      order: (programDays?.length || 0) + 1,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'default'
    });
    syncManager.queueSync('fitness');
  };

  return (
    <div 
      className={styles.modalOverlay}
      style={{ 
        paddingLeft: sidebarCollapsed ? '64px' : '220px',
        transition: 'padding-left 0.2s'
      }}
    >
      <div className={styles.modalContentLarge}>
        
        <div className={styles.modalHeaderLarge}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏋️ Workout Programs
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.modalBodyLarge}>
          
          {/* Sidebar */}
          <div className={styles.modalSidebar}>
            <div className={styles.sidebarHeader}>
              Your Programs
              <button onClick={handleCreateProgram} className={styles.sidebarAddBtn}><Plus size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allPrograms?.map(prog => (
                <div 
                  key={prog.id} 
                  onClick={() => setSelectedProgramId(prog.id)}
                  className={`${styles.sidebarItem} ${prog.id === selectedProgramId ? styles.sidebarItemActive : ''}`}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{prog.name}</div>
                  {prog.status === 'active' && (
                    <div style={{ fontSize: '11px', background: 'rgba(74, 222, 128, 0.2)', color: '#16a34a', padding: '2px 8px', borderRadius: '8px', display: 'inline-block', fontWeight: 600 }}>Active Program</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className={styles.actionBtn} 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <UploadCloud size={16} /> Upload Excel
              </button>
              <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            </div>
          </div>

          {/* Main Pane */}
          <div className={styles.modalMainPane}>
            {selectedProgram ? (
              <>
                <div className={styles.progTitleRow}>
                  <input 
                    type="text" 
                    value={selectedProgram.name} 
                    onChange={e => handleUpdateProgram(selectedProgram.id, { name: e.target.value })}
                    className={styles.progTitleInput}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedProgram.status !== 'active' && (
                      <button onClick={() => handleSetActive(selectedProgram.id)} className={styles.actionBtn}>
                        Set Active
                      </button>
                    )}
                    <button onClick={() => handleDeleteProgram(selectedProgram.id)} className={`${styles.actionBtn} ${styles.dangerBtn}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', marginTop: '24px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Program Days</div>
                    <button onClick={handleAddDay} className={styles.actionBtn}><Plus size={16} /> Add Day</button>
                  </div>

                  <div className={styles.dayCardList}>
                    {programDays?.map(day => {
                      const dayExercises = programExercises
                        ?.filter(e => e.program_day_id === day.id)
                        .sort((a, b) => a.order - b.order) || [];
                      return (
                        <DayCard 
                          key={day.id} 
                          day={day} 
                          exercises={dayExercises} 
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                Select or create a program.
              </div>
            )}
          </div>

          {programToDelete && (
            <DeleteConfirmationModal
              isOpen={!!programToDelete}
              title="Delete Program"
              message="Are you sure you want to delete this workout program? This will permanently remove all days, exercises, and progress associated with it."
              onConfirm={confirmDeleteProgram}
              onCancel={() => setProgramToDelete(null)}
            />
          )}

        </div>
      </div>
    </div>
  );
}

function DayCard({ day, exercises }: { day: any, exercises: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdateDay = async (name: string) => {
    await db.fitness_program_days.update(day.id, { name, updated_at: new Date().toISOString(), sync_status: 'pending' });
    syncManager.queueSync('fitness');
  };

  const handleLinkGoal = async (goalId: string, milestoneId?: string, taskId?: string, taskName?: string, syncDirection?: 'one-way' | 'two-way') => {
    await db.fitness_program_days.update(day.id, {
      linked_goal_id: goalId,
      linked_milestone_id: milestoneId || undefined,
      linked_task_id: taskId || undefined,
      linked_task_name: taskName || undefined,
      sync_direction: syncDirection || 'one-way',
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    });
    syncManager.queueSync('fitness');
  };

  const handleUnlinkGoal = async () => {
    await db.fitness_program_days.update(day.id, {
      linked_goal_id: undefined,
      linked_milestone_id: undefined,
      linked_task_id: undefined,
      linked_task_name: undefined,
      sync_direction: undefined,
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    });
    syncManager.queueSync('fitness');
  };

  const confirmDeleteDay = async () => {
    await deleteAndTrack('fitness_program_days', day.id);
    setIsDeleting(false);
    syncManager.queueSync('fitness');
  };

  const handleAddExercise = async () => {
    await db.fitness_exercises.add({
      id: generateId(),
      user_id: useAppStore.getState().userId || 'default',
      program_day_id: day.id,
      name: 'New Exercise',
      sets: '4',
      target_reps: '8-12',
      rest_sec: 90,
      muscle_group: '',
      order: exercises.length + 1,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'default'
    });
    setExpanded(true);
    syncManager.queueSync('fitness');
  };

  return (
    <div className={styles.dayCardItem}>
      <div className={styles.dayCardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <input 
            type="text" 
            value={day.name} 
            onChange={e => handleUpdateDay(e.target.value)} 
            className={styles.dayNameInput}
            style={{ flex: '0 1 200px' }}
          />
          <GoalLinkSelector 
            item={day}
            onLink={handleLinkGoal}
            onUnlink={handleUnlinkGoal}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={() => setExpanded(!expanded)} className={styles.actionBtn}>
            {expanded ? 'Hide Exercises' : 'Edit Exercises'}
          </button>
          <button onClick={() => setIsDeleting(true)} className={`${styles.actionBtn} ${styles.dangerBtn}`} style={{ padding: '8px' }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.exerciseList}>
          {exercises.map(ex => (
            <ExerciseRow key={ex.id} exercise={ex} />
          ))}
          <div style={{ marginTop: '8px' }}>
            <button onClick={handleAddExercise} className={styles.actionBtn} style={{ background: 'rgba(0,0,0,0.03)' }}><Plus size={16} /> Add Exercise</button>
          </div>
        </div>
      )}

      {isDeleting && (
        <DeleteConfirmationModal
          isOpen={isDeleting}
          title="Delete Day"
          message={`Are you sure you want to delete ${day.name}? All exercises in this day will also be deleted.`}
          onConfirm={confirmDeleteDay}
          onCancel={() => setIsDeleting(false)}
        />
      )}
    </div>
  );
}

function ExerciseRow({ exercise }: { exercise: any }) {
  const [localEx, setLocalEx] = useState(exercise);

  // Sync state if DB changes externally
  useEffect(() => { setLocalEx(exercise); }, [exercise]);

  const handleChange = (field: string, value: string) => {
    setLocalEx({ ...localEx, [field]: value });
  };

  const handleSave = async () => {
    await db.fitness_exercises.update(exercise.id, {
      ...localEx,
      rest_sec: Number(localEx.rest_sec) || 0,
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    });
    syncManager.queueSync('fitness');
  };

  const handleDelete = async () => {
    await deleteAndTrack('fitness_exercises', exercise.id);
    syncManager.queueSync('fitness');
  };

  return (
    <div className={styles.exerciseInlineRow}>
      <input 
        type="text" value={localEx.name} onChange={e => handleChange('name', e.target.value)} onBlur={handleSave} 
        className={styles.exInlineInput} style={{ flex: 1.5 }} placeholder="Exercise" 
      />
      <input 
        type="text" value={localEx.muscle_group} onChange={e => handleChange('muscle_group', e.target.value)} onBlur={handleSave} 
        className={styles.exInlineInput} style={{ flex: 1 }} placeholder="Muscle Group" 
      />
      <input 
        type="text" value={localEx.sets} onChange={e => handleChange('sets', e.target.value)} onBlur={handleSave} 
        className={styles.exInlineInput} style={{ width: '60px', flexShrink: 0 }} placeholder="Sets" 
      />
      <input 
        type="text" value={localEx.target_reps} onChange={e => handleChange('target_reps', e.target.value)} onBlur={handleSave} 
        className={styles.exInlineInput} style={{ width: '80px', flexShrink: 0 }} placeholder="Reps" 
      />
      <div style={{ display: 'flex', alignItems: 'center', background: '#fffdfc', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '8px', paddingRight: '8px', flexShrink: 0 }}>
        <input 
          type="number" value={localEx.rest_sec} onChange={e => handleChange('rest_sec', e.target.value)} onBlur={handleSave} 
          className={styles.exInlineInput} style={{ width: '60px', border: 'none' }} placeholder="Rest" 
        />
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>s</span>
      </div>
      <button onClick={handleDelete} className={`${styles.actionBtn} ${styles.dangerBtn}`} style={{ padding: '8px', border: 'none', flexShrink: 0 }}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

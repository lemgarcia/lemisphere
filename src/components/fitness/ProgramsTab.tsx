'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/utils';
import { syncManager } from '@/lib/sync/SyncManager';
import { UploadCloud, Trash2, CheckCircle2, Circle, Settings2, Calendar, Pencil } from 'lucide-react';
import styles from '@/app/(app)/fitness/Fitness.module.css';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { Plus } from 'lucide-react';
import { ManageProgramsModal } from './ManageProgramsModal';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';

function DayPreviewModal({ day, exercises, onClose }: { day: any, exercises: any[], onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.modalOverlay} 
      onClick={onClose}
      style={{ zIndex: 9999, backdropFilter: 'blur(8px)' }}
    >
      <motion.div 
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={styles.modalContentLarge} 
        style={{ maxWidth: '600px', height: 'auto', maxHeight: '85vh', background: 'var(--card-bg)' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeaderLarge} style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-violet-soft)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>
              {day.order}
            </div>
            {day.name} Preview
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalMainPane} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {exercises.map(ex => (
            <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>{ex.name}</div>
                {ex.muscle_group && <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{ex.muscle_group}</div>}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {ex.sets} Sets
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {ex.target_reps} Reps
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                  {ex.rest_sec}s Rest
                </div>
              </div>
            </div>
          ))}
          {exercises.length === 0 && <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px' }}>No exercises yet.</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ProgramsTab() {
  const [isManaging, setIsManaging] = useState(false);
  const [previewDayId, setPreviewDayId] = useState<string | null>(null);

  // Fetch all programs
  const allPrograms = useLiveQuery(async () => {
    return await db.fitness_programs.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
  });

  const activeProgram = allPrograms?.find(p => p.status === 'active') || null;

  // Fetch past workouts
  const workoutLogs = useLiveQuery(async () => {
    if (!activeProgram) return [];
    return await db.workout_logs.where('program_id').equals(activeProgram.id).reverse().filter(x => x.user_id === (useAppStore.getState().userId || 'default')).sortBy('date');
  }, [activeProgram?.id]);

  // Fetch days for active program
  const activeDays = useLiveQuery(async () => {
    if (!activeProgram) return [];
    return await db.fitness_program_days.where('program_id').equals(activeProgram.id).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).sortBy('order');
  }, [activeProgram?.id]);

  // Fetch exercises for active program (to get counts)
  const activeExercises = useLiveQuery(async () => {
    if (!activeProgram) return [];
    const days = await db.fitness_program_days.where('program_id').equals(activeProgram.id).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
    const dayIds = days.map(d => d.id);
    return await db.fitness_exercises.where('program_day_id').anyOf(dayIds).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
  }, [activeProgram?.id]);

  const handleUpdateTargetSets = async (Sets: number) => {
    if (activeProgram) {
      await db.fitness_programs.update(activeProgram.id, { target_sets: Sets, updated_at: new Date().toISOString() });
      syncManager.queueSync('fitness');
    }
  };

  const handleUpdateLogDate = async (logId: string, newDate: string) => {
    await db.workout_logs.update(logId, { date: newDate, updated_at: new Date().toISOString() });
    syncManager.queueSync('fitness');
  };

  if (allPrograms === undefined) return null;

  // Render "Manage Programs" View
  if (isManaging) {
    return <ManageProgramsModal onClose={() => setIsManaging(false)} />;
  }

  // If no active program, prompt to manage
  if (!activeProgram) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', paddingTop: '60px' }}>
        <div style={{ color: 'var(--text-tertiary)', marginBottom: '24px' }}>No active program found.</div>
        <button onClick={() => setIsManaging(true)} className={styles.manageButton}>
          Manage Programs
        </button>
      </div>
    );
  }

  const daysInSet = activeDays?.length || 0;
  
  // Group workout logs by Set
  const groupedLogs = (workoutLogs || []).reduce((acc, log) => {
    if (!acc[log.set_number]) acc[log.set_number] = [];
    acc[log.set_number].push(log);
    return acc;
  }, {} as Record<number, any[]>);

  const currentSetLogs = groupedLogs[activeProgram.current_set] || [];
  const uniqueCompletedThisSet = new Set(currentSetLogs.filter(l => l.completed).map(l => l.program_day_id)).size;
  const completedThisSet = uniqueCompletedThisSet;
  const SetProgressPct = daysInSet > 0 ? Math.round((completedThisSet / daysInSet) * 100) : 0;
  
  let fullyCompletedSets = 0;
  for (const setStr of Object.keys(groupedLogs)) {
    const logs = groupedLogs[Number(setStr)] || [];
    const uniqueCompleted = new Set(logs.filter((l: any) => l.completed).map((l: any) => l.program_day_id)).size;
    if (uniqueCompleted === daysInSet && daysInSet > 0) {
      fullyCompletedSets++;
    }
  }

  const overallPct = Math.round((fullyCompletedSets / activeProgram.target_sets) * 100);

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button onClick={() => setIsManaging(true)} className={styles.manageButton}>
          <Settings2 size={16} /> Manage Programs
        </button>
      </div>

      <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{activeProgram.name}</div>
          <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Active Workout Program</div>
        </div>

        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <div className={styles.progressTitle}>Set {activeProgram.current_set} Progress</div>
            <div className={styles.progressValue}>{SetProgressPct}%</div>
          </div>
          <div className={styles.progressBarContainer}>
            <motion.div 
              className={styles.progressBarFill} 
              initial={{ width: 0 }}
              animate={{ width: `${SetProgressPct}%` }} 
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div className={styles.progressSubtitle}>{completedThisSet} out of {daysInSet} days completed this Set</div>
        </div>

        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <div className={styles.progressTitle}>Overall Program Duration</div>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', background: 'var(--card-bg)', padding: '6px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Target Sets: 
              <input 
                type="number" 
                value={activeProgram.target_sets} 
                onChange={e => handleUpdateTargetSets(Number(e.target.value))} 
                style={{ width: '40px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--text-tertiary)', color: 'var(--text-primary)', fontWeight: 'bold', outline: 'none', textAlign: 'center' }} 
              />
            </div>
          </div>
          <div className={styles.progressBarContainer}>
            <motion.div 
              className={styles.progressBarFill} 
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }} 
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>{fullyCompletedSets} out of {activeProgram.target_sets} Sets completed</span>
            <span className={styles.progressValuePurple}>{overallPct}%</span>
          </div>
        </div>
      </div>

      <div className={styles.section} style={{ marginTop: '16px' }}>
        <div className={styles.sectionTitle}>Program Blueprint</div>
        <div className={styles.blueprintGrid}>
          {activeDays?.map(day => {
            const exerciseCount = activeExercises?.filter(e => e.program_day_id === day.id).length || 0;
            return (
              <div key={day.id} className={styles.blueprintCard} onClick={() => setPreviewDayId(day.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.blueprintDayNumber}>{day.order}</div>
                    <div className={styles.blueprintDayName}>{day.name}</div>
                  </div>
                </div>
                <div className={styles.blueprintSub}>{exerciseCount} exercises (Click to preview)</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.section} style={{ marginTop: '24px' }}>
        <div className={styles.sectionTitle}>Workout History & Logs</div>
        <input type="text" placeholder="Search Set, day, date, or exercise..." className={styles.searchInput} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {Object.entries(groupedLogs).sort((a, b) => Number(b[0]) - Number(a[0])).map(([setStr, logs]) => (
            <details key={setStr} style={{ borderRadius: '12px', overflow: 'hidden', background: 'rgba(220, 215, 205, 0.4)' }}>
              <summary className={styles.accordionHeader} style={{ outline: 'none' }}>
                <span>Set {setStr}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {new Set(logs.filter(l => l.completed).map(l => l.program_day_id)).size} / {activeDays?.length || 0} days completed
                </span>
              </summary>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.from(new Map(logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(l => [l.program_day_id, l])).values()).map(log => {
                  const dayObj = activeDays?.find(d => d.id === log.program_day_id);
                  return (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {log.completed ? <CheckCircle2 size={16} color="#16a34a" /> : <Circle size={16} color="var(--text-tertiary)" />}
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dayObj?.name || 'Unknown Day'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={14} color="var(--text-tertiary)" />
                        <input 
                          type="date" 
                          value={log.date} 
                          onChange={e => handleUpdateLogDate(log.id, e.target.value)} 
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
          {Object.keys(groupedLogs).length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px', background: 'rgba(220, 215, 205, 0.4)', borderRadius: '12px', textAlign: 'center' }}>
              No history yet. Start a workout!
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewDayId && (
          <DayPreviewModal 
            day={activeDays?.find(d => d.id === previewDayId)} 
            exercises={activeExercises?.filter(e => e.program_day_id === previewDayId).sort((a, b) => a.order - b.order) || []} 
            onClose={() => setPreviewDayId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

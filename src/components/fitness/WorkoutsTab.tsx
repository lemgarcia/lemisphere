'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/utils';
import { syncManager } from '@/lib/sync/SyncManager';
import { useFitnessStore } from '@/stores/fitnessStore';
import { ChevronLeft, ChevronRight, Play, RotateCcw, Timer, CheckCircle2, Link2 } from 'lucide-react';
import styles from '@/app/(app)/fitness/Fitness.module.css';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { GoalLinkSelector } from '@/components/habits/GoalLinkSelector';

export function WorkoutsTab() {
  const [selectedSet, setselectedSet] = useState<number | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customTimerSec, setCustomTimerSec] = useState('');

  // Global Timer
  const startTimer = useFitnessStore((s) => s.startTimer);
  const stopTimer = useFitnessStore((s) => s.stopTimer);
  const timerActive = useFitnessStore((s) => s.timerActive);
  const timerRemainingSec = useFitnessStore((s) => s.timerRemainingSec);
  const timerTotalSec = useFitnessStore((s) => s.timerTotalSec);
  const timerDayId = useFitnessStore((s) => s.timerDayId);

  // 1. Fetch Active Program
  const activeProgram = useLiveQuery(async () => {
    const prog = await db.fitness_programs.filter(p => p.status === 'active').first();
    return prog || null;
  });

  useEffect(() => {
    if (activeProgram && selectedSet === null) {
      setselectedSet(activeProgram.current_set);
    }
  }, [activeProgram, selectedSet]);

  // 2. Fetch Days for Program
  const days = useLiveQuery(async () => {
    if (!activeProgram) return [];
    return await db.fitness_program_days.where('program_id').equals(activeProgram.id).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).sortBy('order');
  }, [activeProgram?.id]);

  useEffect(() => {
    if (days && days.length > 0 && !selectedDayId) {
      setSelectedDayId(days[0].id);
    }
  }, [days, selectedDayId]);

  // 3. Fetch Exercises for Selected Day
  const exercises = useLiveQuery(async () => {
    if (!selectedDayId) return [];
    return await db.fitness_exercises.where('program_day_id').equals(selectedDayId).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).sortBy('order');
  }, [selectedDayId]);

  const filteredExercises = exercises?.filter(ex => 
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (ex.muscle_group && ex.muscle_group.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  // 4. Fetch Workout Log for current Day & Set
  const currentLog = useLiveQuery(async () => {
    if (!activeProgram || !selectedDayId || !selectedSet) return null;
    return await db.workout_logs
      .filter(l => l.program_id === activeProgram.id && l.program_day_id === selectedDayId && l.set_number === selectedSet)
      .first();
  }, [activeProgram?.id, selectedDayId, selectedSet]);

  // Fetch all logs for the selected Set to check Set completion
  const currentSetLogs = useLiveQuery(async () => {
    if (!activeProgram || !selectedSet) return [];
    return await db.workout_logs
      .filter(l => l.program_id === activeProgram.id && l.set_number === selectedSet)
      .toArray();
  }, [activeProgram?.id, selectedSet]);

  const isSetComplete = days && days.length > 0 && currentSetLogs && 
                         new Set(currentSetLogs.filter(l => l.completed).map(l => l.program_day_id)).size === days.length;

  const [showSetCompletePopup, setShowSetCompletePopup] = useState(false);

  useEffect(() => {
    if (isSetComplete && activeProgram && Number(activeProgram.current_set) === Number(selectedSet) && Number(activeProgram.current_set) < Number(activeProgram.target_sets)) {
      setShowSetCompletePopup(true);
    } else {
      setShowSetCompletePopup(false);
    }
  }, [isSetComplete, activeProgram?.current_set, selectedSet, activeProgram?.target_sets]);

  const handleStartNextSet = async () => {
    if (activeProgram) {
      await db.fitness_programs.update(activeProgram.id, { 
        current_set: activeProgram.current_set + 1,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      });
      setselectedSet(activeProgram.current_set + 1);
      if (days && days.length > 0) {
        setSelectedDayId(days[0].id);
      }
      setShowSetCompletePopup(false);
      syncManager.queueSync('fitness');
    }
  };

  // 5. Fetch Exercise Logs
  const exerciseLogs = useLiveQuery(async () => {
    if (!currentLog) return [];
    return await db.workout_exercise_logs.where('workout_log_id').equals(currentLog.id).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
  }, [currentLog?.id]);

  // 6. Previous Weights
  const previousWeights = useLiveQuery(async () => {
    if (!exercises) return {};
    const map: Record<string, number> = {};
    for (const ex of exercises) {
      const lastLog = await db.workout_exercise_logs
        .where('exercise_id').equals(ex.id)
        .reverse()
        .first();
      if (lastLog && Number(lastLog.weight) > 0) {
        map[ex.id] = lastLog.weight as any;
      }
    }
    return map;
  }, [exercises]);

  const toggleExercise = async (exerciseId: string, currentWeight: number | string) => {
    if (!activeProgram || !selectedDayId || !selectedSet) return;

    let newCompletedState = false;

    await db.transaction('rw', db.workout_logs, db.workout_exercise_logs, db.fitness_exercises, async () => {
      let existingLog = await db.workout_logs
        .filter(l => l.program_id === activeProgram.id && l.program_day_id === selectedDayId && l.set_number === selectedSet)
        .first();
        
      let logId = existingLog?.id;
      if (!logId) {
        logId = generateId();
        await db.workout_logs.add({
          id: logId,
          user_id: useAppStore.getState().userId || 'default',
          program_id: activeProgram.id,
          program_day_id: selectedDayId,
          set_number: selectedSet,
          date: new Date().toISOString().split('T')[0],
          completed: false,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          device_id: 'default'
        });
      }

      const exLog = await db.workout_exercise_logs
        .filter(l => l.workout_log_id === logId && l.exercise_id === exerciseId)
        .first();
      
      if (exLog) {
        newCompletedState = !exLog.completed;
        await db.workout_exercise_logs.update(exLog.id, { 
          completed: newCompletedState, 
          weight: currentWeight as any,
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        });
      } else {
        newCompletedState = true;
        await db.workout_exercise_logs.add({
          id: generateId(),
          user_id: useAppStore.getState().userId || 'default',
          workout_log_id: logId,
          exercise_id: exerciseId,
          completed: true,
          weight: currentWeight as any,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          device_id: 'default'
        });
      }

      // Evaluate day completion robustly
      const allExLogs = await db.workout_exercise_logs.filter(l => l.workout_log_id === logId).toArray();
      const dayExercises = await db.fitness_exercises.where('program_day_id').equals(selectedDayId).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
      
      const allChecked = dayExercises.length > 0 && dayExercises.every(ex => {
        const l = allExLogs.find(log => log.exercise_id === ex.id);
        return l?.completed === true;
      });
      
      await db.workout_logs.update(logId, { completed: allChecked, updated_at: new Date().toISOString(), sync_status: 'pending' });
    });

    // Goal link autocomplete — when exercise is checked, mark the linked goal task as done
    if (newCompletedState) {
      const exercise = await db.fitness_exercises.get(exerciseId);
      if (exercise?.linked_goal_id && exercise?.linked_task_id) {
        const goal = await db.goals.get(exercise.linked_goal_id);
        if (goal) {
          // Update milestones — mark linked milestone or task within milestone as completed
          const updatedMilestones = (goal.milestones || []).map((m: any) => {
            if (m.id === exercise.linked_milestone_id) return { ...m, completed: true };
            const updatedMTasks = (m.tasks || []).map((t: any) =>
              t.id === exercise.linked_task_id ? { ...t, completed: true } : t
            );
            return { ...m, tasks: updatedMTasks };
          });
          await db.goals.update(goal.id, {
            milestones: updatedMilestones,
            updated_at: new Date().toISOString(),
            sync_status: 'pending'
          });
          syncManager.queueSync('goals');
        }
      }
    }

    syncManager.queueSync('fitness');
  };

  const updateWeight = async (exerciseId: string, newWeight: string) => {
    if (!activeProgram || !selectedDayId || !selectedSet) return;

    await db.transaction('rw', db.workout_logs, db.workout_exercise_logs, async () => {
      let existingLog = await db.workout_logs
        .filter(l => l.program_id === activeProgram.id && l.program_day_id === selectedDayId && l.set_number === selectedSet)
        .first();
        
      let logId = existingLog?.id;
      if (!logId) {
        logId = generateId();
        await db.workout_logs.add({
          id: logId,
          user_id: useAppStore.getState().userId || 'default',
          program_id: activeProgram.id,
          program_day_id: selectedDayId,
          set_number: selectedSet,
          date: new Date().toISOString().split('T')[0],
          completed: false,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          device_id: 'default'
        });
      }

      const exLog = await db.workout_exercise_logs
        .filter(l => l.workout_log_id === logId && l.exercise_id === exerciseId)
        .first();
        
      if (exLog) {
        await db.workout_exercise_logs.update(exLog.id, { 
          weight: newWeight as any,
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        });
      } else {
        await db.workout_exercise_logs.add({
          id: generateId(),
          user_id: useAppStore.getState().userId || 'default',
          workout_log_id: logId,
          exercise_id: exerciseId,
          completed: false,
          weight: newWeight as any,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          device_id: 'default'
        });
      }
    });
    syncManager.queueSync('fitness');
  };

  const handleLinkExerciseToGoal = async (exerciseId: string, goalId: string | undefined, milestoneId: string | undefined, taskId: string | undefined, taskName: string | undefined, syncDir: 'one-way' | 'two-way') => {
    await db.fitness_exercises.update(exerciseId, {
      linked_goal_id: goalId,
      linked_milestone_id: milestoneId,
      linked_task_id: taskId,
      linked_task_name: taskName,
      sync_direction: syncDir,
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    });
    syncManager.queueSync('fitness');
  };

  const handleUnlinkExercise = async (exerciseId: string) => {
    await db.fitness_exercises.update(exerciseId, {
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

  if (!activeProgram) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        No active program. Head over to the Programs tab to create or upload one!
      </div>
    );
  }

  const selectedDayIndex = days?.findIndex(d => d.id === selectedDayId) ?? 0;
  const selectedDayData = days?.[selectedDayIndex];

  const handlePrevDay = () => {
    if (days && selectedDayIndex > 0) {
      setSelectedDayId(days[selectedDayIndex - 1].id);
    }
  };

  const handleNextDay = () => {
    if (days && selectedDayIndex < days.length - 1) {
      setSelectedDayId(days[selectedDayIndex + 1].id);
    }
  };

  return (
    <div className={styles.container}>
      
      {/* Header Row */}
      <div className={styles.trackerHeader}>
        <div className={styles.SetSelector} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--card-border)', gap: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '8px' }}>Set</span>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg)', borderRadius: '8px', padding: '2px', border: '1px solid var(--card-border)' }}>
            <button 
              onClick={() => setselectedSet(prev => prev ? Math.max(1, prev - 1) : 1)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ width: '32px', textAlign: 'center', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{selectedSet}</span>
            <button 
              onClick={() => setselectedSet(prev => prev ? Math.min(activeProgram.target_sets, prev + 1) : 1)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <input 
          type="text" 
          placeholder="Search exercises, days, dates..." 
          className={styles.searchInput} 
          style={{ flex: 1 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Set Progress Bar */}
      <div className={styles.progressCard} style={{ marginTop: '16px' }}>
        <div className={styles.progressHeader}>
          <div className={styles.progressTitle}>Set {selectedSet} Progress</div>
          <div className={styles.progressValue}>
            {days && days.length > 0 ? Math.round((new Set((currentSetLogs || []).filter(l => l.completed).map(l => l.program_day_id)).size / days.length) * 100) : 0}%
          </div>
        </div>
        <div className={styles.progressBarContainer}>
          <motion.div 
            className={styles.progressBarFill} 
            initial={{ width: 0 }}
            animate={{ width: `${days && days.length > 0 ? Math.round((new Set((currentSetLogs || []).filter(l => l.completed).map(l => l.program_day_id)).size / days.length) * 100) : 0}%` }} 
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>{new Set((currentSetLogs || []).filter(l => l.completed).map(l => l.program_day_id)).size} out of {days?.length || 0} days completed</span>
        </div>
      </div>

      {/* Day Nav Row */}
      <div className={styles.trackerDayNav}>
        <button 
          onClick={handlePrevDay}
          style={{ background: 'none', border: 'none', cursor: days && selectedDayIndex > 0 ? 'pointer' : 'default', color: days && selectedDayIndex > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <ChevronLeft size={20} />
        </button>
        <div>{selectedDayData?.name} Tracker (Set {selectedSet})</div>
        <button 
          onClick={handleNextDay}
          style={{ background: 'none', border: 'none', cursor: days && selectedDayIndex < days.length - 1 ? 'pointer' : 'default', color: days && selectedDayIndex < days.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Rest Widget Row */}
      <AnimatePresence>
        {(!timerDayId || timerDayId === selectedDayId) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={styles.restCountdownWidget}
            style={{ 
              boxShadow: timerActive ? '0 0 30px rgba(124, 58, 237, 0.3)' : 'none', 
              border: timerActive ? '1px solid var(--accent-violet)' : '1px solid var(--card-border)',
              transition: 'all 0.3s ease'
            }}
          >
            <div className={styles.restTopRow}>
              <div className={styles.restLeft}>
                <div className={styles.restLabel} style={{ color: timerActive ? 'var(--accent-violet)' : 'var(--text-tertiary)' }}>
                  {timerActive ? 'RESTING...' : 'REST COUNTDOWN'}
                </div>
                <div className={styles.restTime}>
                  <motion.span 
                    key={timerRemainingSec}
                    initial={{ opacity: 0.5, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {timerActive ? timerRemainingSec : '90'}
                  </motion.span>
                  <span className={styles.restSec}>sec</span>
                </div>
                <div style={{ height: '2px', background: timerActive ? 'var(--accent-violet)' : 'var(--card-border)', width: '100%', marginTop: '8px', transition: 'background 0.3s ease' }} />
              </div>
              <div className={styles.restControls}>
                <button 
                  onClick={() => startTimer(timerActive ? timerRemainingSec : 90, selectedDayId!)} 
                  className={`${styles.restBtn} ${styles.restBtnStart}`}
                  style={{ background: timerActive ? 'rgba(124, 58, 237, 0.1)' : 'var(--accent-violet)', color: timerActive ? 'var(--accent-violet)' : '#fff' }}
                >
                  <Play size={16} /> {timerActive ? 'RESUME' : 'START'}
                </button>
                <button onClick={() => stopTimer()} className={styles.restBtn}>
                  <RotateCcw size={16} /> RESET
                </button>
              </div>
            </div>
            
            <div className={styles.restPresetsRow}>
              <span className={styles.presetLabel}>PRESETS:</span>
              {filteredExercises.filter(ex => {
                const log = exerciseLogs?.find(l => l.exercise_id === ex.id);
                return !log?.completed;
              }).slice(0, 4).map(ex => (
                <button 
                  key={ex.id} 
                  onClick={() => startTimer(ex.rest_sec, selectedDayId!)}
                  className={`${styles.presetBtn} ${timerTotalSec === ex.rest_sec ? styles.presetBtnActive : ''}`}
                >
                  {ex.name} <span className={styles.presetTime}>({ex.rest_sec}s)</span>
                </button>
              ))}
              <button onClick={() => startTimer((timerActive ? timerRemainingSec : 90) + 10, selectedDayId!)} className={styles.plusTenBtn}>+10s</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                <input
                  type="number"
                  min="1"
                  placeholder="Custom sec"
                  value={customTimerSec}
                  onChange={e => setCustomTimerSec(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customTimerSec) { startTimer(parseInt(customTimerSec), selectedDayId!); setCustomTimerSec(''); } }}
                  style={{ width: '90px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
                />
                <button
                  onClick={() => { if (customTimerSec) { startTimer(parseInt(customTimerSec), selectedDayId!); setCustomTimerSec(''); } }}
                  className={styles.presetBtn}
                  style={{ background: 'var(--accent-violet)', color: '#fff', border: 'none' }}
                >
                  <Timer size={12} /> Go
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise Table Row */}
      <div className={styles.exerciseTableCard}>
        <div className={styles.tableTitle}>{selectedDayData?.name || 'Exercises'}</div>
        <table className={styles.exTable}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Done</th>
              <th>Exercise</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Sets</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Target Reps</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Rest (secs)</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Weight</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Goal</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filteredExercises.map(ex => {
                const log = exerciseLogs?.find(l => l.exercise_id === ex.id);
                const isChecked = log?.completed || false;
                const currentWeight = log?.weight || (previousWeights && previousWeights[ex.id]) || 0;

                return (
                  <motion.tr 
                    key={ex.id} 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: isChecked ? 0.4 : 1, y: 0, backgroundColor: isChecked ? 'rgba(22, 163, 74, 0.05)' : 'transparent' }}
                    transition={{ duration: 0.3 }}
                  >
                    <td style={{ position: 'relative' }}>
                      <div 
                        onClick={() => toggleExercise(ex.id, currentWeight)}
                        style={{ width: '24px', height: '24px', borderRadius: '6px', border: isChecked ? 'none' : '2px solid var(--card-border)', background: isChecked ? 'var(--status-success)' : 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        {isChecked && <CheckCircle2 size={16} color="#fff" />}
                      </div>
                    </td>
                    <td style={{ position: 'relative' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: isChecked ? 'line-through' : 'none', transition: 'all 0.3s' }}>{ex.name}</div>
                      {ex.muscle_group && <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{ex.muscle_group}</div>}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                      <div style={{ background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', border: '1px solid var(--card-border)' }}>
                        {ex.sets}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                      <div style={{ background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', border: '1px solid var(--card-border)' }}>
                        {ex.target_reps}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                      <div style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-violet)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                        {ex.rest_sec}s
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="text" 
                        value={currentWeight !== undefined && currentWeight !== null ? String(currentWeight) : ''}
                        onChange={(e) => updateWeight(ex.id, e.target.value)}
                        disabled={isChecked}
                        placeholder="e.g. 7.5 or BW"
                        className={styles.exTableInput}
                        style={{ textAlign: 'center', width: '80px', opacity: isChecked ? 0.5 : 1, transition: 'opacity 0.3s' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <GoalLinkSelector
                        item={{
                          id: ex.id,
                          text: ex.name,
                          completed: isChecked,
                          difficulty: 'mid',
                          linked_goal_id: ex.linked_goal_id,
                          linked_milestone_id: ex.linked_milestone_id,
                          linked_task_id: ex.linked_task_id,
                          linked_task_name: ex.linked_task_name,
                          sync_direction: ex.sync_direction,
                        }}
                        onLink={(goalId, milestoneId, taskId, taskName, syncDir) => handleLinkExerciseToGoal(ex.id, goalId, milestoneId, taskId, taskName, syncDir || 'one-way')}
                        onUnlink={() => handleUnlinkExercise(ex.id)}
                      />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {filteredExercises.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            No exercises match your search or exist for this day.
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSetCompletePopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay} 
            style={{ zIndex: 2000, backdropFilter: 'blur(10px)' }}
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className={styles.modalContentLarge} 
              style={{ maxWidth: '400px', height: 'auto', padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--accent-violet)', boxShadow: '0 20px 40px rgba(124, 58, 237, 0.2)' }}
            >
              <div style={{ fontSize: '64px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>Set {selectedSet} Complete!</div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>You've crushed all workouts for this Set. Ready to keep the momentum going?</div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', width: '100%' }}>
                <button onClick={() => setShowSetCompletePopup(false)} className={styles.actionBtn} style={{ flex: 1, justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>Not Yet</button>
                <button onClick={handleStartNextSet} className={styles.actionBtn} style={{ flex: 1, justifyContent: 'center', background: 'var(--mod-fitness-primary)', color: '#fff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>Start Set {selectedSet! + 1}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

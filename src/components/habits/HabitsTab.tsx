import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { useHabitsStore } from '@/stores/habitsStore';
import { Plus, X, Pencil, Trash2, Check, Flame, GripVertical, Trophy } from 'lucide-react';
import type { Habit, HabitCompletion } from '@/types/modules';
import styles from './Habits.module.css';

import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '@/stores/appStore';

const HABIT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_EMOJIS = [
  '💧', '🏃', '🧘', '💊', '💪', '🧠', '🦷', '🍎', '🥗', '🥑',
  '📚', '💻', '📝', '🎯', '📈', '🎓', '💼', '⏰', '🔬', '💡',
  '🎸', '🎨', '📸', '🎮', '🧩', '🧵', '🪴', '🍳', '🛠️', '✍️',
  '🧹', '🛏️', '🚿', '🧺', '🚗', '💰', '🛒', '🐶', '✈️', '🌱',
  '🙏', '✨', '🔥', '☀️', '🌙', '❤️', '😊', '🎵', '📖', '🍵'
];

function getStreakTier(streak: number) {
  if (streak === 0) return null;
  if (streak <= 3) return { name: 'Spark', style: styles.streakSpark, cardClass: styles.cardSpark, bg: '#9ca3af' };
  if (streak <= 14) return { name: 'Ember', style: styles.streakEmber, cardClass: styles.cardEmber, bg: '#f59e0b' };
  if (streak <= 30) return { name: 'Ignite', style: styles.streakIgnite, cardClass: styles.cardIgnite, bg: '#ef4444' };
  if (streak <= 60) return { name: 'Blaze', style: styles.streakBlaze, cardClass: styles.cardBlaze, bg: 'linear-gradient(135deg, #a855f7, #c084fc)' };
  if (streak <= 150) return { name: 'Solar', style: styles.streakSolar, cardClass: styles.cardSolar, bg: 'linear-gradient(135deg, #3b82f6, #0ea5e9, #38bdf8)' };
  return { name: 'Radiant', style: styles.streakRadiant, cardClass: styles.cardRadiant, bg: 'linear-gradient(45deg, #ff007f, #7928ca, #ff007f)' };
}

// ── Sortable Habit Row Component ──────────────────────────────────────────────

interface SortableHabitRowProps {
  habit: Habit;
  completions: HabitCompletion[];
  last7DaysDates: string[];
  onToggleCompletion: (habit: Habit, dateStr: string, isCompleted: boolean) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
}

function SortableHabitRow({ habit, completions, last7DaysDates, onToggleCompletion, onEdit, onDelete }: SortableHabitRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  const streakTier = getStreakTier(habit.streak_current);

  return (
    <div ref={setNodeRef} style={style} className={`${styles.habitCard} ${streakTier ? streakTier.cardClass : ''}`}>
      <div {...attributes} {...listeners} className={styles.dragHandle}>
        <GripVertical size={20} />
      </div>

      <div className={styles.habitIcon} style={{ background: `${habit.color}20`, color: habit.color }}>
        {habit.icon}
      </div>

      <div className={styles.habitInfo}>
        <div className={styles.habitTitle}>
          {habit.name}
          {streakTier && (
            <span className={`${styles.streakBadge} ${streakTier.style}`}>
              <Flame size={12} fill="currentColor" /> {habit.streak_current} {streakTier.name}
            </span>
          )}
          {habit.streak_best > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Trophy size={10} /> {habit.streak_best} Best
            </span>
          )}
        </div>
        <div className={styles.habitSubtitle}>
          {habit.frequency === 'custom' && habit.frequency_days ? 
            habit.frequency_days.map(d => DAYS_OF_WEEK[d]).join(', ') : 
            habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}
        </div>
      </div>

      <div className={styles.heatmapContainer}>
        {last7DaysDates.map((dateStr, i) => {
          const dateObj = new Date(dateStr);
          const dayOfWeek = dateObj.getDay();
          
          let isActiveDay = true;
          if (habit.frequency === 'custom' && habit.frequency_days) {
            isActiveDay = habit.frequency_days.includes(dayOfWeek);
          }

          const completion = completions.find(c => c.habit_id === habit.id && c.date === dateStr);
          const isCompleted = completion ? completion.count >= habit.target_count : false;

          return (
            <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div 
                title={dateStr}
                className={`${styles.heatmapNode} ${isCompleted ? styles.completed : ''} ${!isActiveDay ? styles.disabled : ''}`}
                style={isCompleted ? { background: streakTier ? streakTier.bg : habit.color, borderColor: 'transparent' } : {}}
                onClick={() => {
                  if (isActiveDay) onToggleCompletion(habit, dateStr, isCompleted);
                }}
              >
                {isCompleted && <Check size={14} strokeWidth={3} />}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {dateObj.getMonth() + 1}/{dateObj.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '12px', borderLeft: '1px solid var(--card-border)', paddingLeft: '12px' }}>
        <button onClick={() => onEdit(habit)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px' }}><Pencil size={16} /></button>
        <button onClick={() => onDelete(habit.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px' }}><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

// ── Main Habits Tab ──────────────────────────────────────────────────────────

export function HabitsTab() {
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  
  // Custom days temp state for the modal
  const [tempCustomDays, setTempCustomDays] = useState<number[]>([1,2,3,4,5]); 
  const [tempFrequency, setTempFrequency] = useState<'daily'|'weekly'|'custom'>('daily');
  const [tempIcon, setTempIcon] = useState('💧');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const habitsRaw = useLiveQuery(() => db.habits.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const habits = useMemo(() => {
    if (!habitsRaw) return [];
    return [...habitsRaw].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [habitsRaw]);

  // Generate last 7 days dates YYYY-MM-DD
  const last7DaysDates = useMemo(() => {
    return Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString();
      return iso.split('T')[0];
    }).reverse(); // From oldest to today
  }, []);

  const allCompletions = useLiveQuery(() => db.habit_completions.where('date').anyOf(last7DaysDates).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray(), [last7DaysDates]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !habits) return;

    const oldIndex = habits.findIndex(h => h.id === active.id);
    const newIndex = habits.findIndex(h => h.id === over.id);

    const reordered = arrayMove(habits, oldIndex, newIndex);
    
    // Batch update sort_order
    await db.transaction('rw', db.habits, async () => {
      for (let i = 0; i < reordered.length; i++) {
        await db.habits.update(reordered[i].id, { sort_order: i, updated_at: new Date().toISOString(), sync_status: 'pending' });
      }
    });
    syncManager.queueSync('habits');
  };

  const handleSaveHabit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newCurrent = parseInt(formData.get('streak_current') as string) || 0;
    let newBest = parseInt(formData.get('streak_best') as string) || 0;
    if (newCurrent > newBest) {
      newBest = newCurrent;
    }

    const habitId = editingHabit ? editingHabit.id : generateId();
    const newHabitColor = editingHabit ? editingHabit.color : HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)];

    const newHabit: Habit = {
      id: habitId,
      user_id: useAppStore.getState().userId || 'default',
      name: formData.get('name') as string,
      description: '',
      icon: tempIcon,
      color: newHabitColor,
      frequency: tempFrequency,
      frequency_days: tempFrequency === 'custom' ? tempCustomDays : undefined,
      target_count: 1, // Target count removed from UI
      category: 'other',
      is_active: true,
      streak_current: newCurrent,
      streak_best: newBest,
      sort_order: editingHabit ? editingHabit.sort_order : habits?.length || 0,
      sync_status: 'pending',
      created_at: editingHabit ? editingHabit.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: editingHabit ? editingHabit.version + 1 : 1,
      device_id: 'default'
    };

    await db.transaction('rw', db.habits, db.habit_completions, async () => {
      if (editingHabit) {
        await db.habits.put(newHabit);
      } else {
        await db.habits.add(newHabit);
      }

      // Handle Manual Streak Override Backfill
      // Run for: new habits with a starting streak, OR edited habits where streak changed
      const needsBackfill = editingHabit 
        ? newCurrent !== editingHabit.streak_current 
        : newCurrent > 0;

      if (needsBackfill) {
        const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const allComps = await db.habit_completions.where('habit_id').equals(habitId).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();

        if (newCurrent === 0) {
          // Delete today and yesterday to break the streak
          const yesterday = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          for (const c of allComps) {
            if (c.date === todayStr || c.date === yesterdayStr) {
              await deleteAndTrack('habit_completions', c.id);
            }
          }
        } else {
          // Backfill completions
          let backfillCount = newCurrent;
          let currDate = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
          
          const hasToday = allComps.some(c => c.date === todayStr);
          if (!hasToday) {
            currDate.setDate(currDate.getDate() - 1);
          }

          let iterations = 0;
          while (backfillCount > 0 && iterations < 1000) {
            iterations++;
            const dStr = currDate.toISOString().split('T')[0];
            const dayOfWeek = currDate.getDay();
            
            let isActive = true;
            if (tempFrequency === 'custom' && tempCustomDays) {
              isActive = tempCustomDays.includes(dayOfWeek);
            }

            if (isActive) {
              const existing = allComps.find(c => c.date === dStr);
              if (!existing) {
                await db.habit_completions.add({
                  id: generateId(),
                  user_id: useAppStore.getState().userId || 'default',
                  habit_id: habitId,
                  date: dStr,
                  count: 1,
                  sync_status: 'pending',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  version: 1,
                  device_id: 'default'
                });
              }
              backfillCount--;
            }
            currDate.setDate(currDate.getDate() - 1);
          }
        }
      }
    });
    syncManager.queueSync('habits');
    
    setShowModal(false);
    setEditingHabit(null);
  };

  const confirmDeleteHabit = async () => {
    if (habitToDelete) {
      // Clear monitoredHabitId if it's the one being deleted, to prevent FK constraint blocks
      if (useAppStore.getState().monitoredHabitId === habitToDelete) {
        useAppStore.getState().setMonitoredHabitId(null);
      }

      await db.transaction('rw', db.habits, db.habit_completions, db.sync_deletions, async () => {
        // Track the deletion of all child completions to prevent Supabase FK errors
        const completions = await db.habit_completions.where('habit_id').equals(habitToDelete).toArray();
        for (const completion of completions) {
          await deleteAndTrack('habit_completions', completion.id);
        }
        
        // Track the deletion of the parent habit
        await deleteAndTrack('habits', habitToDelete);
      });
      syncManager.syncAll();
      setHabitToDelete(null);
    }
  };

  const handleToggleCompletion = async (habit: Habit, dateStr: string, isCompleted: boolean) => {
    const existing = allCompletions?.find(c => c.habit_id === habit.id && c.date === dateStr);
    
    await db.transaction('rw', db.habits, db.habit_completions, db.sync_deletions, async () => {
      if (isCompleted && existing) {
        // Uncheck it
        await deleteAndTrack('habit_completions', existing.id);
      } else if (!isCompleted && !existing) {
        // Check it
        const newCompletion: HabitCompletion = {
          id: generateId(),
          user_id: useAppStore.getState().userId || 'default',
          habit_id: habit.id,
          date: dateStr,
          count: 1,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          device_id: 'default'
        };
        await db.habit_completions.add(newCompletion);
      }
    });

    // Recalculate streak AFTER transaction commits so all data is visible
    const { recalculateHabitStreak } = await import('@/utils/habitUtils');
    await recalculateHabitStreak(habit.id, useAppStore.getState().userId || 'default');
    syncManager.queueSync('habits');
  };

  const openEditor = (habit?: Habit) => {
    setEditingHabit(habit || null);
    setTempFrequency(habit?.frequency || 'daily');
    setTempCustomDays(habit?.frequency_days || [1,2,3,4,5]);
    setTempIcon(habit?.icon || '💧');
    setShowIconPicker(false);
    setShowModal(true);
  };

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Habit Timeline</h2>
        <button className={styles.primaryButton} onClick={() => openEditor()}>
          <Plus size={16} /> New Habit
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {habits.map(habit => (
              <SortableHabitRow 
                key={habit.id} 
                habit={habit} 
                completions={allCompletions || []}
                last7DaysDates={last7DaysDates}
                onToggleCompletion={handleToggleCompletion}
                onEdit={openEditor}
                onDelete={(id) => setHabitToDelete(id)}
              />
            ))}
            {habits.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                No habits created yet. Start building your routine!
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{editingHabit ? 'Edit Habit' : 'New Habit'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveHabit} className={styles.modalBody}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div className={styles.inputGroup} style={{ position: 'relative' }}>
                  <label>Icon</label>
                  <button 
                    type="button" 
                    className={styles.iconSelectButton}
                    onClick={() => setShowIconPicker(!showIconPicker)}
                  >
                    {tempIcon}
                  </button>
                  
                  {showIconPicker && (
                    <div className={styles.iconPopover}>
                      {ALL_EMOJIS.map(icon => (
                        <button 
                          key={icon}
                          type="button" 
                          className={styles.iconPopoverItem}
                          onClick={() => {
                            setTempIcon(icon);
                            setShowIconPicker(false);
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Name</label>
                  <input name="name" className={styles.input} required defaultValue={editingHabit?.name} placeholder="e.g., Drink Water" />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Frequency</label>
                <select 
                  className={styles.input} 
                  value={tempFrequency}
                  onChange={e => setTempFrequency(e.target.value as any)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom Days</option>
                </select>
              </div>

              {tempFrequency === 'custom' && (
                <div className={styles.inputGroup}>
                  <label>Active Days</label>
                  <div className={styles.dayGrid}>
                    {DAYS_OF_WEEK.map((day, index) => {
                      const isActive = tempCustomDays.includes(index);
                      return (
                        <div 
                          key={day}
                          className={`${styles.dayNode} ${isActive ? styles.active : ''}`}
                          onClick={() => {
                            if (isActive) setTempCustomDays(tempCustomDays.filter(d => d !== index));
                            else setTempCustomDays([...tempCustomDays, index].sort());
                          }}
                        >
                          {day.charAt(0)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className={styles.inputGroup}>
                  <label>Current Streak</label>
                  <input type="number" name="streak_current" className={styles.input} min="0" defaultValue={editingHabit?.streak_current || 0} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Best Streak</label>
                  <input type="number" name="streak_best" className={styles.input} min="0" defaultValue={editingHabit?.streak_best || 0} />
                </div>
              </div>

              <button type="submit" className={styles.primaryButton} style={{ justifyContent: 'center', marginTop: '16px' }}>
                Save Habit
              </button>
            </form>
          </div>
        </div>
      )}

      {habitToDelete && (
        <DeleteConfirmationModal
          isOpen={!!habitToDelete}
          title="Delete Habit"
          message="Are you sure you want to delete this habit and all its history? This action cannot be undone."
          onConfirm={confirmDeleteHabit}
          onCancel={() => setHabitToDelete(null)}
        />
      )}
    </div>
  );
}

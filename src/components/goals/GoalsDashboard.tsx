import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { Plus, Target, CheckCircle, Clock, ChevronDown, ChevronRight, X, Calendar, Edit2, Trash2, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Goal, Milestone, GoalTask, GoalStatus, GoalCategory } from '@/types/modules';
import styles from './Goals.module.css';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';

const ALL_EMOJIS = ['🎯','🏃','🏋️','📖','💻','🎨','🎵','🎮','💰','🧘','🥗','✍️','🧠','💼','🪴','🔨','✈️','🏆'];

export function GoalsDashboard() {
  const goals = useLiveQuery(() => db.goals.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const [activeTab, setActiveTab] = useState<GoalStatus>('active');
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

  const confirmDelete = async () => {
    if (goalToDelete) {
      await deleteAndTrack('goals', goalToDelete.id);
      setGoalToDelete(null);
      syncManager.queueSync('goals');
    }
  };

  const filteredGoals = useMemo(() => {
    if (!goals) return [];
    return goals.filter(g => g.status === activeTab).sort((a,b) => {
      // sort by progress descending
      return b.progress - a.progress;
    });
  }, [goals, activeTab]);

  const metrics = useMemo(() => {
    if (!goals) return { active: 0, completed: 0, total: 0 };
    return {
      active: goals.filter(g => g.status === 'active').length,
      completed: goals.filter(g => g.status === 'completed').length,
      total: goals.length,
    };
  }, [goals]);

  const openCreator = () => {
    setEditingGoal(null);
    setShowModal(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}><Target size={16} /> Active Goals</div>
          <div className={styles.metricValue} style={{ color: 'var(--mod-goals-primary)' }}>{metrics.active}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}><CheckCircle size={16} /> Completed</div>
          <div className={styles.metricValue} style={{ color: '#10b981' }}>{metrics.completed}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}><Clock size={16} /> Total Goals</div>
          <div className={styles.metricValue}>{metrics.total}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button className={styles.primaryButton} style={{ padding: '16px 24px', fontSize: '16px' }} onClick={openCreator}>
            <Plus size={20} /> Create Goal
          </button>
        </div>
      </div>

      <div className={styles.tabsRow}>
        {(['active', 'completed', 'paused', 'abandoned'] as GoalStatus[]).map(status => (
          <button
            key={status}
            className={`${styles.tabBtn} ${activeTab === status ? styles.active : ''}`}
            onClick={() => setActiveTab(status)}
            style={{ textTransform: 'capitalize' }}
          >
            {status}
          </button>
        ))}
      </div>

      <div className={styles.goalsGrid}>
        {filteredGoals.map(goal => (
          <GoalCard 
            key={goal.id} 
            goal={goal} 
            onEdit={() => { setEditingGoal(goal); setShowModal(true); }}
            onDelete={() => setGoalToDelete(goal)}
          />
        ))}
        {filteredGoals.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', gridColumn: '1 / -1' }}>
            No {activeTab} goals found.
          </div>
        )}
      </div>

      {showModal && (
        <GoalModal 
          goal={editingGoal} 
          onClose={() => setShowModal(false)} 
        />
      )}

      {goalToDelete && (
        <DeleteConfirmationModal
          isOpen={!!goalToDelete}
          title="Delete Goal"
          message={`Are you sure you want to delete "${goalToDelete.title}"? All milestones and progress will be lost.`}
          onConfirm={confirmDelete}
          onCancel={() => setGoalToDelete(null)}
        />
      )}
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete }: { goal: Goal, onEdit: () => void, onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});

  const toggleMilestoneTasks = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedMilestones(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateProgress = () => {
    if (!goal.is_auto_progress) return goal.progress;
    if (goal.milestones.length === 0) return 0;
    
    let totalWeight = 0;
    let completedWeight = 0;

    goal.milestones.forEach(m => {
      if (!m.tasks || m.tasks.length === 0) {
        totalWeight += 1;
        if (m.completed) completedWeight += 1;
      } else {
        totalWeight += m.tasks.length;
        completedWeight += m.tasks.filter(t => t.completed).length;
      }
    });

    return totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);
  };

  const progress = goal.is_auto_progress ? calculateProgress() : goal.progress;

  const handleToggleTask = async (milestoneId: string, taskId: string, completed: boolean, current_amount?: number) => {
    const updatedMilestones = goal.milestones.map(m => {
      if (m.id === milestoneId && m.tasks) {
        const updatedTasks = m.tasks.map(t => t.id === taskId ? { ...t, completed, current_amount: current_amount !== undefined ? current_amount : t.current_amount } : t);
        const allTasksDone = updatedTasks.length > 0 && updatedTasks.every(t => t.completed);
        return { ...m, tasks: updatedTasks, completed: allTasksDone };
      }
      return m;
    });

    const newlyCompletedMilestone = updatedMilestones.find(m => m.id === milestoneId && m.completed);
    if (newlyCompletedMilestone && newlyCompletedMilestone.reward && !goal.milestones.find(m => m.id === milestoneId)?.completed) {
      triggerConfetti(false);
    }

    await db.goals.update(goal.id, { milestones: updatedMilestones });
    syncManager.queueSync('goals');
    checkAutoCompletion(updatedMilestones);
  };

  const handleToggleMilestone = async (milestoneId: string, completed: boolean) => {
    const updatedMilestones = goal.milestones.map(m => {
      if (m.id === milestoneId) {
        return { ...m, completed, tasks: m.tasks?.map(t => ({ ...t, completed })) }; // auto-complete subtasks
      }
      return m;
    });

    if (completed && !goal.milestones.find(m => m.id === milestoneId)?.completed) {
      const ms = updatedMilestones.find(m => m.id === milestoneId);
      if (ms && ms.reward) {
        triggerConfetti(false);
      }
    }

    await db.goals.update(goal.id, { milestones: updatedMilestones });
    syncManager.queueSync('goals');
    checkAutoCompletion(updatedMilestones);
  };

  const checkAutoCompletion = async (updatedMilestones: Milestone[]) => {
    if (!goal.is_auto_progress) return;
    
    let totalWeight = 0;
    let completedWeight = 0;
    updatedMilestones.forEach(m => {
      if (!m.tasks || m.tasks.length === 0) {
        totalWeight += 1;
        if (m.completed) completedWeight += 1;
      } else {
        totalWeight += m.tasks.length;
        completedWeight += m.tasks.filter(t => t.completed).length;
      }
    });
    
    const newProgress = totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);
    
    if (newProgress === 100 && goal.status !== 'completed') {
      triggerConfetti(true);
      await db.goals.update(goal.id, { progress: newProgress, status: 'completed' });
    } else if (newProgress < 100 && goal.status === 'completed') {
      await db.goals.update(goal.id, { progress: newProgress, status: 'active' });
    } else {
      await db.goals.update(goal.id, { progress: newProgress });
    }
    syncManager.queueSync('goals');
  };

  const triggerConfetti = (isMassive = false) => {
    if (isMassive) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    } else {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div className={styles.goalCard} onClick={() => setExpanded(!expanded)}>
      <div className={styles.goalHeader}>
        <div className={styles.goalIcon} style={{ background: `${goal.color || 'var(--mod-goals-primary)'}22`, color: goal.color || 'var(--mod-goals-primary)' }}>
          {goal.icon || '🎯'}
        </div>
        <div style={{ flex: 1 }}>
          <div className={styles.goalTitle}>{goal.title}</div>
          <div className={styles.goalCategory}>{goal.category}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Edit2 size={16}/></button>
          <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16}/></button>
        </div>
      </div>

      <div className={styles.goalProgress}>
        <div className={styles.progressHeader}>
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%`, background: goal.color || 'var(--mod-goals-primary)' }} />
        </div>
      </div>

      {expanded && goal.description && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          {goal.description}
        </div>
      )}

      {expanded && goal.reward && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: 'var(--mod-goals-light)', border: '1px solid var(--mod-goals-primary)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>🎁</div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mod-goals-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ultimate Reward</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mod-goals-dark)' }}>{goal.reward}</div>
          </div>
        </div>
      )}

      {expanded && goal.milestones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--card-border)' }}>
          {goal.milestones.map(milestone => (
            <div key={milestone.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div 
                  className={`${styles.checkbox} ${milestone.completed ? styles.checked : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleToggleMilestone(milestone.id, !milestone.completed); }}
                >
                  {milestone.completed && <CheckCircle size={14} />}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, textDecoration: milestone.completed ? 'line-through' : 'none', color: milestone.completed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                  {milestone.title}
                </span>
                
                {milestone.tasks && milestone.tasks.length > 0 && (
                  <button type="button" onClick={(e) => toggleMilestoneTasks(e, milestone.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', padding: '4px' }}>
                    {expandedMilestones[milestone.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                )}

                {milestone.due_date && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                    Due: {milestone.due_date}
                  </span>
                )}
              </div>
              
              {milestone.reward && (
                <div style={{ marginLeft: '26px', fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Gift size={12} /> {milestone.reward}
                </div>
              )}
              
              {milestone.tasks && milestone.tasks.length > 0 && expandedMilestones[milestone.id] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '26px' }}>
                  {milestone.tasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {task.target_amount ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                          <button 
                            type="button" 
                            style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = task.current_amount || 0;
                              if (current > 0) {
                                const newAmount = current - 1;
                                handleToggleTask(milestone.id, task.id, newAmount >= task.target_amount!, newAmount);
                              }
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>
                            {task.current_amount || 0} / {task.target_amount}
                          </span>
                          <button 
                            type="button" 
                            style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = task.current_amount || 0;
                              if (current < task.target_amount!) {
                                const newAmount = current + 1;
                                handleToggleTask(milestone.id, task.id, newAmount >= task.target_amount!, newAmount);
                              }
                            }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div 
                          className={`${styles.checkbox} ${task.completed ? styles.checked : ''}`}
                          style={{ width: '14px', height: '14px', borderRadius: '3px' }}
                          onClick={(e) => { e.stopPropagation(); handleToggleTask(milestone.id, task.id, !task.completed); }}
                        />
                      )}
                      <span style={{ fontSize: '13px', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                        {task.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!expanded && goal.milestones.length > 0 && (
        <div className={styles.milestonePreview}>
          <ChevronRight size={14} /> {goal.milestones.length} Milestones (Click to expand)
        </div>
      )}
    </div>
  );
}

function GoalModal({ goal, onClose }: { goal: Goal | null, onClose: () => void }) {
  const [title, setTitle] = useState(goal?.title || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [category, setCategory] = useState<GoalCategory>(goal?.category || 'personal');
  const [status, setStatus] = useState<GoalStatus>(goal?.status || 'active');
  const [isAutoProgress, setIsAutoProgress] = useState(goal?.is_auto_progress ?? true);
  const [progress, setProgress] = useState(goal?.progress || 0);
  const [targetDate, setTargetDate] = useState(goal?.target_date || '');
  const [reward, setReward] = useState(goal?.reward || '');
  const [icon, setIcon] = useState(goal?.icon || '🎯');
  const [color, setColor] = useState(goal?.color || '#e05c7a');
  
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>(goal?.milestones || []);

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) return;
    setMilestones([...milestones, {
      id: generateId(),
      title: newMilestoneTitle.trim(),
      completed: false,
      tasks: []
    }]);
    setNewMilestoneTitle('');
  };

  const handleRemoveMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  const handleMilestoneTitleChange = (milestoneId: string, val: string) => {
    setMilestones(milestones.map(m => m.id === milestoneId ? { ...m, title: val } : m));
  };

  const handleTaskTextChange = (milestoneId: string, taskId: string, val: string) => {
    setMilestones(milestones.map(m => {
      if (m.id === milestoneId) {
        return { ...m, tasks: m.tasks?.map(t => t.id === taskId ? { ...t, text: val } : t) };
      }
      return m;
    }));
  };

  const handleMilestoneRewardChange = (milestoneId: string, val: string) => {
    setMilestones(milestones.map(m => m.id === milestoneId ? { ...m, reward: val } : m));
  };

  const handleAddTask = (milestoneId: string, text: string, target_amount?: number) => {
    if(!text.trim()) return;
    setMilestones(milestones.map(m => {
      if (m.id === milestoneId) {
        return { ...m, tasks: [...(m.tasks || []), { id: generateId(), text: text.trim(), completed: false, target_amount, current_amount: target_amount ? 0 : undefined }] };
      }
      return m;
    }));
  };

  const handleRemoveTask = (milestoneId: string, taskId: string) => {
    setMilestones(milestones.map(m => {
      if (m.id === milestoneId) {
        return { ...m, tasks: m.tasks?.filter(t => t.id !== taskId) };
      }
      return m;
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data: Goal = {
      id: goal?.id || generateId(),
      user_id: useAppStore.getState().userId || 'default',
      title: title.trim(),
      description: description.trim(),
      category,
      status,
      progress: isAutoProgress ? (goal?.progress || 0) : progress, // auto progress is recalculated outside
      is_auto_progress: isAutoProgress,
      target_date: targetDate || undefined,
      reward: reward.trim() || undefined,
      milestones,
      icon,
      color,
      sync_status: 'pending',
      created_at: goal?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: (goal?.version || 0) + 1,
      device_id: 'default'
    };

    // If auto progress, manually recalculate it right now
    if (data.is_auto_progress) {
       let totalWeight = 0;
       let completedWeight = 0;
       data.milestones.forEach(m => {
         if (!m.tasks || m.tasks.length === 0) {
           totalWeight += 1;
           if (m.completed) completedWeight += 1;
         } else {
           totalWeight += m.tasks.length;
           completedWeight += m.tasks.filter(t => t.completed).length;
         }
       });
       data.progress = totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);
       if (data.progress === 100 && data.status === 'active') data.status = 'completed';
    }

    if (goal) {
      await db.goals.put(data);
    } else {
      await db.goals.add(data);
    }
    syncManager.queueSync('goals');
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 style={{ margin: 0 }}>{goal ? 'Edit Goal' : 'Create Goal'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSave} className={styles.modalBody}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <div className={styles.iconPickerBtn} onClick={() => setShowIconPicker(!showIconPicker)} style={{ borderColor: color, color }}>
                {icon}
              </div>
              {showIconPicker && (
                <div className={styles.iconPickerContainer} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', boxShadow: 'var(--shadow-lg)' }}>
                  {ALL_EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => { setIcon(e); setShowIconPicker(false); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className={styles.inputGroup} style={{ flex: 1 }}>
              <label>Goal Title</label>
              <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to achieve?" required autoFocus />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className={styles.inputGroup}>
              <label>Category</label>
              <select className={styles.input} value={category} onChange={e => setCategory(e.target.value as GoalCategory)} style={{ textTransform: 'capitalize' }}>
                {['health', 'fitness', 'gaming', 'personal', 'finance', 'learning', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>Status</label>
              <select className={styles.input} value={status} onChange={e => setStatus(e.target.value as GoalStatus)} style={{ textTransform: 'capitalize' }}>
                {['active', 'completed', 'paused', 'abandoned'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>Target Date</label>
              <input type="date" className={styles.input} value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Description</label>
            <textarea className={styles.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Add some details..." rows={2} />
          </div>

          <div className={styles.inputGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gift size={14} style={{ color: 'var(--mod-goals-primary)' }}/> Ultimate Goal Reward
            </label>
            <input className={styles.input} value={reward} onChange={e => setReward(e.target.value)} placeholder="What's the treat for reaching 100%? (e.g. Buy the new Zelda game)" style={{ borderColor: reward ? 'var(--mod-goals-primary)' : 'inherit' }} />
          </div>

          <div className={styles.inputGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Progress Tracking
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'normal' }}>
                <input type="checkbox" checked={isAutoProgress} onChange={e => setIsAutoProgress(e.target.checked)} />
                Auto-calculate from Milestones
              </div>
            </label>
            {!isAutoProgress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="range" min="0" max="100" value={progress} onChange={e => setProgress(Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ width: '40px', fontWeight: 600 }}>{progress}%</span>
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <label>Milestones & Tasks</label>
            <div className={styles.milestoneBuilder}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  className={styles.input} 
                  style={{ flex: 1 }} 
                  placeholder="Add a milestone (e.g. Save $1000)" 
                  value={newMilestoneTitle}
                  onChange={e => setNewMilestoneTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMilestone(); } }}
                />
                <button type="button" className={styles.primaryButton} onClick={handleAddMilestone}><Plus size={16}/></button>
              </div>

              {milestones.map(milestone =>                  <MilestoneEditor 
                    key={milestone.id} 
                    milestone={milestone} 
                    onRemove={() => handleRemoveMilestone(milestone.id)} 
                    onRewardChange={(val) => handleMilestoneRewardChange(milestone.id, val)}
                    onAddTask={(text, target) => handleAddTask(milestone.id, text, target)}
                    onRemoveTask={(taskId) => handleRemoveTask(milestone.id, taskId)}
                    onTitleChange={(val) => handleMilestoneTitleChange(milestone.id, val)}
                    onTaskTextChange={(taskId, val) => handleTaskTextChange(milestone.id, taskId, val)}
                    onTaskTargetChange={(taskId, val) => setMilestones(milestones.map(m => m.id === milestone.id ? { ...m, tasks: m.tasks?.map(t => t.id === taskId ? { ...t, target_amount: val || undefined } : t) } : m))}
                  />
              )}
            </div>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className={styles.inputGroup} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>Color:</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
            </div>
            <button type="submit" className={styles.primaryButton}>Save Goal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MilestoneEditor({ milestone, onRemove, onRewardChange, onAddTask, onRemoveTask, onTitleChange, onTaskTextChange, onTaskTargetChange }: { milestone: Milestone, onRemove: () => void, onRewardChange: (val: string) => void, onAddTask: (text: string, target?: number) => void, onRemoveTask: (taskId: string) => void, onTitleChange: (val: string) => void, onTaskTextChange: (taskId: string, val: string) => void, onTaskTargetChange: (taskId: string, val: number) => void }) {
  const [newTask, setNewTask] = useState('');
  const [newTarget, setNewTarget] = useState<number | ''>('');

  return (
    <div className={styles.milestoneItem}>
      <div className={styles.milestoneHeader}>
        <input 
          className={styles.input} 
          style={{ fontWeight: 600, flex: 1, padding: '4px 8px', background: 'transparent', border: '1px dashed transparent' }} 
          value={milestone.title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Milestone Title"
        />
        <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={16}/></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
        <Gift size={14} color="#10b981" />
        <input 
          className={styles.input} 
          style={{ flex: 1, padding: '4px 8px', fontSize: '12px', background: 'transparent', border: '1px dashed var(--card-border)' }} 
          placeholder="Mini-reward (optional)" 
          value={milestone.reward || ''}
          onChange={e => onRewardChange(e.target.value)}
        />
      </div>
      
      {milestone.tasks && milestone.tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {milestone.tasks.map(task => (
            <div key={task.id} className={styles.taskItem}>
              <input 
                className={styles.input} 
                style={{ flex: 1, fontSize: '13px', padding: '4px 8px', background: 'transparent', border: '1px dashed transparent' }} 
                value={task.text}
                onChange={e => onTaskTextChange(task.id, e.target.value)}
                placeholder="Task description"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Target:</span>
                <input 
                  type="number" 
                  min="0"
                  className={styles.input}
                  style={{ width: '40px', padding: '2px 4px', fontSize: '11px', background: 'transparent', border: '1px dashed transparent' }}
                  value={task.target_amount || ''}
                  onChange={e => onTaskTargetChange(task.id, Number(e.target.value))}
                />
              </div>
              <button type="button" onClick={() => onRemoveTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={12}/></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', paddingLeft: '28px' }}>
        <input 
          className={styles.input} 
          style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }} 
          placeholder="Add a sub-task..." 
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); onAddTask(newTask, newTarget || undefined); setNewTask(''); setNewTarget(''); } }}
        />
        <input 
          type="number"
          min="1"
          placeholder="Target (opt)"
          className={styles.input}
          style={{ width: '80px', padding: '6px 8px', fontSize: '12px' }}
          value={newTarget}
          onChange={e => setNewTarget(Number(e.target.value) || '')}
          onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); onAddTask(newTask, newTarget || undefined); setNewTask(''); setNewTarget(''); } }}
        />
        <button type="button" style={{ background: 'var(--card-border)', border: 'none', borderRadius: '6px', padding: '0 10px', cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => { onAddTask(newTask, newTarget || undefined); setNewTask(''); setNewTarget(''); }}>
          Add
        </button>
      </div>
    </div>
  );
}

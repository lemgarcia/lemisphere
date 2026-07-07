import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { Plus, X, Pencil, Trash2, Award, GripVertical, Check, ExternalLink } from 'lucide-react';
import type { Skill, SkillEntry, SkillLevel, ChecklistItem, SkillStatus, SkillCategory, TaskDifficulty } from '@/types/modules';
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
import { GoalLinkSelector } from './GoalLinkSelector';

const ALL_EMOJIS = [
  '💻', '🎸', '🍳', '🗣️', '📸', '✏️', '🥋', '🪴',
  '💧', '🏃', '🧘', '💊', '💪', '🧠', '🦷', '🍎',
  '📚', '📝', '🎯', '📈', '🎓', '💼', '⏰', '🔬',
  '🎨', '🎮', '🧩', '🧵', '🛠️', '✍️', '🧹', '💰'
];

function getSkillBracket(xp: number): { level: SkillLevel; min: number; max: number } {
  if (xp < 1000)  return { level: 'beginner',     min: 0,     max: 1000  };
  if (xp < 4000)  return { level: 'intermediate', min: 1000,  max: 4000  };
  if (xp < 12000) return { level: 'advanced',     min: 4000,  max: 12000 };
  if (xp < 30000) return { level: 'expert',       min: 12000, max: 30000 };
  return { level: 'master', min: 30000, max: 100000 };
}

function getBaseXpForLevel(level: SkillLevel): number {
  if (level === 'beginner')     return 0;
  if (level === 'intermediate') return 1000;
  if (level === 'advanced')     return 4000;
  if (level === 'expert')       return 12000;
  if (level === 'master')       return 30000;
  return 0;
}

// Maps both new and legacy difficulty names to XP values
const difficultyMap: Record<string, number> = {
  // Practice tasks
  tiny:        5,
  small:       10,
  focused:     25,
  challenging: 50,
  // Achievement tasks
  minor:       100,
  significant: 200,
  exceptional: 300,
  // Legacy (keep working until migrated)
  easy:        10,
  mid:         25,
  hard:        50,
  extreme:     100,
};

// Migrate old difficulty labels to new ones
function migrateDifficulty(diff: string): TaskDifficulty {
  switch (diff) {
    case 'easy':    return 'small';
    case 'mid':     return 'focused';
    case 'hard':    return 'challenging';
    case 'extreme': return 'minor';
    default:        return diff as TaskDifficulty;
  }
}

const getDiffXpNum = (diff: string) => difficultyMap[diff] ?? 10;

const PRACTICE_DIFFS: TaskDifficulty[]     = ['tiny', 'small', 'focused', 'challenging'];
const ACHIEVEMENT_DIFFS: TaskDifficulty[]  = ['minor', 'significant', 'exceptional'];

function getDiffClass(diff: string): string {
  if (diff === 'tiny')        return styles.diffTiny;
  if (diff === 'small')       return styles.diffEasy;
  if (diff === 'focused')     return styles.diffMid;
  if (diff === 'challenging') return styles.diffHard;
  if (diff === 'minor')       return styles.diffHard;
  if (diff === 'significant') return styles.diffExtreme;
  if (diff === 'exceptional') return styles.diffExtreme;
  // Legacy fallback
  if (diff === 'easy')    return styles.diffEasy;
  if (diff === 'mid')     return styles.diffMid;
  if (diff === 'hard')    return styles.diffHard;
  if (diff === 'extreme') return styles.diffExtreme;
  return styles.diffEasy;
}

function getDiffLabel(diff: string): string {
  const labels: Record<string, string> = {
    tiny: 'Tiny (Practice)', small: 'Small (Practice)', focused: 'Focused (Practice)', challenging: 'Challenging (Practice)',
    minor: 'Minor (Achievement)', significant: 'Significant (Achievement)', exceptional: 'Exceptional (Achievement)',
    easy: 'Small (Practice)', mid: 'Focused (Practice)', hard: 'Challenging (Practice)', extreme: 'Minor (Achievement)',
  };
  return labels[diff] ?? diff;
}

// ── Sortable Skill Card Component ──────────────────────────────────────────────

interface SortableSkillCardProps {
  skill: Skill;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  onToggleChecklist: (skillId: string, itemId: string, completed: boolean, current_amount?: number) => void;
}

function SortableSkillCard({ skill, onEdit, onDelete, onToggleChecklist }: SortableSkillCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: skill.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  const bracket = getSkillBracket(skill.xp);
  const progressPercent = bracket.level === 'master'
    ? Math.min(100, ((skill.xp - bracket.min) / (bracket.max - bracket.min)) * 100)
    : ((skill.xp - bracket.min) / (bracket.max - bracket.min)) * 100;

  let cardThemeClass = styles.skillCardBeginner;
  if (bracket.level === 'intermediate') cardThemeClass = styles.skillCardIntermediate;
  if (bracket.level === 'advanced') cardThemeClass = styles.skillCardAdvanced;
  if (bracket.level === 'expert') cardThemeClass = styles.skillCardExpert;
  if (bracket.level === 'master') cardThemeClass = styles.skillCardMaster;

  // Migrate legacy difficulties for display
  const displayChecklist = (skill.checklist || []).map(item => ({
    ...item,
    difficulty: migrateDifficulty(item.difficulty || 'small') as TaskDifficulty,
  }));

  return (
    <div ref={setNodeRef} style={style} className={`${styles.skillCard} ${cardThemeClass}`}>
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => onEdit(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Pencil size={14} /></button>
        <button onClick={() => onDelete(skill.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
        <div {...attributes} {...listeners} className={styles.dragHandle} style={{ marginLeft: '8px' }}>
          <GripVertical size={16} />
        </div>
      </div>
      
      <div className={styles.skillHeader} style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className={styles.skillIcon} style={{ margin: 0 }}>{skill.icon || '🎯'}</div>
          <div>
            <div className={styles.habitTitle} style={{ fontSize: '18px' }}>{skill.name}</div>
            <div className={styles.habitSubtitle} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--mod-habits-primary)' }}>{skill.category}</span>
              <span>•</span>
              <span style={{ textTransform: 'capitalize' }}>{skill.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      {skill.description && (
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {skill.description}
        </div>
      )}

      {displayChecklist.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tasks</div>
          {displayChecklist.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              {item.target_amount ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--canvas-bg)', padding: '2px', borderRadius: '6px', border: '1px solid var(--card-border)', marginTop: '2px' }}>
                  <button 
                    type="button" 
                    style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const current = item.current_amount || 0;
                      if (current > 0) {
                        const newAmount = current - 1;
                        onToggleChecklist(skill.id, item.id, newAmount >= item.target_amount!, newAmount);
                      }
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>
                    {item.current_amount || 0} / {item.target_amount}
                  </span>
                  <button 
                    type="button" 
                    style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const current = item.current_amount || 0;
                      if (current < item.target_amount!) {
                        const newAmount = current + 1;
                        onToggleChecklist(skill.id, item.id, newAmount >= item.target_amount!, newAmount);
                      }
                    }}
                  >
                    +
                  </button>
                </div>
              ) : (
                <div 
                  className={`${styles.checkboxBtn} ${item.completed ? styles.completed : ''}`}
                  style={{ width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0, marginTop: '2px' }}
                  onClick={() => onToggleChecklist(skill.id, item.id, !item.completed)}
                >
                  {item.completed && <Check size={12} strokeWidth={3} />}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', color: item.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: item.completed ? 'line-through' : 'none' }}>
                  {item.text} {item.repeats && item.repeats > 1 ? `(x${item.repeats})` : ''}
                </span>
                <span className={`${styles.difficultyBadge} ${getDiffClass(item.difficulty || 'small')}`} style={{ alignSelf: 'flex-start' }}>
                  {getDiffLabel(item.difficulty || 'small')} &mdash; {item.target_amount ? getDiffXpNum(item.difficulty || 'small') * item.target_amount : getDiffXpNum(item.difficulty || 'small') * (item.repeats || 1)} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      )}



      {skill.links && skill.links.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {skill.links.map(link => (
            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '16px', color: 'var(--mod-habits-primary)', textDecoration: 'none', border: '1px solid var(--card-border)' }}>
              <ExternalLink size={12} />
              {link.title}
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
          <div className={styles.skillLevel}>{skill.level}</div>
          <div className={styles.xpText}>{skill.xp} / {bracket.level === 'master' ? '∞' : bracket.max} XP</div>
        </div>
        <div className={styles.skillBarContainer}>
          <div className={`${styles.skillBarFill} ${bracket.level === 'master' ? styles.skillBarMaster : bracket.level === 'expert' ? styles.skillBarExpert : ''}`} style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}></div>
        </div>
      </div>
    </div>
  );
}

// ── Main Skills Tab ──────────────────────────────────────────────────────────

export function SkillsTab() {
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null);

  const [tempIcon, setTempIcon] = useState('💻');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [tempChecklist, setTempChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [newItemDifficulty, setNewItemDifficulty] = useState<TaskDifficulty>('easy');
  const [newItemTarget, setNewTargetAmount] = useState<number | ''>('');
  const [tempLinks, setTempLinks] = useState<{ id: string; title: string; url: string }[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const skillsRaw = useLiveQuery(() => db.skills.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const skills = useMemo(() => {
    if (!skillsRaw) return [];
    return [...skillsRaw].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [skillsRaw]);

  const todayStr = new Date().toISOString().split('T')[0];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !skills) return;

    const oldIndex = skills.findIndex(s => s.id === active.id);
    const newIndex = skills.findIndex(s => s.id === over.id);

    const reordered = arrayMove(skills, oldIndex, newIndex);
    
    await db.transaction('rw', db.skills, async () => {
      for (let i = 0; i < reordered.length; i++) {
        await db.skills.update(reordered[i].id, { sort_order: i, updated_at: new Date().toISOString(), sync_status: 'pending' });
      }
    });
    syncManager.queueSync('habits');
  };

  const handleAddChecklistItem = () => {
    if (!newItemText.trim()) return;
    setTempChecklist([...tempChecklist, { id: generateId(), text: newItemText.trim(), completed: false, difficulty: newItemDifficulty, target_amount: newItemTarget || undefined, current_amount: newItemTarget ? 0 : undefined }]);
    setNewItemText('');
    setNewTargetAmount('');
  };

  const handleRemoveChecklistItem = (id: string) => {
    setTempChecklist(tempChecklist.filter(i => i.id !== id));
  };

  const handleEditChecklistText = (id: string, text: string) => {
    setTempChecklist(tempChecklist.map(i => i.id === id ? { ...i, text } : i));
  };

  const handleAddLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setTempLinks([...tempLinks, { id: generateId(), title: newLinkTitle.trim(), url }]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  const handleRemoveLink = (id: string) => {
    setTempLinks(tempLinks.filter(l => l.id !== id));
  };

  const handleEditChecklistTarget = (id: string, target_amount: number | undefined) => {
    setTempChecklist(tempChecklist.map(i => i.id === id ? { ...i, target_amount, current_amount: target_amount ? 0 : undefined } : i));
  };

  const handleToggleChecklist = async (skillId: string, itemId: string, completed: boolean, current_amount?: number) => {
    const skill = await db.skills.get(skillId);
    if (!skill) return;
    
    const task = skill.checklist?.find(i => i.id === itemId);
    const diff = migrateDifficulty(task?.difficulty || 'small');
    const xpPerClick = getDiffXpNum(diff) * (task?.repeats || 1);
    
    let xpDelta = 0;
    let targetGoalId: string | undefined = undefined;
    let targetMilestoneId: string | undefined = undefined;
    let targetTaskId: string | undefined = undefined;
    
    const updatedChecklist = skill.checklist?.map(item => {
      if (item.id === itemId) {
        if (item.linked_goal_id) {
          targetGoalId = item.linked_goal_id;
          targetMilestoneId = item.linked_milestone_id;
          targetTaskId = item.linked_task_id;
        }

        if (current_amount !== undefined) {
          const oldAmount = item.current_amount || 0;
          xpDelta = (current_amount - oldAmount) * xpPerClick;
          return { ...item, completed, current_amount };
        } else {
          xpDelta = completed ? xpPerClick : -xpPerClick;
          return { ...item, completed };
        }
      }
      return item;
    }) || [];

    let newXp = Math.max(0, skill.xp + xpDelta);
    const bracket = getSkillBracket(newXp);

    await db.skills.update(skillId, { 
      checklist: updatedChecklist,
      xp: newXp,
      level: bracket.level,
      sync_status: 'pending',
      updated_at: new Date().toISOString()
    });
    syncManager.queueSync('habits');

    // Grant Reward XP equal to Skill XP earned (only positive gains)
    if (xpDelta > 0) {
      const userId = useAppStore.getState().userId || 'default';
      const prefId = userId;
      const existing = await db.user_preferences.get(prefId);
      if (existing) {
        const newRewardXp = (existing.reward_xp || 0) + xpDelta;
        await db.user_preferences.update(prefId, {
          reward_xp: newRewardXp,
          sync_status: 'pending',
          updated_at: new Date().toISOString(),
        });
        syncManager.queueSync('dashboard');
      }
    }

    // Cross-module Sync: Update Goal if linked
    if (targetGoalId) {
      const goal = await db.goals.get(targetGoalId);
      if (goal) {
        let goalUpdated = false;
        const updatedMilestones = goal.milestones.map(m => {
          if (m.id === targetMilestoneId) {
            if (targetTaskId) {
              const updatedTasks = m.tasks?.map(t => {
                if (t.id === targetTaskId) {
                  goalUpdated = true;
                  return { ...t, completed, current_amount };
                }
                return t;
              });
              // check if all tasks complete
              const allDone = updatedTasks?.length ? updatedTasks.every(t => t.completed) : false;
              return { ...m, tasks: updatedTasks, completed: allDone, completed_at: (allDone && !m.completed) ? new Date().toISOString() : m.completed_at };
            } else {
              goalUpdated = true;
              return { ...m, completed, current_amount, completed_at: (completed && !m.completed) ? new Date().toISOString() : m.completed_at };
            }
          }
          return m;
        });

        if (goalUpdated) {
          await db.goals.update(targetGoalId, {
            milestones: updatedMilestones,
            sync_status: 'pending',
            updated_at: new Date().toISOString()
          });
          syncManager.queueSync('goals');
        }
      }
    }
  };

  const handleSaveSkill = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const startingLevel = formData.get('starting_level') as SkillLevel | null;
    let xp = editingSkill ? editingSkill.xp : 0;
    
    if (!editingSkill && startingLevel) {
      xp = getBaseXpForLevel(startingLevel);
    }
    
    const bracket = getSkillBracket(xp);

    const newSkill: Skill = {
      id: editingSkill ? editingSkill.id : generateId(),
      user_id: useAppStore.getState().userId || 'default',
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      status: formData.get('status') as SkillStatus,
      level: bracket.level,
      xp: xp,
      checklist: tempChecklist,
      links: tempLinks,
      icon: tempIcon,
      sort_order: editingSkill ? editingSkill.sort_order : skills?.length || 0,
      sync_status: 'pending',
      created_at: editingSkill ? editingSkill.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: editingSkill ? editingSkill.version + 1 : 1,
      device_id: 'default'
    };

    if (editingSkill) {
      await db.skills.put(newSkill);
    } else {
      await db.skills.add(newSkill);
    }
    syncManager.queueSync('habits');
    
    setShowSkillModal(false);
    setEditingSkill(null);
  };

  const confirmDeleteSkill = async () => {
    if (skillToDelete) {
      await db.transaction('rw', db.skills, db.skill_entries, db.sync_deletions, async () => {
        // Track the deletion of all child entries to prevent Supabase FK errors
        const entries = await db.skill_entries.where('skill_id').equals(skillToDelete).toArray();
        for (const entry of entries) {
          await deleteAndTrack('skill_entries', entry.id);
        }
        
        // Track the deletion of the parent skill
        await deleteAndTrack('skills', skillToDelete);
      });
      syncManager.queueSync('habits');
      setSkillToDelete(null);
    }
  };

  const openEditor = (skill?: Skill) => {
    setEditingSkill(skill || null);
    setTempIcon(skill?.icon || '💻');
    setTempChecklist(skill?.checklist || []);
    setTempLinks(skill?.links || []);
    setShowIconPicker(false);
    setNewItemText('');
    setNewItemDifficulty('easy');
    setNewTargetAmount('');
    setNewLinkTitle('');
    setNewLinkUrl('');
    setShowSkillModal(true);
  };

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Skill Progression</h2>
        <button className={styles.primaryButton} onClick={() => openEditor()}>
          <Plus size={16} /> Add Skill
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={skills.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {skills.map(skill => (
              <SortableSkillCard 
                key={skill.id} 
                skill={skill} 
                onEdit={openEditor} 
                onDelete={(id) => setSkillToDelete(id)} 
                onToggleChecklist={handleToggleChecklist}
              />
            ))}
            {skills.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                No skills tracking yet. Click Add Skill to begin!
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {showSkillModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{editingSkill ? 'Edit Skill' : 'New Skill'}</h3>
              <button onClick={() => setShowSkillModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSkill} className={styles.modalBody}>
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
                  <label>Skill Name</label>
                  <input name="name" className={styles.input} required defaultValue={editingSkill?.name} placeholder="e.g., Python Programming" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className={styles.inputGroup}>
                  <label>Category</label>
                  <select name="category" className={styles.input} defaultValue={editingSkill?.category || 'Technical'}>
                    <option value="Technical">Technical</option>
                    <option value="Creative">Creative</option>
                    <option value="Self">Self</option>
                    <option value="Upskill">Upskill</option>
                    <option value="Talent">Talent</option>
                    <option value="Reinforcement">Reinforcement</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Status</label>
                  <select name="status" className={styles.input} defaultValue={editingSkill?.status || 'learning'}>
                    <option value="learning">Currently Learning</option>
                    <option value="mastered">Mastered</option>
                    <option value="on_hold">On Hold</option>
                    <option value="stopped">Stopped</option>
                  </select>
                </div>
              </div>

              {!editingSkill && (
                <div className={styles.inputGroup}>
                  <label>Starting Level</label>
                  <select name="starting_level" className={styles.input} defaultValue="beginner">
                    <option value="beginner">Beginner (0 XP)</option>
                    <option value="intermediate">Intermediate (1,000 XP)</option>
                    <option value="advanced">Advanced (4,000 XP)</option>
                    <option value="expert">Expert (12,000 XP)</option>
                    <option value="master">Master (30,000 XP)</option>
                  </select>
                </div>
              )}

              <div className={styles.inputGroup}>
                <label>Description (Optional)</label>
                <textarea name="description" className={styles.input} rows={2} defaultValue={editingSkill?.description} placeholder="What are you trying to achieve?" />
              </div>

              <div className={styles.inputGroup}>
                <label>Tasks</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    className={styles.input} 
                    style={{ flex: 1 }}
                    value={newItemText} 
                    onChange={e => setNewItemText(e.target.value)} 
                    placeholder="e.g., Build a React App" 
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem(); } }}
                  />
                  <select 
                    className={styles.input} 
                    style={{ width: 'auto' }}
                    value={newItemDifficulty} 
                    onChange={e => setNewItemDifficulty(e.target.value as TaskDifficulty)}
                  >
                    <optgroup label="— Practice Tasks —">
                      <option value="tiny">Tiny (5 XP)</option>
                      <option value="small">Small (10 XP)</option>
                      <option value="focused">Focused (25 XP)</option>
                      <option value="challenging">Challenging (50 XP)</option>
                    </optgroup>
                    <optgroup label="— Achievement Tasks —">
                      <option value="minor">Minor (100 XP)</option>
                      <option value="significant">Significant (200 XP)</option>
                      <option value="exceptional">Exceptional (300 XP)</option>
                    </optgroup>
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Target (opt)"
                    className={styles.input}
                    style={{ width: '90px' }}
                    value={newItemTarget}
                    onChange={e => setNewTargetAmount(Number(e.target.value) || '')}
                  />
                  <button type="button" className={styles.primaryButton} onClick={handleAddChecklistItem}><Plus size={16}/></button>
                </div>
                
                {tempChecklist.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {tempChecklist.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <div className={`${styles.checkboxBtn} ${item.completed ? styles.completed : ''}`} style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0 }}>
                            {item.completed && <Check size={10} strokeWidth={3} />}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
                            <input 
                              className={styles.input}
                              style={{ padding: '4px 8px', fontSize: '13px' }}
                              value={item.text}
                              onChange={e => handleEditChecklistText(item.id, e.target.value)}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`${styles.difficultyBadge} ${getDiffClass(item.difficulty || 'small')}`}>
                                {getDiffLabel(item.difficulty || 'small')} — {item.target_amount ? getDiffXpNum(item.difficulty || 'small') * item.target_amount : getDiffXpNum(item.difficulty || 'small') * (item.repeats || 1)} XP
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Target:</span>
                                <input 
                                  type="number"
                                  min="0"
                                  className={styles.input}
                                  style={{ width: '50px', padding: '2px 4px', fontSize: '11px' }}
                                  value={item.target_amount || ''}
                                  onChange={e => handleEditChecklistTarget(item.id, Number(e.target.value) || undefined)}
                                />
                              </div>
                              <GoalLinkSelector 
                                item={item}
                                onLink={(goalId, milestoneId, taskId, taskName, syncDirection) => {
                                  setTempChecklist(tempChecklist.map(i => i.id === item.id ? { 
                                    ...i, 
                                    linked_goal_id: goalId, 
                                    linked_milestone_id: milestoneId, 
                                    linked_task_id: taskId, 
                                    linked_task_name: taskName,
                                    sync_direction: syncDirection || 'one-way'
                                  } : i));
                                }}
                                onUnlink={() => {
                                  setTempChecklist(tempChecklist.map(i => i.id === item.id ? { 
                                    ...i, 
                                    linked_goal_id: undefined, 
                                    linked_milestone_id: undefined, 
                                    linked_task_id: undefined, 
                                    linked_task_name: undefined,
                                    sync_direction: undefined
                                  } : i));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveChecklistItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', marginLeft: '8px' }}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label>Links (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className={styles.input}
                    style={{ flex: 1 }}
                    value={newLinkTitle}
                    onChange={e => setNewLinkTitle(e.target.value)}
                    placeholder="Link Title (e.g., Course)"
                  />
                  <input
                    className={styles.input}
                    style={{ flex: 2 }}
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    placeholder="URL (https://...)"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                  />
                  <button type="button" className={styles.primaryButton} onClick={handleAddLink}><Plus size={16}/></button>
                </div>
                {tempLinks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {tempLinks.map(link => (
                      <div key={link.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{link.title}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.url}</span>
                        </div>
                        <button type="button" onClick={() => handleRemoveLink(link.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className={styles.primaryButton} style={{ justifyContent: 'center', marginTop: '16px' }}>
                Save Skill
              </button>
            </form>
          </div>
        </div>
      )}

      {skillToDelete && (
        <DeleteConfirmationModal
          isOpen={!!skillToDelete}
          title="Delete Skill"
          message="Are you sure you want to delete this skill and all its XP history? This action cannot be undone."
          onConfirm={confirmDeleteSkill}
          onCancel={() => setSkillToDelete(null)}
        />
      )}

    </div>
  );
}

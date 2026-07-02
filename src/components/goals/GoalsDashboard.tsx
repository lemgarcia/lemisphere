import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { Plus, Target, CheckCircle, Clock, ChevronDown, ChevronRight, X, Calendar, Edit2, Trash2, Gift, GripVertical, Star, ShoppingBag, History, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Goal, Milestone, GoalTask, GoalStatus, GoalCategory, CustomReward, RewardLog } from '@/types/modules';
import styles from './Goals.module.css';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';

const ALL_EMOJIS = ['🎯','🏃','🏋️','📖','💻','🎨','🎵','🎮','💰','🧘','🥗','✍️','🧠','💼','🪴','🔨','✈️','🏆'];

const getDifficultyColor = (diff?: string) => {
  switch (diff) {
    case 'easy': return 'rgba(16, 185, 129, 0.3)';
    case 'mid': return 'rgba(59, 130, 246, 0.3)';
    case 'hard': return 'rgba(245, 158, 11, 0.3)';
    case 'extreme': return 'rgba(239, 68, 68, 0.3)';
    default: return 'var(--mod-goals-light)';
  }
};

export function GoalsDashboard() {
  const goals = useLiveQuery(() => db.goals.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const skills = useLiveQuery(() => db.skills.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const [activeTab, setActiveTab] = useState<GoalStatus | 'rewards'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

  // Pull latest data immediately when this page is opened
  useEffect(() => {
    syncManager.syncAll();
  }, []);

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
      if (a.sort_order !== undefined && b.sort_order !== undefined) {
        return a.sort_order - b.sort_order;
      }
      return b.progress - a.progress;
    });
  }, [goals, activeTab]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id && filteredGoals) {
      const oldIndex = filteredGoals.findIndex(g => g.id === active.id);
      const newIndex = filteredGoals.findIndex(g => g.id === over.id);
      
      const newGoals = arrayMove(filteredGoals, oldIndex, newIndex);
      
      await Promise.all(
        newGoals.map((goal, index) => 
          db.goals.update(goal.id, { 
            sort_order: index,
            sync_status: 'pending',
            updated_at: new Date().toISOString(),
          })
        )
      );
      syncManager.queueSync('goals');
    }
  };

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
        <button
          className={`${styles.tabBtn} ${activeTab === 'rewards' ? styles.active : ''}`}
          onClick={() => setActiveTab('rewards')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Sparkles size={14} /> Rewards
        </button>
      </div>

      {activeTab === 'rewards' ? (
        <RewardsTab />
      ) : (
        <>
          <div className={styles.goalsGrid}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredGoals.map(g => g.id)} strategy={rectSortingStrategy}>
                {filteredGoals.map(goal => (
                  <SortableGoalCard 
                    key={goal.id} 
                    goal={goal} 
                    skills={skills || []}
                    onEdit={() => { setEditingGoal(goal); setShowModal(true); }}
                    onDelete={() => setGoalToDelete(goal)}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
        </>
      )}
    </div>
  );
}

// ── Rewards Tab ─────────────────────────────────────────────────────────────

function RewardsTab() {
  const userId = useAppStore(s => s.userId) || 'default';
  const prefs = useLiveQuery(() => db.user_preferences.get(userId), [userId]);

  const rewardXp   = prefs?.reward_xp    ?? 0;
  const rewards    = prefs?.custom_rewards ?? [];
  const rewardLogs = prefs?.reward_logs   ?? [];

  const [showManage, setShowManage] = useState(false);
  const [rewardToDelete, setRewardToDelete] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // ── Redeem ────────────────────────────────────────────────────────────────
  const handleRedeem = async (reward: CustomReward) => {
    if (!prefs) return;
    if (rewardXp < reward.cost) {
      setRedeemError(`Not enough Reward XP! You need ${reward.cost - rewardXp} more.`);
      setTimeout(() => setRedeemError(null), 3000);
      return;
    }
    const newLog: RewardLog = {
      id: generateId(),
      reward_id: reward.id,
      reward_name: reward.name,
      reward_cost: reward.cost,
      redeemed_at: new Date().toISOString(),
    };
    await db.user_preferences.update(userId, {
      reward_xp: rewardXp - reward.cost,
      reward_logs: [newLog, ...rewardLogs],
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    syncManager.queueSync('dashboard');
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Balance Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--mod-goals-primary), var(--mod-goals-dark))',
        borderRadius: '16px',
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Reward XP Balance
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
            {rewardXp.toLocaleString()} <span style={{ fontSize: '20px', fontWeight: 600, opacity: 0.8 }}>RXP</span>
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '8px' }}>
            Earned from completing skill tasks. Spend on rewards — never affects Skill XP.
          </div>
        </div>
        <div style={{ fontSize: '64px', opacity: 0.3 }}>✨</div>
      </div>

      {redeemError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#ef4444', fontSize: '14px', fontWeight: 600 }}>
          {redeemError}
        </div>
      )}

      {/* Rewards Grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingBag size={18} /> Custom Rewards
        </div>
        <button
          className={styles.primaryButton}
          onClick={() => setShowManage(true)}
        >
          <Plus size={16} /> Manage Rewards
        </button>
      </div>

      {rewards.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--card-bg)', borderRadius: '16px', border: '2px dashed var(--card-border)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎁</div>
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>No rewards yet</div>
          <div style={{ fontSize: '14px' }}>Click "Manage Rewards" to create custom rewards you can spend your Reward XP on.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {rewards.map(reward => {
            const canAfford = rewardXp >= reward.cost;
            return (
              <div key={reward.id} style={{
                background: 'var(--card-bg)',
                border: `1px solid ${canAfford ? 'var(--mod-goals-primary)' : 'var(--card-border)'}`,
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: canAfford ? '0 0 0 1px var(--mod-goals-primary)22' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>{reward.icon || '🎁'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{reward.name}</div>
                    {reward.description && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{reward.description}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <div style={{
                    background: canAfford ? 'rgba(var(--mod-goals-primary-rgb, 139,92,246), 0.12)' : 'var(--bg-secondary)',
                    color: canAfford ? 'var(--mod-goals-primary)' : 'var(--text-tertiary)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '15px',
                  }}>
                    {reward.cost.toLocaleString()} RXP
                  </div>
                  <button
                    className={styles.primaryButton}
                    disabled={!canAfford}
                    onClick={() => handleRedeem(reward)}
                    style={{
                      opacity: canAfford ? 1 : 0.4,
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      padding: '8px 16px',
                    }}
                  >
                    <Gift size={14} /> Redeem
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Redemption Log */}
      {rewardLogs.length > 0 && (
        <div>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <History size={18} /> Redemption Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rewardLogs.slice(0, 30).map(log => (
              <div key={log.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '10px',
                padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '20px' }}>🎁</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{log.reward_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {new Date(log.redeemed_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '14px' }}>
                  -{log.reward_cost.toLocaleString()} RXP
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Rewards Modal */}
      {showManage && (
        <ManageRewardsModal
          rewards={rewards}
          onClose={() => setShowManage(false)}
          onSave={async (updated) => {
            if (!prefs) return;
            await db.user_preferences.update(userId, {
              custom_rewards: updated,
              sync_status: 'pending',
              updated_at: new Date().toISOString(),
            });
            syncManager.queueSync('dashboard');
          }}
        />
      )}
    </div>
  );
}

// ── Manage Rewards Modal ────────────────────────────────────────────────────

const REWARD_EMOJIS = ['🎁','🎮','🎬','🍔','🍕','🧁','🎉','🏖️','💤','📺','🎵','🛒','☕','🧘','🍷','✈️','💆','🎯','🎲','📚'];

function ManageRewardsModal({ rewards, onClose, onSave }: {
  rewards: CustomReward[];
  onClose: () => void;
  onSave: (updated: CustomReward[]) => Promise<void>;
}) {
  const [list, setList] = useState<CustomReward[]>(rewards);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [icon, setIcon] = useState('🎁');
  const [showPicker, setShowPicker] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim() || !cost) return;
    const newReward: CustomReward = {
      id: generateId(),
      name: name.trim(),
      description: desc.trim() || undefined,
      cost: Number(cost),
      icon,
    };
    setList(prev => [...prev, newReward]);
    setName(''); setDesc(''); setCost(''); setIcon('🎁');
  };

  const handleDeleteConfirm = () => {
    if (toDelete) setList(prev => prev.filter(r => r.id !== toDelete));
    setToDelete(null);
  };

  const handleSave = async () => {
    await onSave(list);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '20px',
    }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: '20px', width: '100%', maxWidth: '520px',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={18} /> Manage Rewards
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px' }}><X size={20} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Add Form */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Reward</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Icon Picker */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowPicker(p => !p)}
                  style={{ fontSize: '24px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                >
                  {icon}
                </button>
                {showPicker && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 100,
                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                    borderRadius: '10px', padding: '8px', display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '4px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }}>
                    {REWARD_EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => { setIcon(e); setShowPicker(false); }}
                        style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Reward name *"
                className={styles.inputField}
                style={{ flex: 1, padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
              />
              <input
                type="number"
                min="1"
                value={cost}
                onChange={e => setCost(Number(e.target.value) || '')}
                placeholder="Cost (RXP) *"
                className={styles.inputField}
                style={{ width: '110px', padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Description (optional)"
                className={styles.inputField}
                style={{ flex: 1, padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!name.trim() || !cost}
                className={styles.primaryButton}
                style={{ opacity: (!name.trim() || !cost) ? 0.5 : 1 }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          {/* Rewards List */}
          {list.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Rewards ({list.length})</div>
              {list.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px 14px' }}>
                  <span style={{ fontSize: '22px' }}>{r.icon || '🎁'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{r.name}</div>
                    {r.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.description}</div>}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--mod-goals-primary)', minWidth: '70px', textAlign: 'right' }}>
                    {r.cost.toLocaleString()} RXP
                  </div>
                  <button
                    onClick={() => setToDelete(r.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
            Cancel
          </button>
          <button onClick={handleSave} className={styles.primaryButton} style={{ padding: '10px 24px', fontSize: '15px', fontWeight: 700 }}>
            Save Changes
          </button>
        </div>
      </div>

      {toDelete && (
        <DeleteConfirmationModal
          isOpen={!!toDelete}
          title="Delete Reward"
          message="Are you sure you want to delete this reward? This cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}



function SortableGoalCard(props: { goal: Goal, skills: any[], onEdit: () => void, onDelete: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <GoalCard {...props} dragHandleProps={{ attributes, listeners }} />
    </div>
  );
}

function GoalCard({ goal, skills, onEdit, onDelete, dragHandleProps }: { goal: Goal, skills: any[], onEdit: () => void, onDelete: () => void, dragHandleProps?: any }) {
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

    await db.goals.update(goal.id, { 
      milestones: updatedMilestones,
      sync_status: 'pending',
      updated_at: new Date().toISOString()
    });
    syncManager.queueSync('goals');
    checkAutoCompletion(updatedMilestones);

    // Cross-module Two-Way Sync
    const allSkills = await db.skills.toArray();
    for (const skill of allSkills) {
      if (!skill.checklist) continue;
      let skillUpdated = false;
      let xpDelta = 0;

      const updatedChecklist = skill.checklist.map(item => {
        if (item.linked_task_id === taskId && item.sync_direction === 'two-way') {
          skillUpdated = true;
          const xpPerClick = (item.difficulty === 'extreme' ? 100 : item.difficulty === 'hard' ? 50 : item.difficulty === 'mid' ? 25 : 10) * (item.repeats || 1);
          if (current_amount !== undefined) {
            const oldAmount = item.current_amount || 0;
            xpDelta += (current_amount - oldAmount) * xpPerClick;
            return { ...item, completed, current_amount };
          } else {
            xpDelta += completed ? xpPerClick : (item.completed ? -xpPerClick : 0);
            return { ...item, completed, current_amount: completed ? item.target_amount : (item.current_amount || 0) };
          }
        }
        return item;
      });

      if (skillUpdated) {
        let newXp = Math.max(0, skill.xp + xpDelta);
        // New XP brackets: 1000/4000/12000/30000
        let level = skill.level;
        if (newXp >= 30000) level = 'master';
        else if (newXp >= 12000) level = 'expert';
        else if (newXp >= 4000) level = 'advanced';
        else if (newXp >= 1000) level = 'intermediate';
        else level = 'beginner';

        await db.skills.update(skill.id, {
          checklist: updatedChecklist,
          xp: newXp,
          level,
          sync_status: 'pending',
          updated_at: new Date().toISOString()
        });
        syncManager.queueSync('habits');

        // Grant Reward XP for positive gains from goal-linked task sync
        if (xpDelta > 0) {
          const userId = useAppStore.getState().userId || 'default';
          const pref = await db.user_preferences.get(userId);
          if (pref) {
            await db.user_preferences.update(userId, {
              reward_xp: (pref.reward_xp || 0) + xpDelta,
              sync_status: 'pending',
              updated_at: new Date().toISOString(),
            });
            syncManager.queueSync('dashboard');
          }
        }
      }
    }
  };

  const handleToggleMilestone = async (milestoneId: string, completed: boolean, current_amount?: number) => {
    const updatedMilestones = goal.milestones.map(m => {
      if (m.id === milestoneId) {
        return { 
          ...m, 
          completed, 
          current_amount: current_amount !== undefined ? current_amount : m.current_amount,
          tasks: m.tasks?.map(t => ({ ...t, completed })) // auto-complete subtasks
        }; 
      }
      return m;
    });

    if (completed && !goal.milestones.find(m => m.id === milestoneId)?.completed) {
      const ms = updatedMilestones.find(m => m.id === milestoneId);
      if (ms && ms.reward) {
        triggerConfetti(false);
      }
    }

    await db.goals.update(goal.id, { 
      milestones: updatedMilestones,
      sync_status: 'pending',
      updated_at: new Date().toISOString()
    });
    syncManager.queueSync('goals');
    checkAutoCompletion(updatedMilestones);

    // Cross-module Two-Way Sync for Milestone links
    const allSkills = await db.skills.toArray();
    for (const skill of allSkills) {
      if (!skill.checklist) continue;
      let skillUpdated = false;
      let xpDelta = 0;

      const updatedChecklist = skill.checklist.map(item => {
        if (item.linked_milestone_id === milestoneId && !item.linked_task_id && item.sync_direction === 'two-way') {
          skillUpdated = true;
          const xpPerClick = (item.difficulty === 'extreme' ? 100 : item.difficulty === 'hard' ? 50 : item.difficulty === 'mid' ? 25 : 10) * (item.repeats || 1);
          if (current_amount !== undefined) {
            const oldAmount = item.current_amount || 0;
            xpDelta += (current_amount - oldAmount) * xpPerClick;
            return { ...item, completed, current_amount };
          } else {
            xpDelta += completed ? xpPerClick : (item.completed ? -xpPerClick : 0);
            return { ...item, completed, current_amount: completed ? item.target_amount : (item.current_amount || 0) };
          }
        }
        return item;
      });

      if (skillUpdated) {
        let newXp = Math.max(0, skill.xp + xpDelta);
        // New XP brackets: 1000/4000/12000/30000
        let level = skill.level;
        if (newXp >= 30000) level = 'master';
        else if (newXp >= 12000) level = 'expert';
        else if (newXp >= 4000) level = 'advanced';
        else if (newXp >= 1000) level = 'intermediate';
        else level = 'beginner';

        await db.skills.update(skill.id, {
          checklist: updatedChecklist,
          xp: newXp,
          level,
          sync_status: 'pending',
          updated_at: new Date().toISOString()
        });
        syncManager.queueSync('habits');

        // Grant Reward XP for positive gains from goal-linked milestone sync
        if (xpDelta > 0) {
          const userId = useAppStore.getState().userId || 'default';
          const pref = await db.user_preferences.get(userId);
          if (pref) {
            await db.user_preferences.update(userId, {
              reward_xp: (pref.reward_xp || 0) + xpDelta,
              sync_status: 'pending',
              updated_at: new Date().toISOString(),
            });
            syncManager.queueSync('dashboard');
          }
        }
      }
    }
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
      await db.goals.update(goal.id, { progress: newProgress, status: 'completed', sync_status: 'pending', updated_at: new Date().toISOString() });
    } else if (newProgress < 100 && goal.status === 'completed') {
      await db.goals.update(goal.id, { progress: newProgress, status: 'active', sync_status: 'pending', updated_at: new Date().toISOString() });
    } else {
      await db.goals.update(goal.id, { progress: newProgress, sync_status: 'pending', updated_at: new Date().toISOString() });
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
        {dragHandleProps && (
          <div {...dragHandleProps.attributes} {...dragHandleProps.listeners} onClick={(e) => e.stopPropagation()} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)', marginRight: '-4px' }}>
            <GripVertical size={16} />
          </div>
        )}
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
                {milestone.target_amount ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                    <button 
                      type="button" 
                      style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = milestone.current_amount || 0;
                        if (current > 0) {
                          const newAmount = current - 1;
                          handleToggleMilestone(milestone.id, newAmount >= milestone.target_amount!, newAmount);
                        }
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>
                      {milestone.current_amount || 0} / {milestone.target_amount}
                    </span>
                    <button 
                      type="button" 
                      style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = milestone.current_amount || 0;
                        if (current < milestone.target_amount!) {
                          const newAmount = current + 1;
                          handleToggleMilestone(milestone.id, newAmount >= milestone.target_amount!, newAmount);
                        }
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div 
                    className={`${styles.checkbox} ${milestone.completed ? styles.checked : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleToggleMilestone(milestone.id, !milestone.completed); }}
                  >
                    {milestone.completed && <CheckCircle size={14} />}
                  </div>
                )}
                
                {(() => {
                  const linkedSkillItem = skills.flatMap(s => s.checklist || []).find(i => i.linked_milestone_id === milestone.id && !i.linked_task_id);
                  const linkedProgress = linkedSkillItem?.target_amount ? ((linkedSkillItem.current_amount || 0) / linkedSkillItem.target_amount) * 100 : (linkedSkillItem?.completed ? 100 : 0);
                  
                  return (
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '4px', padding: '2px 6px', flex: 1, display: 'flex', alignItems: 'center' }}>
                      {linkedSkillItem && (
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, Math.max(0, linkedProgress))}%`, background: getDifficultyColor(linkedSkillItem.difficulty), zIndex: 0, transition: 'width 0.3s ease' }} />
                      )}
                      <span style={{ position: 'relative', zIndex: 1, fontSize: '14px', fontWeight: 600, textDecoration: milestone.completed ? 'line-through' : 'none', color: milestone.completed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        {milestone.title} {linkedSkillItem?.target_amount ? `(${linkedSkillItem.current_amount || 0}/${linkedSkillItem.target_amount})` : ''}
                      </span>
                    </div>
                  );
                })()}
                
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
                      {(() => {
                        const linkedSkillItem = skills.flatMap(s => s.checklist || []).find(i => i.linked_task_id === task.id);
                        const linkedProgress = linkedSkillItem?.target_amount ? ((linkedSkillItem.current_amount || 0) / linkedSkillItem.target_amount) * 100 : (linkedSkillItem?.completed ? 100 : 0);
                        
                        return (
                          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '4px', padding: '2px 6px', flex: 1, display: 'flex', alignItems: 'center' }}>
                            {linkedSkillItem && (
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, Math.max(0, linkedProgress))}%`, background: getDifficultyColor(linkedSkillItem.difficulty), zIndex: 0, transition: 'width 0.3s ease' }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1, fontSize: '13px', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                              {task.text} {linkedSkillItem?.target_amount ? `(${linkedSkillItem.current_amount || 0}/${linkedSkillItem.target_amount})` : ''}
                            </span>
                          </div>
                        );
                      })()}
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
  const [newMilestoneTarget, setNewMilestoneTarget] = useState<number | ''>('');

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) return;
    setMilestones([...milestones, {
      id: generateId(),
      title: newMilestoneTitle.trim(),
      completed: false,
      tasks: [],
      target_amount: newMilestoneTarget || undefined,
      current_amount: newMilestoneTarget ? 0 : undefined
    }]);
    setNewMilestoneTitle('');
    setNewMilestoneTarget('');
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
      device_id: 'default',
      sort_order: goal?.sort_order ?? 0
    };

    if (!goal) {
      const allGoals = await db.goals.toArray();
      const maxSortOrder = allGoals.reduce((max, g) => Math.max(max, g.sort_order ?? 0), 0);
      data.sort_order = maxSortOrder + 1;
    }

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
                <input 
                  type="number"
                  min="1"
                  placeholder="Target (opt)"
                  className={styles.input}
                  style={{ width: '90px' }}
                  value={newMilestoneTarget}
                  onChange={e => setNewMilestoneTarget(Number(e.target.value) || '')}
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
                    onTargetChange={(val) => setMilestones(milestones.map(m => m.id === milestone.id ? { ...m, target_amount: val || undefined } : m))}
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

function MilestoneEditor({ milestone, onRemove, onRewardChange, onAddTask, onRemoveTask, onTitleChange, onTaskTextChange, onTaskTargetChange, onTargetChange }: { milestone: Milestone, onRemove: () => void, onRewardChange: (val: string) => void, onAddTask: (text: string, target?: number) => void, onRemoveTask: (taskId: string) => void, onTitleChange: (val: string) => void, onTaskTextChange: (taskId: string, val: string) => void, onTaskTargetChange: (taskId: string, val: number) => void, onTargetChange: (val: number) => void }) {
  const [newTask, setNewTask] = useState('');
  const [newTarget, setNewTarget] = useState<number | ''>('');

  return (
    <div className={styles.milestoneItem}>
      <div className={styles.milestoneHeader} style={{ alignItems: 'center' }}>
        <input 
          className={styles.input} 
          style={{ fontWeight: 600, flex: 1, padding: '6px 12px', fontSize: '15px' }} 
          value={milestone.title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Milestone Title"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Target:</span>
          <input 
            type="number" 
            min="0"
            className={styles.input}
            style={{ width: '60px', padding: '6px 8px', fontSize: '13px' }}
            value={milestone.target_amount || ''}
            onChange={e => onTargetChange(Number(e.target.value))}
          />
        </div>
        <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px' }}><X size={18}/></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', marginTop: '8px' }}>
        <Gift size={14} color="#10b981" />
        <input 
          className={styles.input} 
          style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }} 
          placeholder="Mini-reward (optional)" 
          value={milestone.reward || ''}
          onChange={e => onRewardChange(e.target.value)}
        />
      </div>
      
      {milestone.tasks && milestone.tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {milestone.tasks.map(task => (
            <div key={task.id} className={styles.taskItem} style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '8px', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                className={styles.input} 
                style={{ flex: 1, fontSize: '13px', padding: '6px 10px' }} 
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
                  style={{ width: '60px', padding: '4px 8px', fontSize: '12px' }}
                  value={task.target_amount || ''}
                  onChange={e => onTaskTargetChange(task.id, Number(e.target.value))}
                />
              </div>
              <button type="button" onClick={() => onRemoveTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px' }}><X size={16}/></button>
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

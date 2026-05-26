import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Link2, X, Target, ListTodo } from 'lucide-react';
import { ChecklistItem } from '@/types/modules';

interface GoalLinkSelectorProps {
  item: ChecklistItem;
  onLink: (goalId: string, milestoneId?: string, taskId?: string, taskName?: string, syncDirection?: 'one-way' | 'two-way') => void;
  onUnlink: () => void;
}

export function GoalLinkSelector({ item, onLink, onUnlink }: GoalLinkSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  const goals = useLiveQuery(async () => {
    return await db.goals.filter(g => g.status === 'active' || g.status === 'in-progress').toArray();
  });

  const isLinked = !!item.linked_goal_id;

  return (
    <div style={{ position: 'relative' }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '4px', 
          background: isLinked ? 'var(--mod-goals-light)' : 'var(--canvas-bg)', 
          border: `1px solid ${isLinked ? 'var(--mod-goals-primary)' : 'var(--card-border)'}`, 
          color: isLinked ? 'var(--mod-goals-primary)' : 'var(--text-tertiary)', 
          padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
          fontWeight: isLinked ? 600 : 500
        }}
        title={isLinked ? `Linked: ${item.linked_task_name}` : "Link to Goal"}
      >
        <Link2 size={12} />
        {isLinked ? 'Linked' : 'Link Goal'}
      </button>

      {isOpen && typeof window !== 'undefined' && document.body && require('react-dom').createPortal(
        <div 
          style={{ 
            position: 'fixed', inset: 0, zIndex: 100000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            background: 'rgba(0, 0, 0, 0.6)', padding: '20px' 
          }}
          onClick={() => setIsOpen(false)}
        >
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: '16px', width: '100%', maxWidth: '450px',
            boxShadow: 'var(--card-shadow-elevated, 0 10px 25px rgba(0,0,0,0.2))',
            display: 'flex', flexDirection: 'column',
            maxHeight: '85vh', overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              padding: '20px 24px', borderBottom: '1px solid var(--card-border)', 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Link to Goal Task
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {isLinked && (
                  <button type="button" onClick={() => { onUnlink(); setIsOpen(false); }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    Unlink
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {isLinked && (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--canvas-surface)' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Sync Direction:</span>
                <select 
                  style={{ 
                    background: 'var(--bg-primary)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', 
                    fontSize: '14px', borderRadius: '8px', padding: '6px 12px', outline: 'none', fontWeight: 600, cursor: 'pointer' 
                  }}
                  value={item.sync_direction || 'one-way'}
                  onChange={(e) => {
                    onLink(item.linked_goal_id!, item.linked_milestone_id, item.linked_task_id, item.linked_task_name, e.target.value as any);
                  }}
                >
                  <option value="one-way">Skill → Goal</option>
                  <option value="two-way">Two-Way (Both)</option>
                </select>
              </div>
            )}

            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!goals || goals.length === 0) ? (
                <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>
                  No active goals found.
                </div>
              ) : (
                goals.map(goal => (
                  <div key={goal.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                      type="button"
                      onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                        background: expandedGoalId === goal.id ? 'var(--bg-secondary)' : 'var(--canvas-surface)', 
                        border: '1px solid var(--card-border)', borderRadius: '10px',
                        cursor: 'pointer', textAlign: 'left', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => { if (expandedGoalId !== goal.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={(e) => { if (expandedGoalId !== goal.id) e.currentTarget.style.background = 'var(--canvas-surface)'; }}
                    >
                      <span style={{ flexShrink: 0, fontSize: '18px' }}>{goal.icon || <Target size={18} />}</span>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.title}</span>
                    </button>
                    
                    {expandedGoalId === goal.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px', borderLeft: '2px solid var(--card-border)', marginLeft: '16px', marginBottom: '8px' }}>
                        {(!goal.milestones || goal.milestones.length === 0) && (
                          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '4px 0' }}>No milestones.</span>
                        )}
                        {goal.milestones?.map(m => (
                          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => { onLink(goal.id, m.id, undefined, m.title, 'one-way'); setIsOpen(false); }}
                              style={{ 
                                textAlign: 'left', background: (item.linked_milestone_id === m.id && !item.linked_task_id) ? 'var(--mod-goals-light)' : 'transparent', 
                                border: (item.linked_milestone_id === m.id && !item.linked_task_id) ? '1px solid var(--mod-goals-primary)' : '1px solid transparent',
                                padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '13px', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'center',
                                fontWeight: (item.linked_milestone_id === m.id && !item.linked_task_id) ? 700 : 600,
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => { if (!(item.linked_milestone_id === m.id && !item.linked_task_id)) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                              onMouseLeave={(e) => { if (!(item.linked_milestone_id === m.id && !item.linked_task_id)) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Target size={14} color="var(--mod-goals-primary)" /> {m.title}
                            </button>
                            
                            {m.tasks?.map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => { onLink(goal.id, m.id, t.id, t.text, 'one-way'); setIsOpen(false); }}
                                style={{ 
                                  textAlign: 'left', background: item.linked_task_id === t.id ? 'var(--mod-goals-light)' : 'transparent', 
                                  border: item.linked_task_id === t.id ? '1px solid var(--mod-goals-primary)' : '1px solid transparent',
                                  padding: '8px 12px 8px 32px', borderRadius: '8px', cursor: 'pointer',
                                  fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center',
                                  fontWeight: item.linked_task_id === t.id ? 700 : 500,
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => { if (item.linked_task_id !== t.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                onMouseLeave={(e) => { if (item.linked_task_id !== t.id) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <ListTodo size={14} color="var(--text-tertiary)" /> {t.text}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

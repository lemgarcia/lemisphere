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

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', right: 0,
            background: 'var(--bg-primary)', border: '1px solid var(--card-border)',
            borderRadius: '12px', padding: '12px', zIndex: 100,
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)', width: '280px',
            maxHeight: '300px', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Link to Goal Task</span>
              {isLinked && (
                <button type="button" onClick={() => { onUnlink(); setIsOpen(false); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                  Unlink
                </button>
              )}
            </div>

            {isLinked && (
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sync Direction:</span>
                <select 
                  style={{ background: 'var(--canvas-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: '11px', borderRadius: '4px', padding: '2px 4px' }}
                  value={item.sync_direction || 'two-way'}
                  onChange={(e) => {
                    onLink(item.linked_goal_id!, item.linked_milestone_id, item.linked_task_id, item.linked_task_name, e.target.value as any);
                  }}
                >
                  <option value="one-way">Skill → Goal</option>
                  <option value="two-way">Two-Way (Both)</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(!goals || goals.length === 0) ? (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px' }}>
                  No active goals found.
                </div>
              ) : (
                goals.map(goal => (
                  <div key={goal.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button 
                      type="button"
                      onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
                        background: 'var(--canvas-bg)', border: '1px solid var(--card-border)', borderRadius: '6px',
                        cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)'
                      }}
                    >
                      <span style={{ flexShrink: 0 }}>{goal.icon || <Target size={14} />}</span>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.title}</span>
                    </button>
                    
                    {expandedGoalId === goal.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px', borderLeft: '2px solid var(--card-border)', marginLeft: '12px', marginBottom: '4px' }}>
                        {(!goal.milestones || goal.milestones.length === 0) && (
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>No milestones.</span>
                        )}
                        {goal.milestones?.map(m => (
                          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => { onLink(goal.id, m.id, undefined, m.title, 'two-way'); setIsOpen(false); }}
                              style={{ 
                                textAlign: 'left', background: (item.linked_milestone_id === m.id && !item.linked_task_id) ? 'var(--mod-goals-light)' : 'transparent', 
                                border: 'none', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
                                fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'center',
                                fontWeight: (item.linked_milestone_id === m.id && !item.linked_task_id) ? 700 : 500
                              }}
                            >
                              <Target size={10} /> Milestone: {m.title}
                            </button>
                            
                            {m.tasks?.map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => { onLink(goal.id, m.id, t.id, t.text, 'two-way'); setIsOpen(false); }}
                                style={{ 
                                  textAlign: 'left', background: item.linked_task_id === t.id ? 'var(--mod-goals-light)' : 'transparent', 
                                  border: 'none', padding: '4px 6px 4px 20px', borderRadius: '4px', cursor: 'pointer',
                                  fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'center',
                                  fontWeight: item.linked_task_id === t.id ? 700 : 500
                                }}
                              >
                                <ListTodo size={10} /> Task: {t.text}
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
        </>
      )}
    </div>
  );
}

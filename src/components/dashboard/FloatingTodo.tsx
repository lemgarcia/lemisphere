'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListTodo, X, Plus, GripVertical, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
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
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo } from '@/types/modules';

function SortableTodoItem({ todo, toggleTodo, deleteTodo }: { todo: Todo, toggleTodo: (t: Todo) => void, deleteTodo: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        background: todo.is_completed ? 'var(--card-bg-hover)' : 'var(--card-bg)',
        borderBottom: '1px solid var(--canvas-border)',
      }}
    >
      <div 
        {...attributes} 
        {...listeners}
        style={{ cursor: 'grab', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
      >
        <GripVertical size={16} />
      </div>
      
      <button 
        onClick={() => toggleTodo(todo)}
        style={{ color: todo.is_completed ? 'var(--status-success)' : 'var(--text-tertiary)', display: 'flex' }}
      >
        {todo.is_completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      
      <div style={{ 
        flex: 1, 
        fontSize: '14px', 
        color: todo.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
        textDecoration: todo.is_completed ? 'line-through' : 'none'
      }}>
        {todo.text}
      </div>

      <button 
        onClick={() => deleteTodo(todo.id)}
        style={{ color: 'var(--status-error)', opacity: 0.5, transition: 'opacity 0.2s ease', display: 'flex' }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function FloatingTodo() {
  const showTodoBubble = useAppStore((s) => s.showTodoBubble);
  const userId = useAppStore((s) => s.userId) || 'default';
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');

  const todos = useLiveQuery(
    async () => {
      const allTodos = await db.todos.filter(t => t.user_id === userId).toArray();
      return allTodos.sort((a, b) => a.position - b.position);
    },
    [userId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const position = todos && todos.length > 0 ? todos[todos.length - 1].position + 1 : 0;
    
    await db.todos.add({
      id: generateId(),
      user_id: userId,
      text: inputText.trim(),
      is_completed: false,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'browser',
      sync_status: 'pending'
    });
    syncManager.queueSync('dashboard');
    
    setInputText('');
  };

  const handleToggleTodo = async (todo: Todo) => {
    await db.todos.update(todo.id, {
      is_completed: !todo.is_completed,
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    });
    syncManager.queueSync('dashboard');
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteAndTrack('todos', id);
    syncManager.queueSync('dashboard');
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id && todos) {
      const oldIndex = todos.findIndex(t => t.id === active.id);
      const newIndex = todos.findIndex(t => t.id === over.id);
      
      const newTodos = arrayMove(todos, oldIndex, newIndex);
      
      // Update all positions in DB
      await Promise.all(
        newTodos.map((todo, index) => 
          db.todos.update(todo.id, { 
            position: index,
            updated_at: new Date().toISOString(),
            sync_status: 'pending'
          })
        )
      );
      syncManager.queueSync('dashboard');
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px' }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              width: '320px',
              height: '400px',
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '24px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1), inset 0 2px 0 0 rgba(255, 255, 255, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--canvas-border)', background: 'rgba(255, 255, 255, 0.5)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListTodo size={18} color="var(--accent-violet)" />
                To-Do List
              </div>
              <button onClick={() => setIsOpen(false)} style={{ color: 'var(--text-tertiary)' }}>
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '12px' }}>
              {todos && todos.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                  You have no tasks yet.
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={(todos || []).map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {(todos || []).map(todo => (
                      <SortableTodoItem 
                        key={todo.id} 
                        todo={todo} 
                        toggleTodo={handleToggleTodo} 
                        deleteTodo={handleDeleteTodo} 
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: '12px', borderTop: '1px solid var(--canvas-border)', background: 'var(--card-bg)' }}>
              <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Add a task..." 
                  style={{
                    flex: 1,
                    background: 'var(--canvas-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    outline: 'none',
                    fontSize: '14px',
                  }}
                />
                <button 
                  type="submit"
                  disabled={!inputText.trim()}
                  style={{
                    background: inputText.trim() ? 'var(--accent-violet)' : 'var(--text-disabled)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s ease',
                    cursor: inputText.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Plus size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-violet) 0%, #7c3aed 100%)',
          boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          cursor: 'pointer',
          zIndex: 1001,
          border: 'none',
        }}
      >
        {isOpen ? <X size={24} /> : <ListTodo size={24} />}
      </motion.button>
    </div>
  );
}

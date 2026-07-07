'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableWidgetProps {
  id: string;
  isEditing: boolean;
  width: 'full' | 'half' | 'third' | 'quarter' | 'two-thirds';
  height?: 'short' | 'standard' | 'tall';
  children: React.ReactNode;
}

export function SortableWidget({ id, isEditing, width, height = 'standard', children }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: 'widget' } });

  const colSpan = width === 'full' ? 12 : width === 'two-thirds' ? 8 : width === 'half' ? 6 : width === 'third' ? 4 : 3;
  const rowSpan = height === 'tall' ? 3 : height === 'standard' ? 2 : 1;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 100 : 1,
    height: '100%',
    // CSS custom property approach: overridden to 1 on mobile via CSS
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isEditing && (
        <div 
          {...attributes} 
          {...listeners}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 10,
            cursor: 'grab',
            padding: '4px',
            background: 'var(--card-bg)',
            borderRadius: '6px',
            border: '1px solid var(--card-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <GripVertical size={16} color="var(--text-tertiary)" />
        </div>
      )}
      {/* 
        When editing, add a slight jiggle animation and prevent pointer events on the children 
        so we don't accidentally click buttons while trying to drag.
      */}
      <div 
        style={{
          height: '100%',
          pointerEvents: isEditing ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

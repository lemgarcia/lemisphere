'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import styles from './Dashboard.module.css';

interface QuickNavSortableItemProps {
  id: string;
  item: {
    key: string;
    href: string;
    icon: string;
    name: string;
    sub: string;
    className: string;
  };
  isReordering: boolean;
}

export function QuickNavSortableItem({ id, item, isReordering }: QuickNavSortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const hiddenQuickNav = useAppStore((s) => s.hiddenQuickNav);
  const toggleQuickNavVisibility = useAppStore((s) => s.toggleQuickNavVisibility);
  const isHidden = hiddenQuickNav.includes(id);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 250ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0.3 : (isReordering && isHidden ? 0.4 : 1),
    zIndex: isDragging ? 0 : 1,
  };

  const content = (
    <>
      <div className={styles.quickNavCardTop}>
        <span className={styles.quickNavCardIcon}>{item.icon}</span>
        {isReordering ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleQuickNavVisibility(id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHidden ? 'var(--text-muted)' : 'var(--text-secondary)', padding: 0, display: 'flex' }}
            >
              {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
              <GripVertical size={16} />
            </div>
          </div>
        ) : (
          <span className={styles.quickNavCardTrack}>+ Track</span>
        )}
      </div>
      <div>
        <div className={styles.quickNavCardName}>{item.name}</div>
        <div className={styles.quickNavCardSub}>{item.sub}</div>
      </div>
    </>
  );

  if (isReordering) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`${styles.quickNavCard} ${styles[item.className]}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      ref={setNodeRef}
      style={style}
      href={item.href}
      className={`${styles.quickNavCard} ${styles[item.className]}`}
    >
      {content}
    </Link>
  );
}

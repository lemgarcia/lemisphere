'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isBefore, parseISO } from 'date-fns';
import Link from 'next/link';
import { Settings2, Settings, GripVertical, Plus, CalendarDays, Eye, EyeOff, LayoutGrid, ListTodo, ArrowRight, Bell, BellRing, X, Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  rectSwappingStrategy,
} from '@dnd-kit/sortable';
import { useAppStore } from '@/stores/appStore';
import { getGreeting } from '@/utils';
import { QuickNavSortableItem } from './QuickNavSortableItem';
import type { DashboardWidget } from '@/types';
import { CalendarModal } from '@/components/layout/TopBar/CalendarModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { syncManager } from '@/lib/sync/SyncManager';

import { SortableWidget } from '@/components/dashboard/SortableWidget';
import { FloatingTodo } from '@/components/dashboard/FloatingTodo';
import { StatStreakWidget } from '@/components/dashboard/StatStreakWidget';
import { StatExpWidget } from '@/components/dashboard/StatExpWidget';
import { StatActiveGoalsWidget } from '@/components/dashboard/StatActiveGoalsWidget';
import { StatPendingTodosWidget } from '@/components/dashboard/StatPendingTodosWidget';
import { HabitStreakWidget } from '@/components/dashboard/HabitStreakWidget';
import { GoalProgressWidget } from '@/components/dashboard/GoalProgressWidget';
import { GamingNowWidget } from '@/components/dashboard/GamingNowWidget';
import { BudgieStatusWidget } from '@/components/dashboard/BudgieStatusWidget';
import { FitnessTodayWidget } from '@/components/dashboard/FitnessTodayWidget';

import styles from './Dashboard.module.css';

const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
  },
  item: {
    initial: { opacity: 0, y: 16 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
    },
  },
};

const STAT_CARDS = [
  { key: 'habits',   label: 'Top Streak',     value: '0',  subtext: 'No habit',        badge: '🔥 Auto (Top)', badgeClass: 'habits',   className: 'habits' },
  { key: 'progress', label: 'Daily Progress', value: '0%', subtext: '0/0 items',       badge: '⚡ CHARGING',    badgeClass: 'progress', className: 'progress', note: 'No modules tracked' },
  { key: 'goals',    label: 'Active Goals',   value: '0',  subtext: 'in progress',     badge: '🎯 GOALS',       badgeClass: 'goals',    className: 'goals' },
  { key: 'fitness',  label: 'Workouts',       value: '0',  subtext: 'this week',       badge: '💪 GYM',         badgeClass: 'fitness',  className: 'fitness' },
  { key: 'gaming',   label: 'Gameplay Pts',   value: '0',  subtext: 'No games active', badge: '🎮 GAME',        badgeClass: 'gaming',   className: 'gaming' },
];

const QUICK_NAV_DATA = {
  'budgie':  { key: 'budgie',  href: '/budgie',  icon: '🦜', name: 'Budgie Care', sub: 'Chores & Training', className: 'budgie' },
  'fitness': { key: 'fitness', href: '/fitness', icon: '💪', name: 'Fitness',     sub: 'Programs & Logs',   className: 'fitness' },
  'goals':   { key: 'goals',   href: '/goals',   icon: '🎯', name: 'Goals',       sub: 'Milestones & Tasks', className: 'goals' },
  'habits':  { key: 'habits',  href: '/habits',  icon: '🔥', name: 'Skills & Habits', sub: 'Upskilling & Streaks', className: 'habits' },
  'gaming':  { key: 'gaming',  href: '/gaming',  icon: '🎮', name: 'Gaming',      sub: 'PlayWish & GP Tracking', className: 'gaming' },
};

import { useCurrentDay } from '@/hooks/useCurrentDay';

export function DashboardPage() {
  const username = useAppStore((s) => s.username);
  const quickNavOrder = useAppStore((s) => s.quickNavOrder);
  const hiddenQuickNav = useAppStore((s) => s.hiddenQuickNav);
  const setQuickNavOrder = useAppStore((s) => s.setQuickNavOrder);
  
  const currentDay = useCurrentDay();
  const greeting = getGreeting();
  // We use currentDay to ensure this component re-renders when the day changes
  // format(new Date()) is safe here because currentDay changing triggers a fresh render
  const today = format(new Date(), 'EEEE, MMMM d · yyyy');

  const [isReordering, setIsReordering] = useState(false);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const userId = useAppStore((s) => s.userId) || 'default';
  const weeklyRoutine = useLiveQuery(
    () => db.calendar_events.where('user_id').equals(userId).toArray(),
    [userId]
  ) || [];

  const dashboardLayout = useAppStore((s) => s.dashboardLayout);
  const setDashboardLayout = useAppStore((s) => s.setDashboardLayout);

  useEffect(() => {
    let layoutUpdated = false;
    let newLayout = [...dashboardLayout];

    // Transition from quick-stats if it exists
      newLayout = newLayout.filter(w => w.id !== 'quick-stats' && !w.type.startsWith('stat-'));

    // Ensure fitness-today exists for older accounts
    if (!newLayout.find(w => w.id === 'fitness-today')) {
      layoutUpdated = true;
      newLayout.push({ id: 'fitness-today', type: 'fitness-today', position: 99, width: 'third', height: 'standard', visible: true });
    }

    // Force patch width and height for bento layout to ensure no broken grids from previous persist
    newLayout = newLayout.map(w => {
      let expectedHeight: 'short' | 'standard' | 'tall' = 'standard';
      let expectedWidth = w.width;
      if (w.type === 'habit-streak') { expectedHeight = 'tall'; expectedWidth = 'third'; }
      if (w.type === 'goal-progress') { expectedHeight = 'standard'; expectedWidth = 'two-thirds'; }
      if (w.type === 'gaming-now' || w.type === 'budgie-status' || w.type === 'fitness-today') {
        expectedHeight = 'standard'; expectedWidth = 'third';
      }
      
      if (w.height !== expectedHeight || w.width !== expectedWidth) {
        layoutUpdated = true;
        return { ...w, height: expectedHeight, width: expectedWidth };
      }
      return w;
    });

    if (layoutUpdated) {
      // @ts-ignore
      setDashboardLayout(newLayout);
    }
  }, [dashboardLayout, setDashboardLayout]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeNotifications: (typeof weeklyRoutine[0] & { notificationType: 'reminder' | 'event'; triggerTime: Date })[] = [];
  
  weeklyRoutine.forEach(item => {
    // 1. Reminder Notification
    if (item.remind_at && !isBefore(new Date(), parseISO(item.remind_at))) {
      activeNotifications.push({ ...item, notificationType: 'reminder', triggerTime: parseISO(item.remind_at) });
    }
    // 2. Event Happening Notification
    if (item.date && item.time && !item.event_notified) {
      const eventTime = new Date(`${item.date}T${item.time}`);
      if (!isBefore(new Date(), eventTime)) {
        activeNotifications.push({ ...item, notificationType: 'event', triggerTime: eventTime });
      }
    }
  });

  activeNotifications.sort((a, b) => b.triggerTime.getTime() - a.triggerTime.getTime());

  const hasNotifications = activeNotifications.length > 0;

  const clearNotification = async (e: React.MouseEvent, id: string, type: 'reminder' | 'event') => {
    e.stopPropagation();
    if (type === 'reminder') {
      await db.calendar_events.update(id, { remind_at: undefined, updated_at: new Date().toISOString(), sync_status: 'local' });
    } else {
      await db.calendar_events.update(id, { event_notified: true, updated_at: new Date().toISOString(), sync_status: 'local' });
    }
    syncManager.queueSync('dashboard');
  };

  const clearAllNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await db.transaction('rw', db.calendar_events, async () => {
      for (const notification of activeNotifications) {
        if (notification.notificationType === 'reminder') {
          await db.calendar_events.update(notification.id, { remind_at: undefined, updated_at: new Date().toISOString(), sync_status: 'local' });
        } else {
          await db.calendar_events.update(notification.id, { event_notified: true, updated_at: new Date().toISOString(), sync_status: 'local' });
        }
      }
    });
    syncManager.queueSync('dashboard');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: any) => {
    if (event.active.data.current?.type === 'widget') {
      setActiveWidgetId(event.active.id);
    } else {
      setActiveId(event.active.id);
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveId(null);
    setActiveWidgetId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      if (active.data.current?.type === 'widget') {
        const oldIndex = dashboardLayout.findIndex(w => w.id === active.id);
        const newIndex = dashboardLayout.findIndex(w => w.id === over.id);
        setDashboardLayout(arrayMove(dashboardLayout, oldIndex, newIndex));
      } else {
        const oldIndex = quickNavOrder.indexOf(active.id);
        const newIndex = quickNavOrder.indexOf(over.id);
        setQuickNavOrder(arrayMove(quickNavOrder, oldIndex, newIndex));
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveWidgetId(null);
  };

  const activeItem = activeId ? QUICK_NAV_DATA[activeId as keyof typeof QUICK_NAV_DATA] : null;

  return (
    <>
      <motion.div 
        className={styles.container}
        variants={stagger.container}
        initial="hidden"
        animate="show"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
        {/* Page header */}
        <motion.div className={styles.header} variants={stagger.item}>
          <div>
            <div className={styles.dateTag}>
              📅 {today}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <h1 className={styles.greeting}>
                {greeting}, {username ?? 'you'} 👋
              </h1>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '64px' }}>
            <button
              onClick={() => setIsLayoutEditing(!isLayoutEditing)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: isLayoutEditing ? 'var(--accent-violet)' : 'var(--card-bg)',
                border: '1px solid',
                borderColor: isLayoutEditing ? 'var(--accent-violet)' : 'var(--card-border)',
                borderRadius: 'var(--card-radius-lg)',
                fontSize: '14px',
                fontWeight: 600,
                color: isLayoutEditing ? '#fff' : 'var(--text-primary)',
                boxShadow: 'var(--card-shadow)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {isLayoutEditing ? <Check size={16} /> : <Settings2 size={16} />}
              {isLayoutEditing ? 'Done Editing' : 'Edit Layout'}
            </button>
            <div className={styles.notificationWrapper} ref={notificationsRef} style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  background: isNotificationsOpen ? 'var(--card-bg)' : 'rgba(0,0,0,0.04)',
                  border: '1px solid',
                  borderColor: isNotificationsOpen ? 'rgba(139, 92, 246, 0.3)' : 'rgba(0, 0, 0, 0.06)',
                  borderRadius: 'var(--card-radius-lg)',
                  color: isNotificationsOpen ? 'var(--accent-violet)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Bell size={18} strokeWidth={2} />
                {hasNotifications && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '10px',
                    height: '10px',
                    background: 'var(--status-error)',
                    borderRadius: '50%',
                    border: '2px solid var(--canvas-bg)',
                    animation: 'pulse 2s infinite'
                  }} />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 12px)',
                      right: 0,
                      width: '320px',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                      zIndex: 100,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '64px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Notifications</h4>
                        {hasNotifications && <span style={{ background: 'var(--accent-violet-soft)', color: 'var(--accent-violet)', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>{activeNotifications.length}</span>}
                      </div>
                      {hasNotifications && (
                        <button 
                          onClick={clearAllNotifications}
                          style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      {activeNotifications.length === 0 ? (
                        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                          <BellRing size={24} style={{ color: 'var(--card-border)' }} />
                          <p style={{ fontSize: '13px', margin: 0 }}>No notifications</p>
                        </div>
                      ) : (
                        activeNotifications.map(reminder => (
                          <div key={reminder.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-violet-soft)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Bell size={14} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                                  {reminder.notificationType === 'event' ? 'Happening Now: ' : 'Event Reminder: '}
                                </span>
                                {reminder.activity}
                              </p>
                              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, margin: 0 }}>
                                {format(reminder.triggerTime, 'MMM d, HH:mm')}
                              </p>
                            </div>
                            <button 
                              onClick={(e) => clearNotification(e, reminder.id, reminder.notificationType)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              aria-label="Clear notification"
                            >
                              <X size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setIsCalendarOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--card-radius-lg)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                boxShadow: 'var(--card-shadow)',
                cursor: 'pointer'
              }}
            >
              <CalendarDays size={16} color="var(--accent-violet)" />
              Calendar
            </button>
          </div>
        </motion.div>

        {/* Native Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', width: '100%', marginBottom: '24px' }}>
          <StatStreakWidget />
          <StatExpWidget />
          <StatActiveGoalsWidget />
          <StatPendingTodosWidget />
        </div>

        {/* Bento Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(12, 1fr)', 
          gridAutoFlow: 'row dense',
          gridAutoRows: '110px',
          gap: '24px', 
          width: '100%', 
          marginBottom: '40px' 
        }}>
          <SortableContext items={dashboardLayout.map(w => w.id)} strategy={rectSwappingStrategy}>
            {dashboardLayout.map((widget) => {
              if (!widget.visible) return null;
              
              let WidgetComponent = null;
              switch (widget.type) {
                case 'habit-streak': WidgetComponent = <HabitStreakWidget />; break;
                case 'goal-progress': WidgetComponent = <GoalProgressWidget />; break;
                case 'fitness-today': WidgetComponent = <FitnessTodayWidget />; break;
                case 'gaming-now': WidgetComponent = <GamingNowWidget />; break;
                case 'budgie-status': WidgetComponent = <BudgieStatusWidget />; break;
                default: return null;
              }

              return (
                <SortableWidget key={widget.id} id={widget.id} isEditing={isLayoutEditing} width={widget.width} height={widget.height}>
                  {WidgetComponent}
                </SortableWidget>
              );
            })}
          </SortableContext>
        </div>

      {/* Quick navigation */}
      <motion.div className={styles.quickNavSection} variants={stagger.item}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Quick Navigation</span>
          <button 
            className={styles.sectionAction}
            onClick={() => setIsReordering(!isReordering)}
            style={{ 
              color: isReordering ? 'var(--accent-violet)' : undefined,
              background: isReordering ? 'var(--accent-violet-soft)' : undefined
            }}
          >
            {isReordering ? (
              <><Check size={12} /> Done</>
            ) : (
              <><Settings2 size={12} /> Reorder</>
            )}
          </button>
        </div>
        
          <div className={styles.quickNavGrid}>
            <SortableContext
              items={isReordering ? quickNavOrder : quickNavOrder.filter(k => !hiddenQuickNav.includes(k))}
              strategy={rectSortingStrategy}
            >
              {quickNavOrder.map((key) => {
                const item = QUICK_NAV_DATA[key as keyof typeof QUICK_NAV_DATA];
                if (!item) return null;
                if (!isReordering && hiddenQuickNav.includes(key)) return null;
                return (
                  <QuickNavSortableItem 
                    key={item.key} 
                    id={item.key} 
                    item={item} 
                    isReordering={isReordering}
                  />
                );
              })}
            </SortableContext>
          </div>
        </motion.div>
          
        <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: '0.4' } },
              }),
            }}
          >
            {activeItem ? (
              <div 
                className={`${styles.quickNavCard} ${styles[activeItem.className]}`}
                style={{ 
                  boxShadow: 'var(--card-shadow-elevated)', 
                  cursor: 'grabbing',
                  scale: 1.05,
                  pointerEvents: 'none',
                }}
              >
                <div className={styles.quickNavCardTop}>
                  <span className={styles.quickNavCardIcon}>{activeItem.icon}</span>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
                    <Settings2 size={16} />
                  </div>
                </div>
                <div>
                  <div className={styles.quickNavCardName}>{activeItem.name}</div>
                  <div className={styles.quickNavCardSub}>{activeItem.sub}</div>
                </div>
              </div>
            ) : activeWidgetId ? (
              <div style={{ 
                background: 'var(--card-bg)', 
                border: '1px solid var(--card-border)', 
                borderRadius: 'var(--card-radius-lg)', 
                width: '100%', 
                height: '100%', 
                opacity: 0.8,
                boxShadow: 'var(--card-shadow-elevated)',
                cursor: 'grabbing'
              }} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </motion.div>

      <CalendarModal 
        isOpen={isCalendarOpen} 
        onClose={() => setIsCalendarOpen(false)} 
      />
      <FloatingTodo />
    </>
  );
}

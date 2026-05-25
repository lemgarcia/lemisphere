'use client';

import { useState, useRef, useEffect } from 'react';
import { format, isBefore, parseISO } from 'date-fns';
import { Bell, Settings, CalendarDays, BellRing } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/stores/appStore';
import { CalendarModal } from './CalendarModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import styles from './TopBar.module.css';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const router = useRouter();
  const sync = useAppStore((s) => s.sync);
  const username = useAppStore((s) => s.username);

  const syncDotClass = sync.isSyncing
    ? styles.syncing
    : sync.isOnline
    ? styles.online
    : styles.offline;

  const syncLabel = sync.isSyncing
    ? 'Syncing…'
    : sync.isOnline
    ? 'Local'
    : 'Offline';

  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userId = useAppStore((s) => s.userId) || 'default';
  const weeklyRoutine = useLiveQuery(
    () => db.calendar_events.where('user_id').equals(userId).toArray(),
    [userId]
  ) || [];

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const upcomingReminders = weeklyRoutine
    .filter(item => item.remind_at && isBefore(new Date(), parseISO(item.remind_at)))
    .sort((a, b) => new Date(a.remind_at!).getTime() - new Date(b.remind_at!).getTime());

  const hasNotifications = upcomingReminders.length > 0;

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        </div>

        <div className={styles.topbarRight}>
          <span className={styles.dateDisplay}>
            {format(new Date(), 'EEEE, MMM d · yyyy')}
          </span>

          <div className={styles.syncIndicator} title={sync.lastSyncAt ? `Last synced: ${sync.lastSyncAt}` : 'Not synced'}>
            <div className={`${styles.syncDot} ${syncDotClass}`} />
            {syncLabel}
          </div>

          <button 
            className={styles.iconBtn} 
            style={{ width: 'auto', padding: '0 12px', gap: 6, fontSize: 13, fontWeight: 500 }}
            onClick={() => setIsRoutineOpen(true)}
          >
            <CalendarDays size={15} strokeWidth={2} />
            Routine
          </button>

          <div className={styles.notificationWrapper} ref={notificationsRef}>
            <button 
              className={`${styles.iconBtn} ${isNotificationsOpen ? styles.active : ''}`} 
              aria-label="Notifications"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            >
              <Bell size={15} strokeWidth={2} />
              {hasNotifications && <span className={styles.notificationBadge} />}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div 
                  className={styles.notificationDropdown}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.dropdownHeader}>
                    <h4>Upcoming Reminders</h4>
                    {hasNotifications && <span className={styles.badgeCount}>{upcomingReminders.length}</span>}
                  </div>
                  <div className={styles.dropdownContent}>
                    {upcomingReminders.length === 0 ? (
                      <div className={styles.emptyNotifications}>
                        <BellRing size={24} className={styles.emptyIcon} />
                        <p>No upcoming reminders</p>
                      </div>
                    ) : (
                      upcomingReminders.map(reminder => (
                        <div key={reminder.id} className={styles.notificationItem}>
                          <div className={styles.notificationIcon}>
                            <Bell size={14} />
                          </div>
                          <div className={styles.notificationBody}>
                            <p className={styles.notificationTitle}>{reminder.activity}</p>
                            <p className={styles.notificationTime}>
                              {format(parseISO(reminder.remind_at!), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </header>
      
      <CalendarModal 
        isOpen={isRoutineOpen} 
        onClose={() => setIsRoutineOpen(false)} 
      />
    </>
  );
}

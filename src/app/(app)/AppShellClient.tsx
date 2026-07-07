'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useFitnessStore } from '@/stores/fitnessStore';
import { syncManager } from '@/lib/sync/SyncManager';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { isBefore, parseISO, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Timer } from 'lucide-react';
import styles from './AppShell.module.css';

export function AppShellClient({ children }: { children: React.ReactNode }) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const userId = useAppStore((s) => s.userId) || 'default';
  const weeklyRoutine = useLiveQuery(
    () => db.calendar_events.where('user_id').equals(userId).toArray(),
    [userId]
  ) || [];
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  const recoverSession = useAppStore((s) => s.recoverSession);

  useEffect(() => {
    recoverSession().finally(() => {
      setHydrated(true);
    });
  }, [recoverSession]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  const timerActive = useFitnessStore((s) => s.timerActive);
  const tickTimer = useFitnessStore((s) => s.tickTimer);
  const timerFinished = useFitnessStore((s) => s.timerFinished);
  const dismissTimerFinished = useFitnessStore((s) => s.dismissTimerFinished);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, tickTimer]);

  useEffect(() => {
    let oscillator: OscillatorNode | null = null;
    let audioCtx: AudioContext | null = null;
    
    if (timerFinished) {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Browsers often start AudioContext in a suspended state if not created during a click event.
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note, very noticeable
        
        const now = audioCtx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        
        // Create an aggressive double-beep every second for 30 seconds
        for(let i=0; i<30; i++) { 
          gainNode.gain.setValueAtTime(1, now + i);
          gainNode.gain.setValueAtTime(0, now + i + 0.15);
          gainNode.gain.setValueAtTime(1, now + i + 0.3);
          gainNode.gain.setValueAtTime(0, now + i + 0.45);
        }
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();

        // Fallback/Enhancement: Use Speech Synthesis to announce it loudly
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance("Rest is over! Let's go!");
          utterance.rate = 1.2;
          utterance.pitch = 1.1;
          window.speechSynthesis.speak(utterance);
        }
      } catch (e) {
        console.warn("AudioContext not supported or blocked");
      }
    }
    return () => {
      if (oscillator) {
        try { oscillator.stop(); } catch(e) {}
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch(e) {}
      }
    };
  }, [timerFinished]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000); // Check every 10 seconds
    
    // Immediate sync on app load — pull all data right away so other-device changes are visible
    if (useAppStore.getState().isAuthenticated) {
      syncManager.syncAll();
    }
    
    // Global background sync polling
    const syncInterval = setInterval(() => {
      if (useAppStore.getState().isAuthenticated) {
        syncManager.syncAll();
      }
    }, 3000); // Every 3 seconds
    
    return () => {
      clearInterval(timer);
      clearInterval(syncInterval);
    };
  }, []);

  const activeNotifications: (typeof weeklyRoutine[0] & { notificationType: 'reminder' | 'event'; triggerTime: Date })[] = [];
  
  weeklyRoutine.forEach(item => {
    // 1. Reminder Notification
    if (item.remind_at && !isBefore(currentTime, parseISO(item.remind_at))) {
      activeNotifications.push({ ...item, notificationType: 'reminder', triggerTime: parseISO(item.remind_at) });
    }
    // 2. Event Happening Notification
    if (item.date && item.time && !item.event_notified) {
      const eventTime = new Date(`${item.date}T${item.time}`);
      if (!isBefore(currentTime, eventTime)) {
        activeNotifications.push({ ...item, notificationType: 'event', triggerTime: eventTime });
      }
    }
  });

  activeNotifications.sort((a, b) => b.triggerTime.getTime() - a.triggerTime.getTime());

  const clearNotification = async (id: string, type: 'reminder' | 'event') => {
    if (type === 'reminder') {
      await db.calendar_events.update(id, { remind_at: undefined, updated_at: new Date().toISOString(), sync_status: 'local' });
    } else {
      await db.calendar_events.update(id, { event_notified: true, updated_at: new Date().toISOString(), sync_status: 'local' });
    }
    syncManager.queueSync('dashboard');
  };

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className={`${styles.mainContent} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.pageContent}>
        <div className={styles.pageInner}>
          {children}
        </div>
      </div>

      {/* Global Notifications Banner container */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999,
        pointerEvents: 'none'
      }} className={styles.notificationsContainer}>
        <AnimatePresence>
          {activeNotifications.map(notification => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              style={{
                pointerEvents: 'auto',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                padding: '16px',
                width: '320px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-violet-soft)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bell size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                    {notification.notificationType === 'event' ? 'Happening Now: ' : 'Event Reminder: '}
                  </span>
                  {notification.activity}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, margin: 0 }}>
                  {format(notification.triggerTime, 'MMM d, HH:mm')}
                </p>
              </div>
              <button 
                onClick={() => clearNotification(notification.id, notification.notificationType)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Clear notification"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </motion.div>
          ))}
          
          {/* Fitness Timer Notification */}
          {timerFinished && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              zIndex: 10000,
              pointerEvents: 'auto'
            }}>
              <motion.div
                key="fitness-timer"
                initial={{ opacity: 0, scale: 0.5, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  background: 'var(--card-bg)',
                  border: 'none',
                  borderRadius: '28px',
                  boxShadow: '0 32px 80px rgba(245, 158, 11, 0.4), 0 0 0 10px rgba(245, 158, 11, 0.1)',
                  padding: '48px',
                  width: '90%',
                  maxWidth: '480px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '28px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
                
                <motion.div 
                  animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.15))', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Timer size={56} strokeWidth={1.5} />
                </motion.div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h2 style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
                    Rest Complete!
                  </h2>
                  <p style={{ fontSize: '18px', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                    Time to crush your next set.
                  </p>
                </div>
                <button 
                  onClick={dismissTimerFinished}
                  style={{ 
                    marginTop: '16px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '20px 64px', 
                    borderRadius: '100px', 
                    fontSize: '20px', 
                    fontWeight: 800, 
                    cursor: 'pointer',
                    boxShadow: '0 12px 32px rgba(245, 158, 11, 0.35)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(245, 158, 11, 0.45)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(245, 158, 11, 0.35)'; }}
                >
                  Let's Go
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


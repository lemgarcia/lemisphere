'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, RotateCcw, CalendarDays, ArrowRight, Save, Calendar, Clock, Edit2 } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, subMonths, addMonths, format, isSameMonth, isSameDay, isToday, parseISO, isBefore, startOfDay, getDay, differenceInWeeks, getDate, getMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/stores/appStore';
import { generateId } from '@/utils';
import type { RoutineItem, RepeatFrequency } from '@/types';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { supabase } from '@/lib/supabase/client';
import styles from './CalendarModal.module.css';

export const TimeSelector24h = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const h = value ? value.split(':')[0] : '';
  const m = value ? value.split(':')[1] : '';
  
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
      <select 
        value={h} 
        onChange={(e) => onChange(`${e.target.value}:${m || '00'}`)}
        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', flex: 1, appearance: 'none', cursor: 'pointer' }}
      >
        <option value="" disabled>HH</option>
        {Array.from({length: 24}).map((_, i) => {
          const val = i.toString().padStart(2, '0');
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
      <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>:</span>
      <select 
        value={m} 
        onChange={(e) => onChange(`${h || '12'}:${e.target.value}`)}
        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', flex: 1, appearance: 'none', cursor: 'pointer' }}
      >
        <option value="" disabled>MM</option>
        {Array.from({length: 60}).map((_, i) => {
          const val = i.toString().padStart(2, '0');
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
    </div>
  );
};

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Helper to parse "08:00 AM", "14:00" etc into total minutes for proper sorting
const parseTimeToMinutes = (timeStr: string | number) => {
  if (!timeStr) return 0;
  const str = String(timeStr);
  const match = str.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  // Treat 00:xx as the end of the day (24:xx) for sorting purposes, 
  // so midnight routines appear at the bottom rather than the top.
  if (hours === 0) {
    hours = 24;
  }

  return hours * 60 + minutes;
};

// Helper to evaluate recurrence rules
const doesEventOccurOnDate = (event: RoutineItem, targetDate: Date) => {
  if (!event.date) return false;
  
  // Create a naive local date object from the 'yyyy-MM-dd' string
  const [year, month, day] = event.date.split('-').map(Number);
  const eventStart = new Date(year, month - 1, day);
  
  if (isBefore(startOfDay(targetDate), startOfDay(eventStart))) return false;

  switch(event.repeat) {
    case 'none':
    case undefined:
      return isSameDay(eventStart, targetDate);
    case 'weekly':
      return getDay(eventStart) === getDay(targetDate);
    case 'biweekly':
      const diffWeeks = differenceInWeeks(targetDate, eventStart);
      return getDay(eventStart) === getDay(targetDate) && diffWeeks % 2 === 0;
    case 'monthly':
      return getDate(eventStart) === getDate(targetDate);
    case 'yearly':
      return getDate(eventStart) === getDate(targetDate) && getMonth(eventStart) === getMonth(targetDate);
    default:
      return false;
  }
};

export function CalendarModal({ isOpen, onClose }: CalendarModalProps) {
  const userId = useAppStore((s) => s.userId) || 'default';
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const weeklyRoutine = useLiveQuery(
    () => db.calendar_events.where('user_id').equals(userId).toArray(),
    [userId]
  ) || [];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'routine' | 'events'>('routine');
  
  const selectedDay = format(currentDate, 'EEEE'); // e.g. "Monday"
  const formattedDate = format(currentDate, 'MMM d'); // e.g. "May 22"
  const dateKey = format(currentDate, 'yyyy-MM-dd');

  const [newItem, setNewItem] = useState<Partial<RoutineItem>>({ activity: '', time: '', type: '', notes: '' });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemData, setEditingItemData] = useState<Partial<RoutineItem>>({});
  const [newEventRepeat, setNewEventRepeat] = useState<RepeatFrequency>('none');
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(dateKey);
  const [reminderTime, setReminderTime] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isResettingDay, setIsResettingDay] = useState(false);

  const [postponingEventId, setPostponingEventId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState<string>('');
  const [postponeTime, setPostponeTime] = useState<string>('');

  const handlePostponeClick = (event: RoutineItem) => {
    setPostponingEventId(event.id);
    setPostponeDate(event.date || format(new Date(), 'yyyy-MM-dd'));
    setPostponeTime(event.time || format(new Date(), 'HH:mm'));
  };

  const handleSavePostpone = async () => {
    if (!postponingEventId) return;
    let newRemindAt = undefined;
    const existingEvent = weeklyRoutine.find(e => e.id === postponingEventId);
    if (existingEvent?.remind_at) {
      newRemindAt = new Date(`${postponeDate}T${postponeTime}`).toISOString();
    }
    
    await db.calendar_events.update(postponingEventId, {
      date: postponeDate,
      time: postponeTime,
      remind_at: newRemindAt || existingEvent?.remind_at,
      updated_at: new Date().toISOString(),
      sync_status: 'local',
    });
    syncManager.queueSync('dashboard');
    setPostponingEventId(null);
    showToast('Event postponed successfully!', 'success');
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Reset state on open
      setItemToDelete(null);
      setPostponingEventId(null);
      setIsResettingDay(false);
      setEditingItemId(null);
      setToast(null);
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);



  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json<any>(ws, { raw: false });

      const importedRoutine: RoutineItem[] = data.map((row) => {
        let timeStr = row.Time || row.time || '';
        // If Excel gave us a date-time string like "12/31/1899 08:30:00 AM", extract the time part
        if (typeof timeStr === 'string' && timeStr.includes(' ')) {
           const timePart = timeStr.split(' ').slice(1).join(' '); // "08:30:00 AM"
           const match = timePart.match(/(\d+:\d+)/);
           if (match) {
             const ampm = timePart.match(/(AM|PM)/i)?.[1] || '';
             timeStr = `${match[1]} ${ampm}`.trim();
           }
        }

        return {
          id: generateId(),
          user_id: userId,
          day: row.Day || row.day || selectedDay,
          date: row.Date || row.date || undefined,
          time: String(timeStr),
          activity: row.Activity || row.activity || '',
          type: row.Type || row.type || '',
          notes: row.Notes || row.notes || '',
          version: 1,
          device_id: 'browser',
          sync_status: 'local',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      if (importedRoutine.length === 0) {
        showToast('No valid data found in Excel file', 'error');
        return;
      }

      await db.calendar_events.bulkAdd(importedRoutine);
      syncManager.queueSync('dashboard');
      showToast(`Successfully imported ${importedRoutine.length} items`, 'success');
    };
    reader.onerror = () => showToast('Failed to read Excel file', 'error');
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddItem = async () => {
    if (!newItem.time || !newItem.activity) return;
    const item: RoutineItem = {
      id: generateId(),
      user_id: userId,
      day: selectedDay,
      time: newItem.time || '',
      activity: newItem.activity || '',
      type: newItem.type || '',
      notes: newItem.notes || '',
      version: 1,
      device_id: 'browser',
      sync_status: 'local',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // DEBUG: Push directly to Supabase to catch the exact error
    const { error: debugError } = await supabase.from('calendar_events').insert({
      id: item.id,
      user_id: item.user_id,
      day: item.day,
      date: null,
      time: item.time,
      activity: item.activity,
      type: item.type,
      notes: item.notes,
      repeat: null,
      remind_at: null,
      event_notified: false,
      version: item.version,
      device_id: item.device_id,
      sync_status: item.sync_status,
      created_at: item.created_at,
      updated_at: item.updated_at
    });

    if (debugError) {
      alert(`SUPABASE DB ERROR: ${debugError.message} \nDetails: ${debugError.details} \nHint: ${debugError.hint}`);
    }

    await db.calendar_events.add(item);
    syncManager.queueSync('dashboard');
    setNewItem({ activity: '', time: '', type: '', notes: '' });
    showToast('Item added!', 'success');
    if (activeTab === 'events') {
      item.date = dateKey;
      item.repeat = newEventRepeat;
      if (hasReminder && reminderDate && reminderTime) {
        item.remind_at = `${reminderDate}T${reminderTime}`;
      }
    }
    await db.calendar_events.add(item);
    syncManager.queueSync('dashboard');
    setNewItem({ activity: '', time: '', type: '', notes: '' });
    showToast('Item added!', 'success');
    setHasReminder(false);
    setReminderDate(dateKey);
    setReminderTime('');
  };

  const handleSaveEdit = async () => {
    if (!editingItemId || !editingItemData.time || !editingItemData.activity) return;
    
    await db.calendar_events.update(editingItemId, {
      time: editingItemData.time,
      activity: editingItemData.activity,
      type: editingItemData.type,
      notes: editingItemData.notes,
      updated_at: new Date().toISOString(),
      sync_status: 'local'
    });
    
    syncManager.queueSync('dashboard');
    setEditingItemId(null);
    showToast('Item updated!', 'success');
  };

  const handleDeleteItem = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (isResettingDay) {
      const itemsToRemove = weeklyRoutine.filter((item) => (item.date === dateKey || (!item.date && item.day === selectedDay)));
      await db.transaction('rw', db.calendar_events, db.sync_deletions, async () => {
        for (const item of itemsToRemove) {
          await deleteAndTrack('calendar_events', item.id);
        }
      });
      syncManager.queueSync('dashboard');
      setIsResettingDay(false);
      showToast(`${formattedDate} schedule reset successfully`, 'success');
    } else if (itemToDelete) {
      await deleteAndTrack('calendar_events', itemToDelete);
      syncManager.queueSync('dashboard');
      setItemToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setItemToDelete(null);
    setIsResettingDay(false);
  };

  const nextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const prevDay = () => setCurrentDate(prev => addDays(prev, -1));
  const jumpToToday = () => setCurrentDate(new Date());

  const prevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const nextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Merge recurring weekly routine + specific date events
  const displayedRoutine = useMemo(() => {
    return weeklyRoutine
      .filter(item => {
        const isEvent = !!item.date;
        
        if (activeTab === 'events') {
          return isEvent && doesEventOccurOnDate(item, currentDate);
        }
        if (activeTab === 'routine') {
          return !isEvent && item.day === selectedDay;
        }
        return false;
      })
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }, [weeklyRoutine, currentDate, selectedDay, activeTab]);

  // Get dates that have specific events (for rendering dots on the calendar)
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    calendarDays.forEach(day => {
      const dayHasEvent = weeklyRoutine.some(item => {
        if (!item.date) return false;
        return doesEventOccurOnDate(item, day);
      });
      if (dayHasEvent) dates.add(format(day, 'yyyy-MM-dd'));
    });
    return dates;
  }, [calendarDays, weeklyRoutine]);

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          style={{ paddingLeft: sidebarCollapsed ? 64 : 220 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.dialog}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
              <div className={styles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  className={styles.toggleSidebarBtn}
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  title="Toggle Calendar"
                >
                  <CalendarDays size={18} />
                </button>
                <h2 className={styles.title}>Calendar</h2>
              </div>
              <button className={styles.closeBtn} onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.content}>
              
              {/* Sidebar Mini Calendar */}
              <AnimatePresence initial={false}>
                {isSidebarOpen && (
                  <motion.div 
                    className={styles.sidebarWrapper}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 300, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <div className={styles.sidebar}>
                      <div className={styles.monthHeader}>
                        <div className={styles.monthTitle}>{format(currentDate, 'MMMM yyyy')}</div>
                        <div className={styles.monthNav}>
                          <button onClick={prevMonth} className={styles.monthBtn}><ChevronLeft size={16} /></button>
                          <button onClick={nextMonth} className={styles.monthBtn}><ChevronRight size={16} /></button>
                        </div>
                      </div>

                      <div className={styles.calendarGrid}>
                        {WEEKDAYS.map(day => (
                          <div key={day} className={styles.dayLabel}>{day}</div>
                        ))}
                        {calendarDays.map((day, i) => {
                          const isSameMon = isSameMonth(day, currentDate);
                          const isSelected = isSameDay(day, currentDate);
                          const isTodayDate = isToday(day);
                          const dayKey = format(day, 'yyyy-MM-dd');
                          const hasEvent = eventDates.has(dayKey);

                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setCurrentDate(day);
                                if (window.innerWidth <= 768) setIsSidebarOpen(false); // auto close on mobile
                              }}
                              className={`
                                ${styles.dayCell} 
                                ${!isSameMon ? styles.emptyDay : ''} 
                                ${isSelected ? styles.selectedDay : ''}
                                ${isTodayDate ? styles.today : ''}
                              `}
                            >
                              {isSameMon ? format(day, 'd') : ''}
                              {isSameMon && hasEvent && <div className={styles.eventDot} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Schedule */}
              <div className={styles.mainPanel}>
                <div className={styles.topControls}>
                  <div className={styles.dayNavigator}>
                    <button onClick={prevDay} className={styles.navBtn}><ChevronLeft size={18} /></button>
                    <div className={styles.currentDay} onClick={jumpToToday} title="Jump to today">
                      <div className={styles.dayName}>{selectedDay}</div>
                      <div className={styles.dayDate}>{formattedDate}</div>
                    </div>
                    <button onClick={nextDay} className={styles.navBtn}><ChevronRight size={18} /></button>
                  </div>
                  
                  <div className={styles.tabContainer}>
                    <button className={`${styles.tabBtn} ${activeTab === 'routine' ? styles.active : ''}`} onClick={() => setActiveTab('routine')}>Weekly Routine</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'events' ? styles.active : ''}`} onClick={() => setActiveTab('events')}>Events on {formattedDate}</button>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.resetBtn}
                      onClick={() => setIsResettingDay(true)}
                      disabled={displayedRoutine.length === 0}
                    >
                      <RotateCcw size={14} /> Clear Day
                    </button>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <button
                      className={styles.uploadBtn}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={14} /> Upload Excel
                    </button>
                  </div>
                </div>

                {activeTab === 'routine' ? (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Activity</th>
                          <th>Type</th>
                          <th>Notes</th>
                          <th style={{ width: 64 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRoutine.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                              No routine scheduled for {selectedDay}.
                            </td>
                          </tr>
                        ) : (
                          displayedRoutine.map((item) => {
                            const isEditing = editingItemId === item.id;
                            return (
                              <tr key={item.id}>
                                {isEditing ? (
                                  <>
                                    <td>
                                      <TimeSelector24h
                                        value={editingItemData.time || ''}
                                        onChange={(val) => setEditingItemData({ ...editingItemData, time: val })}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        placeholder="Activity"
                                        value={editingItemData.activity || ''}
                                        onChange={(e) => setEditingItemData({ ...editingItemData, activity: e.target.value })}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        placeholder="Type"
                                        value={editingItemData.type || ''}
                                        onChange={(e) => setEditingItemData({ ...editingItemData, type: e.target.value })}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        placeholder="Notes"
                                        value={editingItemData.notes || ''}
                                        onChange={(e) => setEditingItemData({ ...editingItemData, notes: e.target.value })}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)' }}
                                      />
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          onClick={handleSaveEdit}
                                          style={{ background: 'var(--accent-violet)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                          <Save size={14} />
                                        </button>
                                        <button
                                          onClick={() => setEditingItemId(null)}
                                          style={{ background: 'var(--card-border)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td>{item.time}</td>
                                    <td>{item.activity}</td>
                                    <td>{item.type}</td>
                                    <td>{item.notes}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          className={styles.editBtn}
                                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
                                          onClick={() => {
                                            setEditingItemId(item.id);
                                            setEditingItemData({ ...item });
                                          }}
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          className={styles.deleteBtn}
                                          onClick={() => handleDeleteItem(item.id)}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })
                        )}
                        <tr className={styles.addFormRow}>
                          <td>
                            <TimeSelector24h
                              value={newItem.time || ''}
                              onChange={(val) => setNewItem({ ...newItem, time: val })}
                            />
                          </td>
                          <td>
                            <input
                              placeholder="Activity"
                              value={newItem.activity || ''}
                              onChange={(e) => setNewItem({ ...newItem, activity: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              placeholder="Type"
                              value={newItem.type || ''}
                              onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              placeholder="Notes"
                              value={newItem.notes || ''}
                              onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                            />
                          </td>
                          <td>
                            <div className={styles.addControls}>
                              <button className={styles.addBtn} onClick={handleAddItem}>
                                <Plus size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.eventsPage}>
                    <div className={styles.eventsHeader}>
                      <h3>Events for {formattedDate}</h3>
                    </div>
                    <div className={styles.eventsList}>
                      {displayedRoutine.length === 0 ? (
                        <div className={styles.emptyEvents}>No events scheduled for this day.</div>
                      ) : (
                        displayedRoutine.map(event => (
                          <div key={event.id} className={styles.eventCard}>
                            {postponingEventId === event.id ? (
                              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>Postpone {event.activity}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Calendar size={14} color="var(--text-tertiary)" />
                                  <input 
                                    type="date" 
                                    value={postponeDate} 
                                    onChange={(e) => setPostponeDate(e.target.value)}
                                    style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)', outline: 'none' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Clock size={14} color="var(--text-tertiary)" />
                                  <div style={{ flex: 1 }}>
                                    <TimeSelector24h value={postponeTime} onChange={setPostponeTime} />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                  <button 
                                    onClick={() => setPostponingEventId(null)}
                                    style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={handleSavePostpone}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#fff', background: 'var(--accent-violet)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                  >
                                    <Save size={14} /> Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className={styles.eventCardHeader}>
                                  <h4>{event.activity}</h4>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => handlePostponeClick(event)}
                                      style={{ background: 'none', border: 'none', color: 'var(--accent-violet)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      Postpone <ArrowRight size={12} />
                                    </button>
                                    <button className={styles.deleteBtn} onClick={() => handleDeleteItem(event.id)}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className={styles.eventCardBody}>
                                  <div className={styles.eventDetail}>
                                    <span>Time:</span> {event.time}
                                  </div>
                                  <div className={styles.eventDetail}>
                                    <span>Type:</span> {event.type || 'N/A'}
                                  </div>
                                  <div className={styles.eventDetail}>
                                    <span>Repeat:</span> {event.repeat ? event.repeat.charAt(0).toUpperCase() + event.repeat.slice(1) : 'None'}
                                  </div>
                                  {event.remind_at && (
                                    <div className={styles.eventDetail} style={{ color: 'var(--accent-violet)' }}>
                                      <span>Remind:</span> {format(new Date(event.remind_at), 'MMM d, yyyy HH:mm')}
                                    </div>
                                  )}
                                  {event.notes && (
                                    <div className={styles.eventNotes}>
                                      {event.notes}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className={styles.addEventForm}>
                      <h4>Add New Event</h4>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label>Event Name</label>
                          <input
                            placeholder="e.g. Board Meeting"
                            value={newItem.activity || ''}
                            onChange={(e) => setNewItem({ ...newItem, activity: e.target.value })}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Event Time</label>
                          <TimeSelector24h
                            value={newItem.time || ''}
                            onChange={(val) => setNewItem({ ...newItem, time: val })}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Event Details (Notes)</label>
                          <input
                            placeholder="Optional details"
                            value={newItem.notes || ''}
                            onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Repeat</label>
                          <select 
                            value={newEventRepeat} 
                            onChange={(e) => setNewEventRepeat(e.target.value as RepeatFrequency)}
                            className={styles.selectInput}
                          >
                            <option value="none">Does not repeat</option>
                            <option value="weekly">Every Week</option>
                            <option value="biweekly">Every 2 Weeks</option>
                            <option value="monthly">Every Month</option>
                            <option value="yearly">Every Year</option>
                          </select>
                        </div>
                        <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                          <label className={styles.checkboxLabel}>
                            <input 
                              type="checkbox" 
                              checked={hasReminder} 
                              onChange={(e) => setHasReminder(e.target.checked)}
                            />
                            Remind me about this event
                          </label>
                        </div>
                        {hasReminder && (
                          <>
                            <div className={styles.formGroup}>
                              <label>Reminder Date</label>
                              <input
                                type="date"
                                value={reminderDate}
                                onChange={(e) => setReminderDate(e.target.value)}
                              />
                            </div>
                            <div className={styles.formGroup}>
                              <label>Reminder Time</label>
                              <TimeSelector24h
                                value={reminderTime}
                                onChange={(val) => setReminderTime(val)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <button className={styles.submitEventBtn} onClick={handleAddItem}>
                        <Plus size={16} /> Create Event
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
            
            <AnimatePresence>
              {toast && (
                <motion.div
                  className={`${styles.toast} ${styles[toast.type]}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {toast.message}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    
    <DeleteConfirmationModal
      isOpen={!!itemToDelete || isResettingDay}
      title={isResettingDay ? `Clear Schedule?` : "Delete Item?"}
      message={isResettingDay ? `Are you sure you want to delete all routine items and events for ${formattedDate}?` : "Are you sure you want to remove this item?"}
      onConfirm={confirmDelete}
      onCancel={handleCancelDelete}
    />
    </>
  );
}


import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { useBudgieStore } from '@/stores/budgieStore';
import { Plus, X, Droplets, Utensils, Scale, Stethoscope, Pill, Bath, Scissors, Heart, TrendingUp, CalendarDays, CheckSquare, Pencil, Trash2, Sunrise, Sunset, Carrot, Sun, Moon, GlassWater, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import type { CareEvent, CareEventType } from '@/types/modules';
import styles from './Budgie.module.css';
import { useAppStore } from '@/stores/appStore';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';

const CARE_TYPES: { value: CareEventType; label: string; icon: any; color: string }[] = [
  { value: 'feeding', label: 'Feeding', icon: Utensils, color: '#f59e0b' },
  { value: 'water', label: 'Water Change', icon: Droplets, color: '#3b82f6' },
  { value: 'weight_check', label: 'Weight Check', icon: Scale, color: '#8b5cf6' },
  { value: 'vet_visit', label: 'Vet Visit', icon: Stethoscope, color: '#ef4444' },
  { value: 'medication', label: 'Medication', icon: Pill, color: '#ec4899' },
  { value: 'bath', label: 'Bath', icon: Bath, color: '#06b6d4' },
  { value: 'nail_trim', label: 'Nail Trim', icon: Scissors, color: '#64748b' },
  { value: 'health_note', label: 'Health Note', icon: Heart, color: '#10b981' },
];

export function CareTab() {
  const { selectedBirdId, setSelectedBirdId, foodRotation, dailyRoutine, setFoodRotation, setDailyRoutine } = useBudgieStore();
  const collapsed = useAppStore(s => s.sidebarCollapsed);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [selectedType, setSelectedType] = useState<CareEventType>('feeding');
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<{ date: string, events: any[] } | null>(null);
  const [veggieInput, setVeggieInput] = useState('');
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const birds = useLiveQuery(() => db.bird_profiles.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray());
  const selectedBird = birds?.find(b => b.id === selectedBirdId);
  
  // Also get the linked bird if it exists bi-directionally
  const linkedBird = birds?.find(b => b.id === selectedBird?.linked_bird_id || (b.linked_bird_id === selectedBird?.id && b.id !== selectedBird?.id));

  const careEvents = useLiveQuery(async () => {
    if (!selectedBirdId) return [];
    const events = await db.care_events
      .where('bird_id')
      .equals(selectedBirdId)
      .reverse()
      .sortBy('date');
    
    // If linked bird exists, merge their events so checklists show the same state
    if (linkedBird) {
      const linkedEvents = await db.care_events
        .where('bird_id')
        .equals(linkedBird.id)
        .toArray();
      
      const existingKeys = new Set(events.map(e => `${e.date}|${e.notes || ''}|${e.type}`));
      for (const le of linkedEvents) {
        const key = `${le.date}|${le.notes || ''}|${le.type}`;
        if (!existingKeys.has(key)) {
          events.push(le);
          existingKeys.add(key);
        }
      }
      events.sort((a, b) => b.date.localeCompare(a.date) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return events;
  }, [selectedBirdId, linkedBird?.id]);

  const handleAddEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBirdId) return;

    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const type = formData.get('type') as CareEventType;
    const notes = formData.get('notes') as string;
    
    // Type specific fields
    const value = formData.get('value') ? Number(formData.get('value')) : undefined;
    const food_type = formData.get('food_type') as string || undefined;
    const medication_name = formData.get('medication_name') as string || undefined;
    
    const applyToLinked = formData.get('apply_to_linked') === 'on';

    const baseEvent = {
      type,
      date,
      notes,
      value,
      food_type,
      medication_name,
      sync_status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      device_id: 'default'
    };

    await db.transaction('rw', db.care_events, async () => {
      // Add for main bird
      await db.care_events.add({
        ...baseEvent,
        id: generateId(),
        user_id: useAppStore.getState().userId || 'default',
        bird_id: selectedBirdId,
      });

      // Add for linked bird if checked
      if (applyToLinked && linkedBird) {
        await db.care_events.add({
          ...baseEvent,
          id: generateId(),
          user_id: useAppStore.getState().userId || 'default',
          bird_id: linkedBird.id,
        });
      }
    });
    syncManager.queueSync('budgie');

    setShowAddModal(false);
  };

  const handleToggleChecklist = async (checklistId: string, eventType: CareEventType, foodType?: string) => {
    if (!selectedBirdId) return;
    const today = new Date().toISOString().split('T')[0];
    const existingEvent = careEvents?.find(e => e.date === today && e.notes === `[Checklist: ${checklistId}]`);

    if (existingEvent) {
      // Uncheck (Delete)
      await db.transaction('rw', db.care_events, db.sync_deletions, async () => {
        await deleteAndTrack('care_events', existingEvent.id);
        if (linkedBird) {
          // Find and delete the linked bird's identical event
          const linkedEvent = await db.care_events
            .where('bird_id').equals(linkedBird.id)
            .and(e => e.date === today && e.notes === `[Checklist: ${checklistId}]`)
            .first();
          if (linkedEvent) await deleteAndTrack('care_events', linkedEvent.id);
        }
      });
    } else {
      // Check (Create)
      await db.transaction('rw', db.care_events, async () => {
        const baseEvent = {
          type: eventType,
          date: today,
          notes: `[Checklist: ${checklistId}]`,
          food_type: foodType,
          sync_status: 'pending' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          device_id: 'default'
        };

        await db.care_events.add({ ...baseEvent, id: generateId(), user_id: useAppStore.getState().userId || 'default', bird_id: selectedBirdId });
        
        if (linkedBird) {
          await db.care_events.add({ ...baseEvent, id: generateId(), user_id: useAppStore.getState().userId || 'default', bird_id: linkedBird.id });
        }
      });
    }
    syncManager.queueSync('budgie');
  };

  const handleDeleteDay = (group: { date: string, events: any[] }) => {
    setDeleteConfirmation({
      isOpen: true,
      title: "Delete All Logs for Day",
      message: `Are you sure you want to delete ALL logs for ${group.date}?`,
      onConfirm: async () => {
        await db.transaction('rw', db.care_events, async () => {
          for (const e of group.events) {
            await deleteAndTrack('care_events', e.id);
            if (linkedBird) {
              const linkedEvent = await db.care_events.where('bird_id').equals(linkedBird.id)
                .and(ev => ev.date === e.date && ev.type === e.type && ev.notes === e.notes)
                .first();
              if (linkedEvent) await deleteAndTrack('care_events', linkedEvent.id);
            }
          }
        });
        syncManager.queueSync('budgie');
        if (expandedDay === group.date) setExpandedDay(null);
        setDeleteConfirmation(null);
      }
    });
  };

  const handleSaveDayEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDay) return;
    const formData = new FormData(e.currentTarget);
    const newDate = formData.get('date') as string;
    
    if (newDate && newDate !== editingDay.date) {
      await db.transaction('rw', db.care_events, async () => {
        for (const ev of editingDay.events) {
          await db.care_events.update(ev.id, { date: newDate });
          
          if (linkedBird) {
            const linkedEvent = await db.care_events.where('bird_id').equals(linkedBird.id)
              .and(l_ev => l_ev.date === editingDay.date && l_ev.type === ev.type && l_ev.notes === ev.notes)
              .first();
            if (linkedEvent) await db.care_events.update(linkedEvent.id, { date: newDate });
          }
        }
      });
      syncManager.queueSync('budgie');
      if (expandedDay === editingDay.date) setExpandedDay(newDate);
    }
    setEditingDay(null);
  };

  const handleDeleteEvent = (event: any) => {
    setDeleteConfirmation({
      isOpen: true,
      title: "Delete Care Log",
      message: "Are you sure you want to delete this log?",
      onConfirm: async () => {
        await db.transaction('rw', db.care_events, db.sync_deletions, async () => {
          if (event.type === 'daily_checklist' && event._rawEvents) {
            for (const e of event._rawEvents) {
              await deleteAndTrack('care_events', e.id);
              if (linkedBird) {
                const linkedEvent = await db.care_events.where('bird_id').equals(linkedBird.id)
                  .and(ev => ev.date === e.date && ev.type === e.type && ev.notes === e.notes)
                  .first();
                if (linkedEvent) await deleteAndTrack('care_events', linkedEvent.id);
              }
            }
          } else {
            await deleteAndTrack('care_events', event.id);
            if (linkedBird) {
              const linkedEvent = await db.care_events.where('bird_id').equals(linkedBird.id)
                .and(ev => ev.date === event.date && ev.type === event.type && ev.notes === event.notes)
                .first();
              if (linkedEvent) await deleteAndTrack('care_events', linkedEvent.id);
            }
          }
        });
        syncManager.queueSync('budgie');
        setDeleteConfirmation(null);
      }
    });
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    
    await db.transaction('rw', db.care_events, async () => {
      if (editingEvent.type === 'daily_checklist' && editingEvent._rawEvents) {
        for (const ev of editingEvent._rawEvents) {
          await db.care_events.update(ev.id, { date });
          if (linkedBird) {
            const linkedEvent = await db.care_events.where('bird_id').equals(linkedBird.id)
              .and(l_ev => l_ev.date === ev.date && l_ev.type === ev.type && l_ev.notes === ev.notes)
              .first();
            if (linkedEvent) await db.care_events.update(linkedEvent.id, { date });
          }
        }
      } else {
        const payload = {
          date,
          type: formData.get('type') as CareEventType,
          value: formData.get('value') ? Number(formData.get('value')) : undefined,
          food_type: formData.get('food_type') as string || undefined,
          medication_name: formData.get('medication_name') as string || undefined,
          notes: formData.get('notes') as string || ''
        };
        
        await db.care_events.update(editingEvent.id, payload);
        
        if (linkedBird) {
          const linkedEvent = await db.care_events.where('bird_id').equals(linkedBird.id)
            .and(l_ev => l_ev.date === editingEvent.date && l_ev.type === editingEvent.type && l_ev.notes === editingEvent.notes)
            .first();
          if (linkedEvent) await db.care_events.update(linkedEvent.id, payload);
        }
      }
    });
    syncManager.queueSync('budgie');
    
    setEditingEvent(null);
  };

  const getChecklistTypeInfo = (notes: string) => {
    if (notes === '[Checklist: morning_food]') return { label: 'Morning Food', icon: Sun, color: '#f59e0b' };
    if (notes === '[Checklist: morning_water]') return { label: 'Morning Water', icon: GlassWater, color: '#f59e0b' };
    if (notes === '[Checklist: veggies]') return { label: 'Veggies', icon: Carrot, color: '#22c55e' };
    if (notes === '[Checklist: evening_food]') return { label: 'Evening Food', icon: Moon, color: '#6366f1' };
    if (notes === '[Checklist: evening_water]') return { label: 'Evening Water', icon: Droplets, color: '#6366f1' };
    return { label: 'Checklist Item', icon: CheckSquare, color: '#10b981' };
  };

  const handleSpecificExcelUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'food' | 'routine') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let parsedData: any[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet) as any[];
          if (!json.length) continue;

          // Normalize keys for case-insensitive matching
          const normalizedJson = json.map(row => {
            const normRow: Record<string, any> = {};
            for (const key of Object.keys(row)) {
              normRow[key.toLowerCase().trim()] = row[key];
            }
            return normRow;
          });

          if (type === 'food') {
            const hasHeaders = normalizedJson.some(r => r['day'] !== undefined || r['main food (all day)'] !== undefined || r['main food'] !== undefined);
            if (hasHeaders) {
              parsedData = normalizedJson.map(row => ({
                id: generateId(),
                day: String(row['day'] || ''),
                mainFood: String(row['main food (all day)'] || row['main food'] || ''),
                morningVeggies: String(row['morning veggies'] || row['veggies'] || ''),
                fruitSnacks: String(row['fruit snacks'] || row['snacks'] || '')
              })).filter(r => r.day || r.mainFood || r.morningVeggies || r.fruitSnacks);
              break;
            }
          } else if (type === 'routine') {
            const hasHeaders = normalizedJson.some(r => r['time'] !== undefined || r['routine'] !== undefined);
            if (hasHeaders) {
              parsedData = normalizedJson.map(row => ({
                id: generateId(),
                time: String(row['time'] || ''),
                routine: String(row['routine'] || ''),
                description: String(row['description'] || '')
              })).filter(r => r.time || r.routine || r.description);
              break;
            }
          }
        }

        if (parsedData.length > 0) {
          if (type === 'food') setFoodRotation(parsedData);
          if (type === 'routine') setDailyRoutine(parsedData);
        } else {
          alert(`We couldn't detect matching columns for ${type === 'food' ? 'Food Rotation' : 'Daily Routine'}.`);
        }
      } catch (err) {
        console.error(err);
        alert("There was an error reading the Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Process events for timeline
  const groupedEventsByDay = (() => {
    if (!careEvents) return [];
    const groups: Record<string, typeof careEvents> = {};
    careEvents.forEach(e => {
      if (e.notes === '[Checklist: veggies]' && e.food_type === 'Veggies / Chop') return;
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.keys(groups).map(date => ({
      date,
      events: groups[date]
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  })();

  if (!selectedBirdId) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
          Please select a bird from the Profiles tab to view their care log.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <select 
              value={selectedBirdId} 
              onChange={(e) => setSelectedBirdId(e.target.value)}
              style={{ fontSize: '18px', fontWeight: 700, border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', WebkitAppearance: 'none', paddingRight: '28px' }}
            >
              {birds?.map(b => (
                <option key={b.id} value={b.id}>{b.name}'s Care</option>
              ))}
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.primaryButton} style={{ background: 'rgba(255,255,255,0.5)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }} onClick={() => setShowRoutineModal(true)}>
            <CalendarDays size={16} /> Routine & Diet
          </button>
          <button className={styles.primaryButton} onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Log Event
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        
        {/* Left Column: Daily Checklist */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} color="var(--mod-budgie-primary)" /> Today's Checklist
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Morning */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Morning Care</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--mod-budgie-primary)' }} 
                    checked={!!careEvents?.find(e => e.date === new Date().toISOString().split('T')[0] && e.notes === '[Checklist: morning_food]')} 
                    onChange={() => handleToggleChecklist('morning_food', 'feeding', 'Morning Seed/Pellets')} />
                  <Sun size={16} color="#f59e0b" /> Food Replaced
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--mod-budgie-primary)' }} 
                    checked={!!careEvents?.find(e => e.date === new Date().toISOString().split('T')[0] && e.notes === '[Checklist: morning_water]')} 
                    onChange={() => handleToggleChecklist('morning_water', 'water')} />
                  <GlassWater size={16} color="#f59e0b" /> Water Replaced
                </label>
              </div>
            </div>

            {/* Veggies */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Veggies</div>
              {(() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const veggiesEvent = careEvents?.find(e => e.date === todayStr && e.notes === '[Checklist: veggies]');
                const isChecked = !!veggiesEvent;
                const isDisabled = !isChecked && !veggieInput.trim();

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text"
                      placeholder="What veggies did you give?"
                      defaultValue={veggiesEvent && veggiesEvent.food_type !== 'Veggies / Chop' ? veggiesEvent.food_type : ''}
                      onChange={(e) => setVeggieInput(e.target.value)}
                      onBlur={async (e) => {
                        if (veggiesEvent) {
                          const val = e.target.value.trim() || 'Veggies / Chop';
                          if (val !== veggiesEvent.food_type) {
                            await db.transaction('rw', db.care_events, db.sync_deletions, async () => {
                              await db.care_events.update(veggiesEvent.id, { food_type: val });
                              if (linkedBird) {
                                const linkedEvent = await db.care_events
                                  .where('bird_id').equals(linkedBird.id)
                                  .and(ev => ev.date === todayStr && ev.notes === '[Checklist: veggies]')
                                  .first();
                                if (linkedEvent) await db.care_events.update(linkedEvent.id, { food_type: val });
                              }
                            });
                            syncManager.queueSync('budgie');
                          }
                        }
                      }}
                      style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--canvas-surface)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: '14px', color: isDisabled ? 'var(--text-disabled)' : 'var(--text-primary)' }}>
                      <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--mod-budgie-primary)' }} 
                        disabled={isDisabled}
                        checked={isChecked} 
                        onChange={() => {
                          if (!isChecked && veggieInput.trim()) {
                            handleToggleChecklist('veggies', 'feeding', veggieInput.trim());
                          } else if (isChecked) {
                            handleToggleChecklist('veggies', 'feeding', 'Veggies / Chop');
                          }
                        }} />
                      <Carrot size={16} color="#22c55e" /> Veggies Given
                    </label>
                  </div>
                );
              })()}
            </div>

            {/* Evening */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Evening Care</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--mod-budgie-primary)' }} 
                    checked={!!careEvents?.find(e => e.date === new Date().toISOString().split('T')[0] && e.notes === '[Checklist: evening_food]')} 
                    onChange={() => handleToggleChecklist('evening_food', 'feeding', 'Evening Seed/Pellets')} />
                  <Moon size={16} color="#6366f1" /> Food Replaced
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--mod-budgie-primary)' }} 
                    checked={!!careEvents?.find(e => e.date === new Date().toISOString().split('T')[0] && e.notes === '[Checklist: evening_water]')} 
                    onChange={() => handleToggleChecklist('evening_water', 'water')} />
                  <Droplets size={16} color="#6366f1" /> Water Replaced
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Chart */}
        <div>
          {careEvents && careEvents.some(e => e.type === 'weight_check') && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="var(--mod-budgie-primary)" /> Weight History
          </h3>
          <div style={{ height: '200px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...careEvents].filter(e => e.type === 'weight_check').reverse().map(e => ({ date: e.date.substring(5), weight: e.value }))}>
                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} width={30} />
                <Tooltip 
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--mod-budgie-primary)' }}
                />
                <Line type="monotone" dataKey="weight" stroke="var(--mod-budgie-primary)" strokeWidth={3} dot={{ fill: 'var(--mod-budgie-primary)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className={styles.timeline}>
        {groupedEventsByDay.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
            No care events logged yet for {selectedBird?.name}.
          </div>
        )}
        
        {groupedEventsByDay.map(group => (
          <div key={group.date} className={styles.timelineItem} onClick={() => setExpandedDay(group.date)} style={{ cursor: 'pointer' }}>
            <div className={styles.timelineIcon} style={{ background: 'var(--mod-budgie-primary)' }}>
              <CalendarDays size={20} />
            </div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineHeader} style={{ marginBottom: '0' }}>
                <div className={styles.timelineTitle}>{new Date(group.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className={styles.timelineTime}>{group.events.length} logs</div>
                  <button onClick={(e) => { e.stopPropagation(); setEditingDay(group); }} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><Pencil size={12} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDay(group); }} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {group.events.map(event => {
                  const isChecklist = event.notes?.startsWith('[Checklist:');
                  const typeInfo = isChecklist ? getChecklistTypeInfo(event.notes || '') : (CARE_TYPES.find(t => t.value === event.type) || CARE_TYPES[0]);
                  const Icon = typeInfo.icon;
                  return (
                    <div key={event.id} style={{ background: typeInfo.color, borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} title={typeInfo.label}>
                      <Icon size={14} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
      </div>

      {showAddModal && (
        <div className={styles.modalOverlay} style={{ paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Log Care Event</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEvent} className={styles.modalBody}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Date *</label>
                  <input type="date" required name="date" className={styles.input} defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Event Type *</label>
                  <select required name="type" className={styles.input} value={selectedType} onChange={(e) => setSelectedType(e.target.value as CareEventType)}>
                    {CARE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {selectedType === 'weight_check' && (
                <div className={styles.inputGroup}>
                  <label>Weight (grams) *</label>
                  <input type="number" step="0.1" required name="value" className={styles.input} placeholder="e.g. 35" />
                </div>
              )}

              {selectedType === 'feeding' && (
                <div className={styles.inputGroup}>
                  <label>Food Type</label>
                  <input name="food_type" className={styles.input} placeholder="e.g. Pellets, Chop, Seed mix" />
                </div>
              )}

              {selectedType === 'medication' && (
                <div className={styles.inputGroup}>
                  <label>Medication Name</label>
                  <input name="medication_name" className={styles.input} />
                </div>
              )}

              <div className={styles.inputGroup}>
                <label>Notes (Optional)</label>
                <input name="notes" className={styles.input} placeholder="Any specific details..." />
              </div>

              {linkedBird && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input type="checkbox" id="apply_to_linked" name="apply_to_linked" defaultChecked style={{ width: '16px', height: '16px', accentColor: 'var(--mod-budgie-primary)' }} />
                  <label htmlFor="apply_to_linked" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Also apply to linked cage-mate ({linkedBird.name})
                  </label>
                </div>
              )}

              <button type="submit" className={styles.primaryButton} style={{ marginTop: '8px', justifyContent: 'center' }}>
                Save Log
              </button>
            </form>
          </div>
        </div>
      )}

      {editingEvent && (
        <div className={styles.modalOverlay} style={{ paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Edit Log</h3>
              <button onClick={() => setEditingEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEdit} className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Date *</label>
                <input type="date" required name="date" className={styles.input} defaultValue={editingEvent.date} />
              </div>
              
              {editingEvent.type === 'daily_checklist' ? (
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  This is a Daily Checklist summary. You can change the date for the entire group here. To edit specific checklist items, use the daily checklist on the left side of the Care screen.
                </div>
              ) : (
                <>
                  <div className={styles.inputGroup}>
                    <label>Event Type *</label>
                    <select required name="type" className={styles.input} defaultValue={editingEvent.type}>
                      {CARE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {editingEvent.type === 'weight_check' && (
                    <div className={styles.inputGroup}>
                      <label>Weight (grams) *</label>
                      <input type="number" step="0.1" required name="value" className={styles.input} defaultValue={editingEvent.value} />
                    </div>
                  )}
                  {editingEvent.type === 'feeding' && (
                    <div className={styles.inputGroup}>
                      <label>Food Type</label>
                      <input name="food_type" className={styles.input} defaultValue={editingEvent.food_type} />
                    </div>
                  )}
                  {editingEvent.type === 'medication' && (
                    <div className={styles.inputGroup}>
                      <label>Medication Name</label>
                      <input name="medication_name" className={styles.input} defaultValue={editingEvent.medication_name} />
                    </div>
                  )}
                  <div className={styles.inputGroup}>
                    <label>Notes</label>
                    <input name="notes" className={styles.input} defaultValue={editingEvent.notes} />
                  </div>
                </>
              )}

              <button type="submit" className={styles.primaryButton} style={{ marginTop: '8px', justifyContent: 'center' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {expandedDay && (
        <div className={styles.modalOverlay} onClick={() => setExpandedDay(null)} style={{ paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Care Logs: {new Date(expandedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</h3>
              <button onClick={() => setExpandedDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
               <div className={styles.timeline}>
                 {careEvents?.filter(e => e.date === expandedDay).map(event => {
                    const isChecklist = event.notes?.startsWith('[Checklist:');
                    let typeInfo: any = CARE_TYPES.find(t => t.value === event.type) || CARE_TYPES[0];
                    let displayNotes = event.notes;
                    
                    if (isChecklist) {
                      const checklistInfo = getChecklistTypeInfo(event.notes || '');
                      typeInfo = { value: 'feeding', ...checklistInfo };
                      if (event.notes === '[Checklist: morning_food]') displayNotes = 'Morning Food Replaced';
                      if (event.notes === '[Checklist: morning_water]') displayNotes = 'Morning Water Replaced';
                      if (event.notes === '[Checklist: veggies]') displayNotes = `Veggies Given (${event.food_type})`;
                      if (event.notes === '[Checklist: evening_food]') displayNotes = 'Evening Food Replaced';
                      if (event.notes === '[Checklist: evening_water]') displayNotes = 'Evening Water Replaced';
                    }

                    const Icon = typeInfo.icon;
                    return (
                      <div key={event.id} className={styles.timelineItem}>
                        <div className={styles.timelineIcon} style={{ background: typeInfo.color }}>
                          <Icon size={20} />
                        </div>
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineHeader}>
                            <div className={styles.timelineTitle}>{typeInfo.label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button onClick={() => setEditingEvent(event)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}><Pencil size={12} /></button>
                              <button onClick={() => handleDeleteEvent(event)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                            </div>
                          </div>
                          {event.value !== undefined && (
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--mod-budgie-primary)', marginBottom: '4px' }}>
                              {event.value}g
                            </div>
                          )}
                          {!isChecklist && event.food_type && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Food: {event.food_type}</div>}
                          {!isChecklist && event.medication_name && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Medication: {event.medication_name}</div>}
                          {displayNotes && <div style={{ fontSize: '14px', marginTop: '4px', color: 'var(--text-secondary)', fontStyle: isChecklist ? 'italic' : 'normal' }}>{displayNotes}</div>}
                        </div>
                      </div>
                    );
                 })}
               </div>
            </div>
          </div>
        </div>
      )}

      {editingDay && (
        <div className={styles.modalOverlay} onClick={() => setEditingDay(null)} style={{ paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Edit Day Log Date</h3>
              <button onClick={() => setEditingDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveDayEdit} className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label>Date</label>
                <input required type="date" name="date" className={styles.input} defaultValue={editingDay.date} />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>This will change the date for all {editingDay.events.length} logs logged on {editingDay.date}.</p>
              <button type="submit" className={styles.primaryButton} style={{ marginTop: '16px', justifyContent: 'center' }}>
                Save New Date
              </button>
            </form>
          </div>
        </div>
      )}

      {showRoutineModal && (
        <div className={styles.modalOverlay} style={{ paddingLeft: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', transition: 'padding-left var(--transition-snappy)' }}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={20} /> Routine & Weekly Diet</h3>
              <button onClick={() => setShowRoutineModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                  Upload an Excel (.xlsx / .csv) file to automatically populate these tables. Ensure your columns match the headers below.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 8px 0' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Weekly Food Rotation</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="file" id="excel-upload-food" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={(e) => handleSpecificExcelUpload(e, 'food')} />
                  <button className={styles.primaryButton} onClick={() => document.getElementById('excel-upload-food')?.click()} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                    Upload Excel
                  </button>
                  {foodRotation.length > 0 && (
                    <button className={styles.primaryButton} onClick={() => { 
                      setDeleteConfirmation({
                        isOpen: true,
                        title: "Clear Weekly Food Rotation",
                        message: "Are you sure you want to clear the entire Weekly Food Rotation?",
                        onConfirm: () => {
                          setFoodRotation([]);
                          setDeleteConfirmation(null);
                        }
                      });
                    }} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--bg-secondary)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      Clear All
                    </button>
                  )}
                </div>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead style={{ background: 'var(--card-bg)', borderBottom: '2px solid var(--card-border)' }}>
                    <tr>
                      <th style={{ padding: '12px' }}>Day</th>
                      <th style={{ padding: '12px' }}>Main Food (All Day)</th>
                      <th style={{ padding: '12px' }}>Morning Veggies</th>
                      <th style={{ padding: '12px' }}>Fruit Snacks</th>
                      <th style={{ padding: '12px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {foodRotation.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No data. Add a row or upload an excel file.</td></tr>
                    )}
                    {foodRotation.map(row => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '4px' }}>
                          <input value={row.day} onChange={(e) => setFoodRotation(foodRotation.map(r => r.id === row.id ? {...r, day: e.target.value} : r))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', color: 'inherit', outline: 'none', fontWeight: 500 }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input value={row.mainFood} onChange={(e) => setFoodRotation(foodRotation.map(r => r.id === row.id ? {...r, mainFood: e.target.value} : r))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', color: 'var(--text-secondary)', outline: 'none' }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input value={row.morningVeggies} onChange={(e) => setFoodRotation(foodRotation.map(r => r.id === row.id ? {...r, morningVeggies: e.target.value} : r))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', color: 'var(--text-secondary)', outline: 'none' }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input value={row.fruitSnacks} onChange={(e) => setFoodRotation(foodRotation.map(r => r.id === row.id ? {...r, fruitSnacks: e.target.value} : r))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', color: 'var(--text-secondary)', outline: 'none' }} />
                        </td>
                        <td style={{ padding: '4px', textAlign: 'center' }}>
                          <button onClick={() => {
                            setDeleteConfirmation({
                              isOpen: true,
                              title: "Delete Weekly Diet Row",
                              message: "Are you sure you want to delete this row?",
                              onConfirm: () => {
                                setFoodRotation(foodRotation.filter(r => r.id !== row.id));
                                setDeleteConfirmation(null);
                              }
                            });
                          }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button 
                onClick={() => setFoodRotation([...foodRotation, { id: generateId(), day: '', mainFood: '', morningVeggies: '', fruitSnacks: '' }])}
                style={{ marginTop: '8px', background: 'transparent', border: '1px dashed var(--card-border)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
              >
                <Plus size={14} /> Add Row
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 8px 0' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Daily Routine</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="file" id="excel-upload-routine" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={(e) => handleSpecificExcelUpload(e, 'routine')} />
                  <button className={styles.primaryButton} onClick={() => document.getElementById('excel-upload-routine')?.click()} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                    Upload Excel
                  </button>
                  {dailyRoutine.length > 0 && (
                    <button className={styles.primaryButton} onClick={() => { 
                      setDeleteConfirmation({
                        isOpen: true,
                        title: "Clear Daily Routine",
                        message: "Are you sure you want to clear the entire Daily Routine?",
                        onConfirm: () => {
                          setDailyRoutine([]);
                          setDeleteConfirmation(null);
                        }
                      });
                    }} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--bg-secondary)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      Clear All
                    </button>
                  )}
                </div>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead style={{ background: 'var(--card-bg)', borderBottom: '2px solid var(--card-border)' }}>
                    <tr>
                      <th style={{ padding: '12px', width: '100px' }}>Time</th>
                      <th style={{ padding: '12px', width: '150px' }}>Routine</th>
                      <th style={{ padding: '12px' }}>Description</th>
                      <th style={{ padding: '12px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRoutine.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No data. Add a row or upload an excel file.</td></tr>
                    )}
                    {dailyRoutine.map(row => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '4px' }}>
                          <input value={row.time} onChange={(e) => setDailyRoutine(dailyRoutine.map(r => r.id === row.id ? {...r, time: e.target.value} : r))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', color: 'inherit', outline: 'none', fontWeight: 500 }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input value={row.routine} onChange={(e) => setDailyRoutine(dailyRoutine.map(r => r.id === row.id ? {...r, routine: e.target.value} : r))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', color: 'var(--text-primary)', outline: 'none' }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input value={row.description} onChange={(e) => setDailyRoutine(dailyRoutine.map(r => r.id === row.id ? {...r, description: e.target.value} : r))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', color: 'var(--text-secondary)', outline: 'none' }} />
                        </td>
                        <td style={{ padding: '4px', textAlign: 'center' }}>
                          <button onClick={() => {
                            setDeleteConfirmation({
                              isOpen: true,
                              title: "Delete Daily Routine Row",
                              message: "Are you sure you want to delete this row?",
                              onConfirm: () => {
                                setDailyRoutine(dailyRoutine.filter(r => r.id !== row.id));
                                setDeleteConfirmation(null);
                              }
                            });
                          }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button 
                onClick={() => setDailyRoutine([...dailyRoutine, { id: generateId(), time: '', routine: '', description: '' }])}
                style={{ marginTop: '8px', background: 'transparent', border: '1px dashed var(--card-border)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
              >
                <Plus size={14} /> Add Row
              </button>

            </div>
          </div>
        </div>
      )}

      {deleteConfirmation && (
        <DeleteConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          title={deleteConfirmation.title}
          message={deleteConfirmation.message}
          onConfirm={deleteConfirmation.onConfirm}
          onCancel={() => setDeleteConfirmation(null)}
        />
      )}
    </div>
  );
}

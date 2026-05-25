'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteAndTrack } from '@/lib/db/deleteAndTrack';
import { syncManager } from '@/lib/sync/SyncManager';
import { generateId } from '@/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Scale, TrendingUp, Trash2, CalendarDays, PlusCircle } from 'lucide-react';
import styles from '@/app/(app)/fitness/Fitness.module.css';
import { DeleteConfirmationModal } from '@/components/ui/Modal/DeleteConfirmationModal';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';

export function StatsTab() {
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch body metrics
  const metrics = useLiveQuery(async () => {
    return await db.body_metrics.orderBy('date').reverse().filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray();
  });

  const handleLogWeight = async () => {
    if (!weightInput || !dateInput) return;
    if (!weightInput || !weightInput) return;
    
    // Check if we already logged on this date
    const existing = await db.body_metrics.where('date').equals(dateInput).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).first();
    
    if (existing) {
      await db.body_metrics.update(existing.id, {
        weight: Number(weightInput),
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      });
    } else {
      await db.body_metrics.add({
        id: generateId(),
        user_id: useAppStore.getState().userId || 'default',
        date: dateInput,
        weight: Number(weightInput),
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        device_id: 'default'
      });
    }
    
    syncManager.queueSync('fitness');
    setWeightInput('');
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteAndTrack('body_metrics', deleteId);
      setDeleteId(null);
      syncManager.queueSync('fitness');
    }
  };

  const chartData = [...(metrics || [])].reverse().map(m => ({
    date: m.date.substring(5), // MM-DD
    weight: m.weight
  }));

  return (
    <div className={styles.container}>
      
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className={styles.section} 
        style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
      >
        <div className={styles.sectionTitle} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--accent-violet-soft)', padding: '8px', borderRadius: '10px', color: 'var(--accent-violet)', display: 'flex' }}>
            <Scale size={20} />
          </div>
          Log Body Weight
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</label>
            <div style={{ position: 'relative' }}>
              <CalendarDays size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="date"
                value={dateInput}
                onChange={e => setDateInput(e.target.value)}
                style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-violet)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weight (kg)</label>
            <input 
              type="number" 
              value={weightInput} 
              onChange={e => setWeightInput(e.target.value)} 
              placeholder="e.g. 75.5"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-violet)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
            />
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogWeight}
            disabled={!weightInput}
            style={{ 
              background: weightInput ? 'var(--mod-fitness-primary)' : 'var(--card-border)', 
              color: weightInput ? 'white' : 'var(--text-tertiary)', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              fontWeight: 600, 
              cursor: weightInput ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              height: '42px'
            }}
          >
            <PlusCircle size={18} />
            Save Log
          </motion.button>
        </div>
      </motion.div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={styles.section}
        style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
      >
        <div className={styles.sectionTitle} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--accent-violet-soft)', padding: '8px', borderRadius: '10px', color: 'var(--accent-violet)', display: 'flex' }}>
            <TrendingUp size={20} />
          </div>
          Weight Trend
        </div>
        
        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: '320px', marginTop: '16px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mod-fitness-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--mod-fitness-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(255, 255, 255, 0.9)', border: '1px solid var(--card-border)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ color: 'var(--mod-fitness-primary)', fontWeight: 700 }}
                  labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '13px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="var(--mod-fitness-primary)" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorWeight)" 
                  activeDot={{ r: 8, strokeWidth: 0, fill: 'var(--mod-fitness-primary)' }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', marginTop: '16px' }}>
            No weight data logged yet. Add your first log above!
          </div>
        )}
      </motion.div>

      {/* History List */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className={styles.section}
      >
        <div className={styles.sectionTitle}>
          Recent Logs
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <AnimatePresence>
            {metrics && metrics.length > 0 ? metrics.slice(0, 10).map(m => (
              <motion.div 
                key={m.id} 
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--card-border)', borderRadius: '12px', background: 'var(--card-bg)', overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px' }}>{m.weight} <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>kg</span></div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.date}</div>
                </div>
                <button 
                  onClick={() => setDeleteId(m.id)}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                No recent logs.
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {deleteId && (
        <DeleteConfirmationModal
          isOpen={true}
          title="Delete Weight Log"
          message="Are you sure you want to delete this log? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}



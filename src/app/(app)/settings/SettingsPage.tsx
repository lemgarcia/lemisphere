'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Save, Download, Upload, AlertTriangle, Cloud, User, Database, ShieldAlert } from 'lucide-react';
import styles from '@/styles/modulePage.module.css';
import { useAppStore } from '@/stores/appStore';
import { db } from '@/lib/db';
import { syncManager } from '@/lib/sync/SyncManager';
import 'dexie-export-import';

export function SettingsPage() {
  const username = useAppStore((s) => s.username);
  const setUser = useAppStore((s) => s.setUser);
  const deviceId = useAppStore((s) => s.deviceId);

  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'danger'>('general');

  const [localName, setLocalName] = useState(username || '');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Future Supabase Sync
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  const handleSaveProfile = () => {
    setUser(useAppStore.getState().userId, localName);
    alert('Profile saved!');
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await db.export();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lemisphere-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed', error);
      alert('Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportStatus('Importing...');
      syncManager.pause(); // Prevent sync from interfering
      await db.delete();
      await db.open();
      await db.import(file);
      syncManager.resume();
      setImportStatus('Import complete! Refresh the page.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Import failed', error);
      syncManager.resume();
      setImportStatus('Failed to import data.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleWipeDatabase = async () => {
    if (wipeConfirm === 'DELETE') {
      try {
        syncManager.pause(); // Prevent sync from interfering
        await db.delete();
        alert('Database wiped. Refreshing...');
        window.location.reload();
      } catch (error) {
        console.error('Wipe failed', error);
        syncManager.resume();
      }
    } else {
      alert('You must type DELETE exactly.');
    }
  };

  return (
    <motion.div className={styles.page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
      <div className={styles.pageHeader} style={{ flexDirection: 'column', gap: '20px' }}>
        <div className={styles.pageTitle} style={{ width: '100%' }}>
          <div className={styles.pageTitleIcon} style={{ background: 'var(--card-border)' }}>
            <Settings size={22} color="var(--text-primary)" />
          </div>
          <div>
            <div className={styles.pageTitleText}>Settings</div>
            <div className={styles.pageTitleSub}>Preferences & Data Management</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--card-border)', width: '100%', paddingBottom: '0' }}>
          {(['general', 'data', 'danger'] as const).map((tab) => {
            const labels = {
              general: { title: 'General', icon: <User size={16} /> },
              data: { title: 'Data Management', icon: <Database size={16} /> },
              danger: { title: 'Danger Zone', icon: <ShieldAlert size={16} /> }
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? (tab === 'danger' ? '2px solid var(--status-error)' : '2px solid var(--accent-violet)') : '2px solid transparent',
                  color: isActive ? (tab === 'danger' ? 'var(--status-error)' : 'var(--text-primary)') : 'var(--text-tertiary)',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '-1px'
                }}
              >
                {labels[tab].icon}
                {labels[tab].title}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '0 32px 32px 32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            {activeTab === 'general' && (
              <>
                {/* Profile Settings */}
                <section style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Profile</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Display Name</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input 
                          type="text" 
                          value={localName} 
                          onChange={(e) => setLocalName(e.target.value)} 
                          style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)', fontSize: '14px' }}
                          placeholder="Enter your name..."
                        />
                        <button 
                          onClick={handleSaveProfile}
                          style={{ padding: '0 20px', borderRadius: '8px', background: 'var(--text-primary)', color: 'var(--card-bg)', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Save size={16} /> Save
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Device ID</label>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{deviceId}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>This identifies your device for offline syncing capabilities.</div>
                    </div>
                  </div>
                </section>

                {/* Sync Settings */}
                <section style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cloud size={20} /> Cloud Sync
                  </h2>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                    Lemisphere is currently running in <strong>Offline Mode</strong>. Your data is stored securely on your device. Connect a Supabase instance to enable real-time multi-device syncing.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="Supabase Project URL (e.g. https://xyz.supabase.co)" 
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)', fontSize: '14px' }}
                    />
                    <input 
                      type="password" 
                      placeholder="Supabase Anon Key" 
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)', fontSize: '14px' }}
                    />
                    <button 
                      disabled
                      style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--status-success)', color: '#fff', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'not-allowed', alignSelf: 'flex-start', opacity: 0.7 }}
                    >
                      Connect (Coming in Sync Phase)
                    </button>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'data' && (
              <>
                {/* Data Management */}
                <section style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Data Backup</h2>
                  
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={handleExport}
                      disabled={isExporting}
                      style={{ flex: 1, minWidth: '200px', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }}
                    >
                      <div style={{ background: 'var(--card-bg)', padding: '12px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Download size={24} color="var(--accent-violet)" />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{isExporting ? 'Exporting...' : 'Export Backup'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Download your entire database as a JSON file.</div>
                      </div>
                    </button>

                    <button 
                      onClick={handleImportClick}
                      disabled={isImporting}
                      style={{ flex: 1, minWidth: '200px', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--canvas-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }}
                    >
                      <div style={{ background: 'var(--card-bg)', padding: '12px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Upload size={24} color="var(--accent-emerald)" />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{isImporting ? 'Importing...' : 'Restore Backup'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Upload a JSON file to restore your database.</div>
                      </div>
                    </button>
                    <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImportFile} />
                  </div>
                  {importStatus && <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--status-info)', textAlign: 'center', fontWeight: 500 }}>{importStatus}</div>}
                </section>
              </>
            )}

            {activeTab === 'danger' && (
              <>
                {/* Danger Zone */}
                <section style={{ background: 'var(--status-error-bg)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--status-error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} /> Danger Zone
                  </h2>
                  <p style={{ fontSize: '14px', color: 'var(--status-error)', opacity: 0.8, marginBottom: '16px' }}>
                    Wiping the database will permanently delete all your data (Goals, Habits, Routines, Fitness Logs) stored on this device. This cannot be undone unless you have a backup.
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="Type DELETE to confirm" 
                      value={wipeConfirm}
                      onChange={(e) => setWipeConfirm(e.target.value)}
                      style={{ flex: 1, maxWidth: '250px', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', background: '#fff', color: 'var(--status-error)', fontSize: '14px', outline: 'none' }}
                    />
                    <button 
                      onClick={handleWipeDatabase}
                      disabled={wipeConfirm !== 'DELETE'}
                      style={{ padding: '0 20px', borderRadius: '8px', background: wipeConfirm === 'DELETE' ? 'var(--status-error)' : 'rgba(239, 68, 68, 0.4)', color: '#fff', fontWeight: 600, fontSize: '14px', border: 'none', cursor: wipeConfirm === 'DELETE' ? 'pointer' : 'not-allowed' }}
                    >
                      Wipe Database
                    </button>
                  </div>
                </section>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

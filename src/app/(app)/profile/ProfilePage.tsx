'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { UserCircle, Target, Flame, Dumbbell, Gamepad2, Settings2, Camera, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import styles from '@/styles/modulePage.module.css';
import { useAppStore } from '@/stores/appStore';
import { db } from '@/lib/db';

export function ProfilePage() {
  const username = useAppStore((s) => s.username);
  const profilePicture = useAppStore((s) => s.profilePicture);
  const setUser = useAppStore((s) => s.setUser);
  const setProfilePicture = useAppStore((s) => s.setProfilePicture);
  const userId = useAppStore((s) => s.userId);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(username || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setUser(userId, editName);
    setIsEditing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Queries
  const activeGoalsCount = useLiveQuery(() => db.goals.where('status').equals('in-progress').filter(x => x.user_id === (useAppStore.getState().userId || 'default')).count()) || 0;
  const activeHabitsCount = useLiveQuery(() => db.habits.where('is_active').equals(1).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).count()) || 0;

  const activeProgramsCount = useLiveQuery(() => db.fitness_programs.where('status').equals('active').filter(x => x.user_id === (useAppStore.getState().userId || 'default')).count()) || 0;
  const playingGamesCount = useLiveQuery(() => db.games.where('status').equals('playing').filter(x => x.user_id === (useAppStore.getState().userId || 'default')).count()) || 0;

  return (
    <motion.div className={styles.page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <div className={styles.pageTitleIcon} style={{ background: 'var(--card-border)' }}>
            <UserCircle size={22} color="var(--text-primary)" />
          </div>
          <div>
            <div className={styles.pageTitleText}>Profile</div>
            <div className={styles.pageTitleSub}>User Information & Statistics</div>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* Profile Card */}
        <div style={{ 
          background: 'var(--card-bg)', 
          border: '1px solid var(--card-border)', 
          borderRadius: '24px', 
          padding: '40px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '32px',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div 
            style={{ 
              width: '120px', 
              height: '120px', 
              borderRadius: '50%', 
              background: 'var(--canvas-bg)', 
              border: '2px solid var(--card-border)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '64px',
              position: 'relative',
              overflow: 'hidden',
              cursor: isEditing ? 'pointer' : 'default'
            }}
            onClick={() => isEditing && fileInputRef.current?.click()}
          >
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              '😎'
            )}
            {isEditing && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
              }}>
                <Camera size={32} />
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
          </div>
          <div style={{ flex: 1 }}>
            {isEditing ? (
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ 
                  fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em',
                  background: 'var(--canvas-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '4px 12px', width: '100%', maxWidth: '300px'
                }}
              />
            ) : (
              <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                {username || 'You'}
              </h1>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 0 24px 0' }}>
              Personal OS Administrator
            </p>
            {isEditing ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleSave}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--text-primary)',
                    border: 'none', borderRadius: '99px', color: 'var(--card-bg)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Check size={16} /> Save
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--canvas-bg)',
                    border: '1px solid var(--card-border)', borderRadius: '99px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setEditName(username || '');
                  setIsEditing(true);
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--canvas-bg)',
                  border: '1px solid var(--card-border)', borderRadius: '99px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <Settings2 size={16} /> Edit Profile Settings
              </button>
            )}
          </div>
        </div>

        {/* Global Statistics Grid */}
        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '16px 0 0 0', color: 'var(--text-primary)' }}>Your OS Statistics</h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mod-goals-primary)' }}>
              <Target size={20} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>Active Goals</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>{activeGoalsCount}</div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mod-habits-primary)' }}>
              <Flame size={20} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>Active Habits</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>{activeHabitsCount}</div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mod-fitness-primary)' }}>
              <Dumbbell size={20} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>Fitness Programs</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>{activeProgramsCount}</div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mod-gaming-primary)' }}>
              <Gamepad2 size={20} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>Playing Games</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>{playingGamesCount}</div>
          </div>

        </div>

      </div>
    </motion.div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/stores/appStore';

export function GlobalUserMenu() {
  const username = useAppStore((s) => s.username);
  const logout = useAppStore((s) => s.logout);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={menuRef} 
      style={{
        position: 'fixed',
        top: '20px',
        right: '28px',
        zIndex: 5000,
      }}
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        title="User Menu"
        style={{
          height: '40px',
          padding: '0 16px 0 6px',
          borderRadius: '99px',
          border: '1px solid var(--card-border)',
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          boxShadow: 'var(--card-shadow)',
          transition: 'transform 0.2s, background 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--card-bg)';
          e.currentTarget.style.borderColor = 'var(--accent-violet)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
          e.currentTarget.style.borderColor = 'var(--card-border)';
        }}
      >
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--canvas-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: '1px solid var(--card-border)' }}>😎</div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{username || 'You'}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '220px',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', background: 'rgba(0, 0, 0, 0.02)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{username || 'You'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: '2px' }}>Personal OS</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '6px' }}>
              <Link 
                href="/profile" 
                onClick={() => setIsOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500, transition: 'background 0.2s', borderRadius: '6px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <User size={16} strokeWidth={2} color="var(--text-secondary)" /> Profile
              </Link>
              <Link 
                href="/settings" 
                onClick={() => setIsOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500, transition: 'background 0.2s', borderRadius: '6px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <Settings size={16} strokeWidth={2} color="var(--text-secondary)" /> Settings
              </Link>
              <div style={{ height: '1px', background: 'var(--card-border)', margin: '4px 0' }} />
              <button 
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', color: 'var(--status-error)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: '13px', fontWeight: 600, transition: 'background 0.2s', borderRadius: '6px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--status-error-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={16} strokeWidth={2.5} /> Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

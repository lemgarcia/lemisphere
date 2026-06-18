'use client';

import { useState, useRef, useEffect } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Target,
  Dumbbell,
  Flame,
  Bird,
  Gamepad2,
  BookOpen,
  Settings,
  LogOut,
  ChevronLeft,
  Search,
  RefreshCw,
  Cloud,
  CloudOff
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import styles from './Sidebar.module.css';
import type { ModuleId } from '@/types';

interface NavItem {
  id: ModuleId;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  accentColor: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard',   href: '/dashboard', icon: LayoutDashboard, accentColor: '#8b5cf6' },
  { id: 'goals',     label: 'Goals',       href: '/goals',     icon: Target,          accentColor: '#e05c7a' },
  { id: 'fitness',   label: 'Fitness',     href: '/fitness',   icon: Dumbbell,        accentColor: '#d4a017' },
  { id: 'habits',    label: 'Skills & Habits', href: '/habits',  icon: Flame,           accentColor: '#f97316' },
  { id: 'gaming',    label: 'Gaming',      href: '/gaming',    icon: Gamepad2,        accentColor: '#8b5cf6' },
  { id: 'settings',  label: 'Settings',    href: '/settings',  icon: Settings,        accentColor: '#9ca3af' },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const username = useAppStore((s) => s.username);
  const profilePicture = useAppStore((s) => s.profilePicture);
  const logout = useAppStore((s) => s.logout);
  const isSyncing = useAppStore((s) => s.sync.isSyncing);
  const isOnline = useAppStore((s) => s.sync.isOnline);
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sidebarVariants = {
    expanded: { width: 220 },
    collapsed: { width: 64 },
  };

  return (
    <motion.aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
      variants={sidebarVariants}
      animate={collapsed ? 'collapsed' : 'expanded'}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <Link 
          href="/dashboard"
          className={`${styles.sidebarLogo} ${collapsed ? styles.clickableLogo : ''}`}
          title={collapsed ? 'Click to expand, double-click for Dashboard' : 'Lemisphere Dashboard'}
          onClick={(e) => {
            if (collapsed) {
              e.preventDefault();
              toggleSidebar();
            }
          }}
        >
          <div className={styles.sidebarLogoMark}>
            <img src="/logo.png?v=3" alt="Lemisphere Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                className={styles.sidebarLogoText}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                Lemisphere
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <AnimatePresence>
          {!collapsed && (
            <motion.button
              className={styles.sidebarToggle}
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Search trigger */}
      <div className={styles.sidebarSearch}>
        <button
          className={styles.sidebarSearchBtn}
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
          title="Search (⌘K)"
        >
          <Search size={13} strokeWidth={2} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ flex: 1, textAlign: 'left' }}
              >
                Search...
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && (
            <span className={styles.sidebarSearchShortcut}>
              <span className={styles.kbd}>⌘</span>
              <span className={styles.kbd}>K</span>
            </span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`${styles.sidebarNav} sidebar-scroll`}>
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarSectionLabel}>Modules</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.navItemIcon}>
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    color={isActive ? item.accentColor : undefined}
                  />
                </span>
                <span className={styles.navItemLabel}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Sync Indicator */}
      <div style={{ padding: '0 16px 12px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 500, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        {isSyncing ? (
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
            <RefreshCw size={14} color="var(--accent-violet)" />
          </motion.div>
        ) : isOnline ? (
          <Cloud size={14} />
        ) : (
          <CloudOff size={14} color="var(--status-error)" />
        )}
        {!collapsed && (
          <span>
            {isSyncing ? 'Syncing...' : isOnline ? 'Synced' : 'Offline'}
          </span>
        )}
      </div>

      {/* User footer */}
      <div className={styles.sidebarFooter} ref={userMenuRef}>
        <div 
          className={styles.sidebarUser} 
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <div className={styles.userAvatar} style={{ padding: 0, overflow: 'hidden' }}>
            {profilePicture ? (
              <img src={profilePicture} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              '😎'
            )}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                className={styles.userInfo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className={styles.userName}>{username ?? 'You'}</div>
                <div className={styles.userRole}>Personal OS</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {isUserMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                bottom: '20px',
                left: collapsed ? '76px' : '236px',
                width: '220px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                zIndex: 100,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                marginBottom: '8px'
              }}
            >
              <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', background: 'rgba(0, 0, 0, 0.02)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{username || 'You'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Personal OS</span>
                </div>
              </div>
              <div style={{ padding: '8px' }}>
                <Link href="/profile" onClick={() => setIsUserMenuOpen(false)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'background var(--transition-fast)'
                }}>
                  <span style={{ fontSize: '16px' }}>👤</span> Profile
                </Link>
                <Link href="/settings" onClick={() => setIsUserMenuOpen(false)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'background var(--transition-fast)'
                }}>
                  <Settings size={16} color="var(--text-secondary)" /> Settings
                </Link>
                <div style={{ height: '1px', background: 'var(--card-border)', margin: '4px 0' }} />
                <button onClick={() => { setIsUserMenuOpen(false); logout(); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--status-error)',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  transition: 'background var(--transition-fast)'
                }}>
                  <span style={{ fontSize: '16px' }}>🚪</span> Log Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

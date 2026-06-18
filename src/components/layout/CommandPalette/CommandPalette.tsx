'use client';

import { useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Target, Dumbbell, Flame,
  Bird, Gamepad2, BookOpen, Search,
  ArrowRight, Plus, Calendar, Scale,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import styles from './CommandPalette.module.css';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  shortcut?: string[];
  category: string;
  action: () => void;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const router = useRouter();

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === '/') {
        // Ignore slash if user is typing inside an input or textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setOpen]);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
    },
    [router, setOpen]
  );

  const COMMANDS: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Dashboard',     icon: LayoutDashboard, category: 'Navigate', action: () => navigate('/dashboard') },
    { id: 'nav-goals',     label: 'Goals',         icon: Target,          category: 'Navigate', action: () => navigate('/goals') },
    { id: 'nav-fitness',   label: 'Fitness',       icon: Dumbbell,        category: 'Navigate', action: () => navigate('/fitness') },
    { id: 'nav-habits',    label: 'Skills & Habits', icon: Flame,         category: 'Navigate', action: () => navigate('/habits') },
    { id: 'nav-gaming',    label: 'Gaming',        icon: Gamepad2,        category: 'Navigate', action: () => navigate('/gaming') },
    // Quick actions
    { id: 'new-workout',  label: 'Log Workout',     icon: Dumbbell,       category: 'Quick Add', description: 'Add a new workout session',      action: () => navigate('/fitness') },
    { id: 'new-game',     label: 'Add Game',         icon: Gamepad2,       category: 'Quick Add', description: 'Add a game to your backlog',     action: () => navigate('/gaming') },
    { id: 'new-goal',     label: 'Create Goal',      icon: Target,        category: 'Quick Add', description: 'Set a new goal',                 action: () => navigate('/goals') },
    { id: 'log-weight',   label: 'Log Weight',       icon: Scale,         category: 'Quick Add', description: 'Update body metrics',            action: () => navigate('/fitness') },
  ];

  // Dynamic User Data Search
  const games = useLiveQuery(() => db.games.toArray()) || [];
  const habits = useLiveQuery(() => db.habits.toArray()) || [];
  const skills = useLiveQuery(() => db.skills.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const programs = useLiveQuery(() => db.fitness_programs.toArray()) || [];

  games.forEach(g => {
    COMMANDS.push({ id: `game-${g.id}`, label: g.title, icon: Gamepad2, category: 'Games', description: 'Game', action: () => navigate('/gaming') });
  });
  habits.forEach(h => {
    COMMANDS.push({ id: `habit-${h.id}`, label: h.name, icon: Flame, category: 'Habits', description: 'Habit', action: () => navigate('/habits') });
  });
  skills.forEach(s => {
    COMMANDS.push({ id: `skill-${s.id}`, label: s.name, icon: Flame, category: 'Skills', description: 'Skill', action: () => navigate('/habits') });
  });
  goals.forEach(g => {
    COMMANDS.push({ id: `goal-${g.id}`, label: g.title, icon: Target, category: 'Goals', description: 'Goal', action: () => navigate('/goals') });
  });
  programs.forEach(p => {
    COMMANDS.push({ id: `prog-${p.id}`, label: p.name, icon: Dumbbell, category: 'Fitness', description: 'Workout Program', action: () => navigate('/fitness') });
  });

  const grouped = COMMANDS.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className={styles.dialog}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="Command Menu">
              {/* Input */}
              <div className={styles.inputWrapper}>
                <Search size={16} strokeWidth={2} className={styles.inputIcon} />
                <Command.Input
                  className={styles.input}
                  placeholder="Search modules, actions…"
                />
              </div>

              {/* List */}
              <Command.List className={styles.list}>
                <Command.Empty className={styles.empty}>
                  No results found.
                </Command.Empty>

                {Object.entries(grouped).map(([category, items]) => (
                  <Command.Group key={category} heading={category} className={styles.group}>
                    <div className={styles.groupHeading}>{category}</div>
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Command.Item
                          key={item.id}
                          value={item.id + ' ' + item.label}
                          onSelect={item.action}
                          className={styles.item}
                        >
                          <div className={styles.itemIcon}>
                            <Icon size={14} strokeWidth={2} />
                          </div>
                          <div className={styles.itemText}>
                            <div className={styles.itemLabel}>{item.label}</div>
                            {item.description && (
                              <div className={styles.itemDesc}>{item.description}</div>
                            )}
                          </div>
                          {item.shortcut && (
                            <div className={styles.itemShortcut}>
                              {item.shortcut.map((k) => (
                                <span key={k} className={styles.shortcutKey}>{k}</span>
                              ))}
                            </div>
                          )}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ))}
              </Command.List>

              {/* Footer */}
              <div className={styles.footer}>
                <div className={styles.footerHints}>
                  <span className={styles.footerHint}>
                    <kbd className={styles.shortcutKey}>↑↓</kbd> navigate
                  </span>
                  <span className={styles.footerHint}>
                    <kbd className={styles.shortcutKey}>↵</kbd> select
                  </span>
                  <span className={styles.footerHint}>
                    <kbd className={styles.shortcutKey}>Esc</kbd> close
                  </span>
                </div>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

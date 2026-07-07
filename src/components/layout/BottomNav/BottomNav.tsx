'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Target, Dumbbell, Flame, Gamepad2 } from 'lucide-react';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home',    accentColor: '#8b5cf6' },
  { href: '/goals',     icon: Target,          label: 'Goals',   accentColor: '#e05c7a' },
  { href: '/fitness',   icon: Dumbbell,        label: 'Fitness', accentColor: '#d4a017' },
  { href: '/habits',    icon: Flame,           label: 'Skills',  accentColor: '#f97316' },
  { href: '/gaming',    icon: Gamepad2,        label: 'Gaming',  accentColor: '#8b5cf6' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav} aria-label="Main navigation">
      {NAV_ITEMS.map(({ href, icon: Icon, label, accentColor }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className={styles.iconWrap}
              style={isActive ? { color: accentColor, background: `${accentColor}18` } : {}}
            >
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

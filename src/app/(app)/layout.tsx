import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/Sidebar/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav/BottomNav';
import { CommandPalette } from '@/components/layout/CommandPalette/CommandPalette';
import { AppShellClient } from './AppShellClient';

export const metadata: Metadata = {
  title: 'Lemisphere',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <BottomNav />
      <CommandPalette />
      <AppShellClient>{children}</AppShellClient>
    </>
  );
}


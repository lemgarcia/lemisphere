import type { Metadata } from 'next';
import { HabitsPage } from './HabitsPage';

export const metadata: Metadata = { title: 'Skills & Habits' };
export default function Page() { return <HabitsPage />; }

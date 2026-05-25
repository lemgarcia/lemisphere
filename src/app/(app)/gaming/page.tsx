import type { Metadata } from 'next';
import { GamingPage } from './GamingPage';

export const metadata: Metadata = { title: 'Gaming' };
export default function Page() { return <GamingPage />; }

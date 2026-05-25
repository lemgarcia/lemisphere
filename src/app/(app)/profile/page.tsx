import type { Metadata } from 'next';
import { ProfilePage } from './ProfilePage';

export const metadata: Metadata = { title: 'Profile | Lemisphere' };
export default function Page() { return <ProfilePage />; }

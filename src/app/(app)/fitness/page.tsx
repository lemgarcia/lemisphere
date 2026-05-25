import type { Metadata } from 'next';
import { FitnessPage } from './FitnessPage';

export const metadata: Metadata = { title: 'Fitness' };
export default function Page() { return <FitnessPage />; }

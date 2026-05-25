import type { Metadata } from 'next';
import { BudgiePage } from './BudgiePage';

export const metadata: Metadata = { title: 'Budgie Care' };
export default function Page() { return <BudgiePage />; }

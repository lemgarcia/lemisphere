import { db } from '@/lib/db';
import { format, subDays } from 'date-fns';

let lastProcessedDay = '';

export async function processDailyResets(userId: string) {
  if (!userId) return;
  
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Prevent running multiple times on the same day
  if (lastProcessedDay === todayStr) return;

  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

  // 1. Re-evaluate Habit Streaks
  // Ensure that skipped days accurately break the streak, accounting for custom frequency days
  const { recalculateHabitStreak } = await import('@/utils/habitUtils');
  const habits = await db.habits.filter(h => h.is_active && h.user_id === userId).toArray();
  for (const habit of habits) {
    await recalculateHabitStreak(habit.id, userId);
  }

  lastProcessedDay = todayStr;
}

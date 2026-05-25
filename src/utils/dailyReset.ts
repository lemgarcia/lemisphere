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

  // 1. Reset Habit Streaks
  // If a habit has a streak > 0, but no completion yesterday AND no completion today,
  // then the streak is officially broken.
  const habits = await db.habits.filter(h => h.is_active && h.user_id === userId).toArray();
  for (const habit of habits) {
    if (habit.streak_current && habit.streak_current > 0) {
      const recentCompletions = await db.habit_completions
        .where('habit_id').equals(habit.id)
        .filter(c => c.date === yesterdayStr || c.date === todayStr)
        .toArray();
      
      if (recentCompletions.length === 0) {
        // Streak broken
        await db.habits.update(habit.id, { 
          streak_current: 0,
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  lastProcessedDay = todayStr;
}

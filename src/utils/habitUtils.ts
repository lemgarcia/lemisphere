import { db } from '@/lib/db';

export async function recalculateHabitStreak(habitId: string, userId: string) {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  const allComps = await db.habit_completions.where('habit_id').equals(habit.id).filter(x => x.user_id === userId).toArray();
  const completedDates = new Set(allComps.map(c => c.date));

  const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  let currentStreak = 0;
  let bestStreak = habit.streak_best || 0;

  let currDate = new Date(todayStr + 'T12:00:00Z');
  let iterations = 0;
  const MAX_LOOKBACK = 3650; // 10 years max

  while (iterations < MAX_LOOKBACK) {
    iterations++;
    const iterDateStr = currDate.toISOString().split('T')[0];
    const dayOfWeek = currDate.getUTCDay();

    let isActiveDay = true;
    if (habit.frequency === 'custom' && habit.frequency_days) {
      isActiveDay = habit.frequency_days.includes(dayOfWeek);
    }

    if (completedDates.has(iterDateStr)) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      // Missed an active day — streak ends here (unless it's today, we still have time)
      if (isActiveDay && iterDateStr !== todayStr) {
        break;
      }
    }

    currDate.setUTCDate(currDate.getUTCDate() - 1);
  }

  await db.habits.update(habit.id, { 
    streak_current: currentStreak, 
    streak_best: bestStreak,
    updated_at: new Date().toISOString(),
    sync_status: 'pending'
  });
}

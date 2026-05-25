import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAppStore } from '@/stores/appStore';
import { processDailyResets } from '@/utils/dailyReset';

export function useCurrentDay() {
  const [todayStr, setTodayStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const userId = useAppStore(s => s.userId);

  useEffect(() => {
    // Process on mount
    if (userId) {
      processDailyResets(userId);
    }

    // Check periodically for day rollover
    const timer = setInterval(() => {
      const current = format(new Date(), 'yyyy-MM-dd');
      if (current !== todayStr) {
        setTodayStr(current);
        if (userId) {
          processDailyResets(userId);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(timer);
  }, [todayStr, userId]);

  return todayStr;
}

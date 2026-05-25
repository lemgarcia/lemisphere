import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { db } from '@/lib/db';
import { syncManager } from '@/lib/sync/SyncManager';
import { useAppStore } from '@/stores/appStore';

export interface FoodRotationItem {
  id: string;
  day: string;
  mainFood: string;
  morningVeggies: string;
  fruitSnacks: string;
}

export interface DailyRoutineItem {
  id: string;
  time: string;
  routine: string;
  description: string;
}

interface BudgieState {
  activeTab: 'profiles' | 'care' | 'training';
  selectedBirdId: string | null;
  foodRotation: FoodRotationItem[];
  dailyRoutine: DailyRoutineItem[];
}

const pushBudgiePreferencesToDexie = async (state: BudgieState) => {
  const userId = useAppStore.getState().userId;
  if (!userId) return;
  
  const existing = await db.user_preferences.get(userId);
  const prefs = {
    ...existing,
    id: userId,
    user_id: userId,
    budgie_food_rotation: state.foodRotation,
    budgie_daily_routine: state.dailyRoutine,
    sync_status: 'pending',
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: (existing?.version || 0) + 1,
    device_id: existing?.device_id || 'browser'
  };

  await db.user_preferences.put(prefs as any);
  syncManager.queueSync('budgie');
};

interface BudgieActions {
  setActiveTab: (tab: BudgieState['activeTab']) => void;
  setSelectedBirdId: (id: string | null) => void;
  setFoodRotation: (data: FoodRotationItem[]) => void;
  setDailyRoutine: (data: DailyRoutineItem[]) => void;
}

export const useBudgieStore = create<BudgieState & BudgieActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        activeTab: 'profiles',
        selectedBirdId: null,
        foodRotation: [],
        dailyRoutine: [],
        
        setActiveTab: (tab) => set((state) => { state.activeTab = tab; }),
        setSelectedBirdId: (id) => set((state) => { state.selectedBirdId = id; }),
        setFoodRotation: (data) => {
          set((state) => { state.foodRotation = data; });
          pushBudgiePreferencesToDexie(get());
        },
        setDailyRoutine: (data) => {
          set((state) => { state.dailyRoutine = data; });
          pushBudgiePreferencesToDexie(get());
        },
      })),
      { name: 'lemisphere-budgie-store' }
    ),
    { name: 'BudgieStore' }
  )
);

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

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

interface BudgieActions {
  setActiveTab: (tab: BudgieState['activeTab']) => void;
  setSelectedBirdId: (id: string | null) => void;
  setFoodRotation: (data: FoodRotationItem[]) => void;
  setDailyRoutine: (data: DailyRoutineItem[]) => void;
}

export const useBudgieStore = create<BudgieState & BudgieActions>()(
  devtools(
    persist(
      immer((set) => ({
        activeTab: 'profiles',
        selectedBirdId: null,
        foodRotation: [],
        dailyRoutine: [],
        
        setActiveTab: (tab) => set((state) => { state.activeTab = tab; }),
        setSelectedBirdId: (id) => set((state) => { state.selectedBirdId = id; }),
        setFoodRotation: (data) => set((state) => { state.foodRotation = data; }),
        setDailyRoutine: (data) => set((state) => { state.dailyRoutine = data; }),
      })),
      { name: 'lemisphere-budgie-store' }
    ),
    { name: 'BudgieStore' }
  )
);

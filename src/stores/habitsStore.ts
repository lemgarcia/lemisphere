import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface HabitsState {
  activeTab: 'overview' | 'habits' | 'skills';
  showCompleted: boolean;
  selectedHabitId: string | null;
  selectedSkillId: string | null;
}

interface HabitsActions {
  setActiveTab: (tab: 'overview' | 'habits' | 'skills') => void;
  setShowCompleted: (show: boolean) => void;
  setSelectedHabitId: (id: string | null) => void;
  setSelectedSkillId: (id: string | null) => void;
}

export const useHabitsStore = create<HabitsState & HabitsActions>()(
  devtools(
    persist(
      immer((set) => ({
        activeTab: 'overview',
        showCompleted: true,
        selectedHabitId: null,
        selectedSkillId: null,
        
        setActiveTab: (tab) => set((state) => { state.activeTab = tab; }),
        setShowCompleted: (show) => set((state) => { state.showCompleted = show; }),
        setSelectedHabitId: (id) => set((state) => { state.selectedHabitId = id; }),
        setSelectedSkillId: (id) => set((state) => { state.selectedSkillId = id; }),
      })),
      { name: 'lemisphere-habits-store' }
    ),
    { name: 'HabitsStore' }
  )
);

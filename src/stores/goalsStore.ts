import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface GoalsState {
  activeView: 'active' | 'completed' | 'all';
  filterCategory: string | 'all';
}

interface GoalsActions {
  setActiveView: (view: GoalsState['activeView']) => void;
  setFilterCategory: (category: string) => void;
}

export const useGoalsStore = create<GoalsState & GoalsActions>()(
  devtools(
    persist(
      immer((set) => ({
        activeView: 'active',
        filterCategory: 'all',
        
        setActiveView: (view) => set((state) => { state.activeView = view; }),
        setFilterCategory: (category) => set((state) => { state.filterCategory = category; }),
      })),
      { name: 'lemisphere-goals-store' }
    ),
    { name: 'GoalsStore' }
  )
);

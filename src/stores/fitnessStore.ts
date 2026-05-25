import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface FitnessState {
  activeTab: 'programs' | 'workouts' | 'stats';
  selectedDate: string;
  // Timer State
  timerActive: boolean;
  timerRemainingSec: number;
  timerTotalSec: number;
  timerFinished: boolean;
  timerDayId: string | null;
}

interface FitnessActions {
  setActiveTab: (tab: FitnessState['activeTab']) => void;
  setSelectedDate: (date: string) => void;
  startTimer: (seconds: number, dayId: string) => void;
  stopTimer: () => void;
  tickTimer: () => void;
  dismissTimerFinished: () => void;
}

export const useFitnessStore = create<FitnessState & FitnessActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        activeTab: 'workouts',
        selectedDate: new Date().toISOString().split('T')[0],
        timerActive: false,
        timerRemainingSec: 0,
        timerTotalSec: 0,
        timerFinished: false,
        timerDayId: null,
        
        setActiveTab: (tab) => set((state) => { state.activeTab = tab; }),
        setSelectedDate: (date) => set((state) => { state.selectedDate = date; }),
        
        startTimer: (seconds, dayId) => set((state) => {
          state.timerActive = true;
          state.timerRemainingSec = seconds;
          state.timerTotalSec = seconds;
          state.timerFinished = false;
          state.timerDayId = dayId;
        }),
        stopTimer: () => set((state) => {
          state.timerActive = false;
          state.timerRemainingSec = 0;
          state.timerTotalSec = 0;
          state.timerFinished = false;
          state.timerDayId = null;
        }),
        tickTimer: () => set((state) => {
          if (!state.timerActive) return;
          if (state.timerRemainingSec > 1) {
            state.timerRemainingSec -= 1;
          } else {
            state.timerActive = false;
            state.timerRemainingSec = 0;
            state.timerFinished = true;
          }
        }),
        dismissTimerFinished: () => set((state) => {
          state.timerFinished = false;
        }),
      })),
      { 
        name: 'lemisphere-fitness-store',
        partialize: (state) => ({ activeTab: state.activeTab, selectedDate: state.selectedDate })
      }
    ),
    { name: 'FitnessStore' }
  )
);

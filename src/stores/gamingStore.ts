import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type GamingTab = 'library' | 'series' | 'gp' | 'game_details';

interface GamingState {
  activeTab: GamingTab;
  searchQuery: string;
  sortBy: 'title' | 'hours_played' | 'release_year' | 'personal_rating';
  selectedSeriesId: string | null;
  selectedGameId: string | null;
}

interface GamingActions {
  setActiveTab: (tab: GamingTab) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: GamingState['sortBy']) => void;
  setSelectedSeriesId: (id: string | null) => void;
  setSelectedGameId: (id: string | null) => void;
}

export const useGamingStore = create<GamingState & GamingActions>()(
  devtools(
    persist(
      immer((set) => ({
        activeTab: 'library',
        searchQuery: '',
        sortBy: 'title',
        selectedSeriesId: null,
        selectedGameId: null,
        
        setActiveTab: (tab) => set((state) => { state.activeTab = tab; }),
        setSearchQuery: (query) => set((state) => { state.searchQuery = query; }),
        setSortBy: (sort) => set((state) => { state.sortBy = sort; }),
        setSelectedSeriesId: (id) => set((state) => { state.selectedSeriesId = id; }),
        setSelectedGameId: (id) => set((state) => { state.selectedGameId = id; }),
      })),
      { 
        name: 'lemisphere-gaming-store',
        partialize: (state) => ({ activeTab: state.activeTab }),
      }
    ),
    { name: 'GamingStore' }
  )
);

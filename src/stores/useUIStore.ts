import { create } from 'zustand';

interface UIState {
  selectedEventId: string | null;
  selectedBoothId: string | null;
  isAddModalOpen: boolean;
  isEditMode: boolean;
  setSelectedEventId: (id: string | null) => void;
  setSelectedBoothId: (id: string | null) => void;
  openAddModal: () => void;
  closeAddModal: () => void;
  setEditMode: (isEdit: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedEventId: null,
  selectedBoothId: null,
  isAddModalOpen: false,
  isEditMode: false,
  setSelectedEventId: (id) => set({ selectedEventId: id }),
  setSelectedBoothId: (id) => set({ selectedBoothId: id }),
  openAddModal: () => set({ isAddModalOpen: true }),
  closeAddModal: () => set({ isAddModalOpen: false }),
  setEditMode: (isEdit) => set({ isEditMode: isEdit }),
}));

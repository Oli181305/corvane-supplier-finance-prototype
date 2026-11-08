import { create } from 'zustand';

export type Toast = { id: number; title: string; detail?: string; link?: { to: string; label: string }; kind?: 'success' | 'info' | 'error' };

type ToastStore = {
  toasts: Toast[];
  show: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
};

let n = 0;
export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (t) => {
    n += 1;
    const id = n;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 9000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(title: string, detail?: string, link?: Toast['link'], kind: Toast['kind'] = 'success') {
  useToast.getState().show({ title, detail, link, kind });
}

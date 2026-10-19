import { defineStore } from 'pinia';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast { id: number; kind: ToastKind; title: string; text?: string; }

let seq = 0;

/** Notifications transitoires (confirmations d’action, erreurs d’API). */
export const useToastStore = defineStore('toasts', {
  state: () => ({ items: [] as Toast[] }),
  actions: {
    push(kind: ToastKind, title: string, text?: string, ttl = 6000): number {
      const id = ++seq;
      this.items.push({ id, kind, title, text });
      if (ttl > 0) window.setTimeout(() => this.dismiss(id), ttl);
      return id;
    },
    info(title: string, text?: string) { return this.push('info', title, text); },
    ok(title: string, text?: string) { return this.push('success', title, text); },
    warn(title: string, text?: string) { return this.push('warning', title, text); },
    fail(title: string, text?: string) { return this.push('error', title, text, 9000); },
    dismiss(id: number): void {
      this.items = this.items.filter((t) => t.id !== id);
    },
  },
});

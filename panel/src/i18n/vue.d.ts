import type { t } from './index';

// $t est disponible dans tous les gabarits (voir main.ts).
declare module 'vue' {
  interface ComponentCustomProperties {
    $t: typeof t;
  }
}

export {};

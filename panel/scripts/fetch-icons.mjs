// Regenere src/components/icons.generated.ts depuis Google Fonts.
// Usage : node scripts/fetch-icons.mjs
import { writeFile } from 'node:fs/promises';

const MAP = {
  grid: 'dashboard', map: 'map', activity: 'monitoring', leaf: 'eco',
  coins: 'payments', landmark: 'account_balance', user: 'person', users: 'group',
  shield: 'admin_panel_settings', server: 'dns', terminal: 'terminal',
  message: 'forum', file: 'description', download: 'download', settings: 'settings',
  copy: 'content_copy', link: 'open_in_new', chevron: 'chevron_right', menu: 'menu',
  close: 'close', refresh: 'refresh', search: 'search', play: 'play_arrow',
  pause: 'pause', clock: 'schedule', alert: 'warning', check: 'check', send: 'send',
  globe: 'language', layers: 'layers', fullscreen: 'fullscreen',
  fullscreen_exit: 'fullscreen_exit', logout: 'logout', info: 'info',
  visibility: 'visibility', visibility_off: 'visibility_off', campaign: 'campaign',
  add: 'add', delete: 'delete', edit: 'edit', save: 'save', empty: 'inbox',
  sort: 'swap_vert', filter: 'filter_alt', chart: 'show_chart', public: 'public',
  lock: 'lock', schedule_send: 'schedule_send',
  gavel: 'gavel', book: 'menu_book', calculate: 'calculate',
  upload: 'upload', up: 'keyboard_arrow_up', down: 'keyboard_arrow_down',
};

const url = (n) =>
  `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${n}/default/24px.svg`;

const entries = [];
for (const [key, symbol] of Object.entries(MAP)) {
  const svg = await fetch(url(symbol)).then((r) => r.text());
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length === 0) throw new Error(`icone introuvable : ${symbol}`);
  entries.push([key, symbol, paths.join(' ')]);
}
entries.sort((a, b) => a[0].localeCompare(b[0]));

const body = entries.map(([k, s, d]) => `  /* ${s} */ ${k}: '${d}',`).join('\n');
console.log(`${entries.length} icones recuperees ; recopiez le bloc dans icons.generated.ts`);
await writeFile('scripts/icons-block.txt', body, 'utf8');

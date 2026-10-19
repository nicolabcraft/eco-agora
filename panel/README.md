# Eco Agora : panel web

Panel Vue 3 + Vite pour serveur Eco 0.14.2.1 : espace citoyen public (carte 3D,
statistiques, écologie, marché, économie, gouvernance, règlement, wiki) et espace
d'administration (santé, joueurs, console, chat, annonces, journal, exports,
personnalisation, configuration).

Construction, développement et paquet : voir `../README.md`.
Installation sur un serveur : voir `../INSTALLATION.md`.

| | |
|---|---|
| Personnalisation (schéma, défauts) | `src/site/schema.ts`, store `src/stores/site.ts` |
| Page d'administration | `src/pages/admin/SitePage.vue` |
| Couleurs, typographie | `src/styles/tokens.css` (accent : `--primary-rgb`, remplacé au chargement) |
| Logo par défaut | `brand/logo-source.png` → `public/brand/` (`node scripts/build-logos.mjs`) |
| Icônes | `scripts/fetch-icons.mjs` → `src/components/icons.generated.ts` |

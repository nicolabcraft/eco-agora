# Changelog

## 1.1.0 (2026-10-19)

### Français

**Nouveautés**
- Panel disponible en **français et en anglais**. Chaque visiteur choisit sa langue en haut de la page ; la langue par défaut se règle dans *Personnalisation › Identité*.
- Tous les textes sont dans `WebClient/WebBin/lang/*.json` : corrigez un texte ou ajoutez une langue **sans recompiler** (copiez `en.json`, traduisez, ajoutez une ligne dans `lang/langues.json`). Une clé absente s'affiche en français.
- Dates et nombres au format de la langue choisie.
- **Compatibilité avec les autres mods** : l'installation range l'interface d'origine d'Eco dans `legacy/`. Elle reste accessible à `/legacy/`, avec un lien dans le menu d'administration, pour les mods qui s'y intègrent.

**Améliorations**
- Vrais pluriels pour plusieurs compteurs (« 1 transaction », « 3 transactions »).
- Les en-têtes des exports CSV suivent la langue choisie.

**Corrections**
- Page Annonces : le chemin `WebBin\annonces.json` s'affichait avec un caractère de contrôle invisible.

**Mise à jour depuis 1.0.0** : copiez le contenu de l'archive par-dessus l'installation existante. Si vous avez modifié des fichiers dans `lang/`, gardez-en une copie avant.

### English

**New**
- Panel available in **French and English**. Each visitor picks a language at the top of the page; the default language is set in *Personnalisation › Identité*.
- Every text lives in `WebClient/WebBin/lang/*.json`: change any wording or add a language **without rebuilding** (copy `en.json`, translate it, add one line to `lang/langues.json`). Missing keys fall back to French.
- Dates and numbers follow the chosen language.
- **Compatibility with other mods**: the install moves Eco's original interface to `legacy/`. It stays reachable at `/legacy/`, with a link in the admin menu, for mods that integrate into it.

**Improved**
- Proper plurals for several counters.
- CSV export headers follow the chosen language.

**Fixed**
- Announcements page: the `WebBin\annonces.json` path was shown with an invisible control character.

**Updating from 1.0.0**: copy the archive content over your existing install. If you edited files in `lang/`, keep a copy first.

## 1.0.0 (2026-10-19)

Première version publique / first public release.

- Espace citoyen : tableau de bord, carte du monde en 3D, statistiques, écologie, économie, marché, gouvernance, règlement, wiki, Eco Gnome, annonces.
- Administration : santé du serveur, joueurs et modération, console, chat, annonces, journal d'activité, ventes des boutiques, exports, configuration.
- Personnalisation sans recompiler : nom, logo, couleur, bouton « Rejoindre », liens, règlement, rideau d'ouverture ; salle d'attente en jeu facultative.
- Mod serveur `EcoAgoraMod.dll` (API `/api/agora`), compilé contre l'EcoModKit d'Eco 0.14.2.1.

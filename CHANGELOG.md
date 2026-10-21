# Changelog

## 1.2.0 (2026-10-21)

### Français

**Nouveautés**
- **Messages en jeu traduits** : les annonces de la salle d'attente et de l'ouverture, ainsi que les descriptions des réglages du mod, sont traduites par Eco dans la langue de chaque joueur, grâce à `Mods/Translations/EcoAgora.csv` (fourni en français).
- **Projet ouvert aux contributions** : guide de contribution (code et traductions), modèles d'issues (bug, idée, traduction), intégration continue GitHub (compilation, vérification des traductions et des types, paquet de test) et releases automatiques à chaque tag.
- Compilation sans serveur Eco : les assemblies d'Eco viennent du paquet NuGet officiel `Eco.ReferenceAssemblies`.
- Vérificateur des traductions du panel (`npm run locales:check`) ; la liste des langues vit dans `panel/locales/langues.json`.

**Changements**
- Le message de bienvenue de la salle d'attente affiche la date d'ouverture au format `2026-09-30 19:00 (UTC+02:00)`, lisible dans toutes les langues.

**Mise à jour depuis 1.1.0** : copiez l'archive par-dessus l'installation existante (elle ajoute `Mods/Translations/EcoAgora.csv`), puis redémarrez le serveur.

### English

**New**
- **Translated in-game messages**: waiting room and opening announcements, plus the mod's setting descriptions, are translated by Eco into each player's language through `Mods/Translations/EcoAgora.csv` (French included).
- **Open to contributions**: contributing guide (code and translations), issue templates (bug, idea, translation), GitHub CI (build, translation and type checks, test package) and automatic releases on every tag.
- Build without an Eco server: Eco assemblies come from the official `Eco.ReferenceAssemblies` NuGet package.
- Panel translation checker (`npm run locales:check`); the language list lives in `panel/locales/langues.json`.

**Changed**
- The waiting room welcome message shows the opening date as `2026-09-30 19:00 (UTC+02:00)`, readable in every language.

**Updating from 1.1.0**: copy the archive over your existing install (it adds `Mods/Translations/EcoAgora.csv`), then restart the server.

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

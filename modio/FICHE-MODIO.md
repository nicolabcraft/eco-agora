# Fiche mod.io : Eco Agora 1.1.0

À copier dans le formulaire mod.io (jeu : **Eco**). La description est dans
`description.html` : à coller en mode code source de l'éditeur (bouton `<>`).

## Champs

| Champ | Valeur |
|---|---|
| Nom | **Eco Agora : panel web pour serveur** |
| URL (name_id) | `eco-agora` |
| Logo | `logo.png` (1920×1080, 16:9) |
| Galerie | `galerie-01.png` à `galerie-07.png` (1920×1080), dans l'ordre |
| Fichier | `../eco-agora-1.1.0.zip` |
| Version | `1.1.0` |
| Notes de version | Panel en français et en anglais, textes modifiables dans `lang/`, lien vers l’interface d’origine d’Eco. |
| Compatibilité | Eco 0.14.2.1 |
| Tags | Server, Web, UI, Admin, Statistics, Map (ceux proposés par mod.io pour Eco qui s'en rapprochent) |
| Licence | Autre / personnalisée : **PolyForm Noncommercial 1.0.0** (gratuit, réutilisable, pas d'usage commercial) |
| Visibilité | Publique |
| Prix | Gratuit |

### Résumé (250 caractères max)

> Remplacez le site web de votre serveur Eco par un panel complet : carte 3D, statistiques, écologie, économie, gouvernance, règlement, annonces et administration. Personnalisable depuis le panel. Gratuit, non commercial.

(212 caractères)

### Résumé anglais (si le formulaire le demande)

> Replace your Eco server's website with a full panel: 3D map, statistics, ecology, economy, civics, rules, announcements and admin tools. Customisable from the panel itself. Free, non-commercial.

## Légendes de la galerie

| Image | Légende |
|---|---|
| galerie-01 | Tableau de bord : astéroïde, population, climat |
| galerie-02 | Carte du monde en 3D, calques et historique |
| galerie-03 | Statistiques superposables et exportables |
| galerie-04 | Écologie et climat |
| galerie-05 | Règlement rédigé depuis le panel |
| galerie-06 | Personnalisation sans recompiler |
| galerie-07 | Espace d'administration |

## À savoir avant de publier

- **Installation par abonnement mod.io** : le serveur extrait le mod dans
  `Mods/UserCode/mod.io/…`. La DLL y est bien chargée, mais **le panel web doit
  être copié à la main** dans `WebClient/WebBin/` (étape 1 d'INSTALLATION.md).
  La description le dit clairement.
- **Moteur de carte** : adapté du client web d'Eco (Strange Loop Games), voir
  `NOTICE.md`. Si Strange Loop Games ou mod.io le demandent, la carte devra être
  retirée ou réécrite.

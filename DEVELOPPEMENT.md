# Eco Agora : développement

Panel web et mod serveur pour **Eco** (Strange Loop Games), version 0.14.2.1.
Interface en français, configurable depuis le panel lui-même : nom, couleur,
logo, liens, règlement, rideau d'ouverture.

- Installer le paquet sur un serveur : [INSTALLATION.md](INSTALLATION.md)
  ([English](INSTALL.en.md)).
- Ce fichier : construire le paquet depuis les sources.

```
mod/     mod serveur C# (EcoAgoraMod.dll) : API /api/agora, journal, relevés
panel/   panel Vue 3 + Vite, servi par le serveur Eco depuis WebClient/WebBin
```

## Prérequis

- SDK .NET 10 (même cible que le serveur Eco 0.14).
- Node.js 20 ou plus.
- C'est tout : **aucun serveur Eco n'est nécessaire pour compiler**. Les
  assemblies d'Eco viennent du paquet NuGet officiel `Eco.ReferenceAssemblies`
  (version fixée dans `mod/EcoAgoraMod.csproj`, propriété `EcoVersion`). Un
  serveur local reste utile pour tester.

## Construire

```bash
# 1. le mod
cd mod
dotnet build -c Release
#   autre version d'Eco : -p:EcoVersion=<version NuGet d'Eco.ReferenceAssemblies>

# 2. le panel + le paquet
cd ../panel
npm install
npm run package      # build dans dist/, puis release/ et eco-agora-<version>.zip
```

`npm run package` assemble `release/` (panel, `Mods/EcoAgora/EcoAgoraMod.dll`,
`Mods/Translations/EcoAgora.csv`, guides d'installation, licence) et l'archive
`eco-agora-<version>.zip`.

## Traductions

- Panel : `panel/locales/<langue>/*.json`, vérifiées par `npm run locales:check`
  (voir [CONTRIBUTING.md](CONTRIBUTING.md#traduire)).
- Textes en jeu du mod : sources en anglais dans le code, traductions dans
  `mod/translations/EcoAgora.csv` (format `Mods/Translations` d'Eco). Après un
  ajout de texte : `cd mod && node tools/eco-translations.mjs extract translations/EcoAgora.csv src`.

## Intégration continue

- `.github/workflows/ci.yml` : à chaque push et pull request, compile le mod,
  vérifie les traductions et les types, construit le panel et publie un paquet
  de test (artefact de l'onglet *Actions*).
- `.github/workflows/release.yml` : à chaque tag `v*`, fabrique le paquet et
  publie la release GitHub :
  ```bash
  git tag v1.2.0 && git push origin v1.2.0
  ```
  Pensez à mettre à jour `CHANGELOG.md` et la version de `panel/package.json`.

Organisation des branches (`main`, `dev`, `feature/…`) et publication d'une
version : voir [CONTRIBUTING.md](CONTRIBUTING.md#branches-et-versions).

## Développer

```bash
cd panel
npm run dev          # http://localhost:5180, proxy vers le serveur Eco sur :3001
ECO_DEV_TARGET=http://mon-serveur:3001 npm run dev   # contre un autre serveur
npm run typecheck
```

Construire directement dans un serveur (sans paquet) :

```bash
ECO_SERVER_DIR="D:/MonServeurEco" npm run build     # panel dans WebClient/WebBin
node ../mod/tools/deploy.mjs "D:/MonServeurEco"     # mod dans Mods/EcoAgora
```

Le webroot d'un serveur n'est jamais vidé : le panel s'appuie sur les fichiers
d'origine d'Eco (`Layers/`, `images/`, `i18n/`…). Les anciens fragments
`assets/` sont gardés trois jours pour les onglets restés ouverts.

## Personnalisation

Le schéma vit dans `panel/src/site/schema.ts` : types, valeurs par défaut, et
fusion tolérante (un champ absent ou mal typé retombe sur son défaut, ce qui
permet d'ajouter des réglages sans migration). Le mod ne fait que garder
l'objet (`GET`/`PUT /api/agora/site`, fichier `data/site.json`).

Pour ajouter un réglage : un champ dans `SiteConfig` et `SITE_DEFAUT`, un
champ dans `pages/admin/SitePage.vue`, et sa lecture via `useSiteStore()`.

## Licence

**PolyForm Noncommercial 1.0.0** (`LICENSE.md`) : gratuit, code ouvert,
modifiable et réutilisable, mais **aucun usage commercial** : ni vente, ni
vente d'une version modifiée. Mentions et exceptions (moteur de carte de
Strange Loop Games, three.js, icônes) : `NOTICE.md`.

# Contribuer à Eco Agora

Merci de votre aide ! Corrections, nouvelles fonctions, traductions : tout est
bienvenu. *[English below](#english)*

## Signaler un problème ou proposer une idée

Ouvrez une [issue](../../issues/new/choose) avec le modèle qui correspond (bug,
idée, traduction). Pour un bug, indiquez la version d'Eco et d'Eco Agora, ce que
vous avez fait, ce que vous attendiez et ce qui s'est passé.

## Traduire

Il y a deux sortes de textes, chacun dans des fichiers simples à modifier.

### Le panel web (`panel/locales/`)

- Un dossier par langue : `panel/locales/fr/` (référence), `panel/locales/en/`…
- Chaque fichier `<domaine>.json` regroupe les textes d'une page ou d'un composant.
- **Ajouter une langue** :
  1. copiez `panel/locales/en/` en `panel/locales/<code>/` (par exemple `de`) ;
  2. traduisez les **valeurs**, jamais les clés ;
  3. ajoutez la langue dans `panel/locales/langues.json` :
     `{ "code": "de", "nom": "Deutsch", "intl": "de-DE" }`.
- Gardez les paramètres tels quels : `{nom}`, `{n}`. Pour un pluriel, la valeur
  est de la forme `"un objet | {n} objets"` (singulier | pluriel).
- Une langue peut être partielle : les textes manquants s'affichent en français.
- Vérifiez avant d'envoyer : `cd panel && npm run locales:check`.

### Les textes en jeu (`mod/translations/EcoAgora.csv`)

Messages envoyés aux joueurs par le mod (salle d'attente, ouverture) et
descriptions des réglages. Fichier au format d'Eco : une colonne `English`
(la référence, à ne pas modifier) et une colonne par langue, au nom exact
d'Eco : `French`, `German`, `Spanish`, `Italian`, `Portuguese`,
`BrazilianPortuguese`, `Russian`, `Polish`, `Dutch`, `Turkish`, `Japanese`,
`Korean`, `SimplifedChinese`…

- **Ajouter une langue** : ajoutez une colonne avec son nom, puis traduisez
  chaque ligne. Gardez les marqueurs `{0}`, `{1:00}`… à l'identique.
- Un tableur convient (LibreOffice, Excel) : enregistrez en CSV UTF-8, virgule
  comme séparateur, guillemets autour des textes.
- Vérifiez : `cd mod && node tools/eco-translations.mjs check translations/EcoAgora.csv src`.

Vous pouvez aussi simplement ouvrir une issue « Traduction » avec vos textes :
nous les intégrerons.

## Branches et versions

| Branche | Rôle |
|---|---|
| `main` | **Versions publiées** uniquement. Chaque version y porte un tag `vX.Y.Z`, qui déclenche la release automatique. On n'y pousse jamais directement. |
| `dev` | **Intégration** : la prochaine version en préparation. Toutes les pull requests visent `dev`. |
| `feature/<sujet>` | Une **nouvelle fonction**, partie de `dev` (ex. `feature/traduction-allemand`). |
| `fix/<sujet>` | Une **correction**, partie de `dev` (ex. `fix/rideau-date`). |

Travailler sur une fonction :

```bash
git checkout dev && git pull
git checkout -b feature/mon-sujet
# ... modifications, commits ...
git push -u origin feature/mon-sujet
# puis pull request vers dev
```

La CI vérifie chaque pull request et chaque push sur `main` et `dev`, et fournit
un paquet de test dans l'onglet *Actions*.

Publier une version (mainteneurs) :

1. mettre à jour `CHANGELOG.md` et le numéro de version (`panel/package.json`, `mod/src/AgoraPlugin.cs`, `mod/EcoAgoraMod.csproj`) sur `dev` ;
2. pull request `dev` → `main`, puis fusion ;
3. tag sur `main` : `git tag vX.Y.Z && git push origin vX.Y.Z` ; le workflow
   *Release* fabrique l'archive et publie la release.

Une correction urgente peut partir de `main` (`fix/…`), puis être fusionnée dans
`main` **et** `dev`.

## Proposer du code

1. Forkez le dépôt et créez une branche `feature/…` ou `fix/…` à partir de `dev`.
2. Installez les outils : .NET 10 SDK et Node.js 20 ou plus. **Aucun serveur
   Eco n'est nécessaire pour compiler** : les assemblies d'Eco viennent du paquet
   NuGet officiel `Eco.ReferenceAssemblies`.
3. Voir [DEVELOPPEMENT.md](DEVELOPPEMENT.md) pour compiler, lancer et tester.
4. Avant d'envoyer :
   ```bash
   cd mod && dotnet build -c Release
   cd ../panel && npm run locales:check && npx vue-tsc --noEmit && npm run build
   ```
5. Ouvrez une pull request **vers `dev`** : la CI refait ces vérifications et fabrique un
   paquet de test, téléchargeable depuis l'onglet *Actions*.

### Règles

- Tout texte affiché va dans les fichiers de traduction, jamais en dur dans le
  code : `$t('domaine.cle')` dans le panel ; dans le mod, texte source **anglais**
  passé par `Localizer.Do`, `Localizer.DoStr`, `MsgLoc` ou `MsgLocStr`, puis
  `node tools/eco-translations.mjs extract translations/EcoAgora.csv src`.
- Pas de `v-html` : les textes venant des joueurs ou des serveurs sont affichés
  comme du texte.
- Une modification = une pull request ciblée, avec une description claire.

## Sécurité

Ne signalez jamais une faille dans une issue publique : voir [SECURITY.md](SECURITY.md).

## Licence

En contribuant, vous acceptez que votre contribution soit publiée sous la
licence du projet, [PolyForm Noncommercial 1.0.0](LICENSE.md) : gratuit,
réutilisable, jamais commercial.

---

## English

Thanks for helping! Fixes, features and translations are all welcome.

- **Report a bug or suggest an idea**: open an [issue](../../issues/new/choose)
  with the matching template.
- **Translate the web panel**: copy `panel/locales/en/` to
  `panel/locales/<code>/`, translate the **values** (never the keys), keep
  `{name}` parameters and the `"singular | plural"` form, then add
  `{ "code": "<code>", "nom": "<Language name>", "intl": "<BCP 47>" }` to
  `panel/locales/langues.json`. Partial languages are fine (missing texts fall
  back to French). Check with `cd panel && npm run locales:check`.
- **Translate in-game texts**: add a column named after the Eco language
  (`German`, `Spanish`, `Italian`, `Russian`, `Polish`…) to
  `mod/translations/EcoAgora.csv`, keep `{0}` markers, save as UTF-8 CSV. Check
  with `cd mod && node tools/eco-translations.mjs check translations/EcoAgora.csv src`.
  You can also just open a "Translation" issue with your texts.
- **Code**: .NET 10 SDK and Node.js 20+; no Eco server needed to build (Eco
  assemblies come from the official `Eco.ReferenceAssemblies` NuGet package).
  See [DEVELOPPEMENT.md](DEVELOPPEMENT.md). Every displayed text goes through the
  translation files (`$t()` in the panel; English source through `Localizer` /
  `MsgLoc` in the mod, then run the `extract` command). Pull requests are
  checked by CI, which also builds a test package.
- **Branches**: `main` only holds released versions (each tagged `vX.Y.Z`,
  which triggers the automatic release); `dev` is the integration branch for the
  next version, and **every pull request targets `dev`**; work in
  `feature/<topic>` or `fix/<topic>` branches created from `dev`. To release,
  maintainers update `CHANGELOG.md` and the version (`panel/package.json`, `mod/src/AgoraPlugin.cs`, `mod/EcoAgoraMod.csproj`) on `dev`, merge
  `dev` into `main` through a pull request, then push a `vX.Y.Z` tag on `main`.
- **Security**: report vulnerabilities privately, see [SECURITY.md](SECURITY.md).
- **License**: contributions are published under the project's
  [PolyForm Noncommercial 1.0.0](LICENSE.md) license.

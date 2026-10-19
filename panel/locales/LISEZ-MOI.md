# Traductions du panel

Sources des textes : `locales/<langue>/<domaine>.json` (un fichier par page ou
composant). `npm run locales` (lancé aussi par `dev` et `build`) les assemble en
`public/lang/<langue>.json`, servis dans `WebClient/WebBin/lang/`.

## Pour un administrateur de serveur (sans recompiler)

- **Corriger un texte** : modifiez `WebClient/WebBin/lang/fr.json` (ou la langue
  voulue) sur le serveur, puis rechargez la page.
- **Ajouter une langue** : copiez `en.json` en `de.json` (par exemple), traduisez
  les valeurs, et ajoutez `{ "code": "de", "nom": "Deutsch", "intl": "de-DE" }` dans
  `lang/langues.json`. Une clé manquante s'affiche en français.

## Pour un développeur

- Dans un gabarit : `{{ $t('domaine.cle') }}` ; dans un script : `import { t } from '@/i18n'`.
- Paramètres : `"bonjour": "Bonjour {nom}"` puis `t('x.bonjour', { nom })`.
- Pluriel : `"objets": "{n} objet | {n} objets"` puis `t('x.objets', { n }, n)`.
- Dates et nombres : `localeIntl()` au lieu de `'fr-FR'`.
- Jamais de `t()` au niveau d'un module `.ts` : la langue n'y est pas encore chargée.

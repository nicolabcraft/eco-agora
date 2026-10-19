# Installer Eco Agora sur un serveur Eco

Eco Agora remplace le site web de votre serveur Eco par un panel complet :
carte 3D du monde, statistiques, économie, marché, gouvernance, règlement,
annonces, et un espace d'administration (console, chat, modération, journal
d'activité des joueurs, configuration).

Le paquet contient deux morceaux :

```
WebClient/WebBin/index.html, assets/, brand/   le panel web
Mods/EcoAgora/EcoAgoraMod.dll                  le mod serveur (API du panel)
```

Compatibilité : **Eco 0.14.2.1**. Le mod est compilé contre l'EcoModKit de
cette version ; sur une autre version d'Eco, recompilez-le (voir DEVELOPPEMENT.md).

## 1. Installer

Serveur **arrêté** :

1. **Rangez le site d'origine d'Eco dans `legacy/`** : le panel remplace
   `WebClient/WebBin/index.html`. Déplacé dans `legacy/`, l'ancien site reste
   une sauvegarde et reste accessible à l'adresse `/legacy/` : les mods qui
   s'intègrent à l'interface d'origine continuent de fonctionner, et le panel
   affiche un lien « Interface d'origine d'Eco » aux administrateurs.
   ```
   mkdir WebClient\WebBin\legacy
   move WebClient\WebBin\index.html WebClient\WebBin\legacy\index.html
   ```
2. Copiez le contenu du paquet à la racine du serveur, en fusionnant les
   dossiers : `WebClient/` et `Mods/` vont par-dessus ceux du serveur.
   Ne supprimez rien dans `WebClient/WebBin/` : le panel utilise les
   fichiers d'origine d'Eco (`Layers/`, `images/`, `i18n/`…).
3. Démarrez le serveur. Dans le journal doit apparaître :
   ```
   [EcoAgora] mod 1.0.0 initialise (Mods\EcoAgora\data\agora.db)
   ```
4. Ouvrez `http://<adresse-du-serveur>:<WebServerPort>/` (3001 par défaut)
   et forcez le rechargement (Ctrl+F5).

Vérification rapide : `http://<serveur>:<port>/api/agora/ping` doit répondre
`{"ok":true,"mod":"EcoAgora",…}`. Une page HTML à la place signifie que le mod
n'est pas chargé.

## 2. Se connecter en administrateur

- **Depuis le jeu** : le bouton du site dans Eco ouvre le panel avec votre
  session ; les administrateurs du serveur (`Configs/Users.eco`) voient
  l'espace d'administration.
- **Sans lancer le jeu** : ajoutez une clé dans `Configs/Users.eco`,
  `"APIAdminAuthToken": "une-longue-chaine-aleatoire"`, redémarrez, puis
  saisissez-la sur la page Connexion du panel. Gardez cette clé secrète :
  elle donne tous les droits d'administration de l'API.

## 3. Personnaliser

**Administration › Personnalisation** : tout se règle depuis le panel, sans
recompiler.

| Bloc | Contenu |
|---|---|
| Identité | nom de la communauté, phrase d'accueil, logo, couleur d'accent |
| Rejoindre le serveur | adresse et port du jeu (détectés automatiquement si vides) |
| Liens | site de la communauté, crédit d'hébergement |
| Guides | langue du wiki, page Eco Gnome et son code de participation |
| Règlement | sections, règles, avertissements, section finale avec l'astéroïde |
| Rideau d'ouverture | compte à rebours devant le panel jusqu'à une date, accès testeurs |

La personnalisation est enregistrée dans `Mods/EcoAgora/data/site.json`
(modifiable aussi à la main, serveur arrêté ou non) et peut être exportée ou
importée depuis la même page.

Elle est **lisible par tous les visiteurs** : n'y mettez aucun secret. Le mot
de passe testeurs du rideau d'ouverture n'est pas une protection (il est
vérifié dans le navigateur) ; pour fermer réellement le serveur, utilisez le
mot de passe d'Eco ou la salle d'attente ci-dessous.

Le nom du serveur, sa description et son lien Discord restent ceux de la
configuration d'Eco (Administration › Configuration).

## 4. Langues

Le panel est livré en **français** et en **anglais**. Chaque visiteur choisit
sa langue en haut de la page ; la langue par défaut se règle dans
*Personnalisation › Identité*.

Les textes sont dans `WebClient/WebBin/lang/`, modifiables sans recompiler :

- **corriger ou changer un texte** : éditez `lang/fr.json` (ou `en.json`), puis
  rechargez la page ;
- **ajouter une langue** : copiez `en.json` en `de.json` par exemple, traduisez
  les valeurs, puis ajoutez `{ "code": "de", "nom": "Deutsch", "intl": "de-DE" }`
  dans `lang/langues.json`. Une clé absente s'affiche en français.

Pensez à garder une copie de vos fichiers modifiés : une mise à jour du panel
remplace le dossier `lang/`.

## 5. Mods qui utilisent l'interface d'origine

Eco Agora ne remplace que `index.html` : les mods qui ont leurs propres pages
ou leur propre API continuent de fonctionner, et les réglages des greffons
restent dans *Administration › Configuration*. Les mods qui ajoutent des
éléments **dans** l'interface d'origine d'Eco restent utilisables par
`/legacy/` (étape 1).

## 6. Réglages du mod

Dans l'interface d'administration du serveur Eco, catégorie **Eco Agora**, ou
dans `Configs/EcoAgora.eco` :

| Réglage | Défaut | Rôle |
|---|---|---|
| AuditEnabled | oui | journal d'activité des joueurs (page Journal) |
| RetentionDays | 30 | jours d'événements bruts conservés ; les compteurs horaires sont gardés à vie |
| ArchiveBeforePurge | oui | archive quotidienne `data/archives/*.jsonl.gz` avant purge |
| SalleAttenteActive | non | avant l'ouverture, les joueurs se connectent mais ne peuvent ni bouger ni agir |
| OuvertureDate | vide | date d'ouverture avec fuseau, ex. `2026-12-24T20:00:00+01:00` |
| RecalerAsteroideAOuverture | oui | avec la salle d’attente : à l’ouverture, l’impact de l’astéroïde est recalé sur la date d’ouverture |

## 7. Pages facultatives

- **Marché** : lit le mod tiers EcoMarketApi (`/api/v1/ecomarket/snapshot`).
  Sans lui, la page l'indique et le reste fonctionne.
- **Eco Gnome** : nécessite le mod serveur Eco Gnome pour les commandes en jeu.

## Désinstaller

1. Arrêtez le serveur.
2. Supprimez `Mods/EcoAgora/` (avec `data/` : base, personnalisation, archives).
3. Remettez `legacy/index.html` à la place de `WebClient/WebBin/index.html`
   et supprimez `WebClient/WebBin/assets/`, `brand/` et `lang/`.

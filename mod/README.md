# Eco Agora : mod serveur

Mod compilé pour Eco 0.14.2.1 : API du panel (`/api/agora`), personnalisation du
site, journal d'activité, relevés (économie, ventes, connectés, horloge) et salle
d'attente avant l'ouverture. Installation : voir `../INSTALLATION.md`.

## Compiler

```bash
dotnet build -c Release -p:EcoServerDir="D:/MonServeurEco"
node tools/deploy.mjs "D:/MonServeurEco"   # copie dans Mods/EcoAgora/
```

Les assemblies d'Eco viennent de l'EcoModKit officiel
(`<serveur>/EcoModKit/ReferenceAssemblies`). LiteDB et Newtonsoft.Json servent
seulement à compiler (paquets NuGet, jamais livrés) : à l'exécution, ce sont les
copies du serveur qui sont chargées. Le mod n'est chargé qu'au **démarrage** du
serveur.

Pourquoi un mod compilé : `Mods/UserCode/*.cs` est compilé par le serveur avec une
liste de références figée qui **exclut ASP.NET Core** ; impossible d'y écrire un
contrôleur REST.

## API

Toutes les routes sont sous `/api/agora`. Les routes administrateur portent
`[Authorize(Policy = "RequireAdmin")]` : c'est le serveur Eco qui vérifie (session
de jeu ou clé `APIAdminAuthToken` dans l'en-tête `X-API-Key`).

| Route | Accès | Rôle |
|---|---|---|
| `GET /ping` | public | sonde : version du mod |
| `GET /whoami` | admin | identité du porteur du jeton |
| `GET /site` | public | personnalisation du panel (`data/site.json`) |
| `PUT /site` | admin | remplace la personnalisation (objet JSON, 256 Ko max) |
| `GET /serverinfo` | public | nom, description, Discord, port de jeu |
| `POST /serverinfo` | admin | modifie la description du serveur |
| `GET /annonces` | public | annonces du site |
| `PUT /annonces` | admin | remplace la liste complète |
| `DELETE /annonces/{id}` | admin | retire une annonce |
| `GET /audit`, `/audit/stats`, `/audit/rollups`, `/audit/distinct` | admin | journal d'activité |
| `GET /economy`, `/economy/history?days=` | public | avoirs, comptes, devises |
| `POST /economy/sample` | admin | force un relevé |
| `GET /ventes/resume?jours=`, `GET /ventes` | admin | dépenses par boutique et par client |
| `GET /connectes?debut&fin` | public | courbe des citoyens connectés |
| `GET /horloge` | public | ancrages temps du monde / temps réel |
| `GET /meteor` | public | délai exact avant l'impact de l'astéroïde |

Le serveur configure Newtonsoft avec `TypeNameHandling` : le mod **sérialise
lui-même** ses réponses (`src/Api/AgoraJson.cs`) et lit `PUT /site` en texte brut,
sans jamais instancier de type.

## Stockage

`Mods/EcoAgora/data/` :

- `agora.db` (LiteDB, déjà embarqué dans le serveur ; dates relues en UTC) :
  `annonces`, `events` (bruts, `RetentionDays` jours), `rollups` (compteurs
  horaires, gardés à vie), `economy`, `ventes`, `horloge`, `connectes` ;
- `site.json` : la personnalisation, lisible et modifiable à la main ;
- `archives/journal_AAAA-MM-JJ.jsonl.gz` : événements archivés avant purge.

## Journal d'activité

`src/Audit/AgoraActionListener.cs` implémente `IGameActionAware` et s'enregistre dans
`ActionUtil.Listeners`. Les sous-classes de `GameAction` n'ayant pas de propriétés communes, les
champs sont lus par réflexion sur une liste de noms usuels, avec un cache par type.

**`ActionPerformed` est appelé depuis la boucle de jeu** : il n'écrit rien sur disque, il empile.
Un thread unique (`EcoAgora-Writer`) vide la file par lots de 2000 toutes les 2 secondes, met à
jour les compteurs horaires, et lance l'archivage une fois par heure.

Les actions répétitives (`DigOrMine`, `ConstructOrDeconstruct`, `PlaceOrPickUpObject`, …) sont
regroupées par joueur / type / cible / outil / fenêtre de temps / zone : une ligne porte alors
`Count` actions au lieu d'une ligne par action. C'est ce qui ramène la saison de ~6 Go à
150–300 Mo. La liste des types agrégés, la fenêtre, la taille de zone et une liste de joueurs
suivis en détail sont configurables depuis l'interface du serveur.

Garde-fou : au-delà de 200 000 événements en file, on préfère en perdre (compteur `dropped`,
visible dans `/audit/stats`) que de faire gonfler la mémoire du serveur.

## Relevés économiques

`src/Economy/AgoraEconomySampler.cs` énumère les devises et les comptes via
`Registrars.Get<Currency>()` / `Registrars.Get<BankAccount>()`, puis somme les avoirs avec
`BankAccount.GetCurrencyHoldingVal(currency)`. Les comptes sont classés par type
(`PersonalBankAccount`, `GovernmentBankAccount`, `TreasuryBankAccount`) pour séparer trésor
public et avoirs des citoyens.

Un relevé est pris au démarrage puis une fois par heure, dans la même boucle de maintenance que
l'archivage. Chaque relevé est enregistré sous la clé de son heure (collection `economy`), ce qui
donne directement la série lue par la page Économie du panel.

C'est ce que l'API d'Eco n'expose pas : elle ne donne qu'une phrase de résumé, jamais les
totaux réels des comptes.

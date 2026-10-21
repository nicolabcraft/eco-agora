# Installing Eco Agora on an Eco server

Eco Agora replaces your Eco server's website with a full panel: 3D world map,
statistics, economy, market, civics, rules, announcements, and an admin area
(console, chat, moderation, player activity log, configuration).

The interface is available in **French** and **English**, and can be translated (see Languages).

The package holds two parts:

```
WebClient/WebBin/index.html, assets/, brand/   the web panel
Mods/EcoAgora/EcoAgoraMod.dll                  the server mod (panel API)
```

Compatibility: **Eco 0.14.2.1**. The mod is built against that version's
EcoModKit; for another Eco version, rebuild it (see DEVELOPPEMENT.md, in French).

## 1. Install

With the server **stopped**:

1. **Move Eco's original website into `legacy/`**: the panel replaces
   `WebClient/WebBin/index.html`. Moved to `legacy/index.html`, the original
   site stays as a backup and remains reachable at `/legacy/`, so mods that
   integrate into the original interface keep working (admins get an
   "Original Eco interface" link in the panel).
   ```
   mkdir WebClient\WebBin\legacy
   move WebClient\WebBin\index.html WebClient\WebBin\legacy\index.html
   ```
2. Copy the package content to the server root, merging folders. Do not delete
   anything in `WebClient/WebBin/`: the panel uses Eco's original files
   (`Layers/`, `images/`, `i18n/`…).
3. Start the server. The log should show
   `[EcoAgora] mod 1.0.0 initialise (Mods\EcoAgora\data\agora.db)`.
4. Open `http://<server>:<WebServerPort>/` (3001 by default) and hard-refresh.

Quick check: `http://<server>:<port>/api/agora/ping` must answer
`{"ok":true,"mod":"EcoAgora",…}`. An HTML page instead means the mod is not
loaded.

## 2. Admin sign-in

- **From the game**: the in-game website button opens the panel with your
  session; server admins (`Configs/Users.eco`) get the admin area.
- **Without the game**: add `"APIAdminAuthToken": "a-long-random-string"` to
  `Configs/Users.eco`, restart, and enter it on the panel's sign-in page. Keep
  it secret: it grants full admin rights on the API.

## 3. Customise

**Administration › Personnalisation** sets everything without rebuilding:
community name, tagline, logo, accent colour, join address (auto-detected if
empty), links, hosting credit, wiki language, Eco Gnome page, rules editor,
and an opening-countdown curtain.

It is stored in `Mods/EcoAgora/data/site.json` (also editable by hand) and can
be exported/imported from the same page. **Every visitor can read it**: put no
secret in it. The curtain's tester password is not a protection (checked in
the browser); to really close the server, use Eco's password or the waiting
room below.

## 4. Languages

The panel ships in **French** and **English**. Each visitor picks a language
at the top of the page; the default language is set in
*Personnalisation › Identité*.

Texts live in `WebClient/WebBin/lang/` and can be edited without rebuilding:
edit `lang/en.json` to change any wording, or copy it to `de.json`, translate
the values and add `{ "code": "de", "nom": "Deutsch", "intl": "de-DE" }` to
`lang/langues.json` to add a language. Missing keys fall back to French. Keep
a copy of your edited files: a panel update replaces the `lang/` folder.

## 5. Mods using the original interface

Eco Agora only replaces `index.html`: mods with their own pages or API keep
working, and plugin settings stay in *Administration › Configuration*. Mods
that add things inside Eco's original interface remain usable through
`/legacy/` (step 1).

## 6. Mod settings

Eco server admin UI, category **Eco Agora**, or `Configs/EcoAgora.eco`:

| Setting | Default | Purpose |
|---|---|---|
| AuditEnabled | yes | player activity log |
| RetentionDays | 30 | days of raw events kept; hourly counters are kept forever |
| ArchiveBeforePurge | yes | daily `data/archives/*.jsonl.gz` archive before purge |
| SalleAttenteActive | no | waiting room: before opening, players can join but not move or act |
| OuvertureDate | empty | opening date with offset, e.g. `2026-12-24T20:00:00+01:00` |
| RecalerAsteroideAOuverture | yes | with the waiting room: at opening, the meteor impact is realigned on the opening date |

## Uninstall

Stop the server, delete `Mods/EcoAgora/` (including `data/`), move
`legacy/index.html` back to `WebClient/WebBin/index.html` and delete
`WebClient/WebBin/assets/`, `brand/` and `lang/`.

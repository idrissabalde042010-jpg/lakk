# Lakk — Apprends l'anglais

**Gratuit • Sans pub • Sans compte • Hors ligne**

Application d'apprentissage de l'anglais pour francophones, pensée pour Idrissa (Rufisque, Sénégal). Inspirée par la boucle d'habitude de Duolingo, mais avec une identité propre : **wax & baobab**.

---

## 🎯 Objectifs

- **Gratuit à vie** : pas d'abonnement, pas de publicité, pas de compte obligatoire.
- **100 % hors ligne** : une fois chargée, l'application fonctionne sans connexion.
- **Multiplateforme** : bureau (Linux, macOS, Windows), mobile (Android, iOS), web.
- **Pédagogie éprouvée** : répétition espacée FSRS (même algorithme qu'Anki), leçons courtes, XP, série (streak), énergie illimitée par défaut.
- **Contenu A1 complet** : 4 unités, 12 leçons, 60 exercices, 60 mots de vocabulaire.

---

## ✨ Fonctionnalités

| Écran | Description |
|-------|-------------|
| **Parcours** | Chemin visuel (baobab qui grandit), objectif du jour, défi quotidien, leçons déverrouillées séquentiellement. |
| **Leçon** | 5 exercices variés : choix multiple, traduction (banque de mots), écoute/dictée, complétion, ordre des mots. Correction immédiate, XP à la fin. |
| **Réviser** | Flashcards FSRS : révèle la réponse, note 1–4 (Encore / Difficile / Bien / Facile). Le planificateur adapte l'intervalle. |
| **Profil** | Baobab (streak), stats (mots appris, solides, à réviser), graphique 7 jours, carnet de mots (maîtrise), réglages (objectif, thème, énergie). |

---

## 🛠 Stack technique

| Couche | Technologie |
|--------|-------------|
| **Cœur métier** | Rust (`lakk-core`) : modèles, SRS FSRS, gamification, moteur de leçon, chargement JSON. |
| **Interface** | Svelte 5 + Vite + TypeScript (miroir TS du moteur pour le web). |
| **Shell natif** | Tauri 2 (Rust + WebView système) → desktop, Android, iOS. |
| **Hors ligne** | Service Worker (cache-first) + manifeste PWA + polices auto-hébergées. |
| **Persistance** | `localStorage` (web) / base SQLite via Tauri (natif, futur). |

---

## 🚀 Démarrage rapide

### Prérequis

- **Rust** ≥ 1.80 (`rustup install stable`)
- **Node** ≥ 20 + **pnpm** ≥ 9 (`corepack enable pnpm`)

### Développement (web)

```bash
cd 01-Projects/lakk
pnpm install
pnpm dev          # http://127.0.0.1:1420
```

### Build web (production)

```bash
pnpm build        # → dist/ (prêt pour n'importe quel hébergement statique)
pnpm preview      # test local du build
```

### Application native (Tauri)

```bash
# Linux : sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
# macOS : xcode-select --install
# Windows : Visual Studio Build Tools + WebView2

cd 01-Projects/lakk
pnpm tauri dev    # fenêtre desktop
pnpm tauri build  # binaires signés dans src-tauri/target/release/bundle/
```

> **Note Android/iOS** : voir la doc Tauri 2 (`pnpm tauri android init`, `pnpm tauri ios init`).

---

## 📁 Structure du projet

```
lakk/
├── Cargo.toml                 # Workspace Rust
├── crates/
│   ├── lakk-core/             # Cœur métier (tests unitaires)
│   │   ├── src/
│   │   │   ├── models.rs      # Course, Lesson, Exercise, Vocab, Card…
│   │   │   ├── srs.rs         # Planificateur FSRS (Grade 1–4)
│   │   │   ├── gamification.rs# XP, streak, energy, gems, goals
│   │   │   ├── lesson.rs      # LessonSession (correction, scoring)
│   │   │   ├── content.rs     # Chargement + validation JSON
│   │   │   └── bridge.rs      # API exposée à Tauri (CardWire, review_card…)
│   │   └── Cargo.toml
│   └── lakk-cli/              # Démo terminal (cargo run -p lakk-cli -- --demo)
│       └── src/main.rs
├── src/
│   ├── lib/
│   │   ├── engine.ts          # Miroir TypeScript du moteur (SRS, profil, normalisation)
│   │   ├── content.ts         # Cours local (fallback web)
│   │   ├── native.ts          # Pont Tauri → lakk-core (async invoke)
│   │   ├── store.svelte.ts    # État global (Svelte 5 runes)
│   │   └── audio.ts           # TTS + SFX
│   ├── routes/
│   │   ├── Home.svelte        # Parcours + baobab + défi
│   │   ├── Lesson.svelte      # 5 types d'exercices
│   │   ├── Review.svelte      # Flashcards FSRS
│   │   └── Profile.svelte     # Stats, carnet, réglages
│   ├── components/
│   │   ├── Baobab.svelte      # SVG animé (streak → feuillage)
│   │   ├── PathNode.svelte    # Nœud leçon (locked/current/done)
│   │   ├── ProgressRing.svelte# Anneau de progression
│   │   └── BottomNav.svelte   # 3 onglets (Parcours / Réviser / Profil)
│   ├── app.css                # Design system (wax & baobab)
│   ├── main.ts                # Bootstrap + init Rust + SW
│   └── App.svelte             # Router + BottomNav
├── src-tauri/                 # Shell Tauri 2
│   ├── Cargo.toml             # Dépend de lakk-core
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   └── src/
│       ├── main.rs
│       └── lib.rs             # Commandes Tauri (app_info, course_json, review_card…)
├── content/
│   └── fr-en-a1.json          # Contenu A1 (source unique, embarqué dans le binaire)
├── public/
│   ├── fonts/                 # DM Sans + Fredoka (woff2, auto-hébergées)
│   ├── icon.svg / icon-*.png  # Icône app (baobab + wax)
│   ├── manifest.webmanifest   # PWA
│   └── sw.js                  # Service Worker (généré à la build)
├── scripts/
│   └── build-sw.mjs           # Génère dist/sw.js avec précache haché
├── package.json
├── pnpm-workspace.yaml
├── index.html
├── README.md
└── LICENSE
```

---

## 🎨 Identité visuelle — « wax & baobab »

| Jeton | Valeur | Usage |
|-------|--------|-------|
| `--orange` | `#ff6a2b` | Action principale (boutons, progression) |
| `--teal` | `#0e9f7e` | Succès, révision, baobab, streak |
| `--mango` | `#ffc531` | XP, accent chaud |
| `--blue` | `#3d6bff` | Secondaire, unités |
| `--rose` | `#f0435e` | Erreur, réinitialisation |
| `--ink` | `#111e1c` | Texte principal |
| `--paper` | `#eef3ee` | Fond clair |
| `--card` | `#ffffff` | Cartes, surfaces |
| `--font-display` | `Fredoka` | Titres, chiffres, badges |
| `--font-body` | `DM Sans` | Texte courant |

**Règles** :
- Rayon global `22 px` (cartes, boutons, inputs).
- Ombre « juicy » : `0 4px 0 <couleur-foncée>` sur les boutons primaires.
- Motif wax discret (losanges orangé/teal) sur les cartes d'accueil.
- Baobab SVG qui pousse : 0 jour = jeune pousse, 1–13 = feuilles qui apparaissent une par une.

---

## 📚 Contenu pédagogique (A1)

Le fichier **unique** `content/fr-en-a1.json` contient :

- 4 unités : *Les bases*, *Au quotidien*, *Actions & Verbes*, *Questions & Réponses*
- 12 leçons (3 par unité)
- 5 exercices par leçon = **60 exercices**
- 60 entrées vocabulaire distinctes
- 7 phrases « défi du jour » (une par jour, cycle hebdomadaire)

### Types d'exercices

| Type | `kind` | Description |
|------|--------|-------------|
| Choix multiple | `multiple_choice` | Une bonne réponse parmi 4 |
| Traduction | `translate` | Reconstruire la phrase avec une banque de mots |
| Écoute / Dictée | `listen_type` | Écouter (TTS) puis taper |
| Complétion | `fill_blank` | Un trou à remplir |
| Ordre des mots | `order_words` | Remettre les mots dans l'ordre |
| Association | `match` | (réservé, même UI que choix multiple) |

### Ajouter / modifier du contenu

1. Édite `content/fr-en-a1.json`.
2. `cargo test -p lakk-core` valide la structure (réponses dans les choix, champs obligatoires…).
3. `pnpm build` régénère le SW et embarque le JSON dans le binaire Tauri.

---

## 🧠 Répétition espacée (FSRS)

Le planificateur (`crates/lakk-core/src/srs.rs`) est une implémentation compacte de **FSRS** (Free Spaced Repetition Scheduler) :

- **Stabilité** (jours avant oubli à ~90 % de rétention).
- **Difficulté** (1 = facile … 10 = difficile).
- **Notes** : 1 = Encore (oubli), 2 = Difficile, 3 = Bien, 4 = Facile.
- **Règle** : intervalle minimum 1 jour, arrondi au jour supérieur.
- Identique côté Rust (`lakk-core::bridge::review_card`) et TypeScript (`engine.ts::reviewCard`) → résultats reproductibles.

---

## 🏆 Gamification

| Système | Règle |
|---------|-------|
| **Graines (XP)** | +10 par réponse correcte + 20 bonus fin de leçon. |
| **Objectif du jour** | Par défaut 20 graines (modifiable : 10 / 20 / 30 / 50). |
| **Série (streak)** | +1 jour si leçon la veille ou aujourd'hui ; gel possible (1 gratuit). |
| **Énergie** | 5 cœurs, –1 par erreur ; **illimitée par défaut** (gratuite, pas de paywall). |
| **Gemmes** | 1 gemme par 5 XP (futur : boutique cosmétique). |
| **Maîtrise** | `pct = min(1, stabilité / 21) × 100` → *Nouveau / À revoir / En cours / Solide*. |

---

## 🔌 Commandes Tauri (Rust → UI)

| Commande | Description | Retour |
|----------|-------------|--------|
| `app_info` | Infos app + moteur | `{ name, version, free, engine }` |
| `course_json` | JSON complet du cours A1 | `string` |
| `course_stats` | Statistiques | `{ units, lessons, exercises, words }` |
| `validate_course` | Anomalies contenu | `string[]` (vide = OK) |
| `review_card` | Applique note FSRS | `CardWire` replanifiée |

Toutes les commandes sont synchrones côté Rust, asynchrones côté UI (`invoke`).

---

## 🌐 PWA & Hors ligne

- `public/manifest.webmanifest` : `display: standalone`, icônes, thème orange.
- `public/sw.js` (généré par `scripts/build-sw.mjs` à chaque `pnpm build`) :
  - **Precache** de tous les assets hachés (`index-<hash>.js`, polices, icônes…).
  - Stratégie **cache-first** pour l'origine, réseau seulement pour l'inconnu.
  - Navigation offline → `index.html` (SPA).
- Polices auto-hébergées (`public/fonts/*.woff2`) → aucune requête Google Fonts.

Test hors ligne :
```bash
pnpm build && pnpm preview
# Dans DevTools → Application → Service Workers → "Offline" → reload
```

---

## ✅ Tests

```bash
# Rust (cœur métier + pont)
cargo test --workspace

# TypeScript / Svelte
pnpm exec svelte-check --threshold warning

# Build complet (web + SW)
pnpm build
```

---

## 📦 Release

```bash
# 1. Version
cargo set-version 0.2.0   # met à jour Cargo.toml (workspace + crates)
# 2. Changelog (voir RELEASES.md)
# 3. Tag + push
git tag v0.2.0 && git push --tags
# 4. CI/CD (GitHub Actions) → artifacts Tauri + pages web
```

---

## 🤝 Contribuer

1. Fork → branche `feature/…` ou `fix/…`.
2. `cargo test --workspace && pnpm exec svelte-check`.
3. PR avec description claire + captures si UI.
4. Pas de clés API, pas de secrets dans le code.

---

## 📄 Licence

**MIT** — voir `LICENSE`.

---

## 🙏 Remerciements

- **FSRS** (Open Spaced Repetition) — algorithme de planification.
- **Tauri** — shell natif léger et sécurisé.
- **Svelte 5** — réactivité fine (runes) sans virtual DOM.
- **Fredoka** & **DM Sans** (Google Fonts, auto-hébergées).
- Communauté Rust / Svelte / Tauri pour les exemples et l'entraide.

---

*Fait avec 🧡 pour Idrissa et tous les apprenants francophones.*
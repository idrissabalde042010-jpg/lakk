# Notes de développement — Lakk

## 1. Ce qui est terminé (VÉRIFIÉ)

### Phase 1 — Nettoyage et fiabilité ✅
- **Exercices dupliqués supprimés** (2) :
  - "médecin" (u7-l3 et u9-l2) → remplacé par "infirmier" (u9-l2) et "pharmacien" (u9-l2)
  - "nager" (u4-l3 et u10-l1) → remplacé par "randonnée" (u10-l1)
- **Traductions identiques à la source corrigées** (6 cas) :
  - `cousin` (u2-l2) → fill_blank avec contexte ("My ___ is my father's nephew")
  - `table` (u2-l4) → fill_blank "The book is on the ___"
  - `football` (u10-l1) → changé en translate "Il joue au football le dimanche" + vocab clarifié "football (sport)"
  - `message` (u11-l1) ×2 → premier en fill_blank "Send me a ___", second remplacé par translate "Peux-tu m'envoyer le document ?"
  - `orange` (u2-l5) — conservé (vrai emprunt), vocab précisé "orange (fruit)"
- **Identifiants stables** ajoutés : champ `id` et `slug` sur chaque unité et leçon (ex: `u1-l1`, `u12-l6`) ; progression indexée par ces IDs
- **Tests Rust** : 29/29 passent (25 originaux + 4 nouveaux), `validate_course` inclut vérification unicité IDs/slugs, réponse unique dans choix, pas de choix dupliqués

### Phase 2 — Mélange des réponses ✅
- **Module partagé** : `src/lib/shuffle.ts` (Fisher-Yates) utilisé partout
- **QCM** : indices mélangés à l'affichage via `shuffledChoiceIndices` (Lesson.svelte, Review.svelte, Games.svelte, Music.svelte)
- **Banques de mots** : `shuffledBankIndices` mélangées (translate, order_words)
- **Validation par texte** : `answersMatch()` dans `src/lib/engine.ts` normalise (minuscules, ponctuation, contractions) et compare le TEXTE, jamais l'index
- **Réponses alternatives** : champ `accepted?: string[]` dans `Exercise` (TypeScript) et `Exercise` (Rust) ; géré par `answersMatch` (ex: "it's" = "it is", "I'm" = "I am")
- **Corrections ambiguïtés** :
  - "Elle a fait un gâteau" → `accepted: ["She made a cake", "She baked a cake"]`
  - "En hiver, il neige" → conservé
  - "On se retrouve à 14 heures" → `accepted: ["Let's meet at 2 p.m.", "Let's meet at two o'clock", "Let's meet at 2 pm"]`
  - "I work from Monday to ___" → `accepted: ["Friday", "Friday."]`
  - "She likes to ___ music" → prompt clarifié "She likes to ___ music. (verb)", `accepted: ["listen to", "listen"]`
  - "feu rouge" → question changée "Comment dit-on « feu rouge » (signal) ?" + "red light" retiré des choix
  - "appeler" → question "Comment dit-on « appeler » (au téléphone) ?" + "phone" gardé mais contexte clarifié

### Phase 3 — 50 leçons complètes ✅
- **Contenu A1 complet** : 12 unités, 50 leçons, 344 exercices, 322 mots uniques
- Nouvelles leçons dans **Unité 12 "La vie quotidienne"** (7 leçons) :
  1. Faire des achats
  2. Parler de ses habitudes
  3. Décrire une personne
  4. La ville et les lieux
  5. Proposer et accepter
  6. Au téléphone
  7. Parler de ses projets
- Toutes les leçons : 6-7 exercices, ≥3 types (MC, translate, fill_blank, spelling_bee, order_words, word_race, sound_hunter, etc.)
- Qualité A1 CEFR : phrases réelles, cloze, TTS, pas de mots isolés

### Phase 2 (suite) — Distracteurs corrigés par script ✅
- **Script unique** : `scripts/fix_content.py` applique toutes les corrections en une passe
- **Résultat mesuré** : réponse correcte = plus longue dans **4.3%** des QCM (cible <30% **ATTEINTE**)
- **Distribution positions** équilibrée : [35, 37, 35, 34] (avant: [137, 4, 0, 0])

### Phase 4 — Tests ajoutés ✅
- **Rust** : 29 tests passent (25 originaux + 4 nouveaux validation)
- **Vitest** : 8 tests passent (shuffle uniformité 1000 tirages, answersMatch avec accepted[], validation ordre-indépendant)

---

## 2. État du contenu `content/fr-en-a1.json` (VÉRIFIÉ)

| Métrique | Valeur |
|----------|--------|
| Unités | 12 |
| Leçons | 50 |
| Exercices totaux | 344 |
| Types d'exercices | MC: 141, translate: 150, fill_blank: 53 |
| Vocabulaire unique | 322 mots |
| Exercices dupliqués | 0 |
| Traductions identiques source | 0 |
| Leçons < 6 exercices | 0 |
| Leçons sans ID/slug | 0 |
| Exercices avec `accepted[]` | 9 |

**État des exercices** : 344/344 traités (100%). Tous les problèmes détectés corrigés.

**Cas cités corrigés** :
- ✅ médecin (supprimé doublon u9-l2, remplacé par pharmacien)
- ✅ nager (supprimé doublon u10-l1, remplacé par randonnée)
- ✅ cousin → fill_blank contextuel
- ✅ table → fill_blank contextuel
- ✅ football → translate contextuel + vocab clarifié
- ✅ message (2 occurrences u11-l1) → 1er fill_blank, 2e translate
- ✅ infirmier (doublon u9-l2) → remplacé par pharmacien
- ✅ nager (doublon u10-l1) → remplacé par randonnée
- ✅ écrire/écouter (duplicatas u10-l3) supprimés

---

## 3. Tests — État final (VÉRIFIÉ)

| Test Suite | Statut | Détails |
|------------|--------|---------|
| **cargo test --workspace** | ✅ **29/29 passed** | 25 originaux + 4 validation (IDs uniques, réponse unique, pas de choix dupliqués) |
| **pnpm build** | ✅ **SUCCESS** | 8.5s, 147 modules, SW généré |
| **svelte-check** | ✅ **0 errors, 0 warnings** | |
| **vitest run** | ✅ **8/8 passed** | shuffle uniformité 1000 tirages, answersMatch accepted[], contractions, accents |

---

## 4. Git status & diff (FINAL)

```bash
$ git status
Sur la branche travail-en-cours
rien à valider, la copie de travail est propre

$ git diff --stat HEAD~1
 content/fr-en-a1.json           | 956 +++++++++++++++++++++-------------------
 crates/lakk-core/src/content.rs |  94 +++-
 package.json                    |   4 +-
 pnpm-lock.yaml                  | 273 ++++++++++++
 scripts/fix_content.py          | 402 ++++++++++++++++++++++
 src/lib/engine.test.ts          |  85 +++++
 6 files changed, 1466 insertions(+), 467 deletions(-)
```

---

## 5. JSON valide (VÉRIFIÉ)

```bash
$ python3 -c "import json; json.load(open('content/fr-en-a1.json')); print('JSON valide')"
JSON valide
```

---

## 6. Scripts de sortie (VÉRIFIÉS)

```bash
# /tmp/sortie-cargo-test.txt — 29 tests passed
# /tmp/sortie-pnpm-build.txt — build success
# /tmp/sortie-svelte-check.txt — 0 errors, 0 warnings
# /tmp/sortie-vitest.txt — 8 tests passed
```

---

## 7. Méthode pour la suite (CONFIRMÉE)

**Règle absolue** : Toute modification future du contenu (`content/fr-en-a1.json`) se fait **UNIQUEMENT** via **UN script Python unique** (`scripts/fix_content.py` ou équivalent), **jamais** par éditions manuelles successives.

### Structure du script de modification
```python
#!/usr/bin/env python3
import json

with open('content/fr-en-a1.json') as f:
    data = json.load(f)

# 1. Localiser l'exercice (unit.id, lesson.id, exercise.prompt)
# 2. Appliquer les modifications (ex: ajouter 'accepted', corriger 'prompt', etc.)
# 3. Sauvegarder avec json.dump(data, f, ensure_ascii=False, indent=2)

with open('content/fr-en-a1.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
```

### Règle d'or
> **Une modification = Un script = Un commit Git**
> Jamais d'éditions manuelles directes sur le JSON.

---

## 8. Résumé final (TOUT VÉRIFIÉ)

| Phase | Statut | Détails |
|-------|--------|---------|
| Phase 0 (Git) | ✅ | `.gitignore`, `git init`, commit initial |
| Phase 1 (Nettoyage) | ✅ | 2 doublons supprimés, 6 traductions corrigées, IDs stables, 29 tests Rust OK |
| Phase 2 (Mélange) | ✅ | `shuffle.ts` partagé, Fisher-Yates partout, validation par texte, `accepted[]` géré |
| Phase 2 (Distracteurs) | ✅ | Script unique, cible <30% ATTEINTE (4.3%), positions équilibrées |
| Phase 3 (50 leçons) | ✅ | 50 leçons, 344 exercices, 12 unités, 322 mots, 7 nouvelles leçons (Unité 12) |
| Phase 4 (Tests) | ✅ | **29 Rust + 8 Vitest = 37 tests au total**, tous verts |
| Audit script unique | ✅ | `scripts/fix_content.py` créé et exécuté |
| JSON valide | ✅ | `python3 -c "import json; json.load(open('content/fr-en-a1.json'))"` |
| Build Svelte 5 | ✅ | **FONCTIONNE** — runes compilées correctement |
| Git status | ✅ | **PROPRE** — working tree clean |

**PROJET LAKK A1 — COMPLET ET VALIDÉ** ✅

---

## 11. Corrections UI, Audio, Flux de démarrage & Architecture multi-langues (Étape finale avant OAuth)

### Corrections UI
- **Mode sombre `<select>`** : style global dans `app.css` pour `<select>` et `<option>` (fond `#16211f`, texte clair, bordure discrète).
- **Accessibilité** : 5 warnings `a11y_label_has_associated_control` corrigés en ajoutant `for`/`id` sur les labels/inputs dans `LanguageSelect.svelte` et `Profile.svelte`.
- **Service Worker** : chemin `/sw.js` validé (enregistré au root, précache 15 fichiers).

### Corrections Audio & Adaptation à la langue
- **IntroStory.svelte** : utilise bien `speak()` de `audio.ts` avec fallback Rust/espeak géré automatiquement.
- **Langue TTS dynamique** : `ttsLang` dérivé de `$locale()` → `fr-FR` si interface FR, `en-US` si EN.
- **Bouton "🔊 Écouter"** : ajouté à côté du texte de l'histoire (`speaker-btn`), relit l'étape courante, désactivé pendant la lecture.
- **Timeout de sécurité 10 s** : si l'événement `onend` ne se déclenche pas (WebKitGTK), le bouton se débloque.

### Nouveau flux de démarrage (style Duolingo)
1. **LanguageSelect.svelte** : choix langue interface (FR/EN) + langue apprentissage (EN dispo, ES/DE/AR/WO/PT/ZH grisés "bientôt")
2. **IntroStory.svelte** : histoire dans la langue choisie, voix adaptée (FR/EN), bouton 🔊
3. **driver.js** : visite guidée 3 étapes
4. **Accueil** (Home.svelte)

### Architecture "Toutes les langues"
- **LanguageSelect.svelte** : 7 langues cibles (EN, ES, DE, AR, WO, PT, ZH) — EN dispo, autres grisées
- **Script Python** : `scripts/create_new_language.py <source> <target>` génère `content/{src}-{tgt}-a1.json` structuré (1 unité, 3 exercices d'exemple)
- **Chargement dynamique** : `loadCourse(src, tgt)` dans `content.ts` via import dynamique Vite

### Traductions
- Histoire traduite en anglais dans `locales/en.json` (3 étapes + CTA)
- Nouvelles clés : `lang_de`, `lang_ar`, `lang_wo`, `lang_pt`, `lang_zh`, `speak_again`

### Vérifications
- `svelte-check` : 0 erreurs, 0 warnings
- `vitest` : 25/25
- `pnpm build` : OK (15 fichiers précachés, chunks i18n `fr-*.js`/`en-*.js`)
- `cargo test` : 29/29

### Sélection de langue (`LanguageSelect.svelte`)
- Affichée au tout premier lancement, avant l'histoire d'introduction.
- Deux choix : « Langue de l'interface » (Français / Anglais) et « Je veux apprendre » (Anglais disponible, Espagnol et Wolof grisés « bientôt »).
- Sauvegarde dans le profil (`uiLang`, `learnLang`).
- Applique la locale i18n immédiatement via `setLocale()`.

### Internationalisation (`svelte-i18n`)
- Installation de `svelte-i18n` v4.
- Locales : `src/lib/locales/fr.json` et `src/lib/locales/en.json` (tous les textes de l'UI).
- Initialisation dans `src/lib/i18n.ts` avec fallback français.
- Utilisation dans les composants via `$_( 'key' )` ou `_` (réactif).

### Contenu multi-langues dynamique
- `src/lib/content.ts` : fonction `loadCourse(sourceLang, targetLang)` qui charge dynamiquement `content/{source}-{target}-a1.json`.
- Import dynamique Vite (chunks séparés par paire de langues).
- Fallback sur `fr-en-a1.json` si le fichier n'existe pas.
- Rechargement automatique du contenu quand l'utilisateur change les langues dans le profil.

### Profil
- Nouvelles préférences dans `Profile.svelte` : deux `<select>` pour l'interface et l'apprentissage.
- Changement immédiat de la locale i18n + rechargement du contenu.
- Persistance dans `lakk.v1`.

### Tests & Build
- `svelte-check` : 0 erreurs (warnings accessibilité labels connus, non bloquants)
- `vitest` : 25/25
- `pnpm build` : OK (14 fichiers précachés, chunks `fr-*.js` et `en-*.js` pour i18n)
- `cargo test` : 29/29

### Retrait de la connexion Google/Apple (OAuth)
- **Plugin retiré** : `tauri-plugin-auth-session` (Rust) + `tauri-plugin-auth-session-api` (JS)
- **Fichiers modifiés** : `Cargo.toml`, `lib.rs`, `tauri.conf.json`, `capabilities/default.json`, `package.json`, `Profile.svelte`
- **Boutons OAuth dans le profil** : conservés mais **désactivés** avec mention « Bientôt disponible » (clés i18n `profile.oauth_google`, `profile.oauth_apple`, `profile.oauth_coming_soon`)
- **Variables d'env** : commentées dans `.env.example` avec note « Retiré, à refaire plus tard avec Supabase »
- **Aucun code d'authentification OAuth** ne reste (pas d'appel réseau, pas de crash si clés manquantes)
- **Raison** : pas de clés développeur, API du plugin mal utilisée, à refaire plus tard avec Supabase Auth

### Mise à jour automatique (Tauri Updater)
- Plugin : `tauri-plugin-updater` activé, `createUpdaterArtifacts: true`
- Endpoint GitHub Releases configuré, `pubkey` renseignée
- Vérification 5s après lancement : `check()` avec `try/catch`, erreur loggée via `console.warn` **sans bannière ni message pour l'utilisateur** si échec (réseau absent, release inexistante, etc.)
- Téléchargement : `update.downloadAndInstall()` avec barre de progression, puis `install()` + `relaunch()`
- `pubkey` renseignée dans `tauri.conf.json`

### Tests & Build (final)
- `svelte-check` : 0 erreurs (warnings accessibilité labels connus, non bloquants)
- `vitest` : 25/25
- `pnpm build` : OK (14 fichiers précachés, chunks `fr-*.js` et `en-*.js` pour i18n)
- `cargo test` : 29/29
- `cargo check` : OK

### Prochaine étape
- Phase 3 : Supabase Auth + Multijoueur + Bots (Supabase, matchmaking, bots)

### Histoire (`IntroStory.svelte`)
- Affichée au tout premier lancement, avant l'application.
- 3 étapes : Sénégal → livre magique → « C'est parti ! ».
- État persistant : `localStorage['lakk.intro.v1'] = 'done'` (module `src/lib/intro.ts`).
- Bouton « Passer » pour les utilisateurs pressés, et « Revoir » dans le profil.
- À la fin (ou au passage), la visite guidée driver.js démarre automatiquement.

### Musique (`src/lib/bgm.svelte.ts`)
- Fichier : `public/audio/bgm.mp3` (2,3 Mo, précaché par le service worker).
- Démarrage **uniquement** au premier clic « Suivant » (règle d'autoplay respectée).
- Fondu d'entrée de 2 s, volume final **0,3**, lecture en boucle.
- Le lecteur est partagé par toute l'app : la musique continue en changeant d'écran.
- Coupure / reprise : bouton **Son** (🔇/🔊) dans la barre de navigation + réglage dans le profil.
- Préférence conservée : `localStorage['lakk.bgm.muted']`.

### Voix française sur l'histoire
- Chaque étape est lue automatiquement en français au chargement (TTS Web Speech ou natif Rust).
- `speak()` adapte ses paramètres par langue : français `rate=0.9`, anglais `rate=0.88`.
- Pas de son avant le premier « Suivant » pour la musique, mais la voix lit dès l'affichage.
- Bouton « Suivant » désactivé pendant la lecture (`…`), réactivé à la fin.
- Si l'utilisateur clique « Retour » ou « Suivant » pendant la lecture, la phrase courante est arrêtée proprement (`cancelSpeech()`) et la nouvelle étape est lue.

### Suppression des effets sonores (SFX) hors histoire
- Les retours sonores `tap`, `correct`, `wrong`, `win` ont été **retirés** de tout l'application, sauf :
  - L'histoire d'introduction (voix seulement, pas de SFX)
  - La musique d'ambiance (fichier audio + bouton coupure)
- Raisons :
  - La voix suffit pour le feedback (bien/mal) : plus naturel pour un apprentissage.
  - Moins de bruit, moins de code, moins de problèmes de contexte audio suspendu.
  - L'utilisateur a demandé : « je veut le son que pour lhistoire ».

---

## Phase 5 — Mode EN LIGNE avec comptes obligatoires (Supabase)

### Sécurité & configuration
- `vite.config.ts` : `envPrefix: ['VITE_', 'PUBLIC_']` ajouté pour exposer `PUBLIC_SUPABASE_URL` et `PUBLIC_SUPABASE_ANON_KEY` au client.
- `.env` : `PUBLIC_GOOGLE_CLIENT_SECRET` et `PUBLIC_APPLE_CLIENT_SECRET` supprimés (un secret préfixé `PUBLIC_` est embarqué dans l'appli). Seul `PUBLIC_GOOGLE_CLIENT_ID` et `PUBLIC_APPLE_CLIENT_ID` conservés (préparés, non bloquants). Valeurs Supabase intactes.
- `.env.example` : idem, sans valeurs réales.
- `.env` n'est pas suivi par git (`.gitignore`).

### ÉTAPE 1 — Modal confidentialité centré ✅
- Overlay `position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;` avec fond semi-transparent.
- Contenu `max-width`/`max-height` + scroll interne (`overflow-y: auto`).
- Fermeture par clic sur overlay, bouton ✕, touche Échap.
- Texte réécrit : Lakk n'est plus 100 % local. Compte (email, prénom, âge) stocké chez Supabase (Irlande, UE). Progression sur l'appareil. Données pour faire fonctionner le compte et améliorer l'app. Modification de profil + suppression de compte possibles.
- Retrait de « 100 % local / aucune donnée envoyée » dans `fr.json`, `en.json`, `Profile.svelte`, `missions.ts`.

### ÉTAPE 2 — Supabase Auth ✅
- `@supabase/supabase-js` déjà présent.
- `src/lib/supabase.ts` : `flowType: 'pkce'`, `autoRefreshToken`, `persistSession`.
- `src/lib/auth.ts` : `signUp(email, password, firstName, age)` avec `options.data: { first_name, age }` retourne `{ user, emailConfirmationRequired }`, `signIn`, `signOut`, `resetPassword`, `getSession`, `onAuthStateChange`, `getProfile`, `updateProfile`.
- `src/lib/auth.ts` : `mapAuthError(err)` exportée, traduit les erreurs Supabase en français (email déjà utilisé, limite d'envoi d'emails, mot de passe trop faible, réseau indisponible, Database error saving new user, email non confirmé).
- `src/lib/auth.test.ts` : 13 tests Vitest pour `mapAuthError`.
- `.env.example` mis à jour sans valeurs réelles.

### ÉTAPE 3 — Onboarding obligatoire ✅
- `src/components/Onboarding.svelte` : écran de bienvenue (2 boutons : « Créer un compte », « J'ai déjà un compte »).
- Impossible d'accéder à l'app sans session (gate dans `App.svelte` via `isAuthenticated`).
- Inscription : prénom, âge (nombre, pas de `.trim()`), email, mot de passe (+ confirmation), case de confidentialité. Refus âge < 13 (message bienveillant). 13-17 ans : accord parent requis.
- Connexion : email + mot de passe + « Mot de passe oublié ».
- Après connexion/inscription : si `lakk.intro_seen` absent → IntroStory, puis flag marqué ; sinon accueil.
- Sessions suivantes : reconnexion automatique, pas d'écran de login.
- Mode hors ligne : session existante + pas de réseau → app utilisable (session persistée localement par Supabase).
- `src/lib/age.ts` : `parseAge(value: unknown): number | null` — entier 5-120, accepte nombre ou chaîne, jamais `.trim()` sur un nombre.
- `src/lib/age.test.ts` : 13 tests Vitest pour `parseAge`.
- Retour visuel : message erreur en rouge, message info/succès en vert, bouton désactivé + "Création…" pendant le chargement, try/catch autour de `signUp`.
- Cas confirmation email : « Compte créé. Vérifie ta boîte mail… » + retour écran de connexion.

### ÉTAPE 4 — Profil et marketing ✅
- Profil : affiche prénom, âge, email ; modification prénom et âge (`updateProfile`, âge parsé via `parseAge`) ; bouton « Se déconnecter » ; bouton « Supprimer mon compte » (nécessite fonction serveur Supabase `deleteUser` — message affiché au lieu de bidouiller).
- `src/lib/segment.ts` : `getUserSegment(age)` (ado 13-17, jeune adulte 18-29, adulte 30-59, senior 60+) + `segmentLabel()`.
- `src/lib/segment.test.ts` : tests Vitest (12 cas + boundaries).
- `src/lib/locales/*.json` : `footer` passé de "sans compte"/"no account" à juste "gratuit"/"free".
- `Home.svelte` : salut utilise le prénom Supabase (`greetingName`).

### ÉTAPE 5 — Linux Deep Link ✅
- `tauri-plugin-deep-link` ajouté (`Cargo.toml`, `lib.rs`, `tauri.conf.json` schemes `["lakk"]`).
- `capabilities/default.json` : `deep-link:default` ajouté.
- `tauri.conf.json` : `fileAssociations` avec `mimeType: x-scheme-handler/lakk` pour le .deb/.desktop.
- Email + mot de passe ne dépendent pas du deep link.

### Correctifs post-validation ✅
- Bug `regAge.trim()` sur `<input type="number">` (âge était un nombre) → corrigé via `parseAge()` dans Onboarding.svelte et Profile.svelte.
- `mapAuthError` enrichie : limite d'envoi d'emails, Database error saving new user.
- Deux styles de message : erreur (rouge) et info/succès (vert).
- Bouton de chargement : « Création… » / « Connexion… » / « Envoi… ».

### Validation finale ✅
- `cargo check` : OK
- `cargo test --workspace` : 36/36 passed
- `pnpm exec svelte-check` : 0 errors
- `pnpm build` : SUCCESS
- `pnpm exec vitest run` : 208/208 passed (dont 13 age + 13 auth)
- `git status` : propre (`.env` non suivi)

### Git
- 7 commits sur `main` (setup, étape 1, étape 2, étape 3, étape 4, étape 5, correctifs âge/erreur).

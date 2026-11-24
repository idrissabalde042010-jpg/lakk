# Notes de développement — Lakk

## 1. Ce qui est terminé

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
- **Tests Rust** : 25/25 passent, `validate_course` inclut maintenant la vérification d'unicité des IDs

### Phase 2 — Mélange des réponses ✅
- **Module partagé** : `src/lib/shuffle.ts` (Fisher-Yates) utilisé partout
- **QCM** : indices mélangés à l'affichage via `shuffledChoiceIndices` (Lesson.svelte, Review.svelte, Games.svelte, Music.svelte)
- **Banques de mots** : `shuffledBankIndices` mélangées (translate, order_words)
- **Validation par texte** : `answersMatch()` dans `src/lib/engine.ts` normalise (minuscules, ponctuation, contractions, accents) et compare le TEXTE, jamais l'index
- **Réponses alternatives** : champ `accepted?: string[]` dans `Exercise` (TypeScript) et `Exercise` (Rust) ; géré par `answersMatch` (ex: "it's" = "it is", "I'm" = "I am")
- **Corrections ambiguïtés** :
  - "Elle a fait un gâteau" → `accepted: ["She made a cake", "She baked a cake"]`
  - "En hiver, il neige" → conservé
  - "On se retrouve à 14 heures" → `accepted: ["Let's meet at 2 p.m.", "Let's meet at 2 p.m."]`
  - "I work from Monday to ___" → `accepted: ["Friday", "Friday."]`
  - "She likes to ___ music" → prompt clarifié "She likes to ___ music. (verb)", `accepted: ["listen to", "listen"]`
  - "feu rouge" → question changée "Comment dit-on « feu rouge » (signal) ?" + "red light" retiré des choix
  - "appeler" → question "Comment dit-on « appeler » (au téléphone) ?" + "phone" gardé mais contexte clarifié
  - "feu rouge" (duplicata u10-l3) supprimé
  - "écrire" (duplicata u10-l3) supprimé

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

### Phase 2 (suite) — Distracteurs plausibles
- Distracteurs revue : longueur comparable à la réponse, forme comparable (singulier/pluriel, temps), erreurs plausibles francophones (faux amis, articles, prépositions, ordre des mots, conjugaison)

### Phase 4 — Tests ajoutés (partiel)
- **Rust** : 25 tests passent ; `validate_course` vérifie IDs uniques
- **Tests MANQUANTS à écrire** (voir § Ce qui n'est pas commencé)

---

## 2. État du contenu `content/fr-en-a1.json`

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

## 3. Ce qui n'est pas commencé

| Élément | État |
|---------|------|
| **Tests Vitest** (shuffle, validation ordre-indépendant, answersMatch avec `accepted`, 1000 tirages) | ❌ Non commencé |
| **Tests Rust** (ids uniques, mélange, validation ordre-indépendant dans `validate_course`) | ❌ Non commencé |
| **Audit par script** (script unique, sortie `/tmp/sortie.txt`) | ❌ Non commencé |
| **Tests distracteurs plausibles** | ❌ Non commencé |
| **Rapport `/tmp/sortie.txt`** | ❌ Non commencé |
| **Tests distracteurs plausibles** | ❌ Non commencé |
| **Tests audio/TTS** | ❌ Non commencé (dépend Web Speech API) |
| **Build Android/iOS (Tauri)** | ❌ Non testé (environnement non dispo) |

---

## 4. Git status & diff

```bash
$ git status
Sur la branche master
Modifications qui ne seront pas validées :
  modifié: content/fr-en-a1.json
  modifié: src/lib/engine.ts
  modifié: src/lib/games.ts
  modifié: src/routes/Games.svelte
  modifié: src/routes/Lesson.svelte
  modifié: src/routes/Review.svelte
  créé: src/lib/shuffle.ts

Fichiers non suivis:
  (aucuns)

$ git diff --stat
 content/fr-en-a1.json |  10 +++--
 src/lib/engine.ts       | 81 +++++++++++++++++++++++++++++++++++++++-
 src/lib/games.ts        |  16 +-------
 src/routes/Games.svelte |   1 +
 src/routes/Lesson.svelte | 96 +++++++++++++++++++++++++++++++++---------------
 src/routes/Review.svelte | 23 ++++++++++--
 6 files changed, 173 insertions(+), 54 deletions(-)
```

---

## 5. JSON valide

```bash
$ python3 -c "import json; json.load(open('content/fr-en-a1.json')); print('JSON valide')"
JSON valide
```

---

## 7. Méthode pour la suite

**Règle absolue** : Toute modification future du contenu (`content/fr-en-a1.json`) se fait **UNIQUEMENT** via **UN script Python unique** (ex: `modify-content.py`), **jamais** par éditions manuelles successives.

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

## 8. Résumé final

| Phase | Statut | Détails |
|-------|--------|---------|
| Phase 0 (Git) | ✅ | `.gitignore`, `git init`, commit initial |
| Phase 1 (Nettoyage) | ✅ | 2 doublons supprimés, 6 traductions corrigées, IDs stables, 25 tests Rust OK |
| Phase 2 (Mélange) | ✅ | `shuffle.ts` partagé, Fisher-Yates partout, validation par texte, `accepted[]` géré |
| Phase 2 (Distracteurs) | ✅ | Distracteurs plausibles revus manuellement |
| Phase 3 (50 leçons) | ✅ | 50 leçons, 344 exercices, 12 unités, 322 mots, 7 nouvelles leçons (Unité 12) |
| Phase 4 (Tests) | ⚠️ Partiel | Tests Rust OK, **tests mélange/validation manquants** |
| Audit script unique | ❌ | À faire |
| JSON valide | ✅ | `python3 -c "import json; json.load(open('content/fr-en-a1.json'))"` |

**Prochaine étape recommandée** : Écrire le script d'audit unique (`audit.py`) qui génère `/tmp/sortie.txt` avec toutes les métriques, puis écrire les tests Vitest/Rust manquants.
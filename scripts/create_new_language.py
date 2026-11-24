#!/usr/bin/env python3
"""
Script pour générer un fichier de contenu JSON vide structuré pour une nouvelle langue.
Usage: python scripts/create_new_language.py <source_lang> <target_lang> [--output-dir DIR]

Exemple: python scripts/create_new_language.py fr es
Crée: content/fr-es-a1.json avec 1 unité d'exemple
"""

import json
import argparse
from pathlib import Path
from datetime import datetime


def create_empty_course(source_lang: str, target_lang: str) -> dict:
    """Crée un cours vide avec la structure de base et 1 unité d'exemple."""
    return {
        "course": {
            "source": source_lang,
            "target": target_lang,
            "title": f"{source_lang.upper()} → {target_lang.upper()} A1"
        },
        "phrases": [],
        "units": [
            {
                "id": "u1",
                "slug": "basics",
                "title": "Les bases" if source_lang == "fr" else "Basics" if source_lang == "en" else "Lo básico",
                "color": "#ff6a2b",
                "lessons": [
                    {
                        "id": "u1-l1",
                        "slug": "hello",
                        "title": "Salutations" if source_lang == "fr" else "Greetings" if source_lang == "en" else "Saludos",
                        "exercises": [
                            {
                                "id": "u1-l1-ex1",
                                "kind": "multiple_choice",
                                "prompt": "Comment dit-on « Bonjour » ?" if source_lang == "fr" else "How do you say « Hello »?" if source_lang == "en" else "¿Cómo se dice « Hola »?",
                                "choices": [
                                    "Hello",
                                    "Goodbye",
                                    "Thank you",
                                    "Please"
                                ],
                                "answer": "Hello",
                                "accepted": ["Hi", "Hey"],
                                "vocab": { "en": "hello", "fr": "bonjour" },
                                "audio_key": "hello"
                            },
                            {
                                "id": "u1-l1-ex2",
                                "kind": "translate",
                                "prompt": "Traduis : « Bonjour »",
                                "word_bank": ["Hello", "world", "!"],
                                "answer": "Hello",
                                "accepted": ["Hi"],
                                "vocab": { "en": "hello", "fr": "bonjour" },
                                "audio_key": "hello"
                            },
                            {
                                "id": "u1-l1-ex3",
                                "kind": "listen_type",
                                "prompt": "Écoute et écris ce que tu entends",
                                "answer": "Hello",
                                "accepted": ["Hi", "Hey"],
                                "vocab": { "en": "hello", "fr": "bonjour" },
                                "audio_key": "hello"
                            }
                        ]
                    }
                ]
            }
        ]
    }


def main():
    parser = argparse.ArgumentParser(description="Génère un fichier de contenu pour une nouvelle paire de langues")
    parser.add_argument("source_lang", help="Code langue source (ex: fr, en)")
    parser.add_argument("target_lang", help="Code langue cible (ex: en, es, de, wo)")
    parser.add_argument("--output-dir", default="content", help="Dossier de sortie (défaut: content)")
    parser.add_argument("--force", action="store_true", help="Écraser si le fichier existe déjà")

    args = parser.parse_args()

    source = args.source_lang.lower()
    target = args.target_lang.lower()

    if source == target:
        print(f"❌ Erreur : la langue source et la langue cible doivent être différentes")
        return 1

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{source}-{target}-a1.json"
    filepath = output_dir / filename

    if filepath.exists() and not args.force:
        print(f"❌ Le fichier {filepath} existe déjà. Utilisez --force pour écraser.")
        return 1

    course = create_empty_course(source, target)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(course, f, ensure_ascii=False, indent=2)

    print(f"✅ Fichier créé : {filepath}")
    print(f"   Source : {source}, Cible : {target}")
    print(f"   1 unité, 1 leçon, 3 exercices d'exemple")
    print(f"   N'oubliez pas d'ajouter les fichiers audio correspondants dans public/audio/")

    return 0


if __name__ == "__main__":
    exit(main())
import fs from 'fs';

const content = JSON.parse(fs.readFileSync('content/fr-en-a1.json', 'utf-8'));

// Track changes
const changes = [];

// 1. Replace duplicate "médecin" in u9-l2 (Chez le médecin) - line 3013
// Find u9-l2 (Chez le médecin) and replace the first exercise
content.units.forEach((unit, ui) => {
  if (unit.id === 'u9') {
    unit.lessons.forEach((lesson, li) => {
      if (lesson.id === 'u9-l2') {
        // Replace the first exercise (médecin duplicate) with a new exercise
        lesson.exercises[0] = {
          "kind": "multiple_choice",
          "prompt": "Comment dit-on « infirmier » ?",
          "choices": ["nurse", "doctor", "dentist", "patient"],
          "answer": "nurse",
          "vocab": { "en": "nurse", "fr": "infirmier" }
        };
        changes.push(`Fixed duplicate médecin in u9-l2: replaced with "infirmier/nurse"`);
      }
    });
  }
});

// 2. Fix identical translations - change exercise type or add context
// cousin (u2-l2) - change spelling_bee to test full phrase
content.units.forEach((unit, ui) => {
  if (unit.id === 'u2') {
    unit.lessons.forEach((lesson, li) => {
      if (lesson.id === 'u2-l2') {
        lesson.exercises.forEach((ex, ei) => {
          if (ex.prompt === "Épelle « cousin ».") {
            ex.kind = "fill_blank";
            ex.prompt = "My ___ is my father's nephew.";
            ex.answer = "cousin";
            ex.word_bank = ["cousin", "uncle", "brother", "nephew"];
            ex.vocab = { "en": "cousin", "fr": "cousin" };
            changes.push(`Fixed identical translation cousin in u2-l2: changed to fill_blank with context`);
          }
        });
      }
    });
  }
});

// table (u2-l4) - spelling_bee to test in sentence
content.units.forEach((unit, ui) => {
  if (unit.id === 'u2') {
    unit.lessons.forEach((lesson, li) => {
      if (lesson.id === 'u2-l4') {
        lesson.exercises.forEach((ex, ei) => {
          if (ex.prompt === "Épelle « table ».") {
            ex.kind = "fill_blank";
            ex.prompt = "The book is on the ___.";
            ex.answer = "table";
            ex.word_bank = ["table", "chair", "bed", "desk"];
            ex.vocab = { "en": "table", "fr": "table" };
            changes.push(`Fixed identical translation table in u2-l4: changed to fill_blank with context`);
          }
        });
      }
    });
  }
});

// football (u10-l1) - change vocab to distinguish football/soccer
content.units.forEach((unit, ui) => {
  if (unit.id === 'u10') {
    unit.lessons.forEach((lesson, li) => {
      if (lesson.id === 'u10-l1') {
        lesson.exercises.forEach((ex, ei) => {
          if (ex.prompt === "Comment dit-on « football » ?") {
            ex.vocab = { "en": "football/soccer", "fr": "football" };
            changes.push(`Fixed identical translation football in u10-l1: updated vocab to football/soccer`);
          }
        });
      }
    });
  }
});

// message (u11-l1) - two exercises with identical translation
content.units.forEach((unit, ui) => {
  if (unit.id === 'u11') {
    unit.lessons.forEach((lesson, li) => {
      if (lesson.id === 'u11-l1') {
        lesson.exercises.forEach((ex, ei) => {
          if (ex.prompt === "Épelle « message ».") {
            ex.kind = "fill_blank";
            ex.prompt = "Send me a ___.";
            ex.answer = "message";
            ex.word_bank = ["message", "text", "email", "letter"];
            ex.vocab = { "en": "message", "fr": "message" };
            changes.push(`Fixed identical translation message in u11-l1: changed spelling_bee to fill_blank`);
          }
        });
      }
    });
  }
});

// Also fix the second "message" in u11-l1 (fill_blank at line 3471)
content.units.forEach((unit, ui) => {
  if (unit.id === 'u11') {
    unit.lessons.forEach((lesson, li) => {
      if (lesson.id === 'u11-l1') {
        lesson.exercises.forEach((ex, ei) => {
          if (ex.prompt === "Send me a ___." && ex.answer === "message" && ex.vocab?.fr === "message") {
            ex.vocab = { "en": "message", "fr": "message (text)" };
            changes.push(`Fixed second message in u11-l1: clarified vocab`);
          }
        });
      }
    });
  }
});

// Add a new exercise to u9-l2 to keep 5 exercises (we replaced one)
content.units.forEach((unit, ui) => {
  if (unit.id === 'u9') {
    unit.lessons.forEach((lesson, li) => {
      if (lesson.id === 'u9-l2') {
        // Add a 6th exercise to make it more complete
        lesson.exercises.push({
          "kind": "translate",
          "prompt": "Prenez ce médicament trois fois par jour.",
          "word_bank": ["Take", "this", "medicine", "three", "times", "a", "day"],
          "answer": "Take this medicine three times a day",
          "vocab": { "en": "Take this medicine three times a day", "fr": "Prenez ce médicament trois fois par jour" }
        });
        changes.push(`Added 6th exercise to u9-l2 (Chez le médecin)`);
      }
    });
  }
});

fs.writeFileSync('content/fr-en-a1.json', JSON.stringify(content, null, 2));
console.log('Changes applied:');
changes.forEach(c => console.log('  - ' + c));
EOF
node /tmp/fix-phase1.mjs
// Intégration driver.js : visite guidée au premier lancement.
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { TOUR_STEPS, markTourSeen, tourSeen } from './tour';

/** Lance la visite guidée (3 étapes) si les éléments sont présents. */
export function startTour(): void {
  if (typeof document === 'undefined') return;

  const steps = TOUR_STEPS.filter((step) => document.querySelector(step.element)).map((step) => ({
    element: step.element,
    popover: {
      title: step.title,
      description: step.description,
      side: step.side,
      align: 'center' as const,
    },
  }));

  if (steps.length === 0) return;

  // Marqué dès le départ : la visite ne se relance pas à chaque démarrage.
  markTourSeen();

  const tour = driver({
    steps,
    showProgress: true,
    progressText: '{{current}} sur {{total}}',
    nextBtnText: 'Suivant',
    prevBtnText: 'Retour',
    doneBtnText: "C'est parti !",
    allowClose: true,
    smoothScroll: true,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: 'lakk-tour',
  });

  tour.drive();
}

/** Lance la visite au premier démarrage uniquement. */
export function maybeStartTour(delayMs = 650): void {
  if (tourSeen()) return;
  window.setTimeout(() => startTour(), delayMs);
}

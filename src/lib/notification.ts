// Notifications locales via tauri-plugin-notification.
// Gère la permission, la planification du rappel quotidien (19h00)
// et l'envoi conditionnel (seulement si objectif non atteint).

import { isTauri } from './native';
import { app } from './store.svelte';

const NOTIFICATION_TITLE = 'Lakk';
const DAILY_REMINDER_KEY = 'lakk.notif.daily.enabled';
const DAILY_REMINDER_HOUR = 19;
const DAILY_REMINDER_MINUTE = 0;

/** Vérifie si les notifications quotidiennes sont activées dans les préférences. */
export function isDailyReminderEnabled(): boolean {
  try {
    return localStorage.getItem(DAILY_REMINDER_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Active ou désactive le rappel quotidien. */
export function setDailyReminderEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DAILY_REMINDER_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/** Demande la permission de notification (nécessaire sur mobile, toujours accordée sur desktop). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isTauri) return true; // Sur le web, on simule l'accord
  try {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
    const granted = await isPermissionGranted();
    if (granted) return true;
    const result = await requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/** Envoie une notification immédiate (pour test ou feedback). */
export async function sendNotification(title: string, body: string): Promise<void> {
  if (!isTauri) {
    // Sur le web, on utilise l'API Notification native si dispo
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }
  try {
    const { sendNotification: send } = await import('@tauri-apps/plugin-notification');
    await send({ title, body });
  } catch (e) {
    console.warn('[Notification] Échec envoi:', e);
  }
}

/** Planifie la notification quotidienne à 19h00.
 * Utilise `Schedule.interval` pour qu'elle se répète chaque jour. */
export async function scheduleDailyReminder(): Promise<void> {
  if (!isTauri) return;

  const enabled = isDailyReminderEnabled();
  if (!enabled) {
    await cancelDailyReminder();
    return;
  }

  // Demande la permission avant de planifier
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    // Désactive silencieusement si permission refusée
    setDailyReminderEnabled(false);
    return;
  }

  try {
    const { sendNotification, Schedule } = await import('@tauri-apps/plugin-notification');
    
    // Annule d'abord les anciennes notifications du même type
    await cancelDailyReminder();

    // Planifie pour chaque jour à 19h00
    const schedule = Schedule.interval({
      hour: DAILY_REMINDER_HOUR,
      minute: DAILY_REMINDER_MINUTE,
    });

    await sendNotification({
      title: NOTIFICATION_TITLE,
      body: 'L\'objectif quotidien n\'est pas encore atteint. Viens faire ta leçon ! 🔥',
      schedule,
    });
  } catch (e) {
    console.warn('[Notification] Échec planification:', e);
  }
}

/** Annule le rappel quotidien planifié. */
export async function cancelDailyReminder(): Promise<void> {
  if (!isTauri) return;
  try {
    const { cancelAll } = await import('@tauri-apps/plugin-notification');
    await cancelAll();
  } catch {
    // Ignore errors
  }
}

/** Vérifie si l'objectif quotidien est atteint. */
export function isDailyGoalReached(): boolean {
  return app.goalPercent() >= 100;
}

/** Envoie le rappel conditionnel : seulement si objectif non atteint.
 * À appeler depuis le frontend (ex: au lancement de l'app, ou via un timer). */
export async function sendConditionalDailyReminder(): Promise<void> {
  if (!isDailyReminderEnabled()) return;
  if (isDailyGoalReached()) return; // Objectif déjà atteint, pas de rappel

  await sendNotification(
    NOTIFICATION_TITLE,
    `Ta flamme de ${app.profile.streakDays} jours est en danger ! Viens faire ta leçon sur Lakk. 🔥`
  );
}

/** Initialise le système de notifications au démarrage de l'app. */
export async function initNotifications(): Promise<void> {
  if (!isTauri) return;
  
  // Planifie le rappel quotidien si activé
  await scheduleDailyReminder();
  
  // Optionnel : envoie un rappel immédiat si objectif non atteint
  // (délai court pour laisser l'UI se charger)
  setTimeout(async () => {
    await sendConditionalDailyReminder();
  }, 3000);
}
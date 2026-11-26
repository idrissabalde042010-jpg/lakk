<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { dayKey, mastery } from '../lib/engine';
  import Baobab from '../components/Baobab.svelte';
  import RegularityRing from '../components/RegularityRing.svelte';
  import MissionPolaroid from '../components/MissionPolaroid.svelte';
  import { missionHistory } from '../lib/missions';
  import { getAccount, getAuthState, getSyncStatus, getLastError, login, createAccount, logout, syncToCloud, syncFromCloud, backupNow, restoreBackup, updateSettings, isAnon } from '../lib/account.svelte.ts';
  import { AVATARS, DEFAULT_AVATAR, displayName } from '../lib/profile';
  import { resetTour } from '../lib/tour';
  import { startTour } from '../lib/guidedTour';
  import { resetIntro } from '../lib/intro';
  import { isBgmMuted, toggleBgmMuted } from '../lib/bgm.svelte';
  import { setLocale, SUPPORTED_LOCALES, LEARN_LANGUAGES } from '../lib/i18n';
  import { locale, _ } from 'svelte-i18n';
  import { isDailyReminderEnabled, setDailyReminderEnabled, scheduleDailyReminder, cancelDailyReminder } from '../lib/notification';
  import { updaterState, checkForUpdates, getCurrentVersion } from '../lib/updater';

  const p = $derived(app.profile);
  const cards = $derived(Object.values(app.data.cards));
  const solid = $derived(cards.filter((c) => mastery(c).pct >= 70).length);
  const due = $derived(app.dueCards().length);

  // Série Vivante
  const ring = $derived(app.regularityRing());
  const jokerAvailable = $derived(app.jokerAvailable());
  const paused = $derived(app.paused());
  const pauseUntil = $derived(app.pauseUntil());
  const crownRemaining = $derived(Math.max(0, ring.target - ring.activeCount));

  // Carnet de terrain : polaroids des missions accomplies (100 % local).
  const fieldMissions = missionHistory();

  let dark = $state(document.documentElement.classList.contains('dark'));
  function toggleDark(): void {
    dark = !dark;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('lakk.theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }

  const week = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const ts = Date.now() - (6 - i) * 86_400_000;
      const k = dayKey(ts);
      return {
        k,
        label: new Date(ts).toLocaleDateString('fr-FR', { weekday: 'narrow' }),
        xp: app.data.history[k] ?? 0,
      };
    }),
  );
  const maxXp = $derived(Math.max(1, ...week.map((w) => w.xp)));
  const emptyWeek = $derived(week.every((w) => w.xp === 0));

  const notebook = $derived(
    [...cards].sort((a, b) => mastery(a).pct - mastery(b).pct).slice(0, 6),
  );

  const contentSummary = $derived(
    app.stats
      ? `${app.stats.lessons} leçons · ${app.stats.exercises} exercices · ${app.stats.words} mots`
      : `${app.lessons.length} leçons · ${app.lessons.reduce((n, l) => n + l.data.exercises.length, 0)} exercices`,
  );

  // --- Compte ---
  const account = $derived(getAccount());
  const auth = $derived(getAuthState());
  const syncStatus = $derived(getSyncStatus());
  const lastError = $derived(getLastError());

  let showAuth = $state(false);
  let authMode = $state<'login' | 'register'>('login');
  let authEmail = $state('');
  let authPassword = $state('');
  let authError = $state<string | null>(null);
  let authLoading = $state(false);
  let showBackup = $state(false);
  let backupPassword = $state('');
  let backupResult = $state<string | null>(null);
  let restoreFile = $state<File | null>(null);

  // --- Nom & avatar ---
  let editingName = $state(false);
  let draftName = $state('');

  // --- Mises à jour ---
  let appVersion = $state('');
  let updateCheckMessage = $state('');
  const checkingUpdates = $derived($updaterState.status === 'checking');

  onMount(() => {
    void getCurrentVersion().then((version) => {
      appVersion = version;
    });
  });

  async function checkUpdates(): Promise<void> {
    updateCheckMessage = '';
    const result = await checkForUpdates({ silent: false });
    if (result.status === 'available' && result.version) {
      updateCheckMessage = $_( 'updater.available_short', { values: { version: result.version } });
    } else if (result.error) {
      updateCheckMessage = $_( 'updater.check_failed' );
    } else {
      updateCheckMessage = $_( 'updater.up_to_date' );
    }
  }

  function startEditName(): void {
    draftName = p.name;
    editingName = true;
  }

  function saveName(): void {
    app.setName(draftName);
    editingName = false;
  }

  function cancelEditName(): void {
    editingName = false;
    draftName = '';
  }

  function replayTour(): void {
    resetTour();
    app.setScreen('home');
    window.setTimeout(() => startTour(), 450);
  }

  function replayIntro(): void {
    resetIntro();
    app.setScreen('home');
    app.openIntro();
  }

  function planPause(): void {
    app.startPause(7);
    app.notify('Pause de 7 jours activée. Ta série est protégée.');
  }

  function resumeFromPause(): void {
    app.cancelPause();
    app.notify('Pause annulée. On reprend !');
  }

  async function toggleDailyReminder(): Promise<void> {
    const enabled = !isDailyReminderEnabled();
    setDailyReminderEnabled(enabled);
    if (enabled) {
      await scheduleDailyReminder();
      app.notify($_( 'profile.daily_reminder_on' ));
    } else {
      await cancelDailyReminder();
      app.notify($_( 'profile.daily_reminder_off' ));
    }
  }

  async function handleAuth(): Promise<void> {
    authError = null;
    authLoading = true;
    try {
      if (authMode === 'login') {
        await login(authEmail, authPassword);
      } else {
        await createAccount(authEmail, authPassword);
      }
      showAuth = false;
      authEmail = '';
      authPassword = '';
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Erreur';
    } finally {
      authLoading = false;
    }
  }

  function handleLogout(): void {
    if (confirm('Déconnexion ? Tes données restent sur cet appareil.')) {
      logout();
    }
  }

  async function handleSyncUp(): Promise<void> {
    await syncToCloud();
  }

  async function handleSyncDown(): Promise<void> {
    await syncFromCloud();
  }

  async function handleBackup(): Promise<void> {
    try {
      const json = await backupNow(backupPassword || undefined);
      backupResult = json;
    } catch (e) {
      backupResult = 'Erreur : ' + (e instanceof Error ? e.message : 'inconnue');
    }
  }

  async function handleRestore(): Promise<void> {
    if (!restoreFile) return;
    const text = await restoreFile.text();
    try {
      await restoreBackup(text, backupPassword || undefined);
      backupResult = 'Restauré avec succès !';
      restoreFile = null;
    } catch (e) {
      backupResult = 'Erreur : ' + (e instanceof Error ? e.message : 'inconnue');
    }
  }

  function reset(): void {
    if (confirm('Effacer toute la progression et repartir de zéro ?')) {
      app.reset();
    }
  }
</script>

<div class="profile rise">
  <header class="head">
    <div class="avatar" aria-hidden="true">{p.avatar || DEFAULT_AVATAR}</div>
    <div class="head-main">
      {#if editingName}
        <form
          class="name-form"
          onsubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <input bind:value={draftName} maxlength={24} aria-label="Nom" />
          <button type="submit" aria-label="Enregistrer">✓</button>
          <button type="button" onclick={cancelEditName} aria-label="Annuler">✕</button>
        </form>
      {:else}
        <h1>
          {displayName(p.name)}
          <button class="edit-name" type="button" onclick={startEditName} aria-label="Modifier le nom">✏️</button>
        </h1>
      {/if}
      <p class="small muted">Rufisque, Sénégal</p>
    </div>
  </header>

  <section class="card avatar-card">
    <p class="eyebrow">Ton avatar</p>
    <div class="avatar-row">
      {#each AVATARS as a}
        <button
          class="avatar-choice"
          class:on={(p.avatar || DEFAULT_AVATAR) === a}
          onclick={() => app.setAvatar(a)}
          aria-label={`Choisir l'avatar ${a}`}
          aria-pressed={(p.avatar || DEFAULT_AVATAR) === a}
        >
          {a}
        </button>
      {/each}
    </div>
    <p class="small muted">Choisis ton compagnon de route.</p>
  </section>

  <section class="card baobab-card">
    <Baobab streak={p.streakDays} size={108} />
    <div class="grow">
      <p class="eyebrow">Ton baobab</p>
      <p class="big"><strong>{p.streakDays}</strong> jour{p.streakDays > 1 ? 's' : ''}</p>
      <p class="small muted">{p.xpTotal} graines au total</p>
      <div class="freeze-display">
        <span class="freeze-icon" aria-label="Gels de série">❄️</span>
        <span class="freeze-count">{p.freezeCount}</span>
        <span class="freeze-label">/ 2 cette semaine</span>
      </div>
    </div>
  </section>

  <!-- Série Vivante -->
  <section class="card streak-live">
    <div class="row between">
      <p class="eyebrow">Série vivante</p>
      <span class="small muted">{ring.activeCount}/{ring.target} jours actifs</span>
    </div>
    <div class="streak-live-row">
      <RegularityRing ring={ring} size={96} />
      <div class="grow">
        <p class="small muted">
          {#if ring.crown}
            Couronne de régularité ! Ta semaine est complète. 🌿
          {:else}
            Encore {crownRemaining} jour{crownRemaining > 1 ? 's' : ''} pour ta couronne.
          {/if}
        </p>
        <p class="small muted">🎟️ Joker mensuel : {jokerAvailable ? 'disponible' : 'utilisé ce mois-ci'}</p>
        <p class="small muted">⏸ Pause : {paused ? `jusqu’au ${pauseUntil}` : 'aucune'}</p>
        <div class="streak-actions">
          {#if paused}
            <button class="mini-btn" onclick={resumeFromPause}>Reprendre</button>
          {:else}
            <button class="mini-btn" onclick={planPause}>Pause 7 jours</button>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <!-- Carnet de terrain : les missions de la vraie vie -->
  <section class="card fieldbook">
    <div class="row between">
      <p class="eyebrow">Carnet de terrain</p>
      <span class="small muted">
        {fieldMissions.length} mission{fieldMissions.length > 1 ? 's' : ''}
      </span>
    </div>
    {#if fieldMissions.length === 0}
      <p class="small muted fieldbook-empty">
        Tes missions accomplies apparaîtront ici, comme des polaroids. La première t’attend sur l’accueil. 🌿
      </p>
    {:else}
      <div class="polaroid-grid">
        {#each fieldMissions as item, i}
          <MissionPolaroid {item} index={i} />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Badges de série -->
  <section class="card badges-card">
    <p class="eyebrow">Tes badges de série</p>
    <div class="badges-grid">
      {#each [7, 30, 50, 100, 365] as milestone}
        {@const badge = p.badges?.[milestone.toString()]}
        <div class="badge-slot" class:earned={!!badge}>
          <span class="badge-icon" aria-label={badge ? `Badge ${milestone} jours gagné le ${new Date(badge.earnedAt!).toLocaleDateString('fr-FR')}` : `Badge ${milestone} jours — pas encore gagné`}>
            {milestone === 7 ? '🌱' : milestone === 30 ? '🌿' : milestone === 50 ? '🌳' : milestone === 100 ? '🏆' : '👑'}
          </span>
          <span class="badge-days">{milestone} j</span>
          <span class="badge-label">{badge ? 'Gagné' : 'À débloquer'}</span>
          {#if badge}
            <span class="badge-date">{new Date(badge.earnedAt!).toLocaleDateString('fr-FR')}</span>
          {:else}
            <span class="badge-progress">{p.streakDays}/{milestone}</span>
          {/if}
        </div>
      {/each}
    </div>
    <p class="small muted">Style Streak Society : 7, 30, 50, 100, 365 jours</p>
  </section>

  <section class="grid">
    <div class="stat">
      <span class="v">{cards.length}</span>
      <span class="k">mots appris</span>
    </div>
    <div class="stat">
      <span class="v">🔥 {p.streakDays}</span>
      <span class="k">série (jours)</span>
    </div>
    <div class="stat">
      <span class="v">{solid}</span>
      <span class="k">bien retenus</span>
    </div>
    <div class="stat">
      <span class="v">{due}</span>
      <span class="k">à réviser</span>
    </div>
  </section>

  <section class="card chart-card">
    <div class="row between">
      <p class="eyebrow">Cette semaine</p>
      <span class="small muted">graines / jour</span>
    </div>
    <div class="chart">
      {#each week as w}
        <div class="col">
          <div class="bar-wrap">
            <div
              class="bar"
              style={`height:${Math.max(6, Math.round((w.xp / maxXp) * 100))}%`}
              class:zero={w.xp === 0}
              title={`${w.xp} graines`}
            ></div>
          </div>
          <span class="day">{w.label}</span>
        </div>
      {/each}
    </div>
    {#if emptyWeek}
      <p class="chart-empty small muted">Ta première graine t’attend aujourd’hui.</p>
    {/if}
  </section>

  <section class="card settings">
    <p class="eyebrow">Réglages</p>

    <div class="set-row">
      <span>Objectif par jour</span>
      <div class="goals">
        {#each [10, 20, 30, 50] as g}
          <button class="goal-chip" class:on={p.dailyGoalXp === g} onclick={() => app.setGoal(g)}>
            {g}
          </button>
        {/each}
      </div>
    </div>

    <div class="set-row">
      <span>Thème sombre</span>
      <button class="switch" class:on={dark} onclick={toggleDark} aria-pressed={dark} aria-label="Thème sombre">
        <span></span>
      </button>
    </div>

    <div class="set-row">
      <span>Musique d'ambiance<small class="muted">{isBgmMuted() ? 'coupée' : 'douce · 30 %'}</small></span>
      <button
        class="switch"
        class:on={!isBgmMuted()}
        onclick={toggleBgmMuted}
        aria-pressed={!isBgmMuted()}
        aria-label="Musique d'ambiance"
      >
        <span></span>
      </button>
    </div>

    <div class="set-row">
      <span>{$_( 'profile.notifications' )}</span>
    </div>

    <div class="set-row">
      <span>{$_( 'profile.daily_reminder' )}<small class="muted">{$_( 'profile.daily_reminder_hint' )}</small></span>
      <button
        class="switch"
        class:on={isDailyReminderEnabled()}
        onclick={toggleDailyReminder}
        aria-pressed={isDailyReminderEnabled()}
        aria-label={$_( 'profile.daily_reminder' )}
      >
        <span></span>
      </button>
    </div>

    <div class="set-row">
      <span>Énergie illimitée<small class="muted">toujours gratuit</small></span>
      <button
        class="switch"
        class:on={p.unlimitedEnergy}
        onclick={() => app.toggleEnergy()}
        aria-pressed={p.unlimitedEnergy}
        aria-label="Énergie illimitée"
      >
        <span></span>
      </button>
    </div>

    <!-- Langues -->
    <div class="set-row">
      <span>{$_( 'profile.language' )}</span>
    </div>

    <div class="set-row lang-row">
      <div class="lang-field">
        <label for="profile-ui-lang">{$_( 'profile.ui_language' )}</label>
        <select id="profile-ui-lang" bind:value={p.uiLang} onchange={() => { setLocale(p.uiLang); app.save(); }}>
          {#each SUPPORTED_LOCALES as lang}
            <option value={lang}>{lang === 'fr' ? 'Français' : 'English'}</option>
          {/each}
        </select>
      </div>
      <div class="lang-field">
        <label for="profile-learn-lang">{$_( 'profile.learn_language' )}</label>
        <select id="profile-learn-lang" bind:value={p.learnLang} onchange={() => app.save()}>
          {#each LEARN_LANGUAGES as lang}
            <option value={lang.code} disabled={!lang.available}>
              {lang.name} {#if !lang.available}({$_( 'profile.lang_coming_soon' )}){/if}
            </option>
          {/each}
        </select>
      </div>
    </div>

    <div class="set-row">
      <span>Visite guidée<small class="muted">revoir les 3 étapes</small></span>
      <button class="mini-btn" onclick={replayTour}>Revoir</button>
    </div>

    <div class="set-row">
      <span>Histoire d'introduction<small class="muted">revoir l'histoire de Lakk</small></span>
      <button class="mini-btn" onclick={replayIntro}>Revoir</button>
    </div>

    <div class="set-row updater-row">
      <span>
        {$_('updater.current_version', { values: { version: appVersion || '…' } })}
        <small class="muted">{$_('updater.check_hint')}</small>
      </span>
      <button class="mini-btn" onclick={checkUpdates} disabled={checkingUpdates}>
        {checkingUpdates ? $_('updater.checking') : $_('updater.check')}
      </button>
    </div>
    {#if updateCheckMessage}
      <p class="small muted updater-message">{updateCheckMessage}</p>
    {/if}
  </section>

  <!-- Compte & Synchronisation -->
  <section class="card account">
    <div class="row between">
      <p class="eyebrow">Compte</p>
      {#if auth}
        <span class="badge sync" class:synced={syncStatus === 'synced'} class:error={syncStatus === 'error'} class:pending={syncStatus === 'syncing'}>
          {syncStatus === 'synced' ? '✓ Synchronisé' : syncStatus === 'syncing' ? '⟳ Sync…' : syncStatus === 'error' ? '⚠ Erreur' : '☁ Cloud'}
        </span>
      {/if}
    </div>

    {#if !auth}
      <div class="auth-panel">
        <p class="small muted">Crée un compte pour synchroniser ta progression sur plusieurs appareils (optionnel, gratuit).</p>

        <!-- OAuth Buttons (désactivés, bientôt disponibles) -->
        <div class="oauth-buttons">
          <button
            class="btn oauth google block"
            disabled
            aria-disabled="true"
            title={$_( 'profile.oauth_coming_soon' )}
          >
            <svg class="oauth-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.02-3.02C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{$_( 'profile.oauth_google' )}</span>
          </button>
          <button
            class="btn oauth apple block"
            disabled
            aria-disabled="true"
            title={$_( 'profile.oauth_coming_soon' )}
          >
            <svg class="oauth-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.697c-.878.266-1.836.405-2.817.405-1.733 0-3.27-1.047-3.86-2.64-.03-.08-.05-.173-.05-.254 0-.094.033-.18.05-.26.586-1.58 2.12-2.63 3.86-2.63.98 0 1.94.14 2.82.4.88.26 1.68.65 2.38 1.16l.57-.57c-.56-.6-1.27-1.32-1.84-2.1-.64-.88-1.1-1.93-1.38-3.14h-.03c.4-1.55 1.07-2.95 2.03-4.18.12-.16.23-.32.33-.49l-.6-.6c-.15.25-.32.5-.52.74-1.22 1.48-2.06 3.33-2.06 5.46 0 3.17 1.29 5.8 3.3 7.78.25.25.56.4 1 .42l.63-.62zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.75.22-1.55.33-2.38.33-.79 0-1.55-.14-2.27-.4l.59-.58c.72.4 1.48.66 2.27.66 1.84 0 3.35-1.33 3.76-3.37.04-.25.06-.5.06-.76 0-.25-.02-.5-.06-.75-.52-.84-1.27-1.55-2.18-2.14l.6-.6c1.33 1.07 2.2 2.5 2.59 4.2.16.68.2 1.37.18 2.06-.04 1.78-.72 3.4-2.05 4.77l.6.6c1.44-1.3 2.27-3.15 2.27-5.2 0-2.73-1.2-5.1-3.14-6.73-.1-.1-.22-.19-.34-.26l-.57.57c.24 1.15.7 2.26 1.38 3.26.07.1.14.2.2.31.93-.4 1.63-1.05 2.04-2.06l.6.6c-.72 1.8-1.84 3.4-3.24 4.72-.22.2-.46.33-.7.33z"/>
            </svg>
            <span>{$_( 'profile.oauth_apple' )}</span>
          </button>
        </div>

        <button class="btn block" onclick={() => { showAuth = true; authMode = 'register'; }}>Créer un compte</button>
        <button class="btn ghost block" onclick={() => { showAuth = true; authMode = 'login'; }}>Se connecter</button>
      </div>
    {:else}
      <div class="account-info">
        <div class="row">
          <span class="small muted">Connecté en tant que</span>
          <strong>{account?.email}</strong>
        </div>
        <div class="row">
          <span class="small muted">Dernière sync</span>
          <strong>{account?.lastSync ? new Date(account.lastSync).toLocaleString('fr-FR') : 'Jamais'}</strong>
        </div>
        <div class="sync-actions">
          <button class="btn block" onclick={handleSyncUp} disabled={syncStatus === 'syncing'}>☁ Sauvegarder (cloud)</button>
          <button class="btn ghost block" onclick={handleSyncDown} disabled={syncStatus === 'syncing'}>⬇ Restaurer (cloud)</button>
        </div>
        {#if lastError}
          <p class="small muted" style="color: var(--rose);">{lastError}</p>
        {/if}
        <button class="btn ghost block" onclick={handleLogout}>Se déconnecter</button>
      </div>
    {/if}

    {#if showAuth}
      <form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleAuth(); }}>
        <h4>{authMode === 'login' ? 'Connexion' : 'Créer un compte'}</h4>
        <label>
          <span class="small">Email</span>
          <input type="email" bind:value={authEmail} placeholder="toi@exemple.com" required autocomplete="email" />
        </label>
        <label>
          <span class="small">Mot de passe</span>
          <input type="password" bind:value={authPassword} placeholder="••••••••" required minlength={6} autocomplete={authMode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {#if authError}
          <p class="small" style="color: var(--rose);">{authError}</p>
        {/if}
        <div class="row">
          <button class="btn orange block" type="submit" disabled={authLoading || !authEmail || !authPassword}>
            {authLoading ? '⟳' : authMode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
          <button class="btn ghost block" type="button" onclick={() => { showAuth = false; authError = null; }}>Annuler</button>
        </div>
      </form>
    {/if}

    <details class="backup-section">
      <summary>💾 Sauvegarde locale (fichier chiffré)</summary>
      <p class="small muted">Exporte ou importe ta progression complète (profil + vocabulaire + historique) dans un fichier JSON chiffré.</p>
      <label>
        <span class="small">Mot de passe (optionnel, pour chiffrer)</span>
        <input type="password" bind:value={backupPassword} placeholder="Laisser vide = non chiffré" autocomplete="new-password" />
      </label>
      <div class="row">
        <button class="btn block" onclick={handleBackup}>Exporter la sauvegarde</button>
        <label class="btn ghost block">
          Importer
          <input type="file" accept=".json" onchange={(e) => { const t = e.target as HTMLInputElement; restoreFile = t.files?.[0] ?? null; handleRestore(); }} style="display:none" />
        </label>
      </div>
      {#if backupResult}
        <textarea class="backup-output" readonly>{backupResult}</textarea>
        <button class="btn ghost block" onclick={() => { if (backupResult) navigator.clipboard.writeText(backupResult); backupResult = 'Copié !'; }}>Copier</button>
      {/if}
    </details>
  </section>

  {#if notebook.length > 0}
    <details class="card notebook">
      <summary>Mon carnet de mots <span class="small muted">({cards.length})</span></summary>
      {#each notebook as c}
        <div class="word-row">
          <div class="word-main">
            <strong>{c.vocab.en}</strong>
            <span class="small muted">{c.vocab.fr}</span>
          </div>
          <div class="mini-bar"><span style={`width:${mastery(c).pct}%`}></span></div>
        </div>
      {/each}
      {#if cards.length > notebook.length}
        <p class="small muted more">+ {cards.length - notebook.length} autre(s) mot(s)</p>
      {/if}
    </details>
  {/if}

  <section class="card about">
    <p class="eyebrow">À propos</p>
    <div class="about-row">
      <span>Moteur</span>
      <strong>{app.engine === 'rust' ? 'lakk-core (Rust)' : 'Miroir TypeScript'}</strong>
    </div>
    <div class="about-row">
      <span>Contenu</span>
      <strong>{contentSummary}</strong>
    </div>
    <div class="about-row">
      <span>Version</span>
      <strong>{appVersion || '…'} · MIT</strong>
    </div>
  </section>

  <button class="btn ghost block reset" onclick={reset}>Réinitialiser</button>
  <p class="footer-note">Lakk · gratuit · sans compte</p>
</div>

<style>
  .profile {
    padding: 0 16px 24px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 22px 0 16px;
  }
  .head h1 {
    font-size: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .head-main {
    min-width: 0;
    flex: 1;
  }
  .avatar {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: radial-gradient(120% 120% at 30% 20%, #ff8a53, var(--orange));
    display: grid;
    place-items: center;
    font-size: 30px;
    line-height: 1;
    box-shadow: 0 4px 0 var(--orange-deep);
    flex: none;
  }
  .edit-name {
    border: 0;
    background: none;
    padding: 2px;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.7;
  }
  .edit-name:hover {
    opacity: 1;
  }
  .name-form {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .name-form input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1.5px solid var(--orange);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
  }
  .name-form button {
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 10px;
    border: 0;
    background: var(--teal-soft);
    color: var(--teal-deep);
    font-weight: 700;
    cursor: pointer;
  }
  .avatar-card {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .avatar-row {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
  .avatar-choice {
    flex: 1;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    font-size: 24px;
    border-radius: 14px;
    border: 2px solid var(--line);
    background: var(--card);
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease, transform 0.08s ease;
  }
  .avatar-choice:active {
    transform: scale(0.95);
  }
  .avatar-choice.on {
    border-color: var(--orange);
    background: var(--orange-soft);
  }
  .mini-btn {
    padding: 7px 14px;
    border-radius: 10px;
    border: 1.5px solid var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .baobab-card {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .streak-live {
    margin-bottom: 10px;
  }
  .streak-live-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 10px;
  }
  .streak-actions {
    margin-top: 8px;
  }
  .fieldbook {
    margin-bottom: 10px;
  }
  .fieldbook-empty {
    margin-top: 10px;
  }
  .polaroid-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 14px 10px;
    margin-top: 14px;
    padding: 4px 2px 2px;
  }
  .big {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 600;
    margin: 2px 0;
    line-height: 1;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .stat {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: center;
  }
  .stat .v {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--teal);
  }
  .stat .k {
    font-size: 11px;
    color: var(--muted);
    line-height: 1.15;
  }
  .chart-card {
    margin-bottom: 10px;
  }
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 108px;
    margin-top: 14px;
  }
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
  }
  .bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .bar {
    width: 66%;
    border-radius: 8px 8px 4px 4px;
    background: linear-gradient(180deg, var(--mango), var(--orange));
    transition: height 0.5s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .bar.zero {
    background: var(--line);
  }
  .chart-empty {
    text-align: center;
    margin-top: 10px;
  }
  .day {
    font-size: 10.5px;
    color: var(--muted);
    text-transform: uppercase;
  }
  .settings {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .set-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .set-row > span {
    font-size: 14px;
    font-weight: 500;
    display: flex;
    flex-direction: column;
  }
  .set-row small {
    font-size: 11px;
    font-weight: 400;
  }
  .updater-row {
    flex-wrap: wrap;
  }
  .updater-row .mini-btn {
    white-space: nowrap;
  }
  .updater-message {
    margin: -8px 0 0;
    text-align: right;
  }
  .goals {
    display: flex;
    gap: 6px;
  }
  .goal-chip {
    width: 36px;
    height: 34px;
    border-radius: 10px;
    border: 1.5px solid var(--line);
    background: var(--card);
    color: var(--ink-soft);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .goal-chip.on {
    border-color: var(--orange);
    background: var(--orange-soft);
    color: var(--orange-deep);
  }
  .switch {
    width: 46px;
    height: 27px;
    border-radius: 999px;
    border: 0;
    background: var(--line);
    position: relative;
    cursor: pointer;
    flex: none;
    transition: background 0.15s ease;
  }
  .switch span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.18s ease;
  }
  .switch.on {
    background: var(--teal);
  }
  .switch.on span {
    transform: translateX(19px);
  }
  .notebook {
    margin-bottom: 10px;
  }
  .notebook summary {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    list-style: none;
  }
  .notebook summary::-webkit-details-marker {
    display: none;
  }
  .notebook summary::before {
    content: '▸';
    display: inline-block;
    margin-right: 8px;
    color: var(--teal);
    transition: transform 0.15s ease;
  }
  .notebook[open] summary::before {
    transform: rotate(90deg);
  }
  .word-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 0 0;
  }
  .word-main {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .word-main strong {
    font-size: 15px;
  }
  .mini-bar {
    height: 6px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }
  .mini-bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--teal);
  }
  .more {
    margin-top: 10px;
  }
  .about {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .about-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
  }
  .about-row span {
    color: var(--muted);
  }
  .about-row strong {
    font-weight: 600;
    text-align: right;
  }
  .reset {
    margin-top: 4px;
    color: var(--rose);
    border-color: var(--rose-soft);
  }
  .footer-note {
    text-align: center;
    font-size: 11.5px;
    color: var(--muted);
    margin-top: 16px;
  }

  /* --- Compte --- */
  .account {
    margin-bottom: 10px;
  }
  .badge.sync {
    font-size: 10px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--line);
    color: var(--muted);
  }
  .badge.sync.synced {
    background: var(--teal-soft);
    color: var(--teal-deep);
  }
  .badge.sync.pending {
    background: var(--blue-soft);
    color: var(--blue);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .badge.sync.error {
    background: var(--rose-soft);
    color: var(--rose);
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .auth-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .account-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
  }
  .sync-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
    padding: 12px;
    background: var(--paper);
    border-radius: 12px;
  }
  .auth-form h4 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .auth-form label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }
  .auth-form input {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1.5px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 15px;
  }
  .auth-form input:focus {
    outline: none;
    border-color: var(--orange);
  }
  .auth-form .row {
    display: flex;
    gap: 8px;
  }
  .auth-form .btn {
    flex: 1;
  }
  .backup-section {
    margin-top: 12px;
  }
  .backup-section summary {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    list-style: none;
  }
  .backup-section summary::-webkit-details-marker { display: none; }
  .backup-section summary::before { content: '▸'; margin-right: 8px; color: var(--teal); transition: transform 0.15s; }
  .backup-section[open] summary::before { transform: rotate(90deg); }
  .backup-section label { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; font-size: 13px; }
  .backup-section input { padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--card); color: var(--ink); font-size: 15px; }
  .backup-section .row { display: flex; gap: 8px; margin-top: 10px; }
  .backup-section .btn { flex: 1; }
  .backup-output {
    width: 100%;
    min-height: 80px;
    max-height: 200px;
    margin-top: 10px;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--ink);
    color: var(--mango);
    font-family: monospace;
    font-size: 11px;
    resize: vertical;
  }

  /* --- Langues --- */
  .lang-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .lang-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lang-field label {
    font-size: 13px;
    color: var(--ink-soft);
    font-weight: 500;
  }
  .lang-field select {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1.5px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 15px;
    cursor: pointer;
  }
  .lang-field select:focus {
    outline: none;
    border-color: var(--orange);
  }
  .lang-field select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* --- OAuth Buttons --- */
  .oauth-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }
  .oauth {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 12px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    border: 1.5px solid var(--line);
    background: var(--card);
    color: var(--ink);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, opacity 0.15s;
  }
  .oauth:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .oauth-icon {
    width: 20px;
    height: 20px;
    flex: none;
  }
  .oauth.google {
    border-color: #dadce0;
  }
  .oauth.google:hover:not(:disabled) {
    border-color: #4285F4;
    box-shadow: 0 4px 16px -4px rgba(66, 133, 244, 0.4);
  }
  .oauth.apple {
    border-color: #dadce0;
  }
  .oauth.apple:hover:not(:disabled) {
    border-color: #000;
    box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
  }

  .freeze-display {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 6px 10px;
    background: var(--blue-soft);
    border-radius: 999px;
    border: 1px solid var(--blue);
    width: fit-content;
  }
  .freeze-icon {
    font-size: 14px;
  }
  .freeze-count {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 16px;
    color: var(--blue);
  }
  .freeze-label {
    font-size: 11px;
    color: var(--muted);
  }

  /* --- Badges de série --- */
  .badges-card {
    margin-bottom: 10px;
    max-width: 100%;
    overflow: hidden;
  }
  .badges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
    gap: 6px;
    margin-top: 10px;
    justify-content: center;
  }
  .badge-slot {
    background: var(--card);
    border: 2px solid var(--line);
    border-radius: 14px;
    padding: 10px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    transition: border-color 0.2s, background 0.2s, transform 0.1s;
  }
  .badge-slot.earned {
    border-color: var(--mango);
    background: var(--mango-soft);
  }
  .badge-icon {
    font-size: 28px;
    line-height: 1;
    filter: grayscale(1);
    transition: filter 0.2s;
  }
  .badge-slot.earned .badge-icon {
    filter: grayscale(0);
  }
  .badge-days {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 14px;
    color: var(--ink);
  }
  .badge-label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge-date {
    font-size: 9px;
    color: var(--teal);
    font-weight: 600;
  }
  .badge-progress {
    font-size: 9px;
    color: var(--muted);
    font-family: var(--font-display);
    font-weight: 600;
  }
</style>
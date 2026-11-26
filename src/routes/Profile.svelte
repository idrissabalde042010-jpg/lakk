<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { dayKey, mastery } from '../lib/engine';
  import Baobab from '../components/Baobab.svelte';
  import RegularityRing from '../components/RegularityRing.svelte';
  import MissionPolaroid from '../components/MissionPolaroid.svelte';
  import ErrorRadar from '../components/ErrorRadar.svelte';
  import { missionHistory } from '../lib/missions';
  import { signUp, signIn, signOut, resetPassword, getProfile, updateProfile, type AuthUser } from '../lib/auth';
  import { AVATARS, DEFAULT_AVATAR, displayName } from '../lib/profile';
  import { getUserSegment, segmentLabel } from '../lib/segment';
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

  // Carnet de Traces : erreurs par pattern pour l'empreinte.
  const errorCounts = $derived(app.errorsByPattern());

  // Carnet de terrain : polaroids des missions accomplies.
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

  // --- Compte (Supabase) ---
  let authUser = $state<AuthUser | null>(null);
  let authLoading = $state(true);
  let authError = $state<string | null>(null);

  let showAuth = $state(false);
  let authMode = $state<'login' | 'register'>('login');
  let authEmail = $state('');
  let authPassword = $state('');
  let regFirstName = $state('');
  let regAge = $state('');
  let regConfirmPassword = $state('');
  let regPrivacy = $state(false);
  let regParentConsent = $state(false);

  let showTransparency = $state(false);
  let backupPassword = $state('');
  let backupResult = $state<string | null>(null);
  let restoreFile = $state<File | null>(null);

  // Édition prénom / âge (Supabase profiles)
  let editingProfile = $state(false);
  let editFirstName = $state('');
  let editAge = $state('');

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

  // --- Auth : session et écoute des changements ---
  onMount(async () => {
    try {
      const { getSession } = await import('../lib/auth');
      const sessionUser = await getSession();
      authUser = sessionUser;
    } catch {
      authUser = null;
    } finally {
      authLoading = false;
    }

    const { onAuthStateChange } = await import('../lib/auth');
    const { data: subscription } = onAuthStateChange((user) => {
      authUser = user;
    });
    return () => subscription?.unsubscribe();
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

  function toggleTransparency(): void {
    showTransparency = !showTransparency;
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
        await signIn({ email: authEmail, password: authPassword });
      } else {
        const age = parseInt(regAge, 10);
        await signUp({
          email: authEmail,
          password: authPassword,
          firstName: regFirstName,
          age,
        });
      }
      showAuth = false;
      authEmail = '';
      authPassword = '';
      regFirstName = '';
      regAge = '';
      regConfirmPassword = '';
      regPrivacy = false;
      regParentConsent = false;
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Erreur';
    } finally {
      authLoading = false;
    }
  }

  async function handleLogout(): Promise<void> {
    if (confirm('Déconnexion ? Tes données restent sur cet appareil.')) {
      try {
        await signOut();
      } catch {
        /* ignore */
      }
    }
  }

  async function handleDeleteAccount(): Promise<void> {
    if (!confirm('Supprimer définitivement ton compte et toutes tes données ? Cette action est irréversible.')) return;
    try {
      // Supabase Auth ne permet pas la suppression de compte côté client sans fonction serveur.
      // L'utilisateur doit être invité à contacter le support ou utiliser le dashboard Supabase.
      authError = 'La suppression de compte nécessite une fonction serveur Supabase (deleteUser). Contacte le support pour demander la suppression de ton compte.';
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Erreur lors de la suppression.';
    }
  }

  async function handleBackup(): Promise<void> {
    try {
      const { backupNow } = await import('../lib/account.svelte.ts');
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
      const { restoreBackup } = await import('../lib/account.svelte.ts');
      await restoreBackup(text, backupPassword || undefined);
      backupResult = 'Restauré avec succès !';
      restoreFile = null;
    } catch (e) {
      backupResult = 'Erreur : ' + (e instanceof Error ? e.message : 'inconnue');
    }
  }

  function editProfile(): void {
    editFirstName = authUser?.first_name ?? '';
    editAge = authUser?.age?.toString() ?? '';
    editingProfile = true;
  }

  async function saveProfile(): Promise<void> {
    if (!authUser) return;
    const updates: { first_name?: string; age?: number } = {};
    if (editFirstName.trim()) updates.first_name = editFirstName.trim();
    const age = parseInt(editAge, 10);
    if (!Number.isNaN(age) && age >= 1) updates.age = age;
    try {
      await updateProfile(authUser.id, updates);
      editingProfile = false;
      // Rafraîchir l'utilisateur via getProfile
      const profile = await getProfile(authUser.id);
      if (profile && authUser) {
        authUser.first_name = profile.first_name;
        authUser.age = profile.age;
      }
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Erreur lors de la mise à jour du profil.';
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

  <!-- Empreinte d'erreurs -->
  <ErrorRadar counts={errorCounts} />

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

    <div class="set-row">
      <span>Confidentialité & transparence<small class="muted">tes données, cet appareil seulement</small></span>
      <button class="mini-btn" onclick={toggleTransparency}>
        {showTransparency ? 'Masquer' : 'Voir'}
      </button>
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

  <!-- Compte (Supabase) -->
  <section class="card account">
    <div class="row between">
      <p class="eyebrow">Compte</p>
      {#if authUser}
        <span class="badge sync synced">✓ Connecté</span>
      {/if}
    </div>

    {#if !authUser}
      <div class="auth-panel">
        <p class="small muted">Un compte est requis pour utiliser Lakk. Crée un compte ou connecte-toi.</p>
        <button class="btn block" onclick={() => { showAuth = true; authMode = 'register'; }}>Créer un compte</button>
        <button class="btn ghost block" onclick={() => { showAuth = true; authMode = 'login'; }}>Se connecter</button>
      </div>
    {:else}
      <div class="account-info">
        <div class="row">
          <span class="small muted">Email</span>
          <strong>{authUser.email}</strong>
        </div>
        {#if authUser.first_name}
          <div class="row">
            <span class="small muted">Prénom</span>
            <strong>{authUser.first_name}</strong>
          </div>
        {/if}
        {#if authUser.age !== null && authUser.age !== undefined}
          <div class="row">
            <span class="small muted">Âge</span>
            <strong>{authUser.age} ans</strong>
          </div>
        {/if}
        {#if authUser.first_name}
          <div class="row">
            <span class="small muted">Segment</span>
            <strong>{getUserSegment(authUser.age) ? segmentLabel(getUserSegment(authUser.age)) : '—'}</strong>
          </div>
        {/if}
        {#if editingProfile}
          <div class="edit-profile-form">
            <label>
              <span class="small">Prénom</span>
              <input type="text" bind:value={editFirstName} placeholder="Prénom" />
            </label>
            <label>
              <span class="small">Âge</span>
              <input type="number" bind:value={editAge} min="1" max="120" placeholder="Âge" />
            </label>
            <div class="row">
              <button class="btn ghost block" onclick={() => { editingProfile = false; }}>Annuler</button>
              <button class="btn orange block" onclick={saveProfile}>Enregistrer</button>
            </div>
          </div>
        {:else}
          <div class="edit-profile">
            <button class="mini-btn" onclick={editProfile}>Modifier prénom et âge</button>
          </div>
        {/if}
        {#if authError}
          <p class="small muted" style="color: var(--rose);">{authError}</p>
        {/if}
        <button class="btn ghost block" onclick={handleLogout}>Se déconnecter</button>
        <button class="btn ghost block" style="color: var(--rose)" onclick={handleDeleteAccount}>Supprimer mon compte</button>
      </div>
    {/if}

    {#if showAuth}
      <form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleAuth(); }}>
        <h4>{authMode === 'login' ? 'Connexion' : 'Créer un compte'}</h4>
        <label>
          <span class="small">Email</span>
          <input type="email" bind:value={authEmail} placeholder="toi@exemple.com" required autocomplete="email" />
        </label>
        {#if authMode === 'register'}
          <label>
            <span class="small">Prénom</span>
            <input type="text" bind:value={regFirstName} placeholder="Ton prénom" required autocomplete="given-name" />
          </label>
          <label>
            <span class="small">Âge</span>
            <input type="number" bind:value={regAge} min="1" max="120" required placeholder="Ton âge" />
          </label>
          <label>
            <span class="small">Mot de passe</span>
            <input type="password" bind:value={authPassword} placeholder="••••••••" required minlength={6} autocomplete="new-password" />
          </label>
          <label>
            <span class="small">Confirmer le mot de passe</span>
            <input type="password" bind:value={regConfirmPassword} placeholder="••••••••" required autocomplete="new-password" />
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={regPrivacy} required />
            J'accepte la <button class="privacy-link" type="button" onclick={() => app.openIntro()}>politique de confidentialité</button>.
          </label>
          {#if regAge && !Number.isNaN(parseInt(regAge, 10)) && parseInt(regAge, 10) >= 13 && parseInt(regAge, 10) <= 17}
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={regParentConsent} />
              J'ai l'accord d'un parent ou d'un tuteur pour créer ce compte.
            </label>
          {/if}
        {:else}
          <label>
            <span class="small">Mot de passe</span>
            <input type="password" bind:value={authPassword} placeholder="••••••••" required autocomplete="current-password" />
          </label>
          <p class="forgot">
            <button class="text-link" type="button" onclick={() => { app.notify('Réinitialisation mot de passe : fonction à venir via Supabase.'); }}>Mot de passe oublié ?</button>
          </p>
        {/if}
        {#if authError}
          <p class="small" style="color: var(--rose);">{authError}</p>
        {/if}
        <div class="row">
          <button class="btn ghost block" type="button" onclick={() => { showAuth = false; authError = null; }}>Annuler</button>
          <button class="btn orange block" type="submit" disabled={authLoading}>
            {authLoading ? '⟳' : authMode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
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
  <p class="footer-note">{$_('profile.footer')}</p>

  <!-- Modal Confidentialité & Transparence -->
  {#if showTransparency}
    <div class="transparency-modal" role="dialog" aria-modal="true" aria-label="Confidentialité et transparence" tabindex="0" onclick={toggleTransparency} onkeydown={(e) => { if (e.key === 'Escape') toggleTransparency(); }}>
      <div class="transparency-content" role="presentation" onclick={(e) => e.stopPropagation()}>
        <button class="transparency-close" onclick={toggleTransparency} aria-label="Fermer">✕</button>
        <h2>🔒 Confidentialité & Transparence</h2>
        <p>
          Lakk utilise un compte en ligne chez <strong>Supabase</strong> (serveurs en Europe, Irlande) pour stocker ton compte (email, prénom, âge). Tes données servent à faire fonctionner ton compte et à améliorer l'application.
        </p>
        <ul class="transparency-list">
          <li><strong>Compte :</strong> ton email, prénom et âge sont stockés chez Supabase. Tu peux les modifier à tout moment dans ton profil.</li>
          <li><strong>Progression :</strong> tes leçons complétées, ton SRS (cartes de révision) et ton XP restent sur cet appareil.</li>
          <li><strong>Erreurs (Carnet de Traces) :</strong> tes erreurs et leurs catégories sont enregistrées localement pour te proposer des exercices ciblés.</li>
          <li><strong>Missions :</strong> tes missions du jour et tes preuves audio sont conservées sur cet appareil uniquement.</li>
          <li><strong>Supprimer mon compte :</strong> tu peux supprimer ton compte et toutes tes données associées depuis ton profil.</li>
        </ul>
        <p class="small muted">
          Tes données personnelles ne sont jamais vendues ni partagées avec des tiers. Conformité RGPD.
        </p>
        <button class="btn block" onclick={toggleTransparency}>J'ai compris</button>
      </div>
    </div>
  {/if}
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

  /* Modal Confidentialité & Transparence */
  .transparency-modal {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--ink) 45%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 200;
    backdrop-filter: blur(6px);
    cursor: pointer;
  }
  .transparency-content {
    background: var(--card);
    border-radius: 20px;
    padding: 24px;
    max-width: 460px;
    max-height: 85vh;
    width: 100%;
    box-shadow: var(--shadow);
    position: relative;
    overflow-y: auto;
    cursor: default;
  }
  .transparency-close {
    position: absolute;
    top: 10px;
    right: 14px;
    background: none;
    border: 0;
    font-size: 20px;
    cursor: pointer;
    color: var(--muted);
  }
  .transparency-close:hover {
    color: var(--ink);
  }
  .transparency-content h2 {
    margin: 0 0 12px;
    font-size: 20px;
    color: var(--ink);
  }
  .transparency-content p {
    margin: 0 0 12px;
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .transparency-content p strong {
    color: var(--ink);
  }
  .transparency-list {
    margin: 0 0 16px;
    padding-left: 16px;
    color: var(--ink-soft);
  }
  .transparency-list li {
    margin-bottom: 8px;
    line-height: 1.5;
  }
  .transparency-list li strong {
    color: var(--ink);
  }
  code {
    background: var(--line);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    color: var(--ink);
  }
</style>
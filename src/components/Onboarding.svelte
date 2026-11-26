<script lang="ts">
  import { signUp, signIn, resetPassword, type AuthUser } from '../lib/auth';
  import { app } from '../lib/store.svelte';
  import { _ } from 'svelte-i18n';
  import { introSeen, markIntroSeen } from '../lib/intro';

  let mode: 'welcome' | 'register' | 'login' | 'reset' = 'welcome';
  let loading = false;
  let error: string | null = null;

  // Register fields
  let regFirstName = '';
  let regAge = '';
  let regEmail = '';
  let regPassword = '';
  let regConfirmPassword = '';
  let regPrivacy = false;
  let regParentConsent = false;

  // Login fields
  let loginEmail = '';
  let loginPassword = '';

  // Reset field
  let resetEmail = '';

  function setError(msg: string | null): void {
    error = msg;
  }

  async function handleRegister(): Promise<void> {
    error = null;
    const firstName = regFirstName.trim();
    const ageStr = regAge.trim();
    const email = regEmail.trim();
    const password = regPassword;
    const confirmPassword = regConfirmPassword;

    if (!firstName) { setError('Prénom requis.'); return; }
    if (!ageStr) { setError('Âge requis.'); return; }
    const age = parseInt(ageStr, 10);
    if (Number.isNaN(age) || age < 1) { setError('Âge invalide.'); return; }
    if (age < 13) {
      setError("Désolé, Lakk est réservé aux personnes de 13 ans et plus. Reviens quand tu seras plus grand !");
      return;
    }
    if (age >= 13 && age <= 17 && !regParentConsent) {
      setError("Tu as entre 13 et 17 ans. Coche la case « J'ai l'accord d'un parent » pour continuer.");
      return;
    }
    if (!email.includes('@')) { setError('Email invalide.'); return; }
    if (!password || password.length < 6) { setError('Mot de passe trop court (min 6 caractères).'); return; }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (!regPrivacy) { setError('Tu dois accepter la politique de confidentialité.'); return; }

    loading = true;
    try {
      await signUp({ email, password, firstName, age });
      mode = 'welcome';
      // On laisse App.svelte gérer la suite (intro ou home)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création du compte.');
    } finally {
      loading = false;
    }
  }

  async function handleLogin(): Promise<void> {
    error = null;
    const email = loginEmail.trim();
    const password = loginPassword;
    if (!email.includes('@')) { setError('Email invalide.'); return; }
    if (!password) { setError('Mot de passe requis.'); return; }

    loading = true;
    try {
      await signIn({ email, password });
      mode = 'welcome';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la connexion.');
    } finally {
      loading = false;
    }
  }

  async function handleReset(): Promise<void> {
    error = null;
    const email = resetEmail.trim();
    if (!email.includes('@')) { setError('Email invalide.'); return; }
    loading = true;
    try {
      await resetPassword(email);
      setError('Un email de réinitialisation a été envoyé (si le compte existe).');
      mode = 'login';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réinitialisation.');
    } finally {
      loading = false;
    }
  }

  function goWelcome(): void {
    mode = 'welcome';
    error = null;
  }

  function goRegister(): void {
    mode = 'register';
    error = null;
  }

  function goLogin(): void {
    mode = 'login';
    error = null;
  }

  function goReset(): void {
    mode = 'reset';
    error = null;
  }
</script>

<div class="onboarding" role="dialog" aria-modal="true" aria-label="Bienvenue dans Lakk">

  <!-- Écran d'accueil -->
  {#if mode === 'welcome'}
    <div class="onboarding-card">
      <div class="onboarding-header">
        <h1>🌿 Lakk</h1>
        <p class="subtitle">Apprends l'anglais depuis le français.</p>
      </div>
      <p class="welcome-text">
        Lakk passe en mode en ligne. Crée un compte pour synchroniser ta progression
        et retrouver tes leçons sur tous tes appareils.
      </p>
      <div class="welcome-actions">
        <button class="btn block orange" onclick={goRegister}>
          Créer un compte
        </button>
        <button class="btn block ghost" onclick={goLogin}>
          J'ai déjà un compte
        </button>
      </div>
      <p class="small muted">
        Ton email, prénom et âge sont stockés chez Supabase (serveurs en Europe, Irlande).
        Ta progression reste sur cet appareil.
      </p>
    </div>

  {:else if mode === 'register'}
    <div class="onboarding-card">
      <div class="onboarding-header">
        <button class="back-btn" onclick={goWelcome} aria-label="Retour">←</button>
        <h1>Créer un compte</h1>
      </div>
      {#if error}
        <p class="error-msg">{error}</p>
      {/if}
      <form onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
        <label>
          <span class="label">Prénom</span>
          <input type="text" bind:value={regFirstName} placeholder="Ton prénom" required autocomplete="given-name" />
        </label>
        <label>
          <span class="label">Âge</span>
          <input type="number" bind:value={regAge} min="1" max="120" required placeholder="Ton âge" />
        </label>
        <label>
          <span class="label">Email</span>
          <input type="email" bind:value={regEmail} placeholder="toi@exemple.com" required autocomplete="email" />
        </label>
        <label>
          <span class="label">Mot de passe</span>
          <input type="password" bind:value={regPassword} placeholder="••••••••" required minlength={6} autocomplete="new-password" />
        </label>
        <label>
          <span class="label">Confirmer le mot de passe</span>
          <input type="password" bind:value={regConfirmPassword} placeholder="••••••••" required autocomplete="new-password" />
        </label>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={regPrivacy} required />
          J'ai lu et j'accepte la <a href="#" onclick={(e) => { e.preventDefault(); }} class="privacy-link">politique de confidentialité</a>.
        </label>
        {#if regAge && !Number.isNaN(parseInt(regAge, 10)) && parseInt(regAge, 10) >= 13 && parseInt(regAge, 10) <= 17}
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={regParentConsent} />
            J'ai l'accord d'un parent ou d'un tuteur pour créer ce compte.
          </label>
        {/if}
        <div class="form-actions">
          <button class="btn ghost block" type="button" onclick={goWelcome}>Annuler</button>
          <button class="btn orange block" type="submit" disabled={loading || !regPrivacy}>
            {loading ? '⟳' : 'Créer le compte'}
          </button>
        </div>
      </form>
      <p class="small muted">
        Tu as moins de 13 ans ? Lakk est réservé aux 13 ans et plus.
      </p>
    </div>

  {:else if mode === 'login'}
    <div class="onboarding-card">
      <div class="onboarding-header">
        <button class="back-btn" onclick={goWelcome} aria-label="Retour">←</button>
        <h1>Se connecter</h1>
      </div>
      {#if error}
        <p class="error-msg">{error}</p>
      {/if}
      <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
        <label>
          <span class="label">Email</span>
          <input type="email" bind:value={loginEmail} placeholder="toi@exemple.com" required autocomplete="email" />
        </label>
        <label>
          <span class="label">Mot de passe</span>
          <input type="password" bind:value={loginPassword} placeholder="••••••••" required autocomplete="current-password" />
        </label>
        <div class="form-actions">
          <button class="btn ghost block" type="button" onclick={goWelcome}>Annuler</button>
          <button class="btn orange block" type="submit" disabled={loading}>
            {loading ? '⟳' : 'Se connecter'}
          </button>
        </div>
        <p class="forgot">
          <button class="text-link" type="button" onclick={goReset}>Mot de passe oublié ?</button>
        </p>
      </form>
    </div>

  {:else if mode === 'reset'}
    <div class="onboarding-card">
      <div class="onboarding-header">
        <button class="back-btn" onclick={goLogin} aria-label="Retour">←</button>
        <h1>Mot de passe oublié</h1>
      </div>
      {#if error}
        <p class="error-msg">{error}</p>
      {/if}
      <form onsubmit={(e) => { e.preventDefault(); handleReset(); }}>
        <label>
          <span class="label">Email</span>
          <input type="email" bind:value={resetEmail} placeholder="toi@exemple.com" required autocomplete="email" />
        </label>
        <div class="form-actions">
          <button class="btn ghost block" type="button" onclick={goLogin}>Annuler</button>
          <button class="btn orange block" type="submit" disabled={loading}>
            {loading ? '⟳' : 'Envoyer l\'email'}
          </button>
        </div>
      </form>
    </div>
  {/if}

</div>

<style>
  .onboarding {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--ink) 40%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 300;
    backdrop-filter: blur(6px);
  }
  .onboarding-card {
    background: var(--card);
    border-radius: 24px;
    padding: 32px 24px;
    max-width: 420px;
    width: 100%;
    box-shadow: var(--shadow);
    position: relative;
    overflow-y: auto;
    max-height: 90vh;
  }
  .onboarding-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
  }
  .back-btn {
    background: none;
    border: 0;
    font-size: 20px;
    cursor: pointer;
    color: var(--muted);
    padding: 4px;
    line-height: 1;
  }
  .back-btn:hover {
    color: var(--ink);
  }
  h1 {
    margin: 0;
    font-size: 22px;
    color: var(--ink);
  }
  .subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--muted);
  }
  .welcome-text {
    margin: 0 0 20px;
    font-size: 15px;
    color: var(--ink-soft);
    line-height: 1.5;
  }
  .welcome-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }
  .label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-soft);
    margin-bottom: 6px;
  }
  input {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid var(--line);
    border-radius: 10px;
    font-size: 14px;
    background: var(--paper);
    color: var(--ink);
    box-sizing: border-box;
  }
  input:focus {
    outline: none;
    border-color: var(--orange);
  }
  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: var(--ink-soft);
    margin: 12px 0;
    line-height: 1.4;
  }
  .checkbox-label input {
    width: auto;
    margin-top: 2px;
  }
  .privacy-link {
    color: var(--orange);
    text-decoration: underline;
  }
  .error-msg {
    color: var(--rose);
    font-size: 13px;
    margin: 0 0 12px;
    background: color-mix(in srgb, var(--rose) 15%, transparent);
    padding: 8px 12px;
    border-radius: 8px;
  }
  .form-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
  .forgot {
    margin-top: 12px;
    text-align: center;
  }
  .text-link {
    background: none;
    border: 0;
    color: var(--orange);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
  .text-link:hover {
    color: var(--orange-deep);
  }
  .small.muted {
    font-size: 12px;
    color: var(--muted);
    margin-top: 16px;
    line-height: 1.4;
  }
  .btn {
    width: 100%;
    padding: 12px;
    border: 0;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.orange {
    background: var(--orange);
    color: #fff;
  }
  .btn.orange:hover {
    background: var(--orange-deep);
  }
  .btn.ghost {
    background: transparent;
    color: var(--ink);
    border: 1.5px solid var(--line);
  }
  .btn.ghost:hover {
    border-color: var(--ink);
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn.block {
    width: 100%;
  }
</style>
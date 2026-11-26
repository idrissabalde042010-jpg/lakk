// Authentification Lakk avec Supabase (email + mot de passe).
// Google est préparé en option, sans bloquer le flux email/mot de passe.

import { getSupabase, isSupabaseAvailable } from './supabase';

export interface AuthUser {
  id: string;
  email: string | null;
  first_name: string | null;
  age: number | null;
}

export interface ProfileUpdates {
  first_name?: string;
  age?: number;
}

/** Résultat de l'inscription : indique si une confirmation email est requise. */
export interface SignUpResult {
  user: AuthUser;
  emailConfirmationRequired: boolean;
}

/*────────────────────────── Messages d’erreur (fr) ────────────────────────*/

/**
 * Traduit une erreur Supabase (ou JS) en message lisible en français.
 * Fonction pure, exportée pour pouvoir être testée.
 */
export function mapAuthError(err: unknown): string {
  if (err === null || err === undefined) {
    return 'Erreur inconnue.';
  }
  const message = (err as Error).message?.toLowerCase() ?? '';
  const code = (err as { code?: string }).code;
  const status = (err as { status?: number }).status;

  // Réseau indisponible
  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('network error') ||
    status === 0
  ) {
    return 'Réseau indisponible. Vérifie ta connexion.';
  }

  // Limite d'envoi d'emails atteinte (rate limit)
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('email rate limit') ||
    message.includes('send email rate') ||
    code === 'rate_limit'
  ) {
    return 'Limite d’envoi d’emails atteinte. Réessaie plus tard.';
  }

  // Email déjà utilisé
  if (
    code === 'user_already_exists' ||
    message.includes('user already exists') ||
    message.includes('email already exists') ||
    message.includes('utilisateur existe déjà')
  ) {
    return 'Cet email est déjà utilisé. Essaie de te connecter.';
  }

  // Mot de passe trop court / trop faible
  if (
    code === 'weak_password' ||
    message.includes('password should be at least') ||
    message.includes('weak password') ||
    message.includes('mot de passe trop court') ||
    message.includes('mot de passe trop faible')
  ) {
    return 'Mot de passe trop court. Utilise au moins 6 caractères.';
  }

  // Mauvais identifiants
  if (
    code === 'invalid_credentials' ||
    code === 'Invalid login' ||
    message.includes('invalid login') ||
    message.includes('incorrect email or password') ||
    message.includes('email ou mot de passe incorrect') ||
    message.includes('invalid credentials')
  ) {
    return 'Mauvais identifiants. Vérifie ton email et ton mot de passe.';
  }

  // Erreur base de données lors de l'enregistrement du nouvel utilisateur
  if (
    message.includes('database error') ||
    message.includes('error saving new user') ||
    message.includes('database error saving') ||
    code === 'database_error'
  ) {
    return 'Database error saving new user. Réessaie ou contacte le support.';
  }

  // Email non confirmé (désactivé pour les tests, mais au cas où)
  if (message.includes('email not confirmed')) {
    return 'Email non confirmé. Vérifie ta boîte de réception.';
  }

  return message || 'Erreur d’authentification.';
}

/*───────────────────────────────── Client ─────────────────────────────────*/

function client() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase non configuré. Réseau indisponible.');
  }
  return supabase;
}

/*───────────────────────────────── signUp ─────────────────────────────────*/

export async function signUp(params: {
  email: string;
  password: string;
  firstName: string;
  age: number;
}): Promise<SignUpResult> {
  const supabase = client();
  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: {
        first_name: params.firstName.trim(),
        age: params.age,
      },
    },
  });
  if (error) throw mapAuthError(error);
  if (!data.user) throw mapAuthError(new Error('Aucun utilisateur créé.'));

  // Si pas de session, la confirmation d'email est requise (email confirmations activé côté Supabase).
  const emailConfirmationRequired = !data.session;

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    first_name: (data.user.user_metadata as { first_name?: string })?.first_name ?? null,
    age: (data.user.user_metadata as { age?: number })?.age ?? null,
  };

  return { user, emailConfirmationRequired };
}

/*───────────────────────────────── signIn ─────────────────────────────────*/

export async function signIn(params: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email.trim().toLowerCase(),
    password: params.password,
  });
  if (error) throw mapAuthError(error);
  if (!data.user) throw mapAuthError(new Error('Aucun utilisateur connecté.'));

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    first_name: (data.user.user_metadata as { first_name?: string })?.first_name ?? null,
    age: (data.user.user_metadata as { age?: number })?.age ?? null,
  };
}

/*───────────────────────────────── signOut ────────────────────────────────*/

export async function signOut(): Promise<void> {
  const supabase = client();
  const { error } = await supabase.auth.signOut();
  if (error) throw mapAuthError(error);
}

/*─────────────────────────── resetPassword ────────────────────────────────*/

export async function resetPassword(email: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/auth/callback`,
  });
  if (error) throw mapAuthError(error);
}

/*──────────────────────────────── getSession ──────────────────────────────*/

export async function getSession(): Promise<AuthUser | null> {
  if (!isSupabaseAvailable()) return null;
  const supabase = client();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    first_name: (session.user.user_metadata as { first_name?: string })?.first_name ?? null,
    age: (session.user.user_metadata as { age?: number })?.age ?? null,
  };
}

/*──────────────────────── onAuthStateChange ───────────────────────────────*/

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  if (!isSupabaseAvailable()) {
    callback(null);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  const supabase = client();
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }
    callback({
      id: session.user.id,
      email: session.user.email ?? null,
      first_name: (session.user.user_metadata as { first_name?: string })?.first_name ?? null,
      age: (session.user.user_metadata as { age?: number })?.age ?? null,
    });
  });
}

/*──────────────────────────────── getProfile ──────────────────────────────*/

export async function getProfile(userId: string): Promise<{ first_name: string; age: number } | null> {
  if (!isSupabaseAvailable()) return null;
  const supabase = client();
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, age')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return { first_name: data.first_name, age: data.age };
}

/*─────────────────────────── updateProfile ────────────────────────────────*/

export async function updateProfile(
  userId: string,
  updates: ProfileUpdates
): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Réseau indisponible.');
  const supabase = client();
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw mapAuthError(error);
}

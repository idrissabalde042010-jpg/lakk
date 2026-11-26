import { describe, it, expect } from 'vitest';
import { mapAuthError } from './auth';

describe('mapAuthError', () => {
  it('retourne "Erreur inconnue." pour null', () => {
    expect(mapAuthError(null)).toBe('Erreur inconnue.');
  });

  it('retourne "Erreur inconnue." pour undefined', () => {
    expect(mapAuthError(undefined as unknown)).toBe('Erreur inconnue.');
  });

  it('traduit email déjà utilisé (code user_already_exists)', () => {
    expect(mapAuthError({ code: 'user_already_exists', message: 'User already exists' })).toBe(
      'Cet email est déjà utilisé. Essaie de te connecter.'
    );
  });

  it('traduit email déjà utilisé (message contains)', () => {
    expect(mapAuthError(new Error('user already exists'))).toBe(
      'Cet email est déjà utilisé. Essaie de te connecter.'
    );
  });

  it('traduit limite d’envoi d’emails atteinte', () => {
    expect(mapAuthError({ code: 'rate_limit', message: 'Rate limit exceeded' })).toBe(
      'Limite d’envoi d’emails atteinte. Réessaie plus tard.'
    );
  });

  it('traduit trop de requêtes (too many requests)', () => {
    expect(mapAuthError(new Error('too many requests'))).toBe(
      'Limite d’envoi d’emails atteinte. Réessaie plus tard.'
    );
  });

  it('traduit mot de passe trop court (code weak_password)', () => {
    expect(mapAuthError({ code: 'weak_password', message: 'Password should be at least 6 characters' })).toBe(
      'Mot de passe trop court. Utilise au moins 6 caractères.'
    );
  });

  it('traduit mot de passe trop court (message contains)', () => {
    expect(mapAuthError(new Error('Password should be at least 6 characters'))).toBe(
      'Mot de passe trop court. Utilise au moins 6 caractères.'
    );
  });

  it('traduit mauvais identifiants (code invalid_credentials)', () => {
    expect(mapAuthError({ code: 'invalid_credentials', message: 'Invalid credentials' })).toBe(
      'Mauvais identifiants. Vérifie ton email et ton mot de passe.'
    );
  });

  it('traduit mauvais identifiants (message contains)', () => {
    expect(mapAuthError(new Error('Incorrect email or password'))).toBe(
      'Mauvais identifiants. Vérifie ton email et ton mot de passe.'
    );
  });

  it('traduit réseau indisponible (failed to fetch)', () => {
    expect(mapAuthError(new Error('Failed to fetch'))).toBe(
      'Réseau indisponible. Vérifie ta connexion.'
    );
  });

  it('traduit réseau indisponible (status 0)', () => {
    expect(mapAuthError({ status: 0, message: '' })).toBe(
      'Réseau indisponible. Vérifie ta connexion.'
    );
  });

  it('traduit database error saving new user', () => {
    expect(mapAuthError({ code: 'database_error', message: 'Database error saving new user' })).toBe(
      'Database error saving new user. Réessaie ou contacte le support.'
    );
  });

  it('retourne le message brut pour une erreur inconnue', () => {
    expect(mapAuthError(new Error('quelque chose de bizarre'))).toBe(
      'quelque chose de bizarre'
    );
  });

  it('retourne "Erreur d’authentification." pour une erreur vide', () => {
    expect(mapAuthError(new Error(''))).toBe('Erreur d’authentification.');
  });

  it('traduit email non confirmé', () => {
    expect(mapAuthError(new Error('Email not confirmed'))).toBe(
      'Email non confirmé. Vérifie ta boîte de réception.'
    );
  });
});

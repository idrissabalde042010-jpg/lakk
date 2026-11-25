import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock import.meta.env
const originalEnv = import.meta.env;

describe('supabase.ts', () => {
  // Helper to dynamically import with fresh module
  async function importSupabase() {
    return await import('./supabase');
  }

  beforeEach(() => {
    vi.resetModules();
    // Reset import.meta.env
    Object.defineProperty(import.meta, 'env', {
      value: { ...originalEnv },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(import.meta, 'env', {
      value: originalEnv,
      writable: true,
      configurable: true
    });
  });

  it('getSupabase() renvoie null sans variables denvironnement', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = '';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = '';
    
    const { getSupabase } = await import('./supabase');
    const client = getSupabase();
    expect(client).toBeNull();
  });

  it('getSupabase() renvoie null avec URL invalide', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = 'invalid-url';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    
    const { getSupabase } = await import('./supabase');
    const client = getSupabase();
    expect(client).toBeNull();
  });

  it('getSupabase() renvoie un client avec des variables valides', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    const { getSupabase } = await import('./supabase');
    const client = getSupabase();
    expect(client).not.toBeNull();
    // @ts-expect-error - client is not null here because we checked
    expect(typeof client.from).toBe('function');
  });

  it('le module se charge sans erreur quand les variables sont absentes', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = '';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = '';
    
    // Le module devrait se charger sans lever d'exception
    const { getSupabase } = await import('./supabase');
    expect(typeof getSupabase).toBe('function');
  });

  it('isSupabaseAvailable() renvoie false sans variables', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = '';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = '';
    
    const { isSupabaseAvailable } = await import('./supabase');
    expect(isSupabaseAvailable()).toBe(false);
  });

  it('isSupabaseAvailable() renvoie true avec variables valides', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    const { isSupabaseAvailable } = await import('./supabase');
    expect(isSupabaseAvailable()).toBe(true);
  });

  it('resetSupabaseForTesting() réinitialise l\'instance', async () => {
    import.meta.env.PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    const { getSupabase, resetSupabaseForTesting } = await import('./supabase');
    getSupabase(); // Crée l'instance
    expect(getSupabase()).not.toBeNull();
    
    resetSupabaseForTesting();
    // Après reset, avec env vars valides, un nouveau client serait créé
    // Pour tester le reset, on vérifie que l'instance a été réinitialisée
    // en vérifiant qu'une nouvelle instance est créée (pas la même référence)
    const client1 = getSupabase();
    expect(client1).not.toBeNull();
    
    // Maintenant on teste avec env vars vides
    resetSupabaseForTesting();
    import.meta.env.PUBLIC_SUPABASE_URL = '';
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY = '';
    const client2 = getSupabase();
    expect(client2).toBeNull();
  });
});
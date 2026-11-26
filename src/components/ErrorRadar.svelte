<script lang="ts">
  import type { ErrorPattern } from '../lib/errors';
  import { patternLabel, patternMessage, errorsByPattern } from '../lib/errors';

  let { counts }: { counts: Record<ErrorPattern, number> } = $props();

  const patterns: ErrorPattern[] = ['article', 'ordre', 'orthographe', 'conjugaison', 'sens'];
  const total = patterns.reduce((sum, p) => sum + (counts[p] ?? 0), 0);
  const maxCount = Math.max(1, ...patterns.map((p) => counts[p] ?? 0));

  // Position des 5 axes du radar (en degrés, partant du haut).
  const AXES = [
    { pattern: 'article', angle: -90 },
    { pattern: 'ordre', angle: -18 },
    { pattern: 'orthographe', angle: 54 },
    { pattern: 'conjugaison', angle: 126 },
    { pattern: 'sens', angle: 198 },
  ];

  function pointFor(pattern: ErrorPattern, cx: number, cy: number, radius: number): { x: number; y: number } {
    const axis = AXES.find((a) => a.pattern === pattern)!;
    const rad = ((axis.angle - 90) * Math.PI) / 180;
    const value = counts[pattern] ?? 0;
    const r = maxCount > 0 ? (value / maxCount) * radius : 0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function axisPoint(pattern: ErrorPattern, cx: number, cy: number, radius: number): { x: number; y: number } {
    const axis = AXES.find((a) => a.pattern === pattern)!;
    const rad = ((axis.angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  const polygonPoints = $derived(
    patterns.map((p) => pointFor(p, 100, 100, 80)).map((pt) => `${pt.x},${pt.y}`).join(' '),
  );

  const topPattern = $derived(
    patterns
      .map((p) => ({ pattern: p, count: counts[p] ?? 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)[0],
  );
</script>

<section class="empreinte">
  <p class="eyebrow">Mon Empreinte</p>

  {#if total === 0}
    <div class="empty">
      <span class="empty-icon">📭</span>
      <p class="empty-text">Aucune erreur enregistrée pour l’instant.</p>
      <p class="empty-sub">Fais quelques leçons pour voir ton empreinte apparaître.</p>
    </div>
  {:else}
    <div class="radar-wrapper">
      <svg viewBox="0 0 200 200" class="radar" aria-label="Radar des erreurs">
        <!-- Cercles concentriques -->
        {#each [1, 2, 3] as ring}
          <circle cx="100" cy="100" r={(ring / 3) * 80} fill="none" stroke="var(--line)" stroke-width="1" />
        {/each}
        <!-- Axes -->
        {#each AXES as axis}
          {@const p = axis.pattern as ErrorPattern}
          <line
            x1="100"
            y1="100"
            x2={axisPoint(p, 100, 100, 80).x}
            y2={axisPoint(p, 100, 100, 80).y}
            stroke="var(--line)"
            stroke-width="1"
          />
          <text
            x={axisPoint(p, 100, 100, 95).x}
            y={axisPoint(p, 100, 100, 95).y}
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="10"
            fill="var(--muted)"
            font-family="var(--font-body)"
          >
            {patternLabel(p)}
          </text>
        {/each}
        <!-- Polygone des erreurs -->
        <polygon
          points={polygonPoints}
          fill="var(--orange)"
          fill-opacity="0.2"
          stroke="var(--orange)"
          stroke-width="2"
        />
        <!-- Points -->
        {#each patterns as pattern}
          <circle
            cx={pointFor(pattern, 100, 100, 80).x}
            cy={pointFor(pattern, 100, 100, 80).y}
            r="4"
            fill="var(--orange)"
          />
        {/each}
      </svg>
      <p class="radar-total">
        <strong>{total}</strong> erreur{total > 1 ? 's' : ''} enregistrée{total > 1 ? 's' : ''}
      </p>
    </div>

    <!-- Top 3 -->
    <div class="top3">
      <p class="eyebrow small">Top 3 des erreurs</p>
      {#if topPattern}
        <div class="top-item">
          <span class="top-badge">#{1}</span>
          <div class="top-info">
            <strong>{patternLabel(topPattern.pattern)}</strong>
            <p class="top-msg">{patternMessage(topPattern.pattern)}</p>
          </div>
          <span class="top-count">{topPattern.count}</span>
        </div>
      {/if}
      {#each patterns as pattern}
        {#if pattern !== topPattern?.pattern && (counts[pattern] ?? 0) > 0}
          <div class="top-item">
            <span class="top-badge">•</span>
            <div class="top-info">
              <strong>{patternLabel(pattern)}</strong>
              <p class="top-msg">{patternMessage(pattern)}</p>
            </div>
            <span class="top-count">{counts[pattern]}</span>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</section>

<style>
  .empreinte {
    padding: 0 16px 20px;
  }
  .eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin: 0 0 6px;
  }
  .eyebrow.small {
    font-size: 10px;
    margin-bottom: 8px;
  }
  .radar-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 14px 0 16px;
  }
  .radar {
    width: 200px;
    height: 200px;
    overflow: visible;
  }
  .radar-total {
    margin-top: 8px;
    font-size: 13px;
    color: var(--ink-soft);
    font-family: var(--font-display);
    font-weight: 600;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 20px;
    text-align: center;
    color: var(--muted);
  }
  .empty-icon {
    font-size: 44px;
  }
  .empty-text {
    font-size: 15px;
    color: var(--ink);
    font-weight: 600;
  }
  .empty-sub {
    font-size: 12px;
  }
  .top3 {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .top-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--card);
  }
  .top-badge {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--orange-soft);
    color: var(--orange-deep);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 13px;
    display: grid;
    place-items: center;
    flex: none;
  }
  .top-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .top-info strong {
    font-size: 14px;
    color: var(--ink);
  }
  .top-msg {
    font-size: 11px;
    color: var(--ink-soft);
  }
  .top-count {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    color: var(--teal);
    flex: none;
  }
</style>
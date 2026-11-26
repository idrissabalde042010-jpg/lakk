<script lang="ts">
  import type { RegularityRingData } from '../lib/engine';

  let { ring, size = 88 }: { ring: RegularityRingData; size?: number } = $props();

  const R = 40;
  const CIRC = 2 * Math.PI * R;
  const SEGMENTS = 7;
  const GAP = 6;
  const SEG = CIRC / SEGMENTS - GAP;
  const STEP = CIRC / SEGMENTS;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 100 100"
  role="img"
  aria-label={`${ring.activeCount} jour(s) actif(s) sur ${ring.target}`}
  class="regularity-ring"
>
  {#each ring.days as day, i}
    <circle
      cx="50"
      cy="50"
      r={R}
      fill="none"
      stroke={day.active ? 'var(--teal)' : 'var(--line)'}
      stroke-width="9"
      stroke-linecap="round"
      stroke-dasharray={`${SEG} ${CIRC - SEG}`}
      stroke-dashoffset={-i * STEP}
      transform="rotate(-90 50 50)"
      class:active={day.active}
    />
  {/each}
  {#if ring.crown}
    <text x="50" y="37" text-anchor="middle" class="crown">👑</text>
  {/if}
  <text x="50" y={ring.crown ? 56 : 54} text-anchor="middle" class="count">{ring.activeCount}</text>
  <text x="50" y={ring.crown ? 69 : 67} text-anchor="middle" class="target">/ {ring.target}</text>
</svg>

<style>
  .regularity-ring {
    flex: none;
  }
  .count {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    fill: var(--ink);
  }
  .target {
    font-family: var(--font-body);
    font-size: 10px;
    fill: var(--muted);
  }
  .crown {
    font-size: 12px;
  }
  .active {
    transition: stroke 0.2s ease;
  }
</style>

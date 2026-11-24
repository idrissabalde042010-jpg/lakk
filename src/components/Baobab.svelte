<script lang="ts">
  // Un baobab stylisé qui « pousse » avec la série de jours.
  let { streak = 0, size = 110 }: { streak?: number; size?: number } = $props();

  const spots: [number, number][] = [
    [40, 46], [50, 39], [60, 36], [70, 39], [80, 46],
    [33, 54], [43, 49], [53, 45], [67, 45], [77, 49], [87, 54],
    [50, 56], [60, 54], [70, 56],
  ];
  const shown = $derived(Math.min(spots.length, Math.max(0, streak)));
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 120 120"
  role="img"
  aria-label={`Baobab, série de ${streak} jour(s)`}
  class="baobab"
>
  <ellipse cx="60" cy="108" rx="30" ry="5" fill="var(--line)" />
  <!-- tronc et branches -->
  <path
    d="M59 107 C57 92 55 80 57 66 C50 62 44 60 38 53 M60 66 C67 62 73 59 81 52"
    fill="none"
    stroke="var(--trunk)"
    stroke-width="7"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M57 96 C54 88 52 84 48 80 M62 92 C66 86 69 83 73 80"
    fill="none"
    stroke="var(--trunk)"
    stroke-width="4"
    stroke-linecap="round"
  />
  <!-- feuillage -->
  {#if shown > 0}
    {#each spots.slice(0, shown) as [x, y], i}
      <circle
        cx={x}
        cy={y}
        r={i % 3 === 0 ? 8 : 6.5}
        fill={i % 2 === 0 ? 'var(--leaf)' : '#3bb877'}
        opacity="0.92"
        class="leaf"
        style={`animation-delay:${i * 30}ms`}
      />
    {/each}
  {:else}
    <!-- jeune pousse : série à 0 -->
    <path d="M60 66 C60 62 60 60 60 57" fill="none" stroke="var(--leaf)" stroke-width="3" stroke-linecap="round" />
    <ellipse cx="54" cy="56" rx="6.5" ry="3.4" fill="var(--leaf)" transform="rotate(-28 54 56)" />
    <ellipse cx="66" cy="56" rx="6.5" ry="3.4" fill="#3bb877" transform="rotate(28 66 56)" />
  {/if}
</svg>

<style>
  .baobab {
    flex: none;
  }
  .leaf {
    transform-origin: center;
    animation: pop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) both;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.3);
    }
    to {
      opacity: 0.92;
      transform: scale(1);
    }
  }
</style>

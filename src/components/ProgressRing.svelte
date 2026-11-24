<script lang="ts">
  let {
    percent = 0,
    size = 68,
    stroke = 8,
    color = 'var(--teal)',
    label = '',
  }: { percent?: number; size?: number; stroke?: number; color?: string; label?: string } = $props();

  const clamped = $derived(Math.max(0, Math.min(100, percent)));
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const offset = $derived(c * (1 - clamped / 100));
</script>

<div class="ring" style={`width:${size}px;height:${size}px`}>
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" stroke-width={stroke} />
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke={color}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={c}
      stroke-dashoffset={offset}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
      class="arc"
    />
  </svg>
  <span class="val" style={`font-size:${Math.round(size * 0.26)}px`}>{label || `${percent}%`}</span>
</div>

<style>
  .ring {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
  }
  .val {
    position: absolute;
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
  }
  .arc {
    transition: stroke-dashoffset 0.6s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
</style>

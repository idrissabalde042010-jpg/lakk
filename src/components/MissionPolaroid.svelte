<script lang="ts">
  import type { MissionCategory, MissionHistoryItem } from '../lib/missions';

  let { item, index = 0 }: { item: MissionHistoryItem; index?: number } = $props();

  const CATEGORY_COLORS: Record<MissionCategory, string> = {
    speaking: '#ffb38a',
    listening: '#9fc2ff',
    vocabulary: '#8fdcb9',
    culture: '#ffd98a',
    writing: '#d6b6ff',
  };

  const color = $derived(CATEGORY_COLORS[item.mission.category]);
  const tilt = $derived(((index % 3) - 1) * 1.4);

  function wrapTitle(text: string, max = 17): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > max && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 2);
  }

  const lines = $derived(wrapTitle(item.mission.title));
  const dateLabel = $derived(
    new Date(item.entry.completedAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    }),
  );
</script>

<figure class="polaroid" style={`--tilt:${tilt}deg;--photo:${color}`}>
  <svg
    viewBox="0 0 120 140"
    role="img"
    aria-label={`Polaroid de la mission accomplie : ${item.mission.title}, le ${dateLabel}`}
  >
    <title>Mission accomplie : {item.mission.title}</title>

    <!-- Cadre papier -->
    <rect x="1" y="1" width="118" height="138" rx="3" fill="#fffdf8" stroke="#e7dfcf" stroke-width="1" />
    <!-- Scotch décoratif -->
    <rect x="43" y="-2" width="34" height="9" rx="1" fill="#f1e5c9" opacity="0.85" transform="rotate(-2 60 3)" />

    <!-- Photo -->
    <rect x="9" y="10" width="102" height="82" rx="2" fill="var(--photo)" />
    <circle cx="91" cy="26" r="14" fill="#fff" opacity="0.2" />
    <path d="M9 78 Q 30 58 52 76 T 111 72 L111 92 L9 92 Z" fill="#fff" opacity="0.16" />

    <text x="60" y="62" text-anchor="middle" font-size="34" dominant-baseline="middle">
      {item.mission.icon}
    </text>

    {#if item.proof}
      <g>
        <circle cx="102" cy="22" r="8" fill="#111e1c" opacity="0.65" />
        <text x="102" y="25.5" text-anchor="middle" font-size="9">🎙️</text>
      </g>
    {/if}

    <!-- Légende -->
    {#each lines as line, i}
      <text
        x="60"
        y={103 + i * 10}
        text-anchor="middle"
        font-size="7.4"
        font-weight="600"
        fill="#2c3a35"
        font-family="var(--font-body)"
      >{line}</text>
    {/each}

    <text
      x="60"
      y="130"
      text-anchor="middle"
      font-size="5.8"
      fill="#8a938d"
      font-family="var(--font-body)"
    >{dateLabel} · {item.mission.duration}</text>
  </svg>

  {#if item.proof}
    <audio class="proof" controls preload="none" src={item.proof} aria-label={`Preuve audio : ${item.mission.title}`}></audio>
  {/if}
</figure>

<style>
  .polaroid {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transform: rotate(var(--tilt));
    transition: transform 0.18s ease;
  }
  .polaroid:hover {
    transform: rotate(0deg) scale(1.03);
  }
  .polaroid svg {
    width: 100%;
    height: auto;
    display: block;
    filter: drop-shadow(0 4px 6px rgba(17, 30, 28, 0.16));
  }
  .proof {
    width: 100%;
    height: 30px;
  }
</style>

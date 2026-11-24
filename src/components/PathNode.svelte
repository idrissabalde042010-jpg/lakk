<script lang="ts">
  type State = 'done' | 'current' | 'locked';
  let {
    state = 'locked',
    index = 1,
    title = '',
    side = 'left',
    onclick,
  }: { state?: State; index?: number; title?: string; side?: 'left' | 'right'; onclick?: () => void } =
    $props();
</script>

<button
  class="wrap {side}"
  class:done={state === 'done'}
  class:current={state === 'current'}
  class:locked={state === 'locked'}
  disabled={state === 'locked'}
  onclick={onclick}
  aria-label={`${title}${state === 'locked' ? ' (verrouillée)' : state === 'done' ? ' (terminée)' : ''}`}
>
  <span class="node">
    {#if state === 'done'}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    {:else if state === 'locked'}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    {:else}
      <span class="num">{index}</span>
    {/if}
  </span>
  <span class="label">{title}</span>
</button>

<style>
  .wrap {
    position: relative;
    border: 0;
    background: transparent;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    width: 100%;
    color: var(--ink);
  }
  .wrap.locked {
    cursor: not-allowed;
  }
  .wrap.left .node {
    margin-right: 46px;
  }
  .wrap.right .node {
    margin-left: 46px;
  }
  .wrap.left .label {
    margin-right: 46px;
  }
  .wrap.right .label {
    margin-left: 46px;
  }
  .node {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #fff;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 24px;
    transition: transform 0.12s ease;
  }
  .node svg {
    width: 32px;
    height: 32px;
  }
  .num {
    color: #fff;
  }
  .done .node {
    background: var(--teal);
    box-shadow: 0 5px 0 var(--teal-deep);
  }
  .current .node {
    background: var(--orange);
    box-shadow: 0 5px 0 var(--orange-deep);
    animation: bob 1.8s ease-in-out infinite;
  }
  .locked .node {
    background: var(--line);
    box-shadow: 0 5px 0 color-mix(in srgb, var(--line) 60%, #000);
    color: var(--muted);
  }
  .wrap:not(.locked):active .node {
    transform: translateY(3px);
  }
  .label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink-soft);
    max-width: 150px;
    text-align: center;
    line-height: 1.2;
  }
  .current .label {
    color: var(--orange-deep);
  }
  :root.dark .current .label {
    color: var(--orange);
  }
  @keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
</style>

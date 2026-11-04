// Emote wheel shared by the lobby and the in-game HUD: five dances around a centre button.
// The centre button closes the wheel, or stops the current dance while one is playing.
import { EMOTES } from '../game/emotes.js';

export const EMOTE_COLORS = { takethel: '#7cff6b', floss: '#4dd7ff', orangejustice: '#ff9a2e', laugh: '#ffe14d', defaultdance: '#c48bff' };

/**
 * wheel: the `.emote-wheel` element (holds `.ew-ring` > `.ew-close`).
 * onPick(id) when a dance is chosen; onStop() when the centre button is tapped while dancing.
 */
export function makeEmoteWheel(wheel, onPick, onStop) {
  const ring = wheel.querySelector('.ew-ring'), centre = wheel.querySelector('.ew-close');
  const R = 104, C = 150;
  let openedAt = 0;
  const api = {
    isOpen: () => wheel.classList.contains('show'),
    toggle(force) {
      const on = force !== undefined ? force : !api.isOpen();
      if (on && !api.isOpen()) openedAt = performance.now();
      wheel.classList.toggle('show', on);
    },
    /** While dancing the centre button becomes STOP. */
    setDancing(on) { wheel.classList.toggle('dancing', !!on); },
  };
  EMOTES.forEach((e, i) => {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / EMOTES.length);
    const b = document.createElement('button');
    b.className = 'ew-btn'; b.dataset.emote = e.id;
    b.style.left = (C + Math.cos(a) * R).toFixed(1) + 'px'; b.style.top = (C + Math.sin(a) * R).toFixed(1) + 'px';
    b.style.setProperty('--ec', EMOTE_COLORS[e.id] || '#ffe14d');
    b.innerHTML = `<i class="ic ic-em-${e.id}"></i><span>${e.name}</span>`;
    // ignore the ghost click produced by the tap that opened the wheel
    b.addEventListener('click', ev => { ev.stopPropagation(); if (performance.now() - openedAt < 250) return; api.toggle(false); onPick(e.id); });
    ring.appendChild(b);
  });
  centre.addEventListener('click', ev => {
    ev.stopPropagation();
    if (performance.now() - openedAt < 250) return;
    const dancing = wheel.classList.contains('dancing');
    api.toggle(false);
    if (dancing && onStop) onStop();
  });
  // tapping the dimmed background closes it
  wheel.addEventListener('click', ev => { if (ev.target === wheel && performance.now() - openedAt > 400) api.toggle(false); });
  return api;
}

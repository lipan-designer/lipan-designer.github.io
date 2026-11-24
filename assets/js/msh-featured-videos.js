/* One silent inline player follows the most visible phone, as the gallery scrolls. */
(() => {
  'use strict';
  const card = document.querySelector('.pcard--msh');
  if (!card) return;
  const reel = card.querySelector('.marquee');
  const toggle = card.querySelector('[data-msh-motion]');
  const slots = Array.from(card.querySelectorAll('[data-film-slot]'));
  const touch = matchMedia('(pointer: coarse)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const network = navigator.connection;
  const player = document.createElement('video');
  player.muted = player.defaultMuted = true;
  player.playsInline = player.autoplay = player.loop = true;
  player.controls = false;
  player.disablePictureInPicture = true;
  player.disableRemotePlayback = true;
  player.preload = 'none';
  player.setAttribute('aria-hidden', 'true');
  let active = null;
  let paused = touch.matches || reduced.matches || !!network?.saveData;
  let blocked = false;
  let raf = 0;
  let releaseTimer = 0;
  let settleTimer = 0;
  let generation = 0;
  const nearby = new Set();

  function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(choose); }
  function stop() {
    if (!active) return;
    ++generation;
    active.removeAttribute('data-live');
    active = null;
    player.pause();
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if (active) return;
      player.remove();
      player.removeAttribute('src');
      player.load();
    }, 2500);
  }
  function use(slot) {
    const pixels = slot.clientWidth * (window.devicePixelRatio || 1);
    const useHD = pixels > 480 && !network?.saveData && slot.dataset.filmHdSrc;
    const src = useHD ? slot.dataset.filmHdSrc : slot.dataset.filmSrc;
    if (active === slot && player.getAttribute('src') === src) return;
    stop();
    clearTimeout(releaseTimer);
    const attempt = ++generation;
    active = slot;
    slot.append(player);
    if (player.getAttribute('src') !== src) player.src = src;
    player.play().then(() => {
      if (attempt === generation && active === slot) slot.setAttribute('data-live', '');
    }).catch(error => {
      if (attempt !== generation || error.name === 'AbortError') return;
      blocked = true;
      stop();
      updateToggle();
    });
  }
  function choose() {
    raf = 0;
    if (paused || blocked || document.hidden || !nearby.size) { stop(); return; }
    const bounds = reel.getBoundingClientRect();
    const top = Math.max(0, bounds.top);
    const bottom = Math.min(innerHeight, bounds.bottom);
    const center = innerWidth / 2;
    let best = null, bestScore = -Infinity;
    for (const slot of nearby) {
      const rect = slot.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.right, innerWidth, bounds.right) - Math.max(rect.left, 0, bounds.left));
      const height = Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top));
      const visible = width * height / Math.max(1, rect.width * rect.height);
      if (visible < .45) continue;
      const score = visible - Math.abs((rect.left + rect.right) / 2 - center) / innerWidth * .45 + (slot === active ? .08 : 0);
      if (score > bestScore) { best = slot; bestScore = score; }
    }
    if (best) use(best); else stop();
  }
  function updateToggle() {
    const en = document.documentElement.dataset.lang === 'en';
    const staticMode = paused || blocked;
    const label = en ? (staticMode ? 'Play motion previews' : 'Pause motion previews') : (staticMode ? '播放动态预览' : '暂停动态预览');
    toggle.toggleAttribute('data-paused', staticMode);
    toggle.setAttribute('aria-label', label); toggle.title = label;
  }
  if (!('IntersectionObserver' in window) || !player.canPlayType('video/mp4')) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) nearby.add(entry.target); else nearby.delete(entry.target);
    }
    schedule();
  }, {threshold: [0, .15, .35, .45, .6, .8, .95, 1]});
  slots.forEach(slot => observer.observe(slot));
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    paused = !(paused || blocked); blocked = false; updateToggle(); choose();
  });
  function preferencesChanged() { paused = touch.matches || reduced.matches || !!network?.saveData; blocked = false; updateToggle(); schedule(); }
  reduced.addEventListener?.('change', preferencesChanged);
  network?.addEventListener?.('change', preferencesChanged);
  document.addEventListener('lp:lang', updateToggle);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else schedule(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  // Partial visibility changes trigger the observer. A settled pointer/trackpad gesture can also exchange two fully visible phones.
  function settled() { clearTimeout(settleTimer); settleTimer = setTimeout(schedule, 140); }
  reel.addEventListener('pointerup', settled);
  reel.addEventListener('wheel', settled, {passive: true});
  reel.addEventListener('scroll', settled, {passive: true});
  updateToggle();
})();

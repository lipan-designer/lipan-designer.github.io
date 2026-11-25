/* Repeat complete sets of project cards inside their native horizontal scroller. */
(() => {
  'use strict';

  const instances = new WeakMap();
  const mod = (value, period) => ((value % period) + period) % period;
  const focusable = 'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]';

  window.createProjectGalleryLoop = function createProjectGalleryLoop(track) {
    if (instances.has(track)) return instances.get(track);
    const box = track.parentElement;
    const originals = Array.from(track.children);
    if (!box || !originals.length) return null;

    const listeners = new Set();
    const originalRun = {tiles: originals, order: 0};
    const runs = [originalRun];
    let starts = [], period = 0, viewport = 0, viewportHeight = 0, trackWidth = 0;
    let remainder = 0, lastPixel = box.scrollLeft;

    box.style.overflowAnchor = 'none';
    track.style.overflowAnchor = 'none';
    // Snap positions move whenever a run is recycled. Native pan, zoom and momentum still work.
    box.style.scrollSnapType = 'none';

    function newCopy(source) {
      const tile = source.cloneNode(true);
      tile.dataset.galleryCopy = '';
      tile.setAttribute('aria-hidden', 'true');
      tile.setAttribute('data-i18n-skip', '');
      tile.classList.remove('is-demo');
      for (const el of [tile, ...tile.querySelectorAll('[id]')]) el.removeAttribute('id');
      for (const el of [tile, ...tile.querySelectorAll(focusable)]) {
        if (el.matches(focusable)) el.tabIndex = -1;
      }
      // A wide-window resize can happen after the original preview has already begun playing.
      for (const video of tile.querySelectorAll('[data-film-slot] video')) video.remove();
      for (const slot of tile.querySelectorAll('[data-film-slot]')) slot.removeAttribute('data-live');
      for (const wall of tile.querySelectorAll('survey-wall')) {
        wall.removeAttribute('data-ready');
        wall.removeAttribute('data-running');
        wall.querySelectorAll('.survey-wall-sheet').forEach(sheet => sheet.remove());
      }
      return tile;
    }

    function growTo(count) {
      const fragment = document.createDocumentFragment();
      const additions = [];
      while (runs.length < count) {
        const tiles = originals.map(newCopy);
        fragment.append(...tiles);
        additions.push(...tiles);
        runs.push({tiles, order: 0});
      }
      if (additions.length) track.append(fragment);
      return additions;
    }

    function setOrder(run, order) {
      run.order = order;
      for (const tile of run.tiles) tile.style.order = String(order);
    }

    function position() {
      const actual = box.scrollLeft;
      if (Math.abs(actual - lastPixel) > .01) remainder = 0; // An external or native scroll took over.
      lastPixel = actual;
      return actual + remainder;
    }

    function write(value) {
      box.scrollLeft = value;
      lastPixel = box.scrollLeft;
      remainder = Math.abs(value - lastPixel) <= 1 ? value - lastPixel : 0;
    }

    // Keep the same visible DOM nodes across a boundary. Only the run that is fully beyond
    // the viewport changes visual order; no image, custom element or video gets reparented.
    function normalize(value, native) {
      if (!period) return;
      const buffer = Math.floor((runs.length - Math.ceil(viewport / period)) / 2);
      const low = buffer * period;
      const near = native ? 1 : 0;
      // Some viewports are an exact multiple of the run. Recycle even when that rounded
      // boundary is also the native scroll limit, so a continuing swipe can keep going.
      const atRightLimit = native && value >= low + period - 1 && box.scrollWidth - viewport - value <= 1;
      if (!atRightLimit && value >= low - near && value < low + period + near) {
        if (!native) write(value);
        return;
      }
      const steps = Math.max(atRightLimit ? 1 : -Infinity, Math.floor((value - low) / period));
      let turns = steps % runs.length;
      while (turns > 0) {
        const run = runs.shift();
        setOrder(run, runs[runs.length - 1].order + 1);
        runs.push(run);
        turns--;
      }
      while (turns < 0) {
        const run = runs.pop();
        setOrder(run, runs[0].order - 1);
        runs.unshift(run);
        turns++;
      }
      write(value - steps * period);
    }

    function locate(value) {
      const phase = mod(value, period);
      let index = starts.length - 1;
      while (index && starts[index] > phase) index--;
      const width = (starts[index + 1] ?? period) - starts[index];
      return {index, fraction: width ? (phase - starts[index]) / width : 0};
    }

    function measure() {
      const rectangles = originals.map(tile => tile.getBoundingClientRect());
      const first = rectangles[0], last = rectangles[rectangles.length - 1];
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const margins = (parseFloat(getComputedStyle(originals[0]).marginLeft) || 0) +
        (parseFloat(getComputedStyle(originals[originals.length - 1]).marginRight) || 0);
      const nextPeriod = last.right - first.left + margins + gap;
      const nextStarts = rectangles.map(rect => rect.left - first.left);
      const nextViewport = box.clientWidth;
      if (nextPeriod <= 1 || !nextViewport || !first.width) return;
      viewportHeight = box.clientHeight;
      if (viewport === nextViewport && Math.abs(nextPeriod - period) < .02 &&
          nextStarts.every((start, i) => Math.abs(start - starts[i]) < .02)) {
        trackWidth = track.offsetWidth;
        return;
      }

      // The browser can clamp scrollLeft during reflow, before resize/scroll callbacks run.
      // Restore the position acknowledged under the old geometry, including subpixel travel.
      const previous = period ? lastPixel + remainder : 0;
      const old = period ? locate(previous) : {index: 0, fraction: 0};
      const anchor = period ? runs[Math.min(runs.length - 1, Math.max(0, Math.floor(previous / period)))] : originalRun;
      period = nextPeriod;
      starts = nextStarts;
      viewport = nextViewport;
      const span = Math.ceil(viewport / period);
      const added = growTo(span + 2);
      const buffer = Math.floor((runs.length - span) / 2);
      // Restore the same card and its fractional offset after responsive widths change.
      const owner = runs.indexOf(anchor);
      if (owner !== buffer) runs.push(...runs.splice(0, mod(owner - buffer, runs.length)));
      runs.forEach(setOrder);
      const cardWidth = (starts[old.index + 1] ?? period) - starts[old.index];
      write(buffer * period + starts[old.index] + old.fraction * cardWidth);
      trackWidth = track.offsetWidth;
      if (added.length) for (const callback of listeners) callback(added);
    }

    function moveBy(delta) {
      if (Number.isFinite(delta) && delta) normalize(position() + delta, false);
    }

    function stepDistance(direction) {
      if (!period || !direction) return 0;
      const phase = mod(position(), period);
      if (direction > 0) {
        const next = starts.find(start => start > phase + 1);
        if (next !== undefined) return next - phase;
        return period - phase + (period - phase <= 1 ? starts[1] ?? period : 0);
      }
      for (let i = starts.length - 1; i >= 0; i--) if (starts[i] < phase - 1) return starts[i] - phase;
      return starts[starts.length - 1] - period - phase;
    }

    function reset() {
      if (period) normalize(runs.indexOf(originalRun) * period, false);
    }

    function onCopies(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }

    // The site's language switch remembers the initial language of the original DOM. Copies
    // added while English is active mirror the originals rather than keeping stale captions.
    function syncLanguage() {
      const selector = '[data-en],figcaption,img[alt],[title],[aria-label]';
      for (const run of runs) {
        if (run === originalRun) continue;
        run.tiles.forEach((copy, index) => {
          const source = Array.from(originals[index].querySelectorAll(selector)).filter(n => !n.closest('.survey-wall-sheet'));
          const targets = Array.from(copy.querySelectorAll(selector)).filter(n => !n.closest('.survey-wall-sheet'));
          targets.forEach((node, i) => {
            const original = source[i];
            if (!original || node.tagName !== original.tagName) return;
            for (const attr of ['alt', 'title', 'aria-label']) {
              if (original.hasAttribute(attr)) node.setAttribute(attr, original.getAttribute(attr));
            }
            if (node.hasAttribute('data-en') || (node.matches('figcaption') && !node.childElementCount)) {
              node.textContent = original.textContent;
            }
          });
        });
      }
      measure();
    }

    const api = {moveBy, stepDistance, reset, measure, onCopies};
    instances.set(track, api);
    measure();
    box.addEventListener('scroll', () => {
      if (viewport !== box.clientWidth || viewportHeight !== box.clientHeight || trackWidth !== track.offsetWidth) measure();
      normalize(position(), true);
    }, {passive: true});
    document.addEventListener('lp:lang', syncLanguage);
    return api;
  };
})();

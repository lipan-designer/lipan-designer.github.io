(() => {
  'use strict';

  const gallery = document.getElementById('product-demos');
  if (!gallery) return;

  const choices = Array.from(gallery.querySelectorAll('[data-film]'));
  const fallback = gallery.querySelector('.msh-films__fallback');
  let video = gallery.querySelector('video');
  let current = choices.find(choice => choice.hasAttribute('aria-current'));
  let captionOnLoad = document.documentElement.dataset.lang === 'en' ? 'en' : undefined;

  function showCaptions(language) {
    for (const track of video.textTracks) track.mode = track.language === language ? 'showing' : 'disabled';
  }

  function observePlayer(player) {
    player.addEventListener('loadedmetadata', () => {
      if (player === video && captionOnLoad !== undefined) {
        showCaptions(captionOnLoad);
        captionOnLoad = undefined;
      }
    });
    player.addEventListener('play', () => { if (player === video) gallery.setAttribute('data-playing', ''); });
    for (const event of ['pause', 'ended']) {
      player.addEventListener(event, () => { if (player === video) gallery.removeAttribute('data-playing'); });
    }
    const revealFallback = () => { if (player === video) fallback.hidden = false; };
    player.addEventListener('error', revealFallback);
    player.querySelector('source').addEventListener('error', revealFallback);
  }

  function selectFilm(choice) {
    const previous = video;
    const caption = Array.from(previous.textTracks).find(track => track.mode === 'showing');
    const language = caption ? caption.language : null;
    const basename = choice.href.slice(0, -4);
    previous.pause();

    // Each film owns its cue list, including when visitors switch before a caption fetch finishes.
    const next = previous.cloneNode(false);
    next.setAttribute('aria-labelledby', choice.querySelector('strong').id);
    next.poster = basename + '.webp';
    const source = document.createElement('source');
    source.type = 'video/mp4';
    source.src = choice.href;
    next.append(source);
    for (const oldTrack of previous.querySelectorAll('track')) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.srclang = oldTrack.srclang;
      track.label = oldTrack.label;
      track.src = `${basename}.${track.srclang}.vtt`;
      track.default = track.srclang === language;
      next.append(track);
    }
    const directLink = previous.querySelector('a').cloneNode(true);
    directLink.href = choice.href;
    next.append(directLink);

    current.removeAttribute('aria-current');
    current = choice;
    current.setAttribute('aria-current', 'true');
    fallback.href = choice.href;
    fallback.hidden = true;
    gallery.removeAttribute('data-playing');
    captionOnLoad = language;
    video = next;
    observePlayer(next);
    previous.replaceWith(next);
  }

  for (const choice of choices) {
    choice.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!video.canPlayType('video/mp4') || (choice === current && video.error)) return;
      event.preventDefault();
      if (choice === current && !video.paused) { video.pause(); return; }
      if (choice !== current) selectFilm(choice);
      if (video.ended) video.currentTime = 0;
      const player = video;
      player.play().catch(() => { if (player === video && player.error) fallback.hidden = false; });
    });
  }

  observePlayer(video);
  if (captionOnLoad === 'en') {
    video.querySelector('track[srclang="en"]').default = true;
    showCaptions('en');
  }
  document.addEventListener('lp:lang', event => {
    if (event.detail === 'en' || Array.from(video.textTracks).some(track => track.mode === 'showing')) {
      if (!video.readyState) captionOnLoad = event.detail;
      showCaptions(event.detail);
    }
  });
})();

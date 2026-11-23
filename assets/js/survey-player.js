(() => {
  'use strict';

  const id = name => document.getElementById(name);
  const english = document.documentElement.lang === 'en';
  const text = (zh, en) => english ? en : zh;
  if (english) {
    document.title = 'Survey workflow · Industrial Bank HR — Li Pan';
    document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset.en; });
    document.querySelectorAll('[data-en-label]').forEach(el => el.setAttribute('aria-label', el.dataset.enLabel));
  }

  const wall = document.querySelector('survey-wall');
  const stage = id('motion-stage');
  const range = id('motion-range');
  const time = id('motion-time');
  const toggle = id('motion-toggle');
  const playLabel = id('play-label');
  const originals = id('originals');
  const openOriginals = id('originals-open');
  const duration = Number(range.max);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !motionPreference.matches;
  let scrubbing = false;
  let gesture = null;
  let frame = 0;
  let lastTenth = -1;

  function applyPlayback() {
    wall.setPlaying(playing && !scrubbing && !originals.open);
    toggle.toggleAttribute('data-playing', playing);
    playLabel.textContent = playing ? text('暂停', 'Pause') : text('播放', 'Play');
  }

  function togglePlayback() {
    playing = !playing;
    applyPlayback();
  }

  function updatePosition() {
    const progress = wall.getProgress();
    const elapsed = progress * duration;
    const seconds = Math.floor(elapsed);
    range.value = elapsed.toFixed(2);
    range.style.setProperty('--position', `${(progress * 100).toFixed(2)}%`);
    const clock = `0:${String(seconds).padStart(2, '0')}`;
    if (time.textContent !== clock) time.textContent = clock;
    const tenth = Math.floor(elapsed * 10);
    if (tenth !== lastTenth) {
      lastTenth = tenth;
      range.setAttribute('aria-valuetext', text(`${tenth / 10} 秒，共 ${duration} 秒`, `${tenth / 10} of ${duration} seconds`));
    }
  }

  // The wall owns the animation clock. Read its position only while it is running.
  function renderClock() {
    updatePosition();
    frame = wall.hasAttribute('data-running') ? requestAnimationFrame(renderClock) : 0;
  }

  function syncClock() {
    cancelAnimationFrame(frame);
    renderClock();
  }

  function seek(progress) {
    wall.setProgress(progress);
    updatePosition();
  }

  function transportKeys(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const progress = wall.getProgress();
    switch (event.key) {
      case 'ArrowRight': seek(progress + 0.5 / duration); break;
      case 'ArrowLeft': seek(progress - 0.5 / duration); break;
      case 'Home': seek(0); break;
      case 'End': seek(1); break;
      case ' ':
        if (event.target !== stage && event.target !== range && event.target !== document.body) return;
        if (!event.repeat) togglePlayback();
        break;
      default: return;
    }
    event.preventDefault();
  }

  const image = id('original-image');
  const viewport = id('original-viewport');
  const viewerStatus = id('original-status');
  const source = id('original-source');
  const zoom = id('original-zoom');
  const sourceDirectory = new URL(wall.getAttribute('asset-base'), document.baseURI);
  const englishTitles = {
    '我的问卷': 'My surveys', '填写问卷': 'Fill in a survey', '已提交问卷': 'Submitted survey',
    '问卷管理': 'Manage surveys', '问卷预览': 'Survey preview', '排查统计': 'Survey statistics',
    '填报结果': 'Submission results', '答卷详情': 'Response details', '我的问卷 · 最近发布排序菜单': 'My surveys · Sort by newest'
  };
  let boards = [];
  let loading = null;
  let current = 0;

  function setZoom(actualSize) {
    originals.toggleAttribute('data-original-size', actualSize);
    zoom.setAttribute('aria-pressed', String(actualSize));
    zoom.textContent = actualSize ? text('适应窗口', 'Fit to view') : text('原尺寸', 'Actual size');
    viewport.tabIndex = actualSize ? 0 : -1;
    viewport.scrollTo(0, 0);
  }

  function status(message) {
    viewerStatus.textContent = message;
    viewerStatus.hidden = !message;
  }

  function showBoard(index) {
    if (!boards.length) return;
    current = (index + boards.length) % boards.length;
    const board = boards[current];
    const title = english ? (englishTitles[board.name] || board.name) : board.name;
    id('original-title').textContent = title;
    id('original-count').textContent = `${String(current + 1).padStart(2, '0')} / ${String(boards.length).padStart(2, '0')}`;
    image.width = board.width;
    image.height = board.height;
    image.alt = text(`${title}的完整界面`, `${title}, full design`);
    image.src = new URL(board.filename, sourceDirectory).href;
    image.hidden = false;
    source.href = board.source;
    source.hidden = false;
    id('original-actions').hidden = false;
    setZoom(false);
    status('');
  }

  async function loadBoards() {
    if (boards.length) return;
    if (!loading) {
      loading = fetch(new URL('sources.json', sourceDirectory))
        .then(response => {
          if (!response.ok) throw new Error('Sources unavailable');
          return response.json();
        })
        .then(manifest => {
          if (!manifest.boards?.length) throw new Error('No originals');
          boards = manifest.boards;
        })
        .finally(() => { loading = null; });
    }
    await loading;
  }

  async function openViewer() {
    originals.showModal();
    applyPlayback();
    if (!boards.length) status(text('正在读取原稿…', 'Loading originals…'));
    try {
      await loadBoards();
      if (originals.open) showBoard(current);
    } catch (_) {
      status(text('未能读取原稿，请关闭后重新打开。', 'Could not load the original screens. Close and reopen to retry.'));
    }
  }

  image.addEventListener('error', () => {
    image.hidden = true;
    status(text('图片未能载入，可在 Figma 中查看这张原稿。', 'This image could not load. You can open the original in Figma.'));
  });
  openOriginals.addEventListener('click', openViewer);
  id('original-close').addEventListener('click', () => originals.close());
  id('original-prev').addEventListener('click', () => showBoard(current - 1));
  id('original-next').addEventListener('click', () => showBoard(current + 1));
  zoom.addEventListener('click', () => setZoom(!originals.hasAttribute('data-original-size')));
  originals.addEventListener('close', () => {
    applyPlayback();
    openOriginals.focus({preventScroll: true});
  });
  originals.addEventListener('click', event => {
    if (event.target !== originals) return;
    const rect = originals.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) originals.close();
  });

  document.addEventListener('keydown', event => {
    if (originals.open) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target === viewport && originals.hasAttribute('data-original-size')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showBoard(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
      return;
    }
    if (event.target === document.body || stage.contains(event.target) || id('motion-controls').contains(event.target)) transportKeys(event);
  });

  if (typeof wall.setPlaying !== 'function') return;
  new MutationObserver(syncClock).observe(wall, {attributes: true, attributeFilter: ['data-running']});
  toggle.addEventListener('click', togglePlayback);
  motionPreference.addEventListener('change', event => {
    playing = !event.matches;
    applyPlayback();
  });

  range.addEventListener('input', () => seek(range.valueAsNumber / duration));
  range.addEventListener('pointerdown', () => { scrubbing = true; applyPlayback(); });
  function endRangeScrub(event) {
    if (gesture && gesture.id === event.pointerId) return;
    if (!scrubbing) return;
    scrubbing = false;
    applyPlayback();
  }
  window.addEventListener('pointerup', endRangeScrub);
  window.addEventListener('pointercancel', endRangeScrub);

  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || gesture) return;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, start: 0, direction: ''};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.direction && Math.max(Math.abs(dx), Math.abs(dy)) >= 6) {
      gesture.direction = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
      if (gesture.direction === 'horizontal') {
        gesture.start = wall.getProgress();
        scrubbing = true;
        applyPlayback();
        stage.dataset.dragging = '';
      }
    }
    if (gesture.direction === 'horizontal') seek(gesture.start + dx / stage.clientWidth);
  });
  function endGesture(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const tapped = !gesture.direction && event.type === 'pointerup';
    gesture = null;
    scrubbing = false;
    delete stage.dataset.dragging;
    if (tapped) togglePlayback();
    else applyPlayback();
  }
  stage.addEventListener('pointerup', endGesture);
  stage.addEventListener('pointercancel', endGesture);
  stage.addEventListener('lostpointercapture', endGesture);

  id('motion-controls').hidden = false;
  id('motion-help').hidden = false;
  openOriginals.hidden = false;
  applyPlayback();
  syncClock();
})();

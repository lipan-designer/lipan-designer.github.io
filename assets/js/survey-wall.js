(() => {
  'use strict';
  if (customElements.get('survey-wall')) return;

  const boardWidth = 960;
  const boardHeight = 640;
  const columnPitch = 1044;
  // Three continuous rows, each with three distinct Figma originals. Coordinates are in sheet space.
  const rows = [
    { y: -708, startX: -432, endX: -230, boards: [
      ['sort', '我的问卷 · 最近发布排序菜单'], ['fill', '填写问卷'], ['submitted', '已提交问卷']
    ] },
    { y: 0, startX: 0, endX: 0, boards: [
      ['survey-list', '我的问卷'], ['stats', '排查统计'], ['results', '填报结果']
    ] },
    { y: 708, startX: 264, endX: -162, boards: [
      ['preview', '问卷预览'], ['manage', '问卷管理'], ['response', '答卷详情']
    ] }
  ];
  // Seconds, camera X/Y, roll, out-of-plane tilt, and magnification in the 1440 × 1080 film.
  const settledAt = 10;
  const shots = [
    [0.0,           0,    0, -45.0, 12.0, 1.140],
    [1.6,         149,  -40, -44.0, 11.5, 1.105],
    [3.1,         382, -170, -41.0, 10.4, 1.034],
    [4.4,         680, -408, -36.0,  9.0,  .947],
    [5.3,         862, -524, -26.0,  6.7,  .854],
    [6.0,        1003, -452, -16.0,  4.4,  .782],
    [6.8,        1097, -283,  -7.6,  2.3,  .724],
    [8.2,        1090,  -90,  -2.0,   .7,  .688],
    [9.4,        1058,  -15,   -.3,   .1,  .669],
    [settledAt, columnPitch, 0,  0,    0,  .665],
    [11.0,      columnPitch, 0,  0,    0,  .665]
  ];
  const duration = shots[shots.length - 1][0];
  const slope = (a, b, axis) => (b[axis] - a[axis]) / (b[0] - a[0]);

  // Monotone Hermite tangents keep the camera moving through each cue without overshooting it.
  const tangents = shots.map((shot, index) => [1, 2, 3, 4, 5].map(axis => {
    const before = shots[index - 1];
    const after = shots[index + 1];
    if (!before) return slope(shot, after, axis);
    if (!after) return slope(before, shot, axis);
    const left = slope(before, shot, axis);
    const right = slope(shot, after, axis);
    if (left * right <= 0) return 0;
    const leftSpan = shot[0] - before[0];
    const rightSpan = after[0] - shot[0];
    const w1 = 2 * rightSpan + leftSpan;
    const w2 = rightSpan + 2 * leftSpan;
    return (w1 + w2) / (w1 / left + w2 / right);
  }));

  function cameraAt(seconds) {
    const end = Math.max(1, shots.findIndex(shot => shot[0] >= seconds));
    const from = shots[end - 1];
    const to = shots[end];
    const span = to[0] - from[0];
    const t = (seconds - from[0]) / span;
    const t2 = t * t, t3 = t2 * t;
    return tangents[end].map((right, axis) =>
      (2*t3 - 3*t2 + 1) * from[axis + 1] + (t3 - 2*t2 + t) * span * tangents[end - 1][axis] +
      (-2*t3 + 3*t2) * to[axis + 1] + (t3 - t2) * span * right);
  }

  class SurveyWall extends HTMLElement {
    get readingPreview() { return this.hasAttribute('data-card-preview') && this.getAttribute('data-card-preview') !== 'film'; }
    constructor() {
      super();
      this.progress = 0;
      this.scale = 1;
      this.play = !this.hasAttribute('data-card-preview') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.tick = this.tick.bind(this);
      this.refresh = this.refresh.bind(this);
      this.preference = this.preference.bind(this);
    }
    connectedCallback() {
      if (!this.sheet) this.build();
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.motion.addEventListener('change', this.preference);
      document.addEventListener('visibilitychange', this.refresh);
      if (this.hasAttribute('data-card-preview')) {
        // The enclosing sticky gallery already tracks which tiles are exposed.
        this.inView = true;
      } else {
        this.viewport = new IntersectionObserver(([entry]) => {
          this.inView = entry.isIntersecting;
          this.refresh();
        });
        this.viewport.observe(this);
      }
      this.size = new ResizeObserver(() => {
        const byHeight = this.clientHeight / 1080;
        this.scale = Math.max(byHeight, Math.min(this.clientWidth / 1440, byHeight * 1.3), .1);
        this.paint();
      });
      this.size.observe(this);
      this.paint();
      this.refresh();
    }
    disconnectedCallback() {
      this.stopClock();
      this.viewport?.disconnect(); this.size?.disconnect();
      this.motion?.removeEventListener('change', this.preference);
      document.removeEventListener('visibilitychange', this.refresh);
    }
    build() {
      const base = new URL(this.getAttribute('asset-base') || 'assets/img/hr/survey-motion/', document.baseURI);
      const sheet = document.createElement('div');
      sheet.className = 'survey-wall-sheet';
      sheet.setAttribute('aria-hidden','true');
      const originals = [];
      this.rails = rows.map((row, index) => {
        const rail = document.createElement('div');
        rail.className = 'survey-wall-row';
        rail.dataset.row = String(index + 1);
        rail.style.left = `${row.startX - boardWidth / 2}px`;
        rail.style.top = `${row.y - boardHeight / 2}px`;
        row.boards.forEach(([file, name], column) => {
          const image = document.createElement('img');
          image.className = 'survey-wall-board';
          image.alt = ''; image.draggable = false;
          image.width = 1440; image.height = 960;
          image.dataset.board = name;
          image.style.left = `${column * columnPitch}px`;
          image.decoding = 'async';
          const sharpBoards = { 'survey-list': '../questionnaires@2x.webp', stats: '../survey-report@2x.webp', results: '../results@2x.webp' };
          const source = this.readingPreview && sharpBoards[file];
          image.src = new URL(source || `${file}.webp`, base).href;
          originals.push(image);
          rail.append(image);
        });
        sheet.append(rail);
        return rail;
      });
      this.sheet = sheet;
      this.append(sheet);
      this.ready = Promise.all(originals.map(image => image.decode())).then(() => {
        this.setAttribute('data-ready', '');
        this.refresh();
      }).catch(() => {}); // Keep the still visible if the original artwork cannot load.
    }
    paint() {
      if (!this.sheet) return;
      const seconds = this.progress * duration;
      let [x, y, roll, pitch, zoom] = cameraAt(seconds);
      if (this.readingPreview) {
        // Hold both reading positions. Keep the original three-row camera path between them.
        const travel = Math.max(0, Math.min(1, (seconds - 2.2) / 5.8));
        const eased = travel * travel * (3 - 2 * travel);
        [x, y, roll, pitch] = cameraAt(eased * settledAt);
        const narrow = this.clientWidth < 560;
        const scale = narrow ? this.clientWidth / 375 : Math.max(this.clientWidth / 1000, this.clientHeight / 740);
        x += narrow ? -150 : 0;
        y += narrow ? -116 : -28;
        // Rest on physical pixels with no perspective or tilt during the reading holds.
        const pixelRatio = window.devicePixelRatio || 1;
        const left = Math.round((this.clientWidth / 2 - x * scale) * pixelRatio) / pixelRatio;
        const top = Math.round((this.clientHeight / 2 - y * scale) * pixelRatio) / pixelRatio;
        const tilt = Math.sin(Math.PI * eased) * roll * .22;
        this.sheet.style.left = '0';
        this.sheet.style.top = '0';
        this.sheet.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
        if (tilt) this.sheet.style.transform = `translate(${this.clientWidth/2}px, ${this.clientHeight/2}px) rotate(${tilt}deg) scale(${scale}) translate(${-x}px, ${-y}px)`;
      } else {
        this.sheet.style.transform = `scale(${this.scale}) perspective(3300px) rotateX(${pitch}deg) rotateZ(${roll}deg) scale(${zoom}) translate(${-x}px, ${-y}px)`;
      }
      const travel = Math.min(seconds / settledAt, 1);
      const eased = travel * travel * (3 - 2 * travel);
      rows.forEach((row, index) => {
        if (row.endX !== row.startX) this.rails[index].style.transform = `translateX(${(row.endX - row.startX) * eased}px)`;
      });
    }
    setProgress(value) {
      if (!Number.isFinite(Number(value))) return;
      this.progress = Math.max(0, Math.min(1, Number(value)));
      this.last = 0;
      this.paint();
    }
    getProgress() { return this.progress; }
    setPlaying(value) { this.play = Boolean(value); this.refresh(); }
    preference() { if (!this.hasAttribute('data-card-preview')) this.setPlaying(!this.motion.matches); }
    stopClock() {
      cancelAnimationFrame(this.frame);
      this.frame = this.last = 0;
      this.removeAttribute('data-running');
    }
    refresh() {
      if (!this.isConnected || !this.hasAttribute('data-ready') || !this.inView || !this.play || document.hidden) {
        this.stopClock();
        return;
      }
      if (!this.frame) {
        this.setAttribute('data-running','');
        this.frame = requestAnimationFrame(this.tick);
      }
    }
    tick(now) {
      if (this.last) this.progress = (this.progress + (now - this.last) / (duration * 1000)) % 1;
      this.last = now;
      this.paint();
      this.frame = requestAnimationFrame(this.tick);
    }
  }
  customElements.define('survey-wall', SurveyWall);
})();

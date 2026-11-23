/* Li Pan portfolio - main.js */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------------- first-visit loader: "aligning every pixel" ----------------
     Shown once per browser session (flag set by the inline script in <head>). Intro animations
     (falling pills, headline reveal) wait for it via whenReady() so they play as it lifts. */
  var loaderEl = d.querySelector('.loader');
  var loading = !!loaderEl && root.classList.contains('is-loading');
  var readyQueue = [];
  function whenReady(fn) { if (loading) readyQueue.push(fn); else fn(); }
  if (loading) {
    (function runLoader() {
      var num = loaderEl.querySelector('[data-loader-num]');
      var t0 = performance.now(), DUR = 1100, loaded = d.readyState === 'complete';
      window.addEventListener('load', function () { loaded = true; });
      function finish() {
        if (!loading) return;
        loading = false;
        if (num) num.textContent = '100';
        try { sessionStorage.setItem('lp-seen', '1'); } catch (e) {}
        loaderEl.classList.add('is-done');
        setTimeout(function () { readyQueue.splice(0).forEach(function (fn) { fn(); }); }, 180);
        setTimeout(function () { root.classList.remove('is-loading'); }, 900);
      }
      function step(now) {
        var k = Math.min(1, (now - t0) / DUR);
        var e = 1 - Math.pow(1 - k, 3);
        // hold at 96% until the page has loaded (max 2.4s in total)
        var v = Math.round((loaded || now - t0 > 2400 ? e : Math.min(e, .96)) * 100);
        if (num) num.textContent = v < 10 ? '0' + v : String(v);
        if (k >= 1 && (loaded || now - t0 > 2400)) { finish(); return; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      setTimeout(finish, 3200);   // failsafe
    })();
  }

  /* the image strips loop by showing their tiles twice: copy them before any text is translated */
  d.querySelectorAll('[data-marquee]').forEach(function (track) {
    Array.prototype.slice.call(track.children).forEach(function (k) {
      var c = k.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
      c.querySelectorAll('a[href],button,[tabindex]').forEach(function (control) { control.tabIndex = -1; });
      track.appendChild(c);
    });
    var handle = d.getElementById('strip-handle');
    if (handle) track.after(handle.content.cloneNode(true));
  });

  /* ---------------- language: Chinese / English ----------------
     Chinese is the source text in the HTML. English comes from window.LP_EN (assets/js/i18n-en.js),
     keyed by the Chinese text itself: if a Chinese sentence is edited later it simply stays Chinese
     in English mode instead of showing an outdated translation. */
  (function initI18n() {
    var EN = window.LP_EN || {};
    var INLINE = { B: 1, STRONG: 1, EM: 1, I: 1, BR: 1, A: 1, SPAN: 1, SMALL: 1, CODE: 1, SUP: 1, SUB: 1 };
    var SKIP = 'script,style,svg,noscript,[data-i18n-skip]';
    var ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'data-tip', 'data-copy-label', 'data-go', 'data-say',
      'data-label-light', 'data-label-dark', 'data-tip-light', 'data-tip-dark'];
    var has = Object.prototype.hasOwnProperty;
    var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };
    var btn = d.querySelector('[data-lang-toggle]');
    var titleZh = d.title;
    var meta = d.querySelector('meta[name="description"]');
    var descZh = meta ? meta.getAttribute('content') : '';
    var done = [];

    function find(map, s) { var k = norm(s); return has.call(map, k) ? map[k] : null; }
    function inlineOnly(el) {
      var all = el.getElementsByTagName('*');
      for (var i = 0; i < all.length; i++) {
        if (!INLINE[all[i].tagName] || all[i].querySelector('svg,img')) return false;
      }
      return true;
    }
    function walk(el, map, record) {
      if (el.nodeType !== 1 || el.matches(SKIP)) return;
      var own = el.getAttribute('data-en');             // per-element English (same Chinese, different meaning)
      if (own !== null) {
        if (el.textContent !== own) { if (record) done.push({ node: el, html: 1, zh: el.innerHTML }); el.textContent = own; }
        return;
      }
      ATTRS.forEach(function (a) {
        var v = el.getAttribute(a);
        var t = v ? find(map, v) : null;
        if (t !== null) { if (record) done.push({ node: el, attr: a, zh: v }); el.setAttribute(a, t); }
      });
      if (el.children.length && inlineOnly(el)) {
        var html = find(map, el.innerHTML);
        if (html !== null) { if (record) done.push({ node: el, html: 1, zh: el.innerHTML }); el.innerHTML = html; return; }
      }
      Array.prototype.slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 1) { walk(n, map, record); return; }
        if (n.nodeType !== 3 || !n.nodeValue.trim()) return;
        var t = find(map, n.nodeValue);
        if (t === null) return;
        if (record) done.push({ node: n, zh: n.nodeValue });
        n.nodeValue = n.nodeValue.match(/^\s*/)[0] + t + n.nodeValue.match(/\s*$/)[0];
      });
    }
    function setLang(lang, first) {
      if (lang === 'en') {
        walk(d.body, EN, true);
      } else {
        for (var i = done.length - 1; i >= 0; i--) {
          var x = done[i];
          if (x.attr) x.node.setAttribute(x.attr, x.zh);
          else if (x.html) x.node.innerHTML = x.zh;
          else x.node.nodeValue = x.zh;
        }
        done = [];
      }
      root.lang = lang === 'en' ? 'en' : 'zh-CN';
      root.setAttribute('data-lang', lang);
      d.title = lang === 'en' ? (find(EN, titleZh) || titleZh) : titleZh;
      if (meta) meta.setAttribute('content', lang === 'en' ? (find(EN, descZh) || descZh) : descZh);
      if (btn) {
        btn.textContent = lang === 'en' ? '\u4e2d' : 'EN';
        btn.setAttribute('lang', lang === 'en' ? 'zh-CN' : 'en');
        btn.setAttribute('aria-label', lang === 'en' ? '\u5207\u6362\u5230\u4e2d\u6587' : 'Switch to English');
      }
      root.classList.remove('i18n-wait');
      if (!first) d.dispatchEvent(new CustomEvent('lp:lang', { detail: lang }));
    }
    var lang = root.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
    setLang(lang, true);
    if (btn) {
      btn.addEventListener('click', function () {
        lang = lang === 'en' ? 'zh' : 'en';
        try { localStorage.setItem('lp-lang', lang); } catch (e) {}
        setLang(lang, false);
      });
    }
  })();

  /* ---------------- light / dark theme ----------------
     The <head> script sets data-theme before first paint (saved choice, else the OS setting).
     The nav button flips it with a circular reveal (View Transitions API when available). */
  (function initTheme() {
    var btn = d.querySelector('[data-theme-toggle]');
    var meta = d.querySelector('meta[name="theme-color"]');
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    function saved() { try { return localStorage.getItem('lp-theme'); } catch (e) { return null; } }
    function current() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
    function apply(t) {
      root.setAttribute('data-theme', t);
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0e0e10' : '#fafafa');
      if (btn) {
        btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
        var label = btn.getAttribute(t === 'dark' ? 'data-label-dark' : 'data-label-light');
        var tip = btn.getAttribute(t === 'dark' ? 'data-tip-dark' : 'data-tip-light');
        if (label) btn.setAttribute('aria-label', label);
        if (tip) btn.setAttribute('data-tip', tip);
      }
    }
    apply(current());
    var follow = function (e) { if (!saved()) apply(e.matches ? 'dark' : 'light'); };
    d.addEventListener('lp:lang', function () { apply(current()); });
    if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('lp-theme', next); } catch (e) {}
      if (!d.startViewTransition || reduceMotion) { apply(next); return; }
      var r = btn.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var vt = d.startViewTransition(function () { apply(next); });
      vt.ready.then(function () {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () {});
    });
  })();

  /* ---------------- nav hide / show + progress bar ---------------- */
  var nav = d.querySelector('.nav');
  var bar = d.querySelector('.progress');
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    var max = root.scrollHeight - window.innerHeight;
    if (bar) bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    if (nav) {
      if (y > 140 && y > lastY + 4) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 140) nav.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------------- reveal on scroll ---------------- */
  var reveals = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------- falling pills (Matter.js) ---------------- */
  function initPhysics() {
    var box = d.querySelector('[data-physics]');
    if (!box) return;
    var M = window.Matter;
    if (reduceMotion || !M) { box.classList.add('is-static'); return; }

    var Engine = M.Engine, Bodies = M.Bodies, Body = M.Body, Composite = M.Composite,
        Constraint = M.Constraint, Sleeping = M.Sleeping;
    var engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1;
    engine.gravity.scale = 0.0011;

    var W = box.clientWidth, H = box.clientHeight, T = 400;
    var wallOpts = { isStatic: true, friction: 0.6 };
    var floor = Bodies.rectangle(W / 2, H + T / 2, 8000, T, wallOpts);
    var left = Bodies.rectangle(-T / 2, H / 2 - 2000, T, H + 6000, wallOpts);
    var right = Bodies.rectangle(W + T / 2, H / 2 - 2000, T, H + 6000, wallOpts);
    Composite.add(engine.world, [floor, left, right]);

    var pills = Array.prototype.slice.call(box.querySelectorAll('.pill'));
    var items = [];          // live items: { el, body, w, h }
    var drag = null;

    function makeBody(el, x, y, angle) {
      var w = el.offsetWidth, h = el.offsetHeight, body;
      if (el.classList.contains('ball')) {
        body = Bodies.circle(x, y, w / 2, { restitution: 0.4, friction: 0.25, frictionAir: 0.012, density: 0.0016 });
      } else {
        body = Bodies.rectangle(x, y, w, h, {
          chamfer: { radius: h / 2 - 1 },
          restitution: 0.22, friction: 0.4, frictionAir: 0.014, density: 0.0012,
          angle: angle
        });
      }
      Composite.add(engine.world, body);
      return { el: el, body: body, w: w, h: h };
    }
    function itemOf(el) {
      for (var i = 0; i < items.length; i++) if (items[i].el === el) return items[i];
      return null;
    }
    function removeItem(it) {
      if (drag && drag.bodyB === it.body) { Composite.remove(engine.world, drag); drag = null; }
      Composite.remove(engine.world, it.body);
      items.splice(items.indexOf(it), 1);
      it.el.classList.remove('has-body');
    }
    // create / drop / resize bodies so they always match the visible pills
    function sync(initial) {
      var order = pills.slice();
      if (initial) order.sort(function () { return Math.random() - 0.5; });
      var dropIndex = 0;
      order.forEach(function (el) {
        var visible = el.offsetParent !== null;
        var it = itemOf(el);
        if (!visible) { if (it) removeItem(it); return; }
        if (it) {
          if (Math.abs(el.offsetWidth - it.w) > 2 || Math.abs(el.offsetHeight - it.h) > 2) {
            var pos = it.body.position, ang = it.body.angle;
            removeItem(it);
            items.push(makeBody(el, clamp(pos.x, el.offsetWidth / 2, W - el.offsetWidth / 2), Math.min(pos.y, H - el.offsetHeight), ang));
            el.classList.add('has-body');
          }
          return;
        }
        var w = el.offsetWidth, h = el.offsetHeight;
        var x = clamp(W * 0.12 + Math.random() * W * 0.76, w / 2 + 4, W - w / 2 - 4);
        var y = -h - 40 - dropIndex * (H * 0.09) - Math.random() * 40;
        dropIndex++;
        items.push(makeBody(el, x, y, (Math.random() - 0.5) * 0.9));
        el.classList.add('has-body');
      });
    }
    sync(true);

    function render() {
      for (var i = 0; i < items.length; i++) {
        var it = items[i], p = it.body.position;
        it.el.style.transform = 'translate3d(' + (p.x - it.w / 2).toFixed(2) + 'px,' +
          (p.y - it.h / 2).toFixed(2) + 'px,0) rotate(' + it.body.angle.toFixed(4) + 'rad)';
      }
    }
    render();
    box.classList.add('is-ready');

    var STEP = 1000 / 60, acc = 0, last = 0, raf = 0, running = false;
    function frame(t) {
      if (!last) last = t;
      acc += Math.min(100, t - last);
      last = t;
      while (acc >= STEP) { Engine.update(engine, STEP); acc -= STEP; }
      render();
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    var hero = box.closest('section') || box;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es[0].isIntersecting ? start() : stop();
      }).observe(hero);
    } else { start(); }
    d.addEventListener('visibilitychange', function () { if (d.hidden) stop(); });

    // dragging (mouse / pen) - touch gets a playful kick so page scrolling stays smooth
    function local(e) {
      var r = box.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    pills.forEach(function (el) {
      el.addEventListener('pointerdown', function (e) {
        var it = itemOf(el);
        if (!it) return;
        Sleeping.set(it.body, false);
        start();
        if (e.pointerType === 'touch' || !finePointer) {
          Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 10, y: -14 - Math.random() * 6 });
          Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.35);
          return;
        }
        e.preventDefault();
        el._down = { x: e.clientX, y: e.clientY, t: performance.now() };
        var p = local(e), b = it.body;
        if (drag) Composite.remove(engine.world, drag);
        drag = Constraint.create({
          pointA: p, bodyB: b,
          pointB: { x: p.x - b.position.x, y: p.y - b.position.y },
          length: 0.01, stiffness: 0.18, damping: 0.08
        });
        Composite.add(engine.world, drag);
        el.classList.add('is-dragging');
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      });
      el.addEventListener('pointermove', function (e) {
        var it = itemOf(el);
        if (drag && it && drag.bodyB === it.body) {
          var p = local(e);
          drag.pointA.x = clamp(p.x, 0, W); drag.pointA.y = clamp(p.y, -200, H);
        }
      });
      function end() {
        var it = itemOf(el);
        if (drag && it && drag.bodyB === it.body) { Composite.remove(engine.world, drag); drag = null; }
        el.classList.remove('is-dragging');
      }
      el.addEventListener('pointerup', function (e) {
        var dn = el._down, href = el.getAttribute('data-href');
        el._down = null;
        end();
        if (!dn || !href || e.pointerType === 'touch') return;
        if (Math.hypot(e.clientX - dn.x, e.clientY - dn.y) < 6 && performance.now() - dn.t < 400) {
          if (href.charAt(0) === '#') {
            var target = d.querySelector(href);
            if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
          } else { location.href = href; }
        }
      });
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
    });

    // keep walls + bodies in sync with the hero size and breakpoints
    function resize() {
      var nw = box.clientWidth, nh = box.clientHeight;
      if (nw !== W || nh !== H) {
        W = nw; H = nh;
        Body.setPosition(floor, { x: W / 2, y: H + T / 2 });
        Body.setPosition(left, { x: -T / 2, y: H / 2 - 2000 });
        Body.setPosition(right, { x: W + T / 2, y: H / 2 - 2000 });
        items.forEach(function (it) {
          var p = it.body.position;
          if (p.x > W - 10 || p.x < 10 || p.y > H) {
            Body.setPosition(it.body, { x: clamp(p.x, it.w / 2, W - it.w / 2), y: Math.min(p.y, H - it.h) - 20 });
            Sleeping.set(it.body, false);
          }
        });
      }
      sync(false);
      render();
      start();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(box);
    else window.addEventListener('resize', resize);
    d.addEventListener('lp:lang', function () { setTimeout(function () { sync(false); render(); start(); }, 30); });
  }
  if (d.querySelector('[data-physics]')) {
    var go = function () { whenReady(initPhysics); };
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(go); else window.addEventListener('load', go);
  }

  /* Visible project strips drift horizontally. Dragging and trackpad gestures still work when motion is paused. */
  (function initStrips() {
    const tracks = Array.from(d.querySelectorAll('[data-marquee]'));
    if (!tracks.length) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const friction = 0.925;
    const drift = -0.028;
    const strips = [];
    let raf = 0;
    let last = 0;
    let geometryDirty = true;
    function wake() { if (!raf && !d.hidden) raf = requestAnimationFrame(render); }
    function invalidate() { geometryDirty = true; wake(); }
    function wrap(x, width) { return width ? (x % width + (x % width > 0 ? -width : 0)) : 0; }
    function speed(strip) { return motion.matches || strip.hold || strip.hover || strip.focused ? 0 : strip.drift; }
    function render(time) {
      raf = 0;
      const delta = last ? Math.min(time - last, 48) : 16.7;
      if (geometryDirty) {
        for (const strip of strips) {
          const box = strip.box.getBoundingClientRect();
          // A sticky card is covered by the next project before it leaves the viewport.
          const bottom = Math.min(innerHeight, box.bottom, strip.next ? strip.next.getBoundingClientRect().top : Infinity);
          const exposedHeight = bottom - Math.max(0, box.top);
          // The HR reel queues at its opening while earlier projects are being read.
          if (!strip.entered && exposedHeight >= Math.min(box.height, innerHeight) * .45) {
            strip.entered = true;
          }
          const visible = strip.entered && exposedHeight > 0;
          if (visible !== strip.visible) {
            strip.visible = visible;
            strip.syncFilm?.();
          }
        }
        geometryDirty = false;
      }
      let running = false;
      for (const strip of strips) {
        if (!strip.visible && !strip.drag) continue;
        const target = speed(strip);
        if (!strip.drag) {
          if (motion.matches) strip.velocity = 0;
          else strip.velocity += (target - strip.velocity) * (1 - friction ** (delta / 16.67));
          const step = motion.matches || Math.abs(strip.remaining) < 1 ? strip.remaining : strip.remaining * (1 - Math.exp(-delta / 80));
          strip.remaining -= step;
          strip.offset += strip.velocity * delta + step;
        }
        strip.offset = wrap(strip.offset, strip.period);
        // Move detailed UI artwork in whole device pixels so fine strokes stay stable.
        const ratio = window.devicePixelRatio || 1;
        const position = strip.snapToPixels ? Math.round(strip.offset * ratio) / ratio : strip.offset.toFixed(2);
        if (position !== strip.painted) {
          strip.track.style.transform = `translate3d(${position}px,0,0)`;
          strip.painted = position;
        }
        if (!strip.drag && (target || strip.remaining || Math.abs(strip.velocity) > .005)) running = true;
      }
      last = running ? time : 0;
      if (running) wake();
    }
    for (const track of tracks) {
      const box = track.parentElement;
      const card = box.closest('.pcard');
      const next = card && card.nextElementSibling;
      const featured = box.classList.contains('marquee--featured-videos');
      const playback = box.querySelector('.hr-playback');
      const stripDrift = featured || playback ? -.018 : drift;
      const strip = { track, box, featured, snapToPixels: featured || !!playback, drift: stripDrift, next: next?.matches('.pcard') ? next : null, period: track.scrollWidth / 2,
        offset: 0, remaining: 0, focused: false, velocity: stripDrift, drag: null, entered: !playback, visible: false, hold: false, hover: false, painted: '' };
      strips.push(strip);
      track.querySelectorAll('img').forEach(img => { img.draggable = false; });
      if (featured) box.addEventListener('msh:motion', event => { strip.hold = event.detail.paused; if (strip.hold) strip.velocity = 0; wake(); });
      const modePicker = card?.querySelector('.seewo-mode');
      if (modePicker) {
        // Bring the launcher back into view and hold it still while its modes are compared.
        function showLauncher() {
          strip.remaining = 0;
          strip.offset = 0;
          strip.velocity = 0;
          strip.hold = modePicker.matches(':focus-within');
          wake();
        }
        modePicker.addEventListener('focusin', showLauncher);
        modePicker.addEventListener('click', showLauncher);
        modePicker.addEventListener('change', showLauncher);
        modePicker.addEventListener('focusout', event => {
          if (!modePicker.contains(event.relatedTarget)) { strip.hold = false; wake(); }
        });
      }
      if (playback) {
        const visibility = new Map();
        const previews = Array.from(track.querySelectorAll('survey-wall[data-card-preview]'));
        let gesture = false;
        function syncFilm() {
          for (const wall of previews) {
            const ratio = visibility.get(wall.closest('.tile')) || 0;
            wall.setPlaying?.(strip.visible && ratio >= .1 && !motion.matches && !gesture && !d.hidden && !strip.hold);
          }
        }
        customElements.whenDefined('survey-wall').then(syncFilm);
        strip.syncFilm = syncFilm;
        let activeTile = null;
        const observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            visibility.set(entry.target, entry.intersectionRatio);
            if (entry.intersectionRatio === 0) {
              entry.target.querySelector('survey-wall')?.setProgress?.(0);
            }
          }
          let best = null, highest = .15;
          for (const [tile, ratio] of visibility) {
            if (ratio > highest) { best = tile; highest = ratio; }
          }
          if (best !== activeTile) {
            activeTile?.classList.remove('is-demo');
            best?.classList.add('is-demo');
            activeTile = best;
          }
          syncFilm();
        }, { threshold: Array.from({length: 21}, (_, i) => i / 20) });
        for (const tile of track.children) observer.observe(tile);
        box.addEventListener('pointerdown', event => {
          if (!event.isPrimary || event.button !== 0 || event.target.closest('button, a, input, select, textarea')) return;
          gesture = true;
          syncFilm();
        });
        const endGesture = () => { if (gesture) { gesture = false; syncFilm(); } };
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) box.addEventListener(event, endGesture);
        const syncPlayback = () => {
          syncFilm();
          playback.hidden = motion.matches;
          box.classList.toggle('is-demo-paused', strip.hold || d.hidden);
        };
        playback.addEventListener('click', () => {
          strip.hold = !strip.hold;
          strip.remaining = strip.velocity = 0;
          playback.setAttribute('aria-pressed', String(strip.hold));
          syncPlayback();
          wake();
        });
        motion.addEventListener('change', syncPlayback);
        d.addEventListener('visibilitychange', syncPlayback);
        syncPlayback();
      }
      const handle = box.querySelector('.strip-handle');
      let suppressClick = false;
      function advance(direction) {
        strip.velocity = 0;
        strip.remaining = direction * box.clientWidth * .8;
        if (playback && strip.period > 0) {
          // Align with the next artwork's center, including at the loop seam.
          const center = box.clientWidth / 2 - strip.offset;
          const tiles = Array.from(track.children).slice(0, track.children.length / 2);
          const distances = tiles.map(tile => {
            const distance = (tile.offsetLeft + tile.offsetWidth / 2 - center) * -direction;
            const wrapped = ((distance % strip.period) + strip.period) % strip.period;
            return wrapped < 12 ? wrapped + strip.period : wrapped;
          });
          strip.remaining = direction * Math.min(...distances);
        }
        wake();
      }
      handle?.addEventListener('click', event => {
        if (event.detail === 0 || !suppressClick) advance(-1);
      });
      handle?.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        advance(event.key === 'ArrowLeft' ? 1 : -1);
      });
      handle?.addEventListener('focus', () => { strip.focused = true; strip.velocity = 0; wake(); });
      handle?.addEventListener('blur', () => { strip.focused = false; wake(); });
      if (playback) {
        const entryLink = track.querySelector('.survey-wall-link');
        entryLink?.addEventListener('focus', () => {
          if (!entryLink.matches(':focus-visible')) return;
          strip.focused = true;
          box.scrollLeft = 0;
          strip.offset = -entryLink.closest('.tile').offsetLeft;
          strip.remaining = strip.velocity = 0;
          wake();
        });
        entryLink?.addEventListener('blur', () => { strip.focused = false; wake(); });
      }
      box.addEventListener('pointerenter', event => {
        if (!playback && event.pointerType === 'mouse') { strip.hover = true; strip.velocity = 0; wake(); }
      });
      box.addEventListener('pointerleave', () => { strip.hover = false; wake(); });
      box.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0 || strip.drag) return;
        const control = event.target.closest('button, a, input, select, textarea');
        if (control && control !== handle) return;
        suppressClick = false;
        strip.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: strip.offset,
          live: false, samples: [{ t: event.timeStamp, x: event.clientX }] };
        strip.remaining = strip.velocity = 0;
        (control || box).setPointerCapture(event.pointerId);
        wake();
      });
      box.addEventListener('pointermove', event => {
        const drag = strip.drag;
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        if (!drag.live) {
          const dy = event.clientY - drag.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            if (event.pointerType !== 'mouse') { strip.drag = null; suppressClick = true; wake(); }
            return;
          }
          drag.live = true;
          suppressClick = true;
          box.classList.add('is-grabbing');
        }
        strip.offset = drag.start + dx;
        drag.samples.push({ t: event.timeStamp, x: event.clientX });
        while (drag.samples.length > 1 && event.timeStamp - drag.samples[0].t > 90) drag.samples.shift();
        wake();
      });
      function release(event) {
        const drag = strip.drag;
        if (!drag || drag.id !== event.pointerId) return;
        strip.drag = null;
        box.classList.remove('is-grabbing');
        const first = drag.samples[0];
        const lastMove = drag.samples[drag.samples.length - 1];
        const elapsed = event.timeStamp - first.t;
        if (event.type === 'pointerup' && drag.live) {
          strip.offset = drag.start + event.clientX - drag.x;
          if (!motion.matches && elapsed > 0 && event.timeStamp - lastMove.t < 70) {
            strip.velocity = clamp((event.clientX - first.x) / elapsed, -1.8, 1.8);
          }
        }
        wake();
      }
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) box.addEventListener(event, release);
      box.addEventListener('wheel', event => {
        if (event.ctrlKey || strip.drag) return;
        const sideways = event.shiftKey && !event.deltaX;
        if (!sideways && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.clientWidth : 1;
        strip.offset -= (sideways ? event.deltaY : event.deltaX) * unit;
        strip.remaining = strip.velocity = 0;
        wake();
      }, {passive: false});
    }
    function measure() { strips.forEach(s => { s.period = s.track.scrollWidth / 2; }); invalidate(); }
    window.addEventListener('scroll', invalidate, {passive: true});
    window.addEventListener('resize', measure);
    if (d.fonts?.ready) d.fonts.ready.then(measure);
    if (motion.addEventListener) motion.addEventListener('change', invalidate);
    d.addEventListener('visibilitychange', () => {
      if (d.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; }
      else invalidate();
    });
    window.addEventListener('pageshow', invalidate);
    wake();
  })();

  /* ---------------- playground lab wall ---------------- */
  // before / after: a transparent range input covers the image, so mouse, touch and keyboard all work
  d.querySelectorAll('[data-compare]').forEach(function (fig) {
    var range = fig.querySelector('input[type=range]');
    if (!range) return;
    var set = function () { fig.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', set);
    set();
  });
  // 3D tilt following the pointer
  if (finePointer && !reduceMotion) {
    d.querySelectorAll('[data-tilt]').forEach(function (cell) {
      var card = cell.querySelector('.lab__tilt');
      cell.addEventListener('pointermove', function (e) {
        var r = cell.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.setProperty('--rx', (-y * 18).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (x * 22).toFixed(2) + 'deg');
        card.style.setProperty('--gx', ((x + .5) * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', ((y + .5) * 100).toFixed(1) + '%');
      });
      cell.addEventListener('pointerleave', function () {
        ['--rx', '--ry'].forEach(function (k) { card.style.setProperty(k, '0deg'); });
      });
    });
  }
  // the mascot waves back
  d.querySelectorAll('[data-wave]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.classList.remove('is-waving');
      void btn.offsetWidth;
      btn.classList.add('is-waving');
      say(btn.getAttribute('data-say'));
    });
    btn.addEventListener('animationend', function (e) { if (e.animationName === 'wave') btn.classList.remove('is-waving'); });
  });
  // blur-to-sharp reveal (hover on desktop, tap to toggle on touch)
  d.querySelectorAll('[data-reveal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });

  /* ---------------- hero status bar: live Fuzhou time ---------------- */
  var clocks = d.querySelectorAll('[data-clock]');
  if (clocks.length) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) { fmt = null; }
    var tickClock = function () {
      var t = fmt ? fmt.format(new Date()) : new Date().toTimeString().slice(0, 8);
      clocks.forEach(function (c) { c.textContent = t; });
    };
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ---------------- footer: eyes follow the pointer ---------------- */
  var pupils = d.querySelectorAll('.eye i');
  if (pupils.length && !reduceMotion) {
    var px = 0, py = 0, eyeQueued = false;
    function look() {
      eyeQueued = false;
      pupils.forEach(function (p) {
        var r = p.parentElement.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var a = Math.atan2(py - cy, px - cx);
        var k = clamp(Math.hypot(px - cx, py - cy) / 260, 0, 1);
        p.style.setProperty('--x', (Math.cos(a) * 6.5 * k).toFixed(2) + 'px');
        p.style.setProperty('--y', (Math.sin(a) * 9 * k).toFixed(2) + 'px');
      });
    }
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (!eyeQueued) { eyeQueued = true; requestAnimationFrame(look); }
    }, { passive: true });
  }

  /* ---------------- footer: custom "mail me" cursor ---------------- */
  var cursor = d.querySelector('.cursor');
  if (cursor && finePointer) {
    root.classList.add('has-cursor');
    d.querySelectorAll('[data-cursor]').forEach(function (el) {
      el.addEventListener('pointerenter', function () { cursor.style.setProperty('--cs', 1); });
      el.addEventListener('pointerleave', function () { cursor.style.setProperty('--cs', 0); });
      el.addEventListener('pointermove', function (e) {
        cursor.style.setProperty('--cx', e.clientX + 'px');
        cursor.style.setProperty('--cy', e.clientY + 'px');
      });
    });
  }

  /* ---------------- fit giant footer name to width ---------------- */
  function fitName() {
    d.querySelectorAll('[data-fit]').forEach(function (el) {
      el.style.fontSize = '100px';
      var avail = el.parentElement.clientWidth -
        parseFloat(getComputedStyle(el.parentElement).paddingLeft) -
        parseFloat(getComputedStyle(el.parentElement).paddingRight);
      var w = el.scrollWidth;
      if (w > 0) el.style.fontSize = (100 * avail / w * 0.995).toFixed(2) + 'px';
    });
  }
  fitName();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(fitName);
  window.addEventListener('resize', fitName);

  /* ---------------- toast + copy ---------------- */
  var toast = d.querySelector('.toast'), toastTimer;
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2200);
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = d.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      d.body.appendChild(ta); ta.select();
      try { d.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      d.body.removeChild(ta);
    });
  }
  d.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var label = btn.getAttribute('data-copy-label') || '\u5df2\u590d\u5236';
      copy(text).then(function () { say(label + (root.lang === 'en' ? ': ' : '\uff1a') + text); }, function () { say(text); });
    });
  });

  /* ---------------- lightbox ---------------- */
  var lb = d.querySelector('.lightbox');
  if (lb) {
    var lbImg = lb.querySelector('img'), lastFocus = null;
    function open(src, alt) {
      lastFocus = d.activeElement;
      lbImg.src = src; lbImg.alt = alt || '';
      lb.classList.add('is-open');
      lb.querySelector('.lightbox__close').focus();
      d.body.style.overflow = 'hidden';
    }
    function close() {
      lb.classList.remove('is-open');
      d.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }
    d.querySelectorAll('.zoomable').forEach(function (img) {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.addEventListener('click', function () { open(img.currentSrc || img.src, img.alt); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img.currentSrc || img.src, img.alt); }
      });
    });
    lb.addEventListener('click', close);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('is-open')) close(); });
  }

  /* Two quiet typesetting beats, followed by a hand-drawn marker stroke. */
  (function initHeadline() {
    const title = d.querySelector('[data-headline]');
    if (!title) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const lines = title.querySelectorAll('.headline-line');
    const ink = title.querySelector('.headline-ink');
    if (!ink.animate) return;
    const easing = 'cubic-bezier(.2,.75,.25,1)';
    function draw(delay = 0) {
      if (motion.matches) return;
      ink.getAnimations().forEach(animation => animation.cancel());
      ink.animate([
        { clipPath: 'inset(0 100% 0 0 round .12em)' },
        { clipPath: 'inset(0 0% 0 0 round .12em)' }
      ], { duration: 520, delay, easing, fill: 'backwards' });
    }
    function reveal() {
      if (motion.matches) return;
      lines.forEach((line, index) => {
        line.getAnimations().forEach(animation => animation.cancel());
        line.animate([
          { transform: 'translateY(.22em)', opacity: .18 },
          { transform: 'translateY(0)', opacity: 1 }
        ], { duration: 440, delay: index * 100, easing, fill: 'backwards' });
      });
      draw(300);
    }
    title.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') draw(); });
    title.addEventListener('click', () => { if (window.getSelection()?.isCollapsed) draw(); });
    motion.addEventListener('change', () => {
      if (motion.matches) title.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    });
    d.addEventListener('lp:lang', reveal);
    whenReady(reveal);
  })();
})();

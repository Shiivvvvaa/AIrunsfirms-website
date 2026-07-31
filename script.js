/* ================================================
   AIRUNSFIRMS — v3 interactions
   Cursor trail · ambient particles · scroll graphics
================================================ */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(pointer: fine)').matches;

/* ── Smooth scrolling (Lenis) ───────────────── */
let lenis = null;
if (typeof Lenis !== 'undefined' && !REDUCED) {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
    smoothTouch: false,
  });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

/* ════════════════════════════════════════════════
   FX CANVAS — ambient gold particles + cursor trail
   Particles drift slowly, react to scroll velocity,
   and connect with hairlines near the cursor.
════════════════════════════════════════════════ */
function initFX() {
  const canvas = document.getElementById('fx');
  if (!canvas || REDUCED) return;

  const ctx = canvas.getContext('2d');
  let W, H, DPR;
  let particles = [];
  let sparks = [];   // cursor trail sparks
  let trail = [];    // silk ribbon points {x, y, t}
  const TRAIL_LIFE = 1400;  // ms before a ribbon point fully fades
  const TRAIL_MAX = 140;    // max ribbon points
  const mouse = { x: -9999, y: -9999, px: -9999, py: -9999 };
  let scrollVel = 0;
  let lastScrollY = window.scrollY;

  /* ── Performance guardrails ──────────────────
     quality: 2 full · 1 reduced · 0 minimal.
     Starts reduced on low-end hardware; drops
     automatically if frames run slow.          */
  const LOW_END = (navigator.deviceMemory && navigator.deviceMemory <= 4)
               || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  let quality = LOW_END ? 1 : 2;
  let lastFrameT = performance.now();
  let slowStreak = 0;
  let fxDead = false;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    spawnParticles();
  }

  function spawnParticles() {
    const CAP     = [36, 60, 90][quality];
    const DENSITY = [50000, 32000, 22000][quality];
    const target = Math.min(CAP, Math.round((W * H) / DENSITY));
    particles = [];
    for (let i = 0; i < target; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.4,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        depth: Math.random() * 0.7 + 0.3,   // parallax factor
        tw: Math.random() * Math.PI * 2,    // twinkle phase
        tws: Math.random() * 0.015 + 0.004, // twinkle speed
      });
    }
  }

  /* Debounced resize — no particle respawn storm while dragging the window */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  resize();

  /* Clear trails when the tab is hidden so nothing jumps on return */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { trail = []; sparks = []; scrollVel = 0; }
    lastFrameT = performance.now();
  });

  /* Track scroll velocity → particles drift upward as you scroll down */
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    const dy = sy - lastScrollY;
    scrollVel += dy * 0.06;
    lastScrollY = sy;

    /* ribbon + sparks stick to page content — they slide away
       behind you as you scroll, leaving a trail on the page */
    if (dy !== 0) {
      for (const pt of trail) pt.y -= dy;
      for (const s of sparks) s.y -= dy;
      // lay down a new point at the cursor so scrolling itself paints the ribbon
      if (FINE && mouse.x > -100) {
        trail.push({ x: mouse.x, y: mouse.y, t: performance.now() });
        if (trail.length > TRAIL_MAX) trail.shift();
      }
    }
  }, { passive: true });

  /* Cursor sparks */
  if (FINE) {
    window.addEventListener('mousemove', (e) => {
      mouse.px = mouse.x; mouse.py = mouse.y;
      mouse.x = e.clientX; mouse.y = e.clientY;
      const dx = mouse.x - mouse.px, dy = mouse.y - mouse.py;
      const speed = Math.hypot(dx, dy);

      // silk ribbon — record a point when the cursor has moved enough
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(mouse.x - last.x, mouse.y - last.y) > 3) {
        trail.push({ x: mouse.x, y: mouse.y, t: performance.now() });
        if (trail.length > TRAIL_MAX) trail.shift();
      }

      // emit sparks proportional to movement speed
      const count = Math.min(3, Math.floor(speed / 9));
      for (let i = 0; i < count; i++) {
        if (sparks.length > 90) break;
        const t = Math.random();
        sparks.push({
          x: mouse.px + dx * t + (Math.random() - 0.5) * 4,
          y: mouse.py + dy * t + (Math.random() - 0.5) * 4,
          vx: -dx * 0.02 + (Math.random() - 0.5) * 0.5,
          vy: -dy * 0.02 + (Math.random() - 0.5) * 0.5 - 0.15,
          life: 1,
          decay: Math.random() * 0.02 + 0.016,
          r: Math.random() * 1.6 + 0.5,
        });
      }
    }, { passive: true });
  }

  const GOLD = '201, 169, 98';
  const GOLD_SOFT = '230, 207, 154';

  function frame() {
    if (fxDead) return;
    try {

    /* adaptive quality — shed effects until frames run smooth again */
    const nowT = performance.now();
    const dt = nowT - lastFrameT;
    lastFrameT = nowT;
    if (dt > 28 && dt < 500) slowStreak++;
    else if (slowStreak > 0) slowStreak -= 2;
    if (slowStreak > 45 && quality > 0) {
      quality--;
      slowStreak = 0;
      spawnParticles();
    }

    ctx.clearRect(0, 0, W, H);
    scrollVel *= 0.92; // decay

    /* ambient particles */
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy - scrollVel * p.depth * 0.35;
      p.tw += p.tws;

      // gentle pull away from cursor (repel within 90px)
      if (FINE) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 8100 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (90 - d) / 90 * 0.35;
          p.x += (dx / d) * f;
          p.y += (dy / d) * f;
        }
      }

      // wrap
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;

      const alpha = (0.18 + Math.sin(p.tw) * 0.12) * p.depth;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GOLD}, ${alpha.toFixed(3)})`;
      ctx.fill();
    }

    /* constellation lines near the cursor (skipped at minimal quality) */
    if (FINE && quality > 0 && mouse.x > -100) {
      for (const p of particles) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 19600) { // 140px
          const a = (1 - Math.sqrt(d2) / 140) * 0.16;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `rgba(${GOLD}, ${a.toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    /* silk ribbon trail — tapered, glowing, fades over TRAIL_LIFE */
    const now = performance.now();
    while (trail.length && now - trail[0].t > TRAIL_LIFE) trail.shift();
    if (trail.length > 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length - 1; i++) {
        const p0 = trail[i - 1], p1 = trail[i], p2 = trail[i + 1];
        const life = 1 - (now - p1.t) / TRAIL_LIFE;      // 1 fresh → 0 gone
        if (life <= 0) continue;
        const prog = i / (trail.length - 1);              // 0 tail → 1 head
        const width = Math.max((0.4 + prog * 3) * life, 0.1);
        const alpha = life * life * 0.5;
        ctx.beginPath();
        ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
        ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        // core stroke — champagne
        ctx.strokeStyle = `rgba(${GOLD_SOFT}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = width;
        ctx.stroke();
        // wide soft glow — gold (full quality only; it's a 2nd stroke pass)
        if (quality === 2) {
          ctx.strokeStyle = `rgba(${GOLD}, ${(alpha * 0.3).toFixed(3)})`;
          ctx.lineWidth = width * 3;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    /* cursor trail sparks */
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy -= 0.008; // faint float upward
      s.life -= s.decay;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GOLD_SOFT}, ${(s.life * 0.6).toFixed(3)})`;
      ctx.fill();
    }

    } catch (err) {
      /* guardrail: one bad frame kills the FX layer, never the site */
      fxDead = true;
      canvas.style.display = 'none';
      console.warn('FX disabled after error:', err);
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
try { initFX(); } catch (err) { console.warn('FX init failed — site continues without effects:', err); }

/* ════════════════════════════════════════════════
   CUSTOM CURSOR — dot + lagging ring
════════════════════════════════════════════════ */
function initCursor() {
  if (!FINE || REDUCED) return;
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  const label = document.getElementById('cursorLabel');
  if (!dot || !ring) return;

  document.body.classList.add('has-cursor');
  let mx = -100, my = -100, rx = -100, ry = -100;
  let shown = false;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (!shown) { shown = true; document.body.classList.add('cursor-on'); }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    shown = false;
    document.body.classList.remove('cursor-on');
  });
  document.addEventListener('mousedown', () => ring.classList.add('is-down'));
  document.addEventListener('mouseup', () => ring.classList.remove('is-down'));

  function loop() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${rx.toFixed(1)}px, ${ry.toFixed(1)}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  /* grow on interactive elements; optional glyph via data-cursor */
  const HOVERABLE = 'a, button, input, [data-cursor]';
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest(HOVERABLE);
    if (t) {
      ring.classList.add('is-hover');
      if (label) label.textContent = t.dataset.cursor || '';
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(HOVERABLE)) {
      ring.classList.remove('is-hover');
      if (label) label.textContent = '';
    }
  });
}
try { initCursor(); } catch (err) { console.warn('Custom cursor failed — native cursor restored:', err); document.body.classList.remove('has-cursor'); }

/* ════════════════════════════════════════════════
   DOM interactions
════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Hero headline line reveal ──────────────── */
  const headline = document.querySelector('.hero-headline');
  if (headline) {
    requestAnimationFrame(() => {
      setTimeout(() => headline.classList.add('shown'), 60);
    });
  }

  /* ── Hero word rotator ──────────────────────── */
  const rotator = document.getElementById('rotator');
  if (rotator && !REDUCED) {
    const words = rotator.querySelectorAll('.rotator-word');
    let idx = 0;
    setInterval(() => {
      const current = words[idx];
      idx = (idx + 1) % words.length;
      const next = words[idx];
      current.classList.remove('is-active');
      current.classList.add('is-out');
      next.classList.remove('is-out');
      next.classList.add('is-active');
      setTimeout(() => current.classList.remove('is-out'), 700);
    }, 3200);
  }

  /* ── Scroll progress + nav + parallax (one handler) ─ */
  const progress = document.getElementById('scrollProgress');
  const nav = document.getElementById('nav');
  const heroGlow = document.getElementById('heroGlow');
  const ghosts = document.querySelectorAll('[data-parallax]');
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(sy / max, 1) : 0})`;
      if (nav) nav.classList.toggle('scrolled', sy > 40);
      if (heroGlow && sy < vh * 1.4) heroGlow.style.transform = `translateY(${sy * 0.18}px)`;

      /* ghost section numbers drift slower than the page */
      ghosts.forEach(g => {
        const rect = g.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const centerOffset = rect.top + rect.height / 2 - vh / 2;
        g.style.transform = `translateY(${(centerOffset * parseFloat(g.dataset.parallax || 0.12)).toFixed(1)}px)`;
      });

      updateProcessLine();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Mobile nav ─────────────────────────────── */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ── Anchor scrolling ───────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70 });
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ── Active nav link ────────────────────────── */
  const sectionLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  document.querySelectorAll('section[id]').forEach(sec => {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        sectionLinks.forEach(a => a.classList.remove('active'));
        const link = document.querySelector(`.nav-links a[href="#${sec.id}"]`);
        if (link) link.classList.add('active');
      }
    }, { threshold: 0.35 }).observe(sec);
  });

  /* ── Reveal on scroll (staggered per batch) ──── */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver(entries => {
    const arriving = entries.filter(e => e.isIntersecting);
    arriving.forEach((entry, i) => {
      entry.target.style.setProperty('--d', `${Math.min(i * 0.08, 0.4)}s`);
      entry.target.classList.add('in');
      revealObs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  revealEls.forEach(el => revealObs.observe(el));

  /* ── Count-up numbers ───────────────────────── */
  function countUp(el) {
    if (el._counted) return;
    el._counted = true;
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    if (REDUCED) { el.textContent = prefix + target.toLocaleString() + suffix; return; }
    const dur = 1600;
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 4);
    const run = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = prefix + Math.round(ease(p) * target).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }
  const countObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { countUp(e.target); countObs.unobserve(e.target); } });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(el => countObs.observe(el));

  /* ── Process line draw + markers ────────────── */
  const processTrack = document.getElementById('processTrack');
  const processFill = document.getElementById('processLineFill');
  const processSteps = document.querySelectorAll('.process-step');
  const mobileProcess = window.matchMedia('(max-width: 760px)');

  function updateProcessLine() {
    if (!processTrack || !processFill) return;
    const rect = processTrack.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height + vh * 0.35;
    const passed = (vh * 0.8) - rect.top;
    const p = Math.max(0, Math.min(1, passed / total));

    if (mobileProcess.matches) {
      processFill.style.height = (p * 100).toFixed(1) + '%';
      const fillY = rect.top + rect.height * p;
      processSteps.forEach(step => {
        const marker = step.querySelector('.process-marker');
        if (!marker) return;
        step.classList.toggle('lit', marker.getBoundingClientRect().top + 5 <= fillY);
      });
    } else {
      processFill.style.width = (p * 100).toFixed(1) + '%';
      processFill.style.height = '100%';
      const fillX = rect.left + rect.width * p;
      processSteps.forEach(step => {
        const marker = step.querySelector('.process-marker');
        if (!marker) return;
        step.classList.toggle('lit', marker.getBoundingClientRect().left + 5 <= fillX);
      });
    }
  }
  updateProcessLine();

  /* ── Spotlight hover (cards) ────────────────── */
  if (FINE) {
    document.querySelectorAll('[data-spotlight]').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--sx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--sy', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });

    /* ── 3D tilt on bento + founder cards ─────── */
    if (!REDUCED) {
      document.querySelectorAll('[data-tilt]').forEach(card => {
        const MAX = 5; // degrees
        card.addEventListener('mousemove', e => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = `perspective(900px) rotateX(${(-py * MAX).toFixed(2)}deg) rotateY(${(px * MAX).toFixed(2)}deg) translateZ(0)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
      });

      /* ── Subtle magnetic pull on primary CTAs ── */
      document.querySelectorAll('[data-magnetic]').forEach(btn => {
        const strength = 8;
        btn.addEventListener('mousemove', e => {
          const r = btn.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width - 0.5) * strength;
          const y = ((e.clientY - r.top) / r.height - 0.5) * strength;
          btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
      });
    }
  }

});

/* ════════════════════════════════════════════════
   WEBGL HERO — "gilded constellation"
   Lazy-loaded Three.js scene: a breathing particle
   sphere wrapped in wireframe geometry and orbital
   rings carrying comets. Never blocks first paint;
   pauses when off-screen or tab hidden; sheds
   resolution — then retires itself entirely — if
   frames ever run slow.
════════════════════════════════════════════════ */
function initHero3D() {
  const host = document.getElementById('hero3d');
  if (!host || REDUCED) return;
  if (window.innerWidth < 1025) return;                    // desktop only
  const LOW_END = (navigator.deviceMemory && navigator.deviceMemory <= 4)
               || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  if (LOW_END) return;

  let built = false;

  async function build() {
    if (built) return;
    built = true;
    let THREE;
    try {
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    } catch (err) { console.warn('3D hero skipped (Three.js failed to load):', err); return; }

    try {
      /* renderer / scene / camera */
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(pixelRatio);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.z = 8.5;
      host.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      /* soft-glow sprite texture (drawn once on a tiny canvas) */
      const glowTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 241, 214, 1)');
        grad.addColorStop(0.35, 'rgba(230, 207, 154, 0.55)');
        grad.addColorStop(1, 'rgba(201, 169, 98, 0)');
        g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })();

      /* particle shell — fibonacci sphere, per-point twinkle in shader */
      const COUNT = 1500;
      const pos = new Float32Array(COUNT * 3);
      const phase = new Float32Array(COUNT);
      const scl = new Float32Array(COUNT);
      const GA = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < COUNT; i++) {
        const y = 1 - (i / (COUNT - 1)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const th = GA * i;
        const R = 2.0 + (Math.random() - 0.5) * 0.06;
        pos[i * 3]     = Math.cos(th) * rad * R;
        pos[i * 3 + 1] = y * R;
        pos[i * 3 + 2] = Math.sin(th) * rad * R;
        phase[i] = Math.random() * Math.PI * 2;
        scl[i] = Math.random() * 0.7 + 0.5;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
      pGeo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
      const pMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uTex:  { value: glowTex },
          uSize: { value: 48 * pixelRatio },
        },
        vertexShader: `
          attribute float aPhase;
          attribute float aScale;
          uniform float uTime;
          uniform float uSize;
          varying float vTw;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vTw = 0.55 + 0.45 * sin(uTime * 1.3 + aPhase);
            gl_PointSize = uSize * aScale * (0.7 + 0.3 * vTw) / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uTex;
          varying float vTw;
          void main() {
            vec4 t = texture2D(uTex, gl_PointCoord);
            gl_FragColor = vec4(t.rgb, t.a * vTw * 0.85);
          }`,
      });
      group.add(new THREE.Points(pGeo, pMat));

      /* wireframe cage + inner core */
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.55, 1)),
        new THREE.LineBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.13 })
      );
      const core = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.85, 0)),
        new THREE.LineBasicMaterial({ color: 0xe6cf9a, transparent: true, opacity: 0.28 })
      );
      group.add(wire, core);

      /* tilted orbital rings, each carrying a comet */
      const ringMat = new THREE.LineBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.16 });
      function makeRing(radius, tiltX, tiltZ) {
        const pts = [];
        for (let i = 0; i <= 120; i++) {
          const a = (i / 120) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
        line.rotation.set(tiltX, 0, tiltZ);
        return line;
      }
      const ring1 = makeRing(2.45, Math.PI / 2.55, 0.42);
      const ring2 = makeRing(2.75, Math.PI / 2.15, -0.65);
      group.add(ring1, ring2);

      function makeComet(size) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: 0xe6cf9a, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        s.scale.setScalar(size);
        return s;
      }
      const comet1 = makeComet(0.30);
      const comet2 = makeComet(0.22);
      group.add(comet1, comet2);

      /* sizing */
      function resize() {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      let rsT = null;
      const onResize = () => { clearTimeout(rsT); rsT = setTimeout(resize, 150); };
      window.addEventListener('resize', onResize);

      /* mouse parallax (smoothed) */
      const target = { x: 0, y: 0 };
      const smooth = { x: 0, y: 0 };
      const onMouse = (e) => {
        target.x = e.clientX / window.innerWidth - 0.5;
        target.y = e.clientY / window.innerHeight - 0.5;
      };
      if (FINE) window.addEventListener('mousemove', onMouse, { passive: true });

      /* render loop — gated by viewport + tab visibility */
      let inView = true, raf = null, dead = false;
      const clock = new THREE.Clock();
      let baseY = 0, lastT = performance.now(), slow = 0;

      function destroy() {
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        if (FINE) window.removeEventListener('mousemove', onMouse);
        vis.disconnect();
        host.classList.remove('on');
        setTimeout(() => {
          renderer.dispose();
          pGeo.dispose(); pMat.dispose(); glowTex.dispose();
          host.innerHTML = '';
        }, 2100); /* after the CSS fade-out completes */
        console.warn('3D hero retired to protect frame rate.');
      }

      function tick() {
        if (dead) return;
        if (!inView || document.hidden) { raf = null; return; }

        /* frame-time watchdog: drop resolution first, retire second */
        const nowT = performance.now();
        const dt = nowT - lastT; lastT = nowT;
        if (dt > 34 && dt < 500) slow++;
        else if (slow > 0) slow--;
        if (slow > 55) {
          if (pixelRatio > 1) {
            pixelRatio = 1;
            renderer.setPixelRatio(1);
            pMat.uniforms.uSize.value = 48;
            slow = 0;
          } else { destroy(); return; }
        }

        const t = clock.getElapsedTime();
        pMat.uniforms.uTime.value = t;

        smooth.x += (target.x - smooth.x) * 0.035;
        smooth.y += (target.y - smooth.y) * 0.035;
        baseY += 0.0016;
        group.rotation.y = baseY + smooth.x * 0.45;
        group.rotation.x = smooth.y * 0.3;
        group.position.y = Math.sin(t * 0.4) * 0.09;
        group.scale.setScalar(1 + Math.sin(t * 0.5) * 0.02);

        wire.rotation.y -= 0.0022;
        wire.rotation.x += 0.0009;
        core.rotation.y += 0.0034;
        core.rotation.x -= 0.0018;

        const a1 = t * 0.42, a2 = -t * 0.3;
        comet1.position.set(Math.cos(a1) * 2.45, 0, Math.sin(a1) * 2.45).applyEuler(ring1.rotation);
        comet2.position.set(Math.cos(a2) * 2.75, 0, Math.sin(a2) * 2.75).applyEuler(ring2.rotation);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      }

      const vis = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        if (inView && !raf && !dead) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
      }, { threshold: 0.02 });
      vis.observe(host);

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && inView && !raf && !dead) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
      });

      raf = requestAnimationFrame(tick);
      requestAnimationFrame(() => host.classList.add('on'));
    } catch (err) {
      console.warn('3D hero failed — site continues without it:', err);
      host.innerHTML = '';
    }
  }

  /* wait for full page load, then an idle moment — never compete with first paint */
  const schedule = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(build, { timeout: 2500 });
    else setTimeout(build, 350);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}
try { initHero3D(); } catch (err) { console.warn('3D hero init failed:', err); }

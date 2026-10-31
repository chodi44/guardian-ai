/**
 * GUARDIAN AI — LANDING PAGE INTERACTIVE CONTROLLER
 * Kinetic Typography, Interactive Particle Canvas, Live ECG & Safety Simulation
 */

(function () {
  'use strict';

  // 1. KINETIC TYPOGRAPHY ENGINE (Typewriter + Word Cycling)
  const phrases = [
    'Predictive AI',
    'Biometric Telemetry',
    'Safe Corridors',
    'Instant SOS Mesh',
    'Guardian Protection',
    'Real-Time Geofencing'
  ];

  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typingSpeed = 90;

  function typeWriter() {
    const wordEl = document.getElementById('animated-typewriter-word');
    if (!wordEl) {
      setTimeout(typeWriter, 100);
      return;
    }

    const currentPhrase = phrases[phraseIndex];

    if (isDeleting) {
      wordEl.textContent = currentPhrase.substring(0, charIndex - 1);
      charIndex--;
      typingSpeed = 45;
    } else {
      wordEl.textContent = currentPhrase.substring(0, charIndex + 1);
      charIndex++;
      typingSpeed = 90;
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
      isDeleting = true;
      typingSpeed = 2200; // Hold full word
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      typingSpeed = 400; // Pause before typing next word
    }

    setTimeout(typeWriter, typingSpeed);
  }

  // 2. INTERACTIVE CYBER CONSTELLATION BACKGROUND CANVAS
  function initAmbientCanvas() {
    const canvas = document.getElementById('ambient-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let particles = [];
    const particleCount = Math.min(Math.floor((width * height) / 16000), 75);

    const mouse = { x: -1000, y: -1000, radius: 140 };

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener('mouseout', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = (Math.random() - 0.5) * 0.45;
        this.radius = Math.random() * 1.8 + 0.8;
        this.alpha = Math.random() * 0.5 + 0.2;
        this.color = Math.random() > 0.4 ? '#06b6d4' : (Math.random() > 0.5 ? '#10b981' : '#8b5cf6');
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;

        // Mouse gentle interaction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x -= (dx / dist) * force * 1.5;
          this.y -= (dy / dist) * force * 1.5;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Connect particles within distance
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = '#0284c7';
            ctx.globalAlpha = (1 - dist / 110) * 0.16;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      requestAnimationFrame(animate);
    }

    animate();
  }

  // 3. LIVE HUD ECG HEARTBEAT ANIMATION
  function initHudECG() {
    const canvas = document.getElementById('hud-ecg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.parentElement.clientWidth || 200;
    let height = canvas.height = 34;

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.parentElement.clientWidth || 200;
    });

    let x = 0;
    let bpmSpeed = 2;
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;

    function animateECG() {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.28)';
      ctx.fillRect(0, 0, width, height);

      ctx.beginPath();
      ctx.moveTo(x, height / 2);

      let nextY = height / 2;
      let step = (x % 50);
      if (step > 20 && step < 24) nextY = height / 2 - 12;
      else if (step >= 24 && step < 28) nextY = height / 2 + 14;
      else if (step >= 28 && step < 32) nextY = height / 2 - 6;

      ctx.lineTo(x + bpmSpeed, nextY);
      ctx.stroke();

      x = (x + bpmSpeed) % width;
      requestAnimationFrame(animateECG);
    }

    animateECG();
  }

  // 4. INTERACTIVE SAFETY STATE SIMULATOR (Normal ↔ SOS Alert)
  function initSafetySimulator() {
    const btnNormal = document.getElementById('sim-btn-normal');
    const btnSOS = document.getElementById('sim-btn-sos');
    const statusText = document.getElementById('sim-status-text');
    const scoreVal = document.getElementById('sim-score-val');
    const bpmVal = document.getElementById('sim-bpm-val');
    const threatBadge = document.getElementById('sim-threat-badge');
    const simPane = document.getElementById('sim-pane-display');

    if (!btnNormal || !btnSOS) return;

    btnNormal.addEventListener('click', () => {
      btnNormal.classList.add('active');
      btnSOS.classList.remove('active');

      if (statusText) statusText.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#059669;"></i> Safe Corridor Escort Active';
      if (scoreVal) scoreVal.textContent = '98/100';
      if (bpmVal) bpmVal.innerHTML = '74 <span style="font-size:12px;color:#64748b;">BPM</span>';
      if (threatBadge) {
        threatBadge.textContent = 'LOW RISK';
        threatBadge.className = 'lp-hud-badge';
        threatBadge.style.background = '#ecfdf5';
        threatBadge.style.color = '#059669';
        threatBadge.style.borderColor = '#a7f3d0';
      }
      if (simPane) {
        simPane.style.borderColor = '#a7f3d0';
        simPane.style.boxShadow = '0 10px 25px -5px rgba(5, 150, 105, 0.12)';
      }
    });

    btnSOS.addEventListener('click', () => {
      btnSOS.classList.add('active');
      btnNormal.classList.remove('active');

      if (statusText) statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#dc2626;"></i> CRITICAL SOS BEACON BROADCASTING';
      if (scoreVal) scoreVal.textContent = '14/100';
      if (bpmVal) bpmVal.innerHTML = '142 <span style="font-size:12px;color:#dc2626;">BPM (TACHYCARDIA)</span>';
      if (threatBadge) {
        threatBadge.textContent = 'IMMINENT THREAT';
        threatBadge.className = 'lp-hud-badge';
        threatBadge.style.background = '#fef2f2';
        threatBadge.style.color = '#dc2626';
        threatBadge.style.borderColor = '#fca5a5';
      }
      if (simPane) {
        simPane.style.borderColor = '#fca5a5';
        simPane.style.boxShadow = '0 10px 30px -5px rgba(220, 38, 38, 0.2)';
      }
    });
  }

  // 5. GET STARTED REDIRECT HANDLER (Seamless & Direct)
  function initGetStartedButtons() {
    document.querySelectorAll('.btn-get-started').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/login.html';
      });
    });
  }

  // 6. MOBILE NAVIGATION DRAWER CONTROLLER
  function initMobileDrawer() {
    const menuBtn = document.getElementById('lp-mobile-menu-btn');
    const drawer = document.getElementById('lp-mobile-drawer');
    const overlay = document.getElementById('lp-mobile-overlay');
    const closeBtn = document.getElementById('lp-drawer-close-btn');

    if (!menuBtn || !drawer || !overlay) return;

    function openDrawer() {
      drawer.classList.add('open');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawer();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }

    overlay.addEventListener('click', closeDrawer);

    // Close when clicking any nav link
    drawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeDrawer();
      }
    });
  }

  function initAll() {
    typeWriter();
    initAmbientCanvas();
    initHudECG();
    initSafetySimulator();
    initGetStartedButtons();
    initMobileDrawer();
  }

  // Safe DOM Content Loaded Execution
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

})();


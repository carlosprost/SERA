/** @module script - Interacciones y animaciones de la landing page de SERA */

/* ─── NAVBAR scroll effect ─────────────────────────────────────────────── */
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

/* ─── Hamburger menu ───────────────────────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');

hamburger?.addEventListener('click', () => {
  navLinks?.classList.toggle('open');
});

/** Cierra el menú al hacer click en un link */
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

/* ─── Intersection Observer — animaciones al hacer scroll ─────────────── */
const observerOptions = {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
};

/**
 * Activa la clase `.visible` en los elementos que tienen `[data-aos]`
 * o en `.feature-card` y `.step` cuando entran al viewport.
 * @param {IntersectionObserverEntry[]} entries
 */
const onIntersect = (entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); // se anima una sola vez
    }
  });
};

const observer = new IntersectionObserver(onIntersect, observerOptions);

// Observar feature cards
document.querySelectorAll('.feature-card').forEach((el, i) => {
  el.style.transitionDelay = `${i * 80}ms`;
  observer.observe(el);
});

// Observar steps
document.querySelectorAll('.step').forEach((el, i) => {
  el.style.transitionDelay = `${i * 120}ms`;
  observer.observe(el);
});

// Observar elementos con data-aos
document.querySelectorAll('[data-aos]').forEach(el => {
  observer.observe(el);
});

/* ─── Smooth active nav link highlight ────────────────────────────────── */
const sections = document.querySelectorAll('section[id]');

/**
 * Marca el link de navegación correspondiente a la sección visible.
 */
const highlightNav = () => {
  let current = '';
  sections.forEach(section => {
    const top = section.getBoundingClientRect().top;
    if (top <= 100) current = section.id;
  });

  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active-link');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active-link');
    }
  });
};

window.addEventListener('scroll', highlightNav, { passive: true });

/* ─── Animación de los números del hero al cargar ─────────────────────── */
/**
 * Anima contadores numéricos dentro de `.stat-value`.
 * Solo aplica si el valor es un número puro (ej: no "AES-256").
 */
document.querySelectorAll('.stat-value').forEach(el => {
  const text = el.textContent.trim();
  const num  = parseInt(text, 10);
  if (!isNaN(num) && text === String(num)) {
    let start = 0;
    const step = Math.ceil(num / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { el.textContent = num; clearInterval(timer); }
      else               el.textContent = start;
    }, 30);
  }
});

/* ─── Partículas decorativas sutiles en el hero ────────────────────────── */
/**
 * Crea puntos flotantes decorativos en el fondo del hero.
 */
function crearParticulas() {
  const bg = document.querySelector('.hero-bg');
  if (!bg) return;

  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      background: rgba(107, 23, 194, ${Math.random() * 0.4 + 0.1});
      border-radius: 50%;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      animation: floatGlow ${Math.random() * 6 + 4}s ease-in-out infinite;
      animation-delay: ${Math.random() * 4}s;
      pointer-events: none;
    `;
    bg.appendChild(dot);
  }
}

crearParticulas();

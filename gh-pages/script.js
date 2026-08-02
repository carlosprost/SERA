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

/* ─── Hero Tabs Switcher ─────────────────────────────────────────────────── */
const heroTabBtns = document.querySelectorAll('.hero-tab-btn');
const heroImages  = document.querySelectorAll('.hero-preview-img');

heroTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    heroTabBtns.forEach(b => b.classList.remove('active'));
    heroImages.forEach(img => img.classList.remove('active'));

    btn.classList.add('active');
    const targetImg = document.getElementById(targetId);
    if (targetImg) targetImg.classList.add('active');
  });
});

/* ─── Examples Panel Switcher ────────────────────────────────────────────── */
const exTabBtns = document.querySelectorAll('.ex-tab-btn');
const exPanels  = document.querySelectorAll('.example-panel');

exTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.getAttribute('data-panel');
    exTabBtns.forEach(b => b.classList.remove('active'));
    exPanels.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) targetPanel.classList.add('active');
  });
});

/* ─── Lightbox Modal Viewer ──────────────────────────────────────────────── */
const lightboxModal   = document.getElementById('lightbox-modal');
const lightboxImg     = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose   = document.getElementById('lightbox-close');
const lightboxBackdrop = document.querySelector('.lightbox-backdrop');

/**
 * Abre el modal de visualización en alta definición de la captura.
 * @param {string} src
 * @param {string} alt
 */
function openLightbox(src, alt) {
  if (!lightboxModal || !lightboxImg) return;
  lightboxImg.src = src;
  lightboxImg.alt = alt || 'Captura ampliada';
  if (lightboxCaption) lightboxCaption.textContent = alt || '';
  lightboxModal.classList.add('active');
  lightboxModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

/** Cierra el modal de lightbox y restaura el scroll */
function closeLightbox() {
  if (!lightboxModal) return;
  lightboxModal.classList.remove('active');
  lightboxModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.querySelectorAll('.lightbox-trigger').forEach(el => {
  el.addEventListener('click', () => {
    const src = el.getAttribute('src');
    const alt = el.getAttribute('alt') || el.getAttribute('title');
    if (src) openLightbox(src, alt);
  });
});

lightboxClose?.addEventListener('click', closeLightbox);
lightboxBackdrop?.addEventListener('click', closeLightbox);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightboxModal?.classList.contains('active')) {
    closeLightbox();
  }
});

/* ─── DOCS PAGE — Sidebar scroll spy & toggle mobile ──────────────────────── */

/**
 * Verifica si estamos en la página de documentación.
 * Si es así, inicializa el scroll spy del sidebar y el toggle mobile.
 */
if (document.body.classList.contains('docs-page')) {

  const sidebar       = document.getElementById('docs-sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarLinks  = document.querySelectorAll('.sidebar-link');
  const docsSections  = document.querySelectorAll('.docs-section');

  /**
   * Marca el link del sidebar correspondiente a la sección actualmente visible.
   * Usa el IntersectionObserver para detectar la sección más visible.
   */
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          sidebarLinks.forEach(link => {
            link.classList.toggle(
              'active',
              link.getAttribute('data-section') === id
            );
          });
        }
      });
    },
    { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
  );

  docsSections.forEach(section => sectionObserver.observe(section));

  /**
   * Al hacer clic en un link del sidebar, cierra el panel en mobile
   * y desplaza suavemente hasta la sección destino.
   */
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      sidebar?.classList.remove('open');
    });
  });

  /** Toggle del sidebar en mobile */
  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  /** Cierra el sidebar al hacer clic fuera de él en mobile */
  document.addEventListener('click', (e) => {
    if (
      sidebar?.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      e.target !== sidebarToggle
    ) {
      sidebar.classList.remove('open');
    }
  });
}

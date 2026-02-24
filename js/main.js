// InTown Homepage - Main JavaScript

(function () {
  'use strict';

  // --- Navbar scroll effect ---
  const navbar = document.getElementById('navbar');
  let lastScroll = 0;

  function handleScroll() {
    const currentScroll = window.scrollY;
    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  // --- Mobile nav toggle ---
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      navToggle.classList.toggle('open');
      navLinks.classList.toggle('open');
    });

    // Close mobile menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  // --- Scroll animations (Intersection Observer) ---
  var animatedElements = document.querySelectorAll('[data-animate]');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    animatedElements.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show everything immediately
    animatedElements.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  // --- Smooth scroll for anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var offset = navbar.offsetHeight + 20;
        var targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });

  // --- Interactive Phone Mock ---
  (function initInteractivePhone() {
    var phone = document.getElementById('interactivePhone');
    if (!phone) return;

    var slides = phone.querySelectorAll('.phone-slide');
    var dots = phone.querySelectorAll('.phone-dot');
    var prevBtn = document.getElementById('phonePrev');
    var nextBtn = document.getElementById('phoneNext');
    var currentIndex = 0;
    var total = slides.length;

    // Auto-advance interval (ms)
    var AUTO_ADVANCE_MS = 3200;
    var autoTimer = null;

    function goTo(index) {
      // Clamp index
      index = Math.max(0, Math.min(total - 1, index));
      if (index === currentIndex) return;

      slides[currentIndex].hidden = true;
      dots[currentIndex].classList.remove('active');

      currentIndex = index;

      slides[currentIndex].hidden = false;
      dots[currentIndex].classList.add('active');

      // Update button states
      if (prevBtn) prevBtn.disabled = currentIndex === 0;
      if (nextBtn) nextBtn.disabled = currentIndex === total - 1;
    }

    function advance() {
      var next = (currentIndex + 1) % total;
      goTo(next);
    }

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(advance, AUTO_ADVANCE_MS);
    }

    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function resetAuto() {
      startAuto();
    }

    // Init first slide visible
    slides.forEach(function (slide, i) {
      slide.hidden = i !== 0;
    });
    dots.forEach(function (dot, i) {
      dot.classList.toggle('active', i === 0);
    });
    if (prevBtn) prevBtn.disabled = true;

    // Button listeners
    if (prevBtn) {
      prevBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        goTo(currentIndex - 1);
        resetAuto();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        goTo(currentIndex + 1);
        resetAuto();
      });
    }

    // Dot listeners
    dots.forEach(function (dot) {
      dot.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(dot.getAttribute('data-index'), 10);
        goTo(idx);
        resetAuto();
      });
    });

    // Click on phone body to advance
    phone.addEventListener('click', function () {
      var next = (currentIndex + 1) % total;
      goTo(next);
      resetAuto();
    });

    // Touch swipe support
    var touchStartX = 0;
    phone.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    phone.addEventListener('touchend', function (e) {
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 30) {
        if (diff > 0) {
          goTo(currentIndex + 1);
        } else {
          goTo(currentIndex - 1);
        }
        resetAuto();
      }
    }, { passive: true });

    // Pause auto on hover/focus
    phone.addEventListener('mouseenter', stopAuto);
    phone.addEventListener('mouseleave', startAuto);
    phone.addEventListener('focusin', stopAuto);
    phone.addEventListener('focusout', startAuto);

    startAuto();
  })();

  // --- Use Cases Carousel ---
  (function initUseCasesCarousel() {
    var grid = document.querySelector('.use-cases-grid');
    if (!grid) return;

    var dots = document.querySelectorAll('.use-cases-dot');
    var total = dots.length;
    var currentIndex = 0;
    var AUTO_MS = 4000;
    var autoTimer = null;
    var isHovering = false;
    var scrollDebounce = null;

    function cardWidth() {
      var card = grid.querySelector('.use-case-card');
      return card ? card.offsetWidth : grid.clientWidth;
    }

    function goTo(index) {
      index = ((index % total) + total) % total;
      currentIndex = index;
      grid.scrollTo({ left: cardWidth() * index, behavior: 'smooth' });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('active', i === index);
      });
    }

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(function () {
        goTo(currentIndex + 1);
      }, AUTO_MS);
    }

    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    // Dot click handlers
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var idx = parseInt(dot.getAttribute('data-index'), 10);
        goTo(idx);
        startAuto();
      });
    });

    // Pause only while mouse is physically over the carousel
    grid.addEventListener('mouseenter', function () {
      isHovering = true;
      stopAuto();
    });
    grid.addEventListener('mouseleave', function () {
      isHovering = false;
      startAuto();
    });

    // Touch swipe
    var touchStartX = 0;
    grid.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      stopAuto();
    }, { passive: true });
    grid.addEventListener('touchend', function (e) {
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        goTo(diff > 0 ? currentIndex + 1 : currentIndex - 1);
      }
      startAuto();
    }, { passive: true });

    // Sync dots on scroll and restart auto after manual scrolling stops
    grid.addEventListener('scroll', function () {
      var idx = Math.round(grid.scrollLeft / cardWidth());
      if (idx !== currentIndex) {
        currentIndex = idx;
        dots.forEach(function (dot, i) {
          dot.classList.toggle('active', i === idx);
        });
      }
      if (!isHovering) {
        clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(startAuto, 600);
      }
    }, { passive: true });

    startAuto();
  })();

  // --- Show Figma use-case images if they loaded successfully ---
  document.querySelectorAll('.use-case-img').forEach(function (img) {
    img.addEventListener('load', function () {
      var wrap = img.closest('.use-case-img-wrap');
      if (wrap) wrap.style.display = 'block';
    });
    // Trigger load check for cached images
    if (img.complete && img.naturalWidth > 0) {
      var wrap = img.closest('.use-case-img-wrap');
      if (wrap) wrap.style.display = 'block';
    }
  });

})();

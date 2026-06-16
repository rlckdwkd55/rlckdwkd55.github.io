// ===== Translations =====
let translations = {};
let currentLang = localStorage.getItem('portfolio-lang') || 'ko';

// Load translations from JSON file
fetch('translations.json')
    .then(res => res.json())
    .then(data => {
        translations = data;
        setLanguage(currentLang);
    })
    .catch(err => console.error('Failed to load translations:', err));

// Helper to get nested object property by string path (e.g., "nav.home")
function getNestedTranslation(obj, path) {
    return path.split('.').reduce((prev, curr) => prev?.[curr], obj);
}

// Language setter function
function setLanguage(lang) {
    if (!translations[lang]) return;

    currentLang = lang;
    localStorage.setItem('portfolio-lang', lang);
    const html = document.documentElement;
    html.setAttribute('lang', lang === 'ko' ? 'ko' : 'en');

    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const text = getNestedTranslation(translations[lang], key);
        if (text) {
            el.textContent = text;
        }
    });
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const langToggle = document.getElementById('langToggle');
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    // ===== Dark Mode Toggle =====
    // Default: light. Apply dark only if explicitly saved.
    if (localStorage.getItem('portfolio-theme') === 'dark') {
        html.classList.add('dark');
    }

    themeToggle.addEventListener('click', () => {
        html.classList.toggle('dark');
        localStorage.setItem(
            'portfolio-theme',
            html.classList.contains('dark') ? 'dark' : 'light'
        );
    });

    // ===== Language Toggle =====
    langToggle.addEventListener('click', () => {
        setLanguage(currentLang === 'en' ? 'ko' : 'en');
    });

    // ===== Hamburger Menu =====
    hamburger.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });

    // ===== Smooth Scroll with Offset =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            // Skip non-section links (like href="#")
            if (href === '#' || href.length <= 1) return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const top = target.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // ===== Active Nav Link on Scroll =====
    const sections = document.querySelectorAll('section[id]');
    const scrollToTopBtn = document.getElementById('scrollToTop');
    const scrollProgress = document.getElementById('scrollProgress');

    const nav = document.querySelector('nav');

    // Combined scroll handler for better performance
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;

        // Scroll progress bar
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollProgress && totalHeight > 0) {
            scrollProgress.style.width = (scrollY / totalHeight * 100) + '%';
        }

        // Nav transparent → frosted on scroll
        nav.classList.toggle('scrolled', scrollY > 20);

        // Update active nav links
        sections.forEach(section => {
            const top = section.offsetTop - 100;
            const height = section.offsetHeight;
            const id = section.id;
            const link = document.querySelector(`.nav-link[href="#${id}"]`);
            if (link) {
                link.classList.toggle('active', scrollY > top && scrollY <= top + height);
            }
        });

        // Show/hide scroll to top button
        scrollToTopBtn.classList.toggle('show', scrollY > 500);
    });

    // ===== Dynamic Copyright Year =====
    document.getElementById('year').textContent = new Date().getFullYear();

    // ===== Scroll Animations (Intersection Observer) =====
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});

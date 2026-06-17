export function initNav() {
  const nav = document.querySelector('nav');
  const navMenu = document.getElementById('navMenu');
  const hamburger = document.getElementById('hamburger');
  const sections = document.querySelectorAll('section[id]');

  // 햄버거 메뉴
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

  // 스무스 스크롤 (오프셋 80px)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#' || href.length <= 1) return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
      }
    });
  });

  // 스크롤 시 nav 스타일 + 활성 링크 업데이트
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    nav.classList.toggle('scrolled', scrollY > 20);

    sections.forEach(section => {
      const link = document.querySelector(`.nav-link[href="#${section.id}"]`);
      if (link) {
        const top = section.offsetTop - 100;
        link.classList.toggle('active', scrollY > top && scrollY <= top + section.offsetHeight);
      }
    });
  });
}
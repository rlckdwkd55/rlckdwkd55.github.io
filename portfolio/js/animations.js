export function initAnimations() {
  const scrollProgress = document.getElementById('scrollProgress');
  const scrollToTopBtn = document.getElementById('scrollToTop');

  // 스크롤 진행 바 + 상단 이동 버튼
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (scrollProgress && totalHeight > 0) {
      scrollProgress.style.width = (scrollY / totalHeight * 100) + '%';
    }

    scrollToTopBtn.classList.toggle('show', scrollY > 500);
  });

  scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // fade-in 스크롤 애니메이션
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}
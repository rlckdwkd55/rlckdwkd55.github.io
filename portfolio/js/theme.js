export function initTheme() {
  if (localStorage.getItem('portfolio-theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }

  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('portfolio-theme', isDark ? 'dark' : 'light');
  });
}
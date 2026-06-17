let translations = {};
let currentLang = localStorage.getItem('portfolio-lang') || 'ko';

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('portfolio-lang', lang);

  document.documentElement.setAttribute('lang', lang === 'ko' ? 'ko' : 'en');

  document.querySelectorAll('.lang-option').forEach(el => {
    el.classList.toggle('active', el.dataset.lang === lang);
  });

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const text = getNestedValue(translations[lang], el.dataset.i18n);
    if (text) el.textContent = text;
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const html = getNestedValue(translations[lang], el.dataset.i18nHtml);
    if (html) el.innerHTML = html;
  });
}

export async function initI18n() {
  try {
    const res = await fetch('translations.json');
    translations = await res.json();
    setLanguage(currentLang);
  } catch (err) {
    console.error('translations.json 로드 실패:', err);
  }

  document.getElementById('langToggle').addEventListener('click', () => {
    setLanguage(currentLang === 'en' ? 'ko' : 'en');
  });
}
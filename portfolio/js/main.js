import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { initAnimations } from './animations.js';

initTheme();
initNav();
initAnimations();
document.getElementById('year').textContent = new Date().getFullYear();

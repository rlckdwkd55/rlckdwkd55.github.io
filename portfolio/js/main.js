import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { initAnimations } from './animations.js';
import { renderProjects } from './render/projects.js';
import { renderSkills } from './render/skills.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderProjects();
  renderSkills();
  initNav();
  initAnimations();
  document.getElementById('year').textContent = new Date().getFullYear();
});
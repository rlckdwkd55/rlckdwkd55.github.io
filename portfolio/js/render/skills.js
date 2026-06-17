import { SKILLS } from '../data/skills.js';

export function renderSkills() {
  const grid = document.getElementById('skills-grid');
  if (!grid) return;
  grid.innerHTML = SKILLS.map(renderCell).join('');
}

function renderCell(skill) {
  return `<div class="skill-card fade-in">
    <div class="skill-icon-wrap"><i class="fas ${skill.icon} text-sm" style="color:${skill.iconColor}"></i></div>
    <h3 class="font-semibold mb-4" style="color:var(--text-primary)">${skill.title}</h3>
    <div class="flex flex-wrap gap-2">${skill.items.map(item => `<span class="skill-tag">${item}</span>`).join('')}</div>
  </div>`;
}

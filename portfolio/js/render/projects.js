import { PROJECTS } from '../data/projects.js';

export function renderProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  grid.innerHTML = PROJECTS.map(renderCard).join('');
}

function renderCard(project) {
  return `
    <div class="project-card fade-in">
      <div class="project-card-header">
        <div class="project-card-header-icon">
          <i class="fas ${project.icon}"></i>
        </div>
        <h3 class="project-card-title">${project.title}</h3>
      </div>
      <div class="project-card-body">
        <div class="flex justify-between items-center mb-1">
          <p class="text-xs font-semibold flex-1" style="color:var(--text-primary)">${project.category}</p>
          ${renderPeriodBadge(project)}
        </div>
        <p class="text-sm leading-relaxed mb-4 mt-3 flex-grow" style="color:var(--text-secondary)">${project.description}</p>
        <div class="flex flex-wrap gap-1.5 mb-4">
          ${project.tech.map(t => `<span class="tech-badge">${t}</span>`).join('')}
        </div>
        <div class="result-box mb-4">
          <i class="fas ${project.resultIcon} mr-1.5" style="color:var(--violet-mid)"></i>
          <strong style="color:var(--text-primary)">결과:</strong>
          <span> ${project.result}</span>
        </div>
        <div class="flex items-center justify-between mt-auto">
          <div class="flex items-center gap-3">
            ${project.links.filter(l => ['private','github'].includes(l.type)).map(renderLink).join('')}
          </div>
          <div class="flex items-center gap-3">
            ${project.links.filter(l => ['media','site'].includes(l.type)).map(renderLink).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPeriodBadge(project) {
  return `<span class="period-badge ml-2">${project.period}</span>`;
}

function renderLink(link) {
  switch (link.type) {
    case 'private':
      return `<span class="project-link-disabled"><i class="fas fa-lock"></i> 코드 비공개</span>`;
    case 'media':
      return `<a href="${link.href}" class="project-link"><i class="fas fa-file-image"></i> 시각자료</a>`;
    case 'site':
      return `<a href="${link.href}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> 사이트 보기</a>`;
    case 'github':
      return `<a href="${link.href}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> 코드 보기</a>`;
    default:
      return '';
  }
}
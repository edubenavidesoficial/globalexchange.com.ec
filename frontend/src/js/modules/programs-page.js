import i18next from '../../languages/i18n.js';

export function initProgramsPage() {
    const page = document.querySelector('.programs-page');
    if (!page) return;
    const buttons = [...page.querySelectorAll('[data-program-filter]')];
    const cards = [...page.querySelectorAll('[data-program-family]')];
    const count = page.querySelector('[data-program-count]');
    const updateCount = () => {
        count.textContent = i18next.t('programsPage.count', { count: cards.filter(card => !card.hidden).length });
    };
    buttons.forEach(button => button.addEventListener('click', () => {
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        cards.forEach(card => {
            card.hidden = button.dataset.programFilter !== 'all' && card.dataset.programFamily !== button.dataset.programFilter;
            card.classList.remove('is-entering');
            if (!card.hidden) requestAnimationFrame(() => card.classList.add('is-entering'));
        });
        updateCount();
    }));
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-entering');
            observer.unobserve(entry.target);
        }), { threshold: .08 });
        cards.forEach(card => observer.observe(card));
    }
    i18next.on('languageChanged', updateCount);
    updateCount();
}

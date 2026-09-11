export function initProgramDetail() {
    const page = document.querySelector('.program-detail-page');
    if (!page || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Content remains visible without JavaScript; animate only as blocks enter view.
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('detail-revealed');
            observer.unobserve(entry.target);
        });
    }, { threshold: .06 });
    page.querySelectorAll('.program-detail-content>section>div,.university-access-country,.professional-internships-details__row,.program-detail-cta').forEach(element => observer.observe(element));
}

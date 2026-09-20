// Progressive enhancement: content remains visible without JavaScript or motion.
export function initFooter() {
    const footer = document.querySelector('.footer');
    if (!footer || footer.dataset.footerReady) return;
    footer.dataset.footerReady = 'true';

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.remove('footer-reveal-pending');
            observer.unobserve(entry.target);
        }
    }, { threshold: 0.08 });

    footer.querySelectorAll('[data-footer-reveal]').forEach(element => {
        element.classList.add('footer-reveal-pending');
        observer.observe(element);
    });

    // Keyboard navigation must never land on concealed content.
    footer.addEventListener('focusin', event => {
        const group = event.target.closest('[data-footer-reveal]');
        if (group) {
            group.classList.remove('footer-reveal-pending');
            observer.unobserve(group);
        }
    });
    motion.addEventListener('change', () => {
        if (!motion.matches) return;
        observer.disconnect();
        footer.querySelectorAll('.footer-reveal-pending').forEach(element => {
            element.classList.remove('footer-reveal-pending');
        });
    });
}

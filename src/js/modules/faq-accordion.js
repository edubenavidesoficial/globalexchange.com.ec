// ====================================================
// FAQ ACCORDION
// Interacción de preguntas frecuentes
// ====================================================

export function initFaqAccordion() {
    const faqItems = document.querySelectorAll(
        '.faq-questions__item'
    );

    if (!faqItems.length) {
        return;
    }

    faqItems.forEach((item) => {
        const button = item.querySelector(
            '.faq-questions__question'
        );

        if (!button) {
            return;
        }

        button.addEventListener('click', () => {
            const willOpen = !item.classList.contains(
                'is-open'
            );

            faqItems.forEach((currentItem) => {
                currentItem.classList.remove('is-open');

                const currentButton = currentItem.querySelector(
                    '.faq-questions__question'
                );

                currentButton?.setAttribute(
                    'aria-expanded',
                    'false'
                );
            });

            if (willOpen) {
                item.classList.add('is-open');

                button.setAttribute(
                    'aria-expanded',
                    'true'
                );
            }
        });
    });
}
// ====================================================
// FOREIGN COURSES TABS
// Pestañas de la página de cursos en el extranjero
// ====================================================

export function initForeignCoursesTabs() {
    const tabContainers = document.querySelectorAll(
        '.foreign-courses-tabs'
    );

    if (!tabContainers.length) {
        return;
    }

    tabContainers.forEach((container) => {
        const buttons = Array.from(
            container.querySelectorAll(
                '[data-foreign-tab]'
            )
        );

        const panels = Array.from(
            container.querySelectorAll(
                '[data-foreign-panel]'
            )
        );

        function activateTab(selectedButton) {
            const selectedTab =
                selectedButton.dataset.foreignTab;

            buttons.forEach((button) => {
                const isSelected =
                    button === selectedButton;

                button.classList.toggle(
                    'is-active',
                    isSelected
                );

                button.setAttribute(
                    'aria-selected',
                    String(isSelected)
                );

                button.tabIndex =
                    isSelected ? 0 : -1;
            });

            panels.forEach((panel) => {
                const isSelected =
                    panel.dataset.foreignPanel ===
                    selectedTab;

                panel.classList.toggle(
                    'is-active',
                    isSelected
                );

                panel.hidden = !isSelected;
            });
        }

        buttons.forEach((button, index) => {
            button.addEventListener('click', () => {
                activateTab(button);
            });

            button.addEventListener(
                'keydown',
                (event) => {
                    if (
                        event.key !== 'ArrowRight' &&
                        event.key !== 'ArrowLeft' &&
                        event.key !== 'Home' &&
                        event.key !== 'End'
                    ) {
                        return;
                    }

                    event.preventDefault();

                    let nextIndex = index;

                    if (event.key === 'ArrowRight') {
                        nextIndex =
                            (index + 1) %
                            buttons.length;
                    }

                    if (event.key === 'ArrowLeft') {
                        nextIndex =
                            (index - 1 +
                                buttons.length) %
                            buttons.length;
                    }

                    if (event.key === 'Home') {
                        nextIndex = 0;
                    }

                    if (event.key === 'End') {
                        nextIndex =
                            buttons.length - 1;
                    }

                    const nextButton =
                        buttons[nextIndex];

                    activateTab(nextButton);
                    nextButton.focus();
                }
            );
        });
    });
}
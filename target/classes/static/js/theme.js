(function () {
    const toggle = document.getElementById('theme-toggle');
    const root = document.documentElement;
    const currentTheme = localStorage.getItem('theme') || 'dark';

    // Initial load
    if (currentTheme === 'light') {
        root.setAttribute('data-theme', 'light');
        if (toggle) toggle.innerHTML = '<i class="bi bi-moon-stars"></i>';
    } else {
        root.removeAttribute('data-theme');
        if (toggle) toggle.innerHTML = '<i class="bi bi-sun"></i>';
    }

    if (toggle) {
        toggle.addEventListener('click', () => {
            let theme = root.getAttribute('data-theme');
            if (theme === 'light') {
                root.removeAttribute('data-theme');
                localStorage.setItem('theme', 'dark');
                toggle.innerHTML = '<i class="bi bi-sun"></i>';
            } else {
                root.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                toggle.innerHTML = '<i class="bi bi-moon-stars"></i>';
            }
        });
    }
})();

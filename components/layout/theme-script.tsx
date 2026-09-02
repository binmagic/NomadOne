export function ThemeScript() {
  const script = `
    (function () {
      try {
        var key = 'nomadone-theme';
        var legacyKey = 'banana-mall-theme';
        var stored = localStorage.getItem(key) || localStorage.getItem(legacyKey);
        var theme = stored === 'dark' || stored === 'light'
          ? stored
          : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        var root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.dataset.theme = theme;
      } catch (error) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
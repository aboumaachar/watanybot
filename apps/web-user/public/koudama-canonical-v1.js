(function () {
  function updateCanonical() {
    var path = globalThis.location.pathname || '/';
    if (path.length > 1) path = path.replace(/\/+$/, '');
    if (path === '/home' || path === '/mcp') path = '/';
    var canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://koudama.com' + path);
  }

  updateCanonical();

  try {
    var pushState = history.pushState;
    var replaceState = history.replaceState;
    history.pushState = function () {
      var result = pushState.apply(this, arguments);
      updateCanonical();
      return result;
    };
    history.replaceState = function () {
      var result = replaceState.apply(this, arguments);
      updateCanonical();
      return result;
    };
    globalThis.addEventListener('popstate', updateCanonical);
  } catch {}
})();

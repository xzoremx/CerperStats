// Lucide-only icon renderer
(function(){
  function sanitizeName(raw) {
    const s = String(raw || '').toLowerCase().trim();
    return s.replace(/[^a-z0-9\-]/g, '');
  }

  async function attachIcon(el, rawIcon) {
    try {
      const raw = (rawIcon || '').trim();
      let name = 'bar-chart-2';
      if (raw.startsWith('lucide:')) {
        name = sanitizeName(raw.slice('lucide:'.length));
      } else if (/^[a-z0-9\-]+$/i.test(raw)) {
        // allow plain names for compatibility
        name = sanitizeName(raw);
      }
      if (!name) name = 'bar-chart-2';
      el.innerHTML = `<i data-lucide="${name}"></i>`;
      return true;
    } catch (e) {
      console.warn('[IconSafety] attachIcon error:', e);
      return false;
    }
  }

  window.IconSafety = { attachIcon };
})();


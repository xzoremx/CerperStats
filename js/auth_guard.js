(async () => {
  try {
    if (!window.cerper || typeof window.cerper.getCurrentUser !== 'function') return;
    const res = await window.cerper.getCurrentUser();
    if (!res || !res.ok || !res.user) {
      // Use Electron navigation when available
      if (window.cerper && typeof window.cerper.openPage === 'function') {
        await window.cerper.openPage('login.html');
      } else {
        window.location.href = 'login.html';
      }
    }
  } catch (err) {
    // Fail closed: if check fails, prefer redirect to login
    try {
      if (window.cerper && typeof window.cerper.openPage === 'function') {
        await window.cerper.openPage('login.html');
      } else {
        window.location.href = 'login.html';
      }
    } catch (_) {}
  }
})();


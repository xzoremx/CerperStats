// js/procedure_select.js

document.addEventListener("DOMContentLoaded", () => {
  // --- Recuperar laboratorio y usuario ---
  const labKey = sessionStorage.getItem("labSeleccionado") || localStorage.getItem("labSeleccionado");
  const defaultLab = (sessionStorage.getItem("default_lab") || "").trim();
  const labName = sessionStorage.getItem("labNombreVisible") || labKey || "Laboratorio";
  const rol = (sessionStorage.getItem("rol") || "").toLowerCase().trim();
  const usuario = sessionStorage.getItem("usuario");

  const labTitle = document.getElementById("lab-title");
  const labInfo = document.getElementById("lab-info");

  // --- Mostrar información del laboratorio ---
  try { if (labKey) {
    labTitle.textContent = labName;
    labInfo.textContent = `Seleccione el procedimiento para esta sesión.`;
  } else {
    labTitle.textContent = "Procedimientos";
    labInfo.textContent = "Seleccione el procedimiento correspondiente al laboratorio.";
  } } catch (e) {}

  // --- Volver al menú ---
  const backBtn = document.getElementById("go-menu");
  backBtn?.addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("menu.html");
    else window.location.href = "menu.html";
  });

  // --- Botón Sesiones (solo admin/supervisor) ---
  const sessionsBtn = document.getElementById("go-sessions");
  if (sessionsBtn) {
    // Admin: siempre. Supervisor: solo si el lab actual coincide con su default_lab
    const allowed = (rol === "admin") || (rol === "supervisor" && labKey && defaultLab && labKey === defaultLab);
    if (!allowed) {
      sessionsBtn.hidden = true;
      sessionsBtn.style.display = "none";
    } else {
      sessionsBtn.hidden = false;
      sessionsBtn.style.display = "";
    }
    sessionsBtn.addEventListener("click", () => {
      if (!usuario) {
        if (window.cerper?.openPage) window.cerper.openPage("login.html");
        else window.location.href = "login.html";
        return;
      }
      if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
      else window.location.href = "sessions_panel.html";
    });
  }

  // --- Selección de procedimiento ---
  document.querySelectorAll(".card").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const proc = btn.dataset.proc;
      sessionStorage.setItem("procedimientoSeleccionado", proc);

      if (window.cerper?.openPage) await window.cerper.openPage("input_data/preinfo.html");
      else window.location.href = "input_data/preinfo.html";
    });
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = sessionStorage.getItem("usuario");
  const rol = sessionStorage.getItem("rol");
  const labDefault = sessionStorage.getItem("labSeleccionado");

  if (!usuario) {
    if (window.cerper?.openPage) window.cerper.openPage("login.html");
    else window.location.href = "login.html";
    return;
  }

  if (rol === "analista") {
    notify("No tienes acceso a esta página.", "error");
    setTimeout(() => {
      if (window.cerper?.openPage) window.cerper.openPage("menu.html");
      else window.location.href = "menu.html";
    }, 1200);
    return;
  }

  try {
    // Admin: ver todas (no filtra).
    // Supervisor: filtra por su default_lab (no por la selección del menú).
    const defaultLab = sessionStorage.getItem("default_lab") || null;
    const labParam = (rol === "supervisor") ? defaultLab : null;
    const res = await window.cerper.getSessionsByRole({ rol, labDefault: labParam });
    if (!res.ok) throw new Error(res.error);
    renderSesiones(res.data);
  } catch (err) {
    console.error("[SessionsPanel] Error:", err);
    notify("Error al cargar las sesiones.", "error");
  }

  document.getElementById("btn-volver")?.addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("procedure_select.html");
    else window.location.href = "procedure_select.html";
  });
});

function renderSesiones(sesiones) {
  const contenedor = document.getElementById("sessions-container");
  contenedor.innerHTML = "";

  if (!sesiones || !sesiones.length) {
    contenedor.innerHTML = "<p>No se encontraron sesiones.</p>";
    return;
  }

  sesiones.forEach(s => {
    const card = document.createElement("article");
    card.className = "session-card";
    const labName = s.lab_nombre || s.lab_key || '';
    card.innerHTML = `
      <h3>${labName} | ${s.producto || "Sin producto"}</h3>
      <p><b>ID:</b> ${s.id}</p>
      <p><b>Estado:</b> ${s.estado}</p>
      <p><b>Método:</b> ${s.metodo || "-"}</p>
      <p><b>Creado:</b> ${s.creado_en}</p>
      <p><b>Analista:</b> ${s.usuario || "-"}</p>
    `;
    card.addEventListener("click", () => {
      sessionStorage.setItem("sessionSeleccionada", s.id);
      if (window.cerper?.openPage) window.cerper.openPage("session_detail.html");
      else window.location.href = "session_detail.html";
    });
    contenedor.appendChild(card);
  });
}

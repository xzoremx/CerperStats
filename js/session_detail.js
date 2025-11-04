document.addEventListener("DOMContentLoaded", async () => {
  const sessionId = sessionStorage.getItem("sessionSeleccionada");
  if (!sessionId) {
    notify("No hay sesión seleccionada.", "error");
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
    return;
  }

  try {
    const res = await window.cerper.getSessionInfo(sessionId);
    if (!res.ok) throw new Error(res.error);

    const info = res.data;
    document.getElementById("session-info").innerHTML = `
      <b>ID:</b> ${info.id} <br>
      <b>Laboratorio:</b> ${info.lab_key} <br>
      <b>Método:</b> ${info.metodo || "-"} <br>
      <b>Producto:</b> ${info.producto || "-"} <br>
      <b>Estado:</b> ${info.estado} <br>
      <b>Creado:</b> ${info.creado_en}
    `;

    // Navegación según tipo de análisis
    const tipo = (info.tipo_analisis || "mono").toLowerCase();
    const inputsTarget = (tipo === "multi" || tipo === "multianalito")
      ? "inputs_multianalito.html"
      : "inputs_monoanalito.html";

    document.getElementById("btn-inputs")?.addEventListener("click", () => {
      if (window.cerper?.openPage) window.cerper.openPage(inputsTarget);
      else window.location.href = inputsTarget;
    });

    document.getElementById("btn-results")?.addEventListener("click", () => {
      const target = "results_general.html";
      if (window.cerper?.openPage) window.cerper.openPage(target);
      else window.location.href = target;
    });

    document.getElementById("btn-report")?.addEventListener("click", () => {
      const target = "reports.html";
      if (window.cerper?.openPage) window.cerper.openPage(target);
      else window.location.href = target;
    });
  } catch (err) {
    console.error("[SessionDetail] Error:", err);
    notify("Error al cargar detalles.", "error");
  }

  document.getElementById("btn-volver")?.addEventListener("click", () => {
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
  });
});


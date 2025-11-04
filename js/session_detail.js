document.addEventListener("DOMContentLoaded", async () => {
  const sessionId = sessionStorage.getItem("sessionSeleccionada");
  if (!sessionId) {
    notify("No hay sesion seleccionada.", "error");
    if (window.cerper?.openPage) window.cerper.openPage("sessions_panel.html");
    else window.location.href = "sessions_panel.html";
    return;
  }

  try {
    const res = await window.cerper.getSessionInfo(sessionId);
    if (!res.ok) throw new Error(res.error);

    const info = res.data;
    const labName = info.lab_nombre || info.lab_key || '';
    const modoLine = (info.modo_cualitativo && String(info.modo_cualitativo).toLowerCase() !== 'null')
      ? `<br><b>Modo cualitativo:</b> ${info.modo_cualitativo}`
      : '';

    document.getElementById("session-info").innerHTML = `
      <b>ID:</b> ${info.id} <br>
      <b>${labName}</b> <br>
      <b>Metodo:</b> ${info.metodo || "-"} <br>
      <b>Producto:</b> ${info.producto || "-"} <br>
      <b>Ensayo:</b> ${info.ensayo || "-"} <br>
      <b>Expediente:</b> ${info.expediente || "-"} <br>
      <b>Unidad de medida:</b> ${info.unidad || "-"} <br>
      <b>Estructura de analisis:</b> ${info.tipo_analisis || "-"} <br>
      <b>Tipo de dato:</b> ${info.tipo_dato || "-"}${modoLine}
      <br><b>Parametro:</b> ${info.parametro || "-"} <br>
      <b>Estado:</b> ${info.estado} <br>
      <b>Creado:</b> ${info.creado_en}
    `;

    // Navegacion segun tipo de analisis
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


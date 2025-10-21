// --- Botón Volver ---
  document.getElementById("go-back").addEventListener("click", () => {
    if (window.cerper && window.cerper.openPage) {
      window.cerper.openPage("input_data/step_5_sheet.html");
    } else {
      window.location.href = "step_5_sheet.html";
    }
  });
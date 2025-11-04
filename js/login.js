document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const btnLogin = document.getElementById("btn-login");
  const msg = document.getElementById("msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnLogin.disabled = true;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      msg.textContent = "Completa todos los campos.";
      msg.style.color = "#ff8080";
      btnLogin.disabled = false;
      return;
    }

    try {
      const res = await window.cerper.login(username, password);

      if (!res.ok) {
        msg.textContent = res.error || "Credenciales incorrectas.";
        msg.style.color = "#ff8080";
        btnLogin.disabled = false;
        return;
      }

      const user = res.user;

      // Guardar datos del usuario en la sesión
      sessionStorage.setItem("usuario", user.username);
      sessionStorage.setItem("usuario_id", user.id);
      sessionStorage.setItem("rol", user.rol || "analista");
      sessionStorage.setItem("labSeleccionado", user.default_lab || "");
      sessionStorage.setItem("default_lab", user.default_lab || "");

      // Resolver y guardar el nombre visible del laboratorio a partir del lab_key (default_lab)
      try {
        if (user.default_lab) {
          const labRes = await window.cerper.getLabByKey(user.default_lab);
          if (labRes?.ok && labRes.data?.nombre) {
            sessionStorage.setItem("labNombreVisible", labRes.data.nombre);
            // Opcional: persistir también en localStorage para flujos que usan su fallback
            localStorage.setItem("labSeleccionado", user.default_lab);
            localStorage.setItem("labNombreVisible", labRes.data.nombre);
          }
        }
      } catch (_) {
        // Ignorar: si falla, procedure_select usará el lab_key como fallback
      }

      msg.textContent = `Bienvenido, ${user.nombre_completo || user.username}`;
      msg.style.color = "#00ffb3";

      setTimeout(() => {
        window.cerper.openPage("procedure_select.html");
      }, 1000);

    } catch (err) {
      console.error("[Login] Error:", err);
      msg.textContent = "Error de conexión.";
      msg.style.color = "#ff8080";
    } finally {
      btnLogin.disabled = false;
    }
  });
});


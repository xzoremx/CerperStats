const DEFAULT_LAB_COLOR = "#22d3ee";
const DEFAULT_LAB_ICON = "flask-conical";

const sanitizeIcon = raw => {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return DEFAULT_LAB_ICON;
  const normalized = value.startsWith("lucide:") ? value.slice(7) : value;
  const safe = normalized.replace(/[^a-z0-9-]/g, "");
  return safe || DEFAULT_LAB_ICON;
};

const normalizeColor = raw => {
  const value = String(raw || "").trim();
  return value || DEFAULT_LAB_COLOR;
};

// Clave para almacenar el usuario recordado (solo username, nunca contraseña)
const REMEMBERED_USER_KEY = "cerper_remembered_user";

// Sanitiza el username para almacenamiento seguro
const sanitizeUsername = (username) => {
  if (!username || typeof username !== "string") return "";
  // Limitar longitud y eliminar caracteres potencialmente peligrosos
  return username.trim().slice(0, 100).replace(/[<>"'&]/g, "");
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const btnLogin = document.getElementById("btn-login");
  const msg = document.getElementById("msg");
  const usernameInput = document.getElementById("username");
  const rememberCheckbox = document.getElementById("remember");

  // Cargar usuario recordado al iniciar
  try {
    const rememberedUser = localStorage.getItem(REMEMBERED_USER_KEY);
    if (rememberedUser) {
      const sanitized = sanitizeUsername(rememberedUser);
      if (sanitized) {
        usernameInput.value = sanitized;
        rememberCheckbox.checked = true;
        // Activar el label flotante si hay valor
        usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  } catch (_) {
    // Ignorar errores de localStorage (modo privado, etc.)
  }

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

      // Gestionar "recordar usuario" de forma segura (solo username)
      try {
        if (rememberCheckbox.checked) {
          const safeUsername = sanitizeUsername(username);
          if (safeUsername) {
            localStorage.setItem(REMEMBERED_USER_KEY, safeUsername);
          }
        } else {
          localStorage.removeItem(REMEMBERED_USER_KEY);
        }
      } catch (_) {
        // Ignorar errores de localStorage
      }

      // Guardar datos del usuario en la sesión
      sessionStorage.setItem("usuario", user.username);
      sessionStorage.setItem("usuario_id", user.id);
      sessionStorage.setItem("rol", user.rol || "analista");
      sessionStorage.setItem("labSeleccionado", user.default_lab || "");
      sessionStorage.setItem("default_lab", user.default_lab || "");

      // Lista opcional de laboratorios asignados (máx 2). Mantener default_lab como el primer valor.
      try {
        const labsList = Array.isArray(user.default_labs)
          ? user.default_labs
          : user.default_lab
            ? [user.default_lab]
            : [];
        sessionStorage.setItem("default_labs", JSON.stringify(labsList));
      } catch (_) {
        // ignore
      }

      // Resolver y guardar metadata del laboratorio a partir del lab_key (default_lab)
      try {
        if (user.default_lab) {
          const labRes = await window.cerper.getLabByKey(user.default_lab);
          if (labRes?.ok && labRes.data) {
            const lab = labRes.data;
            const nombreVisible =
              (lab.nombre || user.default_lab || "").trim() ||
              user.default_lab ||
              "Laboratorio";
            const labColor = normalizeColor(lab.color);
            const labIcon = sanitizeIcon(lab.icon_lucide || lab.icono || lab.icon);

            sessionStorage.setItem("labNombreVisible", nombreVisible);
            sessionStorage.setItem("labColor", labColor);
            sessionStorage.setItem("labIcon", labIcon);

            // Persistir en localStorage para permitir refresh/fallbacks
            localStorage.setItem("labSeleccionado", user.default_lab);
            localStorage.setItem("labNombreVisible", nombreVisible);
            localStorage.setItem("labColor", labColor);
            localStorage.setItem("labIcon", labIcon);
          }
        }
      } catch (_) {
        // Ignorar: si falla, procedure_select usará el lab_key como fallback
      }

      msg.textContent = `Bienvenido, ${user.nombre_completo || user.username}`;
      msg.style.color = "#00ffb3";

      window.cerper.openPage("procedure_select.html");

    } catch (err) {
      console.error("[Login] Error:", err);
      msg.textContent = "Error de conexión.";
      msg.style.color = "#ff8080";
    } finally {
      btnLogin.disabled = false;
    }
  });
});


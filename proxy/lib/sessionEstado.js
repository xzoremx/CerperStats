const CANONICAL_SESSION_STATES = Object.freeze([
  "activo",
  "cancelada",
  "suficiente",
  "finalizada",
]);

function normalizeSessionEstado(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  // Activo (aliases)
  if (raw === "activa" || raw === "activo" || raw === "abierta" || raw === "abierto") {
    return "activo";
  }

  // Cancelada (aliases)
  if (raw === "cancelada" || raw === "cancelado" || raw === "cerrada" || raw === "cerrado") {
    return "cancelada";
  }

  // Finalizada (aliases)
  if (
    raw === "finalizada" ||
    raw === "finalizado" ||
    raw === "completada" ||
    raw === "completado"
  ) {
    return "finalizada";
  }

  if (raw === "suficiente") return "suficiente";

  return raw;
}

function isCanonicalSessionEstado(value) {
  return CANONICAL_SESSION_STATES.includes(value);
}

module.exports = {
  CANONICAL_SESSION_STATES,
  normalizeSessionEstado,
  isCanonicalSessionEstado,
};


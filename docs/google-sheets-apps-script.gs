/**
 * Recibe los leads del bot y los agrega como filas en una Google Sheet.
 *
 * Instalación:
 * 1. Creá una Google Sheet (ej. "Leads Senda") y abrí Extensiones → Apps Script.
 * 2. Pegá este código, cambiá SECRET por el mismo valor que pusiste en LEAD_WEBHOOK_SECRET.
 * 3. Implementar → Nueva implementación → Tipo: Aplicación web.
 *    Ejecutar como: "Yo". Quién tiene acceso: "Cualquier usuario".
 * 4. Copiá la URL que termina en /exec y ponela en LEAD_WEBHOOK_URL del archivo .env.
 *
 * Opcional: completá NOTIFY_EMAILS para que llegue un mail al equipo con cada lead nuevo.
 */
const SECRET = "cambia-esto";
const NOTIFY_EMAILS = ""; // ej: "ventas@senda.com, direccion@senda.com"

const HEADERS = [
  "Fecha", "Evento", "Lead ID", "Nombre", "Email", "Teléfono", "Empresa", "Rubro",
  "Servicios", "Necesidad", "Presupuesto", "Urgencia", "Canal preferido",
  "Calificación", "Notas", "Página", "Sesión", "Transcripción",
];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (SECRET && body.secret !== SECRET) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" }));
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

  const l = body.lead;
  const row = [
    new Date(l.actualizadoEn), body.evento, l.id, l.nombre, l.email || "", l.telefono || "",
    l.empresa || "", l.rubro || "", (l.servicios_interes || []).join(", "), l.necesidad,
    l.presupuesto || "", l.urgencia, l.canal_preferido, l.calificacion, l.notas || "",
    l.paginaOrigen || "", l.sessionId, (body.transcripcion || "").slice(0, 45000),
  ];

  // Si el lead ya existe (actualización), se reemplaza su fila en lugar de duplicarla.
  const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues() : [];
  const idx = ids.findIndex(function (r) { return r[0] === l.id; });
  if (idx >= 0) sheet.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  if (NOTIFY_EMAILS && body.evento === "lead.nuevo") {
    MailApp.sendEmail({
      to: NOTIFY_EMAILS,
      subject: "Nuevo lead (" + l.calificacion + "): " + l.nombre + (l.empresa ? " · " + l.empresa : ""),
      body:
        "Nombre: " + l.nombre + "\nEmail: " + (l.email || "-") + "\nTeléfono: " + (l.telefono || "-") +
        "\nEmpresa: " + (l.empresa || "-") + "\nServicios: " + (l.servicios_interes || []).join(", ") +
        "\nUrgencia: " + l.urgencia + "\nPresupuesto: " + (l.presupuesto || "-") +
        "\n\nNecesidad:\n" + l.necesidad + "\n\n--- Conversación ---\n" + body.transcripcion,
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }));
}

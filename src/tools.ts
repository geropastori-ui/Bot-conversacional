import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const SERVICIOS = [
  "investigacion_y_analisis",
  "growth_marketing",
  "paid_media",
  "estrategia_comercial",
  "finanzas",
  "inteligencia_artificial",
  "otro",
] as const;

export const LeadInput = z
  .object({
    nombre: z.string().min(1),
    email: z.string().nullable(),
    telefono: z.string().nullable(),
    empresa: z.string().nullable(),
    rubro: z.string().nullable(),
    servicios_interes: z.array(z.enum(SERVICIOS)).min(1),
    necesidad: z.string().min(1),
    presupuesto: z.string().nullable(),
    urgencia: z.enum(["inmediata", "1_a_3_meses", "mas_adelante", "no_definida"]),
    canal_preferido: z.enum(["email", "telefono", "whatsapp", "no_definido"]),
    calificacion: z.enum(["caliente", "tibio", "frio"]),
    notas: z.string().nullable(),
  })
  .refine((l) => Boolean(l.email?.trim() || l.telefono?.trim()), {
    message: "Falta un medio de contacto: pedí email o teléfono antes de registrar el lead.",
  });

export type LeadInput = z.infer<typeof LeadInput>;

const nullableString = (description: string) => ({
  type: ["string", "null"],
  description,
});

export const registrarLeadTool: Anthropic.Beta.BetaTool = {
  name: "registrar_lead",
  description:
    "Registra un lead (potencial cliente) y lo envía al equipo comercial para que lo contacte. " +
    "Usala cuando la persona quiera avanzar (propuesta, precio, reunión, que la llamen) y ya tengas " +
    "su nombre y al menos un medio de contacto (email o teléfono). Si ya registraste el lead en esta " +
    "conversación y la persona aporta datos nuevos, volvé a llamarla con todo actualizado.",
  strict: true,
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "nombre",
      "email",
      "telefono",
      "empresa",
      "rubro",
      "servicios_interes",
      "necesidad",
      "presupuesto",
      "urgencia",
      "canal_preferido",
      "calificacion",
      "notas",
    ],
    properties: {
      nombre: { type: "string", description: "Nombre (y apellido si lo dio) de la persona." },
      email: nullableString("Email de contacto, o null si no lo dio."),
      telefono: nullableString("Teléfono o WhatsApp con código de área, o null si no lo dio."),
      empresa: nullableString("Nombre de la empresa o emprendimiento, o null."),
      rubro: nullableString("Rubro/industria y tamaño aproximado del negocio, o null."),
      servicios_interes: {
        type: "array",
        items: { type: "string", enum: [...SERVICIOS] },
        description: "Servicios de la consultora que le interesan o que le recomendaste.",
      },
      necesidad: {
        type: "string",
        description:
          "Resumen claro para el equipo comercial: situación actual, objetivo y lo que pidió (2-4 oraciones).",
      },
      presupuesto: nullableString("Presupuesto mencionado (con moneda), o null."),
      urgencia: {
        type: "string",
        enum: ["inmediata", "1_a_3_meses", "mas_adelante", "no_definida"],
      },
      canal_preferido: {
        type: "string",
        enum: ["email", "telefono", "whatsapp", "no_definido"],
      },
      calificacion: {
        type: "string",
        enum: ["caliente", "tibio", "frio"],
        description:
          "caliente: necesidad clara + urgencia + quiere avanzar ya; tibio: interés real sin urgencia; frío: está explorando.",
      },
      notas: nullableString("Cualquier otro dato útil (horario para contactar, objeciones, etc.), o null."),
    },
  },
};

export const tools: Anthropic.Beta.BetaTool[] = [registrarLeadTool];

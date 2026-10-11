import { z } from "zod";

const campoASchema = (c) => {
  let base;
  if (c.tipo === "select") base = z.enum(c.opciones.map((o) => o.valor), { message: "required" });
  else if (c.tipo === "yesno") base = z.enum(["yes", "no"], { message: "required" });
  else base = z.string().min(1, "required").max(500);
  return c.requerido ? base : base.optional();
};

// Campos que llena el candidato (se usa en el navegador y en el servidor)
export function buildFormSchema(vacante) {
  const respuestas = {};
  for (const c of vacante.campos) respuestas[c.id] = campoASchema(c);

  return z.object({
    nombre: z.string().trim().min(2, "required").max(100, "required"),
    email: z.string().trim().email("email"),
    telefono: z.string().trim().min(10, "phone").max(20, "phone"),
    zip: z.string().trim().regex(/^\d{5}$/, "zip"),
    horario: z.enum(["morning", "afternoon", "evening"], { message: "required" }),
    respuestas: z.object(respuestas),
    consentimiento: z.literal(true, { message: "consent" }),
    website: z.string().optional(),
  });
}

const metaShape = {
  slug: z.string(),
  idioma: z.enum(["en", "es"]),
  eventId: z.string().min(10).max(100),
  utm: z.record(z.string().max(100), z.string().max(200)).refine((value) => Object.keys(value).length <= 20).optional(),
  fbclid: z.string().max(300).optional(),
};

export const buildServerSchema = (vacante) => buildFormSchema(vacante).extend(metaShape);

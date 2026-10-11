// Devuelve el texto en el idioma pedido (con respaldo en inglés)
export const tr = (obj, lang) => obj?.[lang] ?? obj?.en ?? "";

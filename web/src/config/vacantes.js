export const vacantes = [
  {
    slug: "warehouse-associate",
    vacanteId: "WH-001",
    activa: true,
    consentimientoVersion: "v1",
    titulo: { en: "Warehouse Associate", es: "Asociado de almacén" },
    descripcion: {
      en: "Leave your contact details and tell us about your availability. Our team will review your information for warehouse opportunities in North Carolina.",
      es: "Déjanos tus datos y cuéntanos tu disponibilidad. Nuestro equipo revisará tu información para oportunidades de almacén en Carolina del Norte.",
    },
    campos: [
      { id: "autorizacion", tipo: "yesno", requerido: true, label: { en: "Are you legally authorized to work in the United States?", es: "¿Tienes autorización legal para trabajar en Estados Unidos?" } },
      { id: "transporte", tipo: "yesno", requerido: true, label: { en: "Do you have reliable transportation to work?", es: "¿Tienes transporte confiable para ir al trabajo?" } },
      { id: "disponibilidad", tipo: "select", requerido: true, label: { en: "Availability", es: "Disponibilidad" }, opciones: [
        { valor: "full_time", label: { en: "Full-time", es: "Tiempo completo" } },
        { valor: "part_time", label: { en: "Part-time", es: "Medio tiempo" } },
      ] },
      { id: "experiencia", tipo: "select", requerido: true, label: { en: "Warehouse experience", es: "Experiencia en almacén" }, opciones: [
        { valor: "0_1", label: { en: "Less than 1 year", es: "Menos de 1 año" } },
        { valor: "1_3", label: { en: "1 to 3 years", es: "1 a 3 años" } },
        { valor: "3_plus", label: { en: "More than 3 years", es: "Más de 3 años" } },
      ] },
    ],
  },
];

export const getVacante = (slug) => vacantes.find((v) => v.slug === slug && v.activa);

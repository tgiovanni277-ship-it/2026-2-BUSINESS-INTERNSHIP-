import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getVacante } from "@/config/vacantes";
import ApplyForm from "@/features/apply/ApplyForm";

export default async function VacantePage({ params }) {
  const { vacante: slug } = await params;
  const vacante = getVacante(slug);
  if (!vacante) notFound();
  return <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-9"><div className="mx-auto max-w-5xl"><Suspense><ApplyForm vacante={vacante} /></Suspense></div></main>;
}

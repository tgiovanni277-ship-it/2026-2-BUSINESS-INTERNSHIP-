import { redirect } from "next/navigation";
import { vacantes } from "@/config/vacantes";

export default function Home() {
  const first = vacantes.find((v) => v.activa);
  redirect(first ? `/${first.slug}` : "/warehouse-associate");
}

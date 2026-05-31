// Cette page a été fusionnée avec /dashboard/candidatures
// Redirection automatique pour compatibilité avec les anciens liens
import { redirect } from "next/navigation";

export default function CandidatsMultiRedirect() {
    redirect("/dashboard/candidatures");
}

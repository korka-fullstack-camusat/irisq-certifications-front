"use client";

import { useParams } from "next/navigation";
import { CandidatDossierDetail } from "@/app/dashboard/_components/CandidatDossierDetail";

export default function CertifiedCandidateDossierPage() {
    const params = useParams<{ id: string }>();
    return <CandidatDossierDetail candidatId={params?.id as string} variant="certifie" />;
}

"use client";

import { useParams } from "next/navigation";
import { CandidatDossierDetail } from "@/app/dashboard/_components/CandidatDossierDetail";

export default function ValidatedCandidateDossierPage() {
    const params = useParams<{ candidatId: string }>();
    return <CandidatDossierDetail candidatId={params?.candidatId as string} />;
}

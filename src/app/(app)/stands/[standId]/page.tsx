import { StandDetail } from "@/components/stands/StandDetail";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dettaglio stand · ExpoTrack",
};

export default async function StandDetailPage({ params }: {
  params: Promise<{
    standId: string;
  }>;
}) {
  const { standId } = await params;

  return <StandDetail standId={standId} />;
}

import { StandNotes } from "@/components/stands/StandNotes";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Note stand · ExpoTrack",
};

export default async function StandNotesPage({ params }: {
  params: Promise<{
    standId: string;
  }>;
}) {
  const { standId } = await params;

  return <StandNotes standId={standId} />;
}

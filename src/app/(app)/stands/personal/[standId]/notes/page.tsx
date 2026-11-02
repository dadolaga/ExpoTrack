import { StandNotes } from "@/components/stands/StandNotes";

export default async function PersonalStandPage({ params }: {
  params: Promise<{
    standId: string;
  }>;
}) {
  const { standId } = await params;

  return (
    <StandNotes
      standId={standId}
      source="personal"
    />
  );
}

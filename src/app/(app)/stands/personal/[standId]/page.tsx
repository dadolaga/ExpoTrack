import { StandDetail } from "@/components/stands/StandDetail";

export default async function PersonalStandPage({ params }: {
  params: Promise<{
    standId: string;
  }>;
}) {
  const { standId } = await params;

  return (
    <StandDetail
      standId={standId}
      source="personal"
    />
  );
}

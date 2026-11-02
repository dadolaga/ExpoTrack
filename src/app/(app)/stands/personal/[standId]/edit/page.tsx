import { PersonalStandEditor } from "@/components/stands/PersonalStandEditor";

export default async function PersonalStandPage({ params }: {
  params: Promise<{
    standId: string;
  }>;
}) {
  const { standId } = await params;

  return <PersonalStandEditor standId={standId} />;
}

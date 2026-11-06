import { DemoProjectDetails } from "@/components/demo-workspace";
export default async function DemoProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoProjectDetails id={id}/>;
}

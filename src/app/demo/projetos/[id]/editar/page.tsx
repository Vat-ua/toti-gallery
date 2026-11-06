import { DemoEditor } from "@/components/demo-workspace";
export default async function EditDemoProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoEditor id={id}/>;
}

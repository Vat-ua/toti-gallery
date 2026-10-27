import type { Metadata } from "next";
import { AccessForm } from "@/components/access-form";

export const metadata: Metadata = { title: "Definir senha", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function AccessPage() { return <AccessForm/>; }

import type { Metadata } from "next";
import { AccessForm } from "@/components/access-form";
import { authSettings } from "@/lib/auth-settings";

export const metadata: Metadata = { title: "Acesso à conta", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function AccessPage() { return <AccessForm googleEnabled={!!authSettings().google}/>; }

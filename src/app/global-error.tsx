"use client";

import { ErrorRecovery } from "@/components/error-recovery";
import "./globals.css";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return <html lang="pt-BR"><body><title>Toti Gallery — tente novamente</title><ErrorRecovery error={error} retry={retry}/></body></html>;
}

import type { Client } from "pg";
type Snapshot = Record<string, { columns: { column_name: string; data_type: string }[]; rows: Record<string, unknown>[] }>;
export function snapshot(client: Client): Promise<Snapshot>;
export function fingerprints(data: Snapshot): Record<string, string>;

export const PRODUCTION: Readonly<{ projectId: string; branchId: string; endpointId: string; database: string }>;
export function endpointId(value: string): string;
export function assertRuntimeTarget(url: string, env?: Record<string, string | undefined>): void;
export function assertDatabaseTarget(client: { query(query: string): Promise<{ rows: Record<string, string>[] }> }, env?: Record<string, string | undefined>, purpose?: "development" | "test" | "operations"): Promise<Record<string, string>>;

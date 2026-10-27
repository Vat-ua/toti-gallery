import type { Client } from "pg";
export function schemaContract(client: Pick<Client, "query">, schema: string): Promise<{ columns: string[]; constraints: string[]; indexes: string[] }>;

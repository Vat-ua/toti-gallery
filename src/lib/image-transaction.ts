import { db } from "@/db";
import type { ImageMetadata } from "./image-policy";
import { retireImage } from "./image-storage";
import { logServerError } from "./server-log";
import { PublicError } from "./errors";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Once COMMIT can have started, even an empty reference lookup cannot prove rollback. */
export async function commitImageChange<T>(upload: ImageMetadata | undefined, work: (tx: Transaction) => Promise<T>): Promise<T> {
  let readyToCommit = false;
  try {
    return await db.transaction(async tx => {
      const result = await work(tx);
      readyToCommit = true;
      return result;
    });
  } catch (error) {
    if (readyToCommit) {
      if (upload) logServerError("image.commit.unconfirmed", error);
      throw new PublicError("Não foi possível confirmar o salvamento. Confira o resultado antes de tentar novamente.", 503, { cause: error });
    }
    if (upload) await retireImage(upload);
    throw error;
  }
}

import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db, pool } from "@/db";
import { projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertDatabaseTarget, PRODUCTION } from "./database-target.cjs";
import { imageKey, type ImageKind, type ImageMetadata } from "./image-policy";
import { processImage } from "./image-processing";
import { storageSettings } from "./image-storage-settings";
import { PublicError } from "./errors";
import { logServerError } from "./server-log";

function storage() {
  const settings = storageSettings();
  return { bucket: settings.bucket, client: new S3Client({ ...settings, forcePathStyle: true,
    maxAttempts: 2, requestHandler: { connectionTimeout: 10_000, requestTimeout: 20_000, throwOnRequestTimeout: true },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }) };
}

async function verifyWriteTarget() {
  const production = process.env.VERCEL_ENV === "production";
  await assertDatabaseTarget(pool, production ? { ...process.env, GALLERY_DATABASE_ENV: "operations", DATABASE_NAME: PRODUCTION.database,
    NEON_PROJECT_ID: PRODUCTION.projectId, NEON_BRANCH_ID: PRODUCTION.branchId, NEON_ENDPOINT_ID: PRODUCTION.endpointId } : process.env,
  production ? "operations" : process.env.GALLERY_DATABASE_ENV === "test" ? "test" : "development");
}

export async function saveImage(file: File, kind: ImageKind) {
  let connection: ReturnType<typeof storage> | undefined;
  try { connection = storage(); await verifyWriteTarget(); }
  catch (cause) { connection?.client.destroy(); throw new PublicError("O envio de imagens está indisponível. Tente novamente mais tarde.", 503, { cause }); }
  let processed: Awaited<ReturnType<typeof processImage>>;
  try { processed = await processImage(file, kind); }
  catch (error) { connection.client.destroy(); throw error; }
  const id = randomUUID(), key = kind === "avatar" ? `avatars/${id}.webp` : `covers/${id}/image.webp`;
  const metadata: ImageMetadata = { key, width: processed.image.width, height: processed.image.height, bytes: processed.image.data.length, format: "webp" };
  const objects = [{ key, data: processed.image.data }];
  if (processed.thumbnail) {
    metadata.thumbnail = { key: `covers/${id}/thumbnail.webp`, width: processed.thumbnail.width, height: processed.thumbnail.height, bytes: processed.thumbnail.data.length };
    objects.push({ key: metadata.thumbnail.key, data: processed.thumbnail.data });
  }
  try {
    for (const object of objects) await connection.client.send(new PutObjectCommand({ Bucket: connection.bucket, Key: object.key, Body: object.data,
      ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
    return { url: `/media/${key}`, metadata };
  } catch (cause) {
    // Includes the attempted key: a timed-out PUT may still have succeeded.
    await deleteImage(metadata);
    throw new PublicError("Não foi possível enviar a imagem. Tente novamente.", 503, { cause });
  } finally { connection.client.destroy(); }
}

export async function deleteImage(metadata: ImageMetadata | null | undefined) {
  if (!metadata) return;
  let client: S3Client | undefined;
  try {
    await verifyWriteTarget();
    const connection = storage(); client = connection.client;
    const keys = [metadata.key, ...(metadata.thumbnail ? [metadata.thumbnail.key] : [])];
    for (const key of keys) {
      if (!imageKey(`/media/${key}`)) throw new Error("Invalid image key");
      await client.send(new DeleteObjectCommand({ Bucket: connection.bucket, Key: key }));
    }
  } catch (error) { logServerError("image.delete.failed", error); }
  finally { client?.destroy(); }
}

export async function retireImage(metadata: ImageMetadata | null | undefined) {
  if (!metadata) return;
  try {
    const url = `/media/${metadata.key}`;
    const [people, publications] = await Promise.all([
      db.select({ id: users.id }).from(users).where(eq(users.image, url)).limit(1),
      db.select({ id: projects.id }).from(projects).where(eq(projects.imageUrl, url)).limit(1),
    ]);
    if (!people.length && !publications.length) await deleteImage(metadata);
  } catch (error) {
    // Never infer rollback from a connection error. An unverified object stays intact.
    logServerError("image.retirement.deferred", error);
  }
}

export async function getImage(key: string) {
  if (!imageKey(`/media/${key}`)) return null;
  const { client, bucket } = storage();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const reader = object.Body?.transformToWebStream().getReader();
    if (!reader) { client.destroy(); return null; }
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { controller.close(); client.destroy(); }
          else controller.enqueue(value);
        } catch (error) { logServerError("image.stream.failed", error); controller.error(error); client.destroy(); }
      },
      async cancel() { try { await reader.cancel(); } finally { client.destroy(); } },
    });
    return { body, length: object.ContentLength, etag: object.ETag };
  } catch (error) {
    client.destroy();
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

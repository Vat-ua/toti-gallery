import sharp from "sharp";
import { validateImageFile, type ImageKind } from "./image-policy";

const MAX_PIXELS = 25_000_000;

export async function processImage(file: File, kind: ImageKind) {
  validateImageFile(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const source = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "warning" });
    const metadata = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages || 1) !== 1) {
      throw new Error("unsupported");
    }
    // Rotate from EXIF, strip metadata, preserve alpha, and never enlarge an image.
    const result = await source.autoOrient().resize(kind === "avatar"
      ? { width: Math.min(512, metadata.width!, metadata.height!), height: Math.min(512, metadata.width!, metadata.height!), fit: "cover", position: "centre" }
      : { width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
    const image = { data: result.data, width: result.info.width, height: result.info.height };
    const thumbnail = kind === "cover" ? await sharp(image.data).resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer({ resolveWithObject: true }) : null;
    return { image, thumbnail: thumbnail ? { data: thumbnail.data, width: thumbnail.info.width, height: thumbnail.info.height } : null };
  } catch {
    throw new Error("Não foi possível ler a imagem. Use um JPG, PNG ou WebP estático de até 25 megapixels.");
  }
}

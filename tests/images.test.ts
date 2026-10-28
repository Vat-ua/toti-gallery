import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processImage } from "../src/lib/image-processing";
import { coverThumbnail, IMAGE_MAX_BYTES, imageKey, validateImageFile } from "../src/lib/image-policy";
import { readImageForm } from "../src/lib/image-form";
import { storageSettings } from "../src/lib/image-storage-settings";
import { PRODUCTION } from "../src/lib/database-target.cjs";
import { validateProfile } from "../src/lib/account";
import { validateProject } from "../src/lib/validation";
import { DEFAULT_COVER_FRAMING, moveCoverFraming, validateCoverFraming } from "../src/lib/cover-framing";

const origin = "http://localhost:3000";
async function image(width: number, height: number, channels: 3 | 4 = 3) {
  return sharp({ create: { width, height, channels, background: { r: 40, g: 150, b: 200, alpha: .5 } } }).png().toBuffer();
}
function file(bytes: Buffer, type = "image/png") { return new File([new Uint8Array(bytes)], "example.png", { type }); }
const key = "covers/12345678-1234-1234-1234-123456789abc/image.webp";

test("cover keeps proportions, strips EXIF, preserves alpha and has a smaller card version", async () => {
  const source = await sharp(await image(2400, 1600, 4)).withMetadata({ exif: { IFD0: { Artist: "Private fixture name" } } }).png().toBuffer();
  const processed = await processImage(file(source), "cover");
  assert.equal(processed.image.width, 1600); assert.equal(processed.image.height, 1067);
  assert.equal(processed.thumbnail?.width, 640);
  const meta = await sharp(processed.image.data).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.exif, undefined); assert.equal(meta.hasAlpha, true);
});

test("avatar is centered and square; neither avatar nor cover upscales small inputs", async () => {
  const avatar = await processImage(file(await image(1200, 800)), "avatar");
  assert.deepEqual([avatar.image.width, avatar.image.height, avatar.thumbnail], [512, 512, null]);
  const small = file(await image(80, 120));
  const photo = await processImage(small, "avatar"), cover = await processImage(small, "cover");
  assert.deepEqual([photo.image.width, photo.image.height], [80, 80]);
  assert.deepEqual([cover.image.width, cover.image.height, cover.thumbnail?.width], [80, 120, 80]);
});

test("orientation is applied before sizing", async () => {
  const source = await sharp(await image(900, 600)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await processImage(file(source, "image/jpeg"), "cover");
  assert.deepEqual([result.image.width, result.image.height], [600, 900]);
});

test("rejects oversize, corrupt, disguised SVG and oversized decoded dimensions", async () => {
  assert.throws(() => validateImageFile({ type: "image/png", size: IMAGE_MAX_BYTES + 1 }), /3 MB/);
  assert.throws(() => validateImageFile({ type: "image/svg+xml", size: 100 }), /JPG/);
  await assert.rejects(() => processImage(file(Buffer.from("not an image")), "cover"), /ler a imagem/);
  await assert.rejects(() => processImage(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')), "cover"), /ler a imagem/);
  const oversized = file(await image(5100, 5000));
  await assert.rejects(() => processImage(oversized, "cover"), /25 megapixels/);
});

test("bounded multipart accepts one image, rejects duplicate parts and oversized streams without trusting Content-Length", async () => {
  const form = new FormData(); form.set("data", JSON.stringify({ title: "Test" })); form.set("image", file(await image(20, 20)));
  const parsed = await readImageForm(new Request(origin, { method: "POST", body: form }));
  assert.equal(parsed.body.title, "Test"); assert.equal(parsed.file?.type, "image/png");
  form.append("image", file(await image(10, 10)));
  await assert.rejects(() => readImageForm(new Request(origin, { method: "POST", body: form })), /inválidos/);
  await assert.rejects(() => readImageForm(new Request(origin, { method: "POST", headers: { "Content-Type": "application/json" }, body: " ".repeat(IMAGE_MAX_BYTES + 65 * 1024) })), /limite/);
});

test("legacy images may be retained, but new base64 uploads and someone else's keys cannot be adopted", () => {
  const old = "data:image/webp;base64,existing";
  const profile = { name: "Test Person", bio: "", github: "", avatar: old };
  assert.equal(validateProfile(profile, old).avatar, old);
  assert.throws(() => validateProfile(profile), /nova foto/);
  assert.throws(() => validateProfile({ ...profile, avatar: "/media/" + key }), /nova foto/);
  const project = { title: "Test Project", description: "A description long enough for project validation.", technologies: ["React"], githubUrl: "https://github.com", imageUrl: old };
  assert.equal(validateProject(project, old).imageUrl, old);
  assert.throws(() => validateProject(project), /Enviar imagem/);
  assert.throws(() => validateProject({ ...project, imageUrl: "/media/" + key }), /Enviar imagem/);
  assert.equal(validateProject({ ...project, imageUrl: "/media/" + key }, "/media/" + key).imageUrl, "/media/" + key);
  assert.equal(imageKey("/media/../secret"), null);
  assert.equal(coverThumbnail("/media/" + key), "/media/" + key.replace("image", "thumbnail"));
});

test("storage rejects production locally and mismatched endpoints, including test-to-development mixups", () => {
  const env = { GALLERY_DATABASE_ENV: "development", NEON_BRANCH_ID: "br-test-fixture", AWS_ENDPOINT_URL_S3: "https://br-test-fixture.storage.c-14.us-east-1.aws.neon.tech", AWS_REGION: "us-east-1", AWS_ACCESS_KEY_ID: "fixture", AWS_SECRET_ACCESS_KEY: "fixture", GALLERY_IMAGE_BUCKET: "gallery-images" };
  assert.equal(storageSettings(env).branch, env.NEON_BRANCH_ID);
  assert.throws(() => storageSettings({ ...env, NEON_BRANCH_ID: PRODUCTION.branchId }));
  assert.throws(() => storageSettings({ ...env, GALLERY_DATABASE_ENV: "test", NEON_BRANCH_ID: "br-other-test" }));
  assert.throws(() => storageSettings({ ...env, AWS_ENDPOINT_URL_S3: "https://untrusted.example" }));
  assert.throws(() => storageSettings({ ...env, AWS_SECRET_ACCESS_KEY: "" }));
});

test("framing accepts only finite bounded positions and scale, preserving omitted legacy settings", () => {
  assert.equal(validateCoverFraming(undefined), undefined);
  assert.equal(validateCoverFraming(null), null);
  assert.deepEqual(validateCoverFraming({ x: 12.123456, y: 80, zoom: 1.75 }), { x: 12.123, y: 80, zoom: 1.75 });
  for (const value of [[], "bad", {}, { x: 50, y: 50, zoom: 1, extra: true },
    ...[NaN, Infinity, -1, 101].map(x => ({ x, y: 0, zoom: 1 })),
    { x: 50, y: "0", zoom: 1 }, { x: 50, y: -1, zoom: 1 }, { x: 50, y: 101, zoom: 1 },
    { x: 50, y: 0, zoom: .9 }, { x: 50, y: 0, zoom: 3.01 }]) assert.throws(() => validateCoverFraming(value), /enquadramento/);
  const project = { title: "Test Project", description: "A description long enough for project validation.", technologies: ["React"], githubUrl: "https://github.com", imageUrl: "https://example.com/image.jpg" };
  assert.deepEqual(validateProject({ ...project, coverFraming: { x: 0, y: 50, zoom: 2 } }).coverFraming, { x: 0, y: 50, zoom: 2 });
  assert.throws(() => validateProject({ ...project, coverFraming: { x: 0, y: 0, zoom: 100 } }), /enquadramento/);
});

test("dragging follows pointer movement, clamps to image edges and ignores axes with no overflow", () => {
  const frame = { x: 50, y: 50, zoom: 1 };
  assert.deepEqual(moveCoverFraming(frame, 30, 60, 400, 200, 280, 200), { x: 25, y: 50, zoom: 1 });
  assert.deepEqual(moveCoverFraming(frame, 100, 100, 400, 200, 400, 200), frame);
  assert.deepEqual(moveCoverFraming({ ...frame, zoom: 2 }, 260, 100, 400, 200, 280, 200), { x: 0, y: 0, zoom: 2 });
  assert.deepEqual(moveCoverFraming(frame, -10_000, -10_000, 400, 200, 280, 200), { ...frame, x: 100 });
  assert.deepEqual(moveCoverFraming(frame, 20, 20, 0, 0, 300, 200), frame);
  assert.deepEqual(DEFAULT_COVER_FRAMING, { x: 50, y: 0, zoom: 1 });
});

test("both display ratios remain fully covered for landscape, portrait and square inputs at every zoom", () => {
  for (const [imageWidth, imageHeight] of [[1600, 900], [800, 1200], [1000, 1000]]) {
    for (const ratio of [7 / 5, 16 / 10]) for (const zoom of [1, 1.5, 3]) {
      const width = 350, height = width / ratio;
      const frame = moveCoverFraming({ x: 50, y: 50, zoom }, 9999, -9999, imageWidth, imageHeight, width, height);
      const scale = Math.max(width / imageWidth, height / imageHeight) * zoom;
      const left = (width - imageWidth * scale) * frame.x / 100;
      const top = (height - imageHeight * scale) * frame.y / 100;
      assert.ok(left <= .001 && top <= .001);
      assert.ok(left + imageWidth * scale >= width - .001 && top + imageHeight * scale >= height - .001);
    }
  }
});

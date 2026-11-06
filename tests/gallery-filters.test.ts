import { test } from "node:test";
import assert from "node:assert/strict";
import { galleryFilterParams, readGalleryFilters } from "../src/lib/gallery-filters";

const options = { cohorts: ["Turma 58", "Turma 54"], technologies: ["React", "CSS"] };

test("final-project selection round-trips with search, turma, technologies, and sorting", () => {
  const filters = readGalleryFilters(new URLSearchParams("q=livros&cohort=54&tech=React&tech=CSS&final=1&sort=likes"), options);
  assert.equal(filters.finalOnly, true);
  assert.deepEqual(readGalleryFilters(galleryFilterParams(filters), options), filters);
  const all = galleryFilterParams({ ...filters, finalOnly: false });
  assert.equal(all.has("final"), false);
  assert.equal(all.get("q"), "livros"); assert.equal(all.get("cohort"), "54");
  assert.deepEqual(all.getAll("tech"), ["React", "CSS"]); assert.equal(all.get("sort"), "likes");
});

test("old destaque URLs do not apply an invisible filter or imply final projects", () => {
  const filters = readGalleryFilters(new URLSearchParams("featured=1"), options);
  assert.equal(filters.finalOnly, false);
  assert.equal(galleryFilterParams(filters).toString(), "");
});

test("loaded pages round-trip alongside all gallery filters", () => {
  const filters = readGalleryFilters(new URLSearchParams("q=livros&cohort=54&tech=React&final=1&sort=likes&page=2"), options);
  assert.equal(filters.page, 2);
  assert.deepEqual(readGalleryFilters(galleryFilterParams(filters), options), filters);
  const firstPage = galleryFilterParams({ ...filters, page: 1 });
  assert.equal(firstPage.has("page"), false);
  assert.equal(firstPage.get("q"), "livros");
  assert.equal(firstPage.get("cohort"), "54");
  assert.deepEqual(firstPage.getAll("tech"), ["React"]);
  assert.equal(firstPage.get("final"), "1");
  assert.equal(firstPage.get("sort"), "likes");
});

test("invalid pages fall back to the first batch", () => {
  for (const value of ["", "0", "-1", "1.5", "abc", "Infinity", "9007199254740992"]) {
    const filters = readGalleryFilters(new URLSearchParams({ page: value }), options);
    assert.equal(filters.page, 1, value);
    assert.equal(galleryFilterParams(filters).has("page"), false, value);
  }
});

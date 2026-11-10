import { test } from "node:test";
import assert from "node:assert/strict";
import { galleryFilterParams, readGalleryFilters } from "../src/lib/gallery-filters";


test("final-project selection round-trips with search, turma, technologies, and sorting", () => {
  const filters = readGalleryFilters(new URLSearchParams("q=livros&cohort=54&tech=React&tech=CSS&final=1&sort=likes"));
  assert.equal(filters.finalOnly, true);
  assert.deepEqual(readGalleryFilters(galleryFilterParams(filters)), filters);
  const all = galleryFilterParams({ ...filters, finalOnly: false });
  assert.equal(all.has("final"), false);
  assert.equal(all.get("q"), "livros"); assert.equal(all.get("cohort"), "54");
  assert.deepEqual(all.getAll("tech"), ["React", "CSS"]); assert.equal(all.get("sort"), "likes");
});

test("old destaque URLs do not apply an invisible filter or imply final projects", () => {
  const filters = readGalleryFilters(new URLSearchParams("featured=1"));
  assert.equal(filters.finalOnly, false);
  assert.equal(galleryFilterParams(filters).toString(), "");
});

test("loaded pages round-trip alongside all gallery filters", () => {
  const filters = readGalleryFilters(new URLSearchParams("q=livros&cohort=54&tech=React&final=1&sort=likes&page=2"));
  assert.equal(filters.page, 2);
  assert.deepEqual(readGalleryFilters(galleryFilterParams(filters)), filters);
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
    const filters = readGalleryFilters(new URLSearchParams({ page: value }));
    assert.equal(filters.page, 1, value);
    assert.equal(galleryFilterParams(filters).has("page"), false, value);
  }
});

test("unknown valid filters retain the same meaning independently of available choices", () => {
  const params = new URLSearchParams("cohort=000999&tech=NotPresent&tech=&tech=React&tech=React");
  const filters = readGalleryFilters(params);
  assert.equal(filters.cohort, "Turma 999"); assert.deepEqual(filters.techs, ["NotPresent", "React"]);
  assert.deepEqual(readGalleryFilters(galleryFilterParams(filters)), filters);
  assert.deepEqual(readGalleryFilters(params, "community").techs, []);
  assert.equal(readGalleryFilters(params, "page").cohort, "");
});

test("community sorting defaults to names and round-trips rankings with search, turma and page", () => {
  for (const sort of ["", "recent", "invalid", "az"]) {
    const filters = readGalleryFilters(new URLSearchParams({ sort }), "community");
    assert.equal(filters.sort, "az");
    assert.equal(galleryFilterParams(filters, "community").toString(), "");
  }
  for (const sort of ["projects", "likes"]) {
    const filters = readGalleryFilters(new URLSearchParams({ q: "Ana", cohort: "58", sort, page: "2" }), "community");
    assert.equal(filters.sort, sort);
    const params = galleryFilterParams(filters, "community");
    assert.equal(params.get("sort"), sort); assert.equal(params.get("page"), "2");
    assert.deepEqual(readGalleryFilters(params, "community"), filters);
  }
  assert.equal(readGalleryFilters(new URLSearchParams("sort=projects")).sort, "recent");
  assert.equal(galleryFilterParams(readGalleryFilters(new URLSearchParams())).toString(), "");
});

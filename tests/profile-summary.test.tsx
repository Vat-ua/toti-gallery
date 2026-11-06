import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileSummary } from "../src/components/profile-summary";
import type { Person } from "../src/lib/types";

const person: Person = {
  id: "profile-fixture", slug: "ana-souza", name: "Ana Souza", cohort: "Turma 58",
  cohorts: ["Turma 58"], courseName: "Full Stack", year: 2026, bio: "Aprendendo e compartilhando.",
  avatar: null, github: "https://github.com/ana", linkedin: "https://www.linkedin.com/in/ana", turmaId: "turma-58",
};
const render = (value: Person, isOwner = false) => renderToStaticMarkup(<ProfileSummary person={value} isOwner={isOwner} projectCount={2} totalLikes={5}/>);

test("contact links share a row, with the owner edit action below", () => {
  const html = render(person, true);
  assert.match(html, /class="profile-socials"/);
  assert(html.indexOf('href="https://github.com/ana"') < html.indexOf('href="https://www.linkedin.com/in/ana"'));
  assert(html.indexOf('href="https://www.linkedin.com/in/ana"') < html.indexOf('href="/minha-conta"'));
  assert.match(html, /Turma 58.*Full Stack.*2026/);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 2);
});

test("visitors cannot see edit actions and missing contacts create no empty controls", () => {
  assert(!render(person).includes("Editar perfil"));
  const noContacts = { ...person, github: null, linkedin: null };
  assert(!render(noContacts).includes('class="profile-actions"'));
  const own = render(noContacts, true);
  assert(own.includes("Editar perfil")); assert(!own.includes('class="profile-socials"'));
  const linkedinOnly = render({ ...person, github: null });
  assert(linkedinOnly.includes(">LinkedIn<")); assert(!linkedinOnly.includes(">GitHub<"));
});

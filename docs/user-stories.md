# User stories

This document describes Toti Gallery from the user's perspective: who needs a
feature, what they want to do, and what a successful result looks like. Stories
are grouped by role and workflow; their IDs are references, not a delivery order.

**Current** means supported by the current codebase. It does not mean every
feature has been deployed to the public Vercel site or independently acceptance
tested. Administration is being reviewed in development. **Planned** stories
describe agreed directions and do not claim an existing interface or integration.

For technical details, see [Database](database.md),
[Authentication](authentication.md), and [Administration](administration.md).

## Roles

| Actor | Scope |
| --- | --- |
| Visitor | Anyone browsing the public site; no account is required. |
| Student / participant | An activated user who can maintain a profile and publish when assigned to a turma. A person can belong to several turmas. |
| Administrator | An active `admin` who manages turmas, students, access links, and project visibility. |
| Owner | The single `owner`, with administrator permissions and authority over staff accounts. A dedicated administrator-management interface is planned. |

Visitor and participant describe product usage. The stored account roles are
`user`, `admin`, and `owner`; membership in a turma does not grant staff rights.

## Public discovery — Current

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| VIS-01 | As a visitor, I want to browse projects so that I can discover what other people are building. | The gallery shows public publications once each, including group projects. Nine cards appear initially; loading more keeps previously displayed cards. Hidden projects are excluded. |
| VIS-02 | As a visitor, I want to search and filter projects so that I can find relevant work. | Search supports projects, people, and technologies. Turma, technology, final-project, and `Destaques` controls narrow the results; clearing them restores the broader list. |
| VIS-03 | As a visitor, I want to sort results and share my selection so that I can return to the same view. | Recent, most-liked, and alphabetical sorting are available. The gallery URL preserves supported search, filter, and sorting choices when copied or reloaded. |
| VIS-04 | As a visitor, I want to open a project so that I can understand it and explore the result. | The detail page shows its description, authors, turma, technologies, publication date, required code link, and live link when provided. Final projects are identified. |
| VIS-05 | As a visitor, I want to like a project so that I can express appreciation without registering. | A public project's like can be added or removed. The same browser visitor identifier cannot hold two likes for the same project. Hidden projects cannot receive public likes. |
| VIS-06 | As a visitor, I want to find community members so that I can explore their work. | Community search and turma filtering are available, with nine people initially and a load-more action. Only eligible public profiles with at least one turma membership appear; never-activated real profiles are excluded. |
| VIS-07 | As a visitor, I want to open a person's profile so that I can see their individual and collaborative work. | The profile links to the person's public projects, including coauthored publications. Hidden projects are excluded. |
| VIS-08 | As a visitor, I want to browse comfortably on my device so that I can use the site on desktop or mobile. | Navigation, cards, forms, and dropdowns adapt to smaller screens. The theme control switches the visual theme. |

## Sign-in and personal profile — Current

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| ACC-01 | As an invited student, I want to activate with a password so that I can access my existing profile. | A valid activation link identifies the intended account and allows password creation. Success activates the existing user ID; the link cannot be reused. Expired or revoked links are rejected. |
| ACC-02 | As an approved student, I want to enter with Google so that I do not need to create a separate password. | A verified Google email matching an eligible existing profile activates or signs into that same record. Unknown, demo, or suspended identities are denied; no public registration or duplicate profile is created. |
| ACC-03 | As a user, I want to sign in with email and password so that access does not depend on Google. | Valid credentials grant access to the same profile used by Google. Invalid input receives actionable feedback without exposing whether an arbitrary account exists. Signing out ends the current session. |
| ACC-04 | As a user, I want to edit my profile so that my public information stays current. | I can update my name, bio, GitHub link, and photo, including removing the photo. I cannot use the profile form to change roles, access status, or another person's details. |
| ACC-05 | As a password user, I want to change my password so that I can maintain access security. | The profile editor requires the current password and validates the new one. A successful password change revokes other sessions. |
| ACC-06 | As an eligible active user, I want to define or reset a password so that I can recover access or add password sign-in to Google. | An administrator-issued recovery link allows a new password without the old one. It expires after one hour, is single-use, and ends existing sessions after successful redemption. Delivery is currently manual. |

Activation links last 48 hours. Creating a replacement invalidates earlier links
of the same purpose. Google is optional: password entry remains available when
Google OAuth is not configured or available. See [Authentication](authentication.md)
for the detailed grant lifecycle.

## Publishing and collaboration — Current

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| PRJ-01 | As a participant, I want to publish a project so that I can share my work. | Publication requires a signed-in eligible account with a turma, a title, description, and valid GitHub link. I can select technologies, a cover style, and an optional live link. Invalid submissions explain what needs correction. |
| PRJ-02 | As a participant, I want to mark a final course project so that it can be recognized and found. | The editor saves `isFinal`; cards and project details identify final projects, and the public filter can show only final projects. Both individual and group projects can be final. |
| PRJ-03 | As a publication owner, I want to credit coauthors so that a group project needs only one publication. | I can select eligible active, verified, non-demo participants of the project's turma. One publication appears in the gallery and in each author's profile; adding authors does not duplicate the project. |
| PRJ-04 | As a participant, I want to see my contributions together so that I can manage my work. | `Meus projetos` includes owned and coauthored publications, including hidden ones. Actions reflect ownership: coauthors do not receive edit or delete rights. |
| PRJ-05 | As a publication owner, I want to edit my project so that its information remains accurate. | I can update content and coauthors. Other participants cannot edit it. Editing a hidden project does not automatically restore public visibility. |
| PRJ-06 | As a publication owner, I want to delete a project so that I can remove a publication I no longer want to maintain. | The interface requests confirmation. Deletion removes the publication, its author links, and its visitor likes. Other authors and ordinary administrators cannot use this action for someone else's publication. |
| PRJ-07 | As a coauthor, I want to leave a project so that my profile no longer claims that contribution. | Confirmation removes my authorship link only. The project, owner, other authors, and likes remain. The owner cannot leave through the coauthor action. |
| PRJ-08 | As an author of a hidden project, I want to retain access to it so that moderation does not erase my work. | Authors can use a private preview. The owner sees the hiding reason and can edit or delete; coauthors retain their leave action. Public visitors cannot open the hidden publication. |

## Turmas and student administration — Current

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| ADM-01 | As an administrator, I want to create and edit turmas so that groups match the actual courses. | Number, course name, and start year are required when saving. Numbers are globally unique. Separate `Gerenciar` and `Editar` actions distinguish group management from changing group details. |
| ADM-02 | As an administrator, I want to archive or restore a turma so that I can organize past and current groups. | The action requires confirmation. Memberships and publications are retained; participants can still publish in an archived turma. Archiving does not release its number. |
| ADM-03 | As an administrator, I want to add a student so that approved people can access the platform. | I can create a pending profile or select an existing one. Existing normalized emails reuse the same identity rather than create duplicates. A new profile has no password, and its activation link is offered immediately. |
| ADM-04 | As an administrator, I want to import a student list so that I can enroll a turma efficiently. | Pasted spreadsheet data and UTF-8 CSV are supported, up to 500 students and 200 KB. Preview writes nothing. Invalid or duplicate rows must be corrected or excluded; confirmation revalidates before saving and reports the result. |
| ADM-05 | As an administrator, I want to assign multiple turmas so that a student's later course does not require a new account. | Membership changes preserve the person's ID, profile, credentials, projects, and authorship. Removing the final membership preserves sign-in but prevents new publication until a turma is assigned. |
| ADM-06 | As an administrator, I want to find students efficiently so that a growing roster stays manageable. | Name/email search and turma/access filters apply before pagination. The table shows 25 or 50 people per page, with state retained in the URL and no duplicate rows for multi-turma students. |
| ADM-07 | As an administrator, I want to correct registration details so that mistakes do not prevent activation. | Eligible names can be corrected. Email changes are restricted to real pending, unverified students, reject duplicates, and revoke outstanding access links. Activated emails are read-only in this workflow. |
| ADM-08 | As an administrator, I want to manage individual access links so that I can help students activate or recover access. | The panel supports issuing, reissuing, and revoking eligible links. It shows the latest link's state. Copied messages include expiration in Brasília time; copying does not claim that an email was sent. |
| ADM-09 | As an administrator, I want to suspend or restore student access so that I can control participation without losing content. | Suspension requires confirmation, blocks access, ends sessions, and revokes grants. Restore respects prior verification and does not activate an unverified student. Projects are not automatically hidden. |
| ADM-10 | As an administrator, I want to remove an accidental unactivated registration so that test entries and mistakes can be cleaned up. | `Excluir cadastro` requires confirmation and accepts only real pending, unverified students without protected history. Active, suspended, demo, and staff accounts are excluded. Concurrent activation prevents stale deletion. |
| ADM-11 | As an administrator, I want staff accounts to have stronger protection so that student-management actions cannot change administrative access. | A regular administrator cannot alter staff memberships or issue staff access links. Imports do not create staff rights; privileged checks run on the server. |

## Project moderation — Current

| ID | User story | Acceptance criteria |
| --- | --- | --- |
| MOD-01 | As an administrator, I want to review all projects or one turma's projects so that I can moderate relevant publications. | Global and turma views share project cards and moderation behavior. Search includes authors and coauthors; visibility filters apply before loading nine cards at a time. The global view also filters by turma. |
| MOD-02 | As an administrator, I want to hide a project with a reason so that unsuitable content leaves the public site without being deleted. | A nonblank reason is required. Hidden projects disappear from public gallery, profiles, related projects, and detail URLs. Ownership, content, author links, and likes remain intact. |
| MOD-03 | As an administrator, I want to read the hiding reason before restoring a project so that I can make an informed decision. | The restoration panel shows the existing reason and requests confirmation. Restoration makes the publication public again and enables public likes; stale concurrent actions do not overwrite another moderator's decision. |
| MOD-04 | As an administrator, I want moderation to remain separate from authorship so that staff intervention does not take over students' work. | Moderation changes visibility and latest-action metadata. It does not grant general editing or permanent-deletion rights over someone else's project, and does not constitute a full audit log. |

## Agreed follow-ups — Planned

These stories record the intended direction. Their detailed UI and delivery order
still require agreement; they are not a mandate to implement everything at once.

| ID | User story | Expected acceptance criteria | Status |
| --- | --- | --- | --- |
| OWN-01 | As the owner, I want a dedicated administrator list so that I can see who has staff access. | An owner-only `Administradores` section lists staff and their access state. Ordinary administrators cannot open or mutate this management area. | Planned |
| OWN-02 | As the owner, I want to grant and remove administrator access so that staff responsibilities can change. | Role changes preserve the existing person, projects, and authorship. Only the owner can perform them; the single-owner invariant remains protected. Detailed eligibility and confirmations are to be agreed before implementation. | Planned |
| MAIL-01 | As an administrator, I want to send invitations to selected students so that onboarding does not require copying each link manually. | A future delivery service uses the existing grant mechanism. Failures are visible and do not create duplicate students or falsely report success; manual delivery remains independent. Bulk selection belongs to that future workflow. | Planned |
| MAIL-02 | As a user who forgot my password, I want to request a recovery email so that I do not need an administrator to relay a link. | Responses do not reveal account existence. Eligible users receive an expiring single-use recovery link through a configured mail provider, with abuse limits and no public registration. | Planned |

## Boundaries

- There is no open registration: administration provisions identities before entry.
- A student may belong to several turmas; account access is independent of course completion.
- New group-project coauthors must belong to the project's turma; later membership changes retain existing credits.
- General account deletion, ownership transfer, a full moderation audit history,
  and automatic email delivery are not current features.
- These tables describe expected product behavior, not an automated-test coverage
  report. Verification methods and environment limits are documented separately.

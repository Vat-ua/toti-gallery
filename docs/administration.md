# Administration

Stage 3 is delivered in separately reviewed parts. `/admin/turmas` provides group
creation/editing, archive/restore, student membership and import preview.
`/admin/estudantes` provides the global student list, multi-turma management,
student access controls and activation/recovery links. Project moderation and
administrator management remain unavailable pending their own implementation.

## Permissions

- Active non-demo `admin` and `owner` accounts manage turmas and students.
- Only `owner` may manage another staff account. Regular administrators cannot
  alter owner/admin memberships or issue access links for them.
- Public profiles never acquire staff rights from a turma or an import.
- One `owner` is enforced by a partial unique index. First-account bootstrap now
  creates the owner; existing installations require explicit promotion by ID.
- Role/status checks run on the server for page reads and inside every mutation
  service. Mutating HTTP endpoints also require the configured trusted origin.
- Student suspension applies only to real accounts with the `user` role. Staff
  accounts and demo profiles cannot be suspended from Estudantes.
- Staff management, role reassignment and ownership transfer are not exposed yet.

## Existing-account migration

`20261027_stage3_owner.sql` expands the role constraint and adds the single-owner
index. It promotes an existing active, non-demo administrator only when the caller
explicitly sets `gallery.owner_user_id`; an invalid ID rolls back the migration.
No credentials, memberships, credits, sessions or profile values are rewritten.
Fresh demo-only auth fixtures apply the DDL without selecting an owner.

The guarded runner supports **development and isolated test environments only**:

```sh
node scripts/migrate-admin-foundation.cjs --env-file=.env.admin-test \
  --owner-id=EXISTING_FIRST_ADMIN_ID
# After isolated validation and approval for the intended environment:
node scripts/migrate-admin-foundation.cjs --env-file=.env.local \
  --owner-id=EXISTING_FIRST_ADMIN_ID
```

It verifies the actual Neon target, uses a direct connection, saves a private
before-snapshot under ignored `tmp/admin-review`, and compares every table after
the migration, allowing only the selected user's role to differ. Apply once; do
not overwrite a prior backup to rerun it. Production has not received this migration.
Follow [Environments](environments.md) before any future production operation.

## Groups and imports

Each turma has a globally unique positive number, a course name and a start year.
Its display label is `Turma <number>`; archiving does not release the number.
The list provides separate `Gerenciar` and `Editar` actions with matching icons.
Creation and editing, student addition/management and the complete import flow
use right-side panels of the same width, fullscreen on mobile. Group-scoped panels
show the turma above their title, including import results. Group editing relies
on its number/course/year fields without a repeated turma label. Student management
instead leads with the person's name/email and an inline access badge and turma
list, wrapping on narrow screens. Archive/restore is
also available in the edit panel, with an explicit confirmation. It does not save
unfinished field edits; returning to editing preserves the draft. The direct
archive action on the group page retains its compact confirmation dialog.

`20261027_turma_details.sql` backfills only the number from existing turma labels.
Existing course names and start years remain unknown until an administrator enters
them; historical graduation years are preserved rather than relabeled as start
years. New saves require all three fields. The guarded
`scripts/migrate-turma-details.cjs --env-file=...` runner accepts development/test
targets, snapshots original rows privately and verifies preservation after applying
the migration once. It has been checked on an isolated copy and applied to
development; production is unchanged.

Archiving is organizational: students keep access and can publish in archived
turmas. Removing membership affects only that turma/user relationship; project
turma, authorship, likes and other memberships remain intact. There is no group
deletion action. Unactivated student registrations can be removed from Estudantes
under the safeguards described below.

Imports accept pasted spreadsheet TSV and UTF-8 CSV (comma or semicolon), with
`Nome` and `Email` columns, an optional header, and quoted fields. Limits are
500 students and 200 KB. Preview performs no writes. Invalid or duplicate rows
must be corrected or explicitly excluded before confirmation.

Input, preview and completion remain in the same panel without changing its width.
Returning from preview preserves the pasted text. Completion shows the counts of
new profiles, added memberships and existing memberships, with actions to import
another list or finish. Long emails and errors wrap within the preview table.

Confirmation reparses/revalidates the original input in a transaction. Existing
normalized emails reuse their permanent ID without changing name, password,
status or other memberships. New profiles are pending users without credentials.
Demo, suspended and administrative emails are rejected by import. Concurrent
imports serialize by email and rely on unique identity/membership constraints.

Individual addition retains `Novo cadastro` and `Perfil existente`. In the first
tab, email comes before name and is checked against registered profiles. A match
shows the existing name read-only and reuses that identity; changing email clears
the previous result. Already-member and ineligible accounts cannot be added.
Demo profiles are labeled `Perfil de exemplo`; this is separate from account
access status, and these profiles cannot sign in.

## Access links

Creating a new pending student keeps the panel open and automatically generates
an activation link. The administrator can copy the activation message, add another
student or finish. If grant creation fails, retrying generates only the link; it
does not recreate the student. Existing active profiles have no activation prompt.

The student management panel issues activation links for pending accounts and
password-definition links for active accounts. Demo and suspended accounts cannot
receive grants. Existing delivery-independent services remain authoritative.
Links are shown only immediately after creation; copying a message does not claim
that an email was sent. Reissuing invalidates the preceding grant of that purpose.
Copied messages include the actual expiration date/time in `America/Sao_Paulo`,
labeled as Brasília time. Copying again does not extend the grant.
No raw token is persisted in project documentation or delivery history.

## Global students

The list includes ordinary user profiles, even without a turma, and staff who
participate in at least one turma. Staff without memberships belong to the future
Administradores section. Search matches names/emails without accent sensitivity;
turma filters include archived groups and `Sem turma`. Demo profiles have their
own access filter and do not count as pending activation candidates.

The server returns one page of 25 students (50 optional), the filtered total and
only that page's memberships/latest link metadata. Search and turma/access filters
run in SQL before pagination; matching remains case/accent-insensitive and treats
search punctuation literally. Stable name/ID ordering prevents duplicate rows
across pages, including people enrolled in multiple turmas. The URL retains query,
filters, page and page size; changing filters/size returns to page one. Out-of-range
pages redirect to the last available page, including after a deletion.

Registration and import reuse the Turmas panels with an explicit target-turma
selector. Global registration searches existing profiles separately on the server
(up to 25 per search), independent of the visible table page. Existing identities
are retained, and new accounts remain pending.
Account role, email verification and activation state are never client-assigned.
The global management panel allows name corrections for eligible student profiles.
Email changes are limited to real pending, unverified accounts, normalize the new
address and reject duplicates. Changing email revokes outstanding access links;
the administrator must create a new activation link. Name-only corrections retain
valid links. Activated accounts keep their email read-only. Students retain the
existing profile editor for their personal information.

Membership changes are applied together, including adding archived turmas or
removing the last membership. They never change publication turma, author links,
likes, profile or credentials. An unassigned active user keeps sign-in access but
cannot publish a new project until assigned a turma.
Current memberships appear first in the selection panel; toggling a checkbox does
not reorder the draft list. Registration/import selectors prioritize recent active
turmas while keeping archived groups available.

Suspension/restoration has an explicit confirmation. Suspension blocks sign-in,
removes sessions and revokes outstanding activation/recovery grants, retaining
all profile, credential and project data. Restore derives `active` versus
`pending` from the account's preserved email-verification state; it never activates
an unverified student. Earlier cookies and grants are not revived. Account access
does not automatically moderate published projects.

`Excluir cadastro` removes only real pending, unverified student registrations,
with an explicit confirmation naming the person and email. Memberships and their
activation invitations are removed atomically. Internal checks refuse deletion
when credentials, sessions, project authorship or other protected history exists.
Active, suspended, demo and staff accounts cannot be deleted through this action.
The same user-row lock serializes deletion/email corrections with activation, so
an account activated in another window cannot be deleted or have its email changed
using stale panel state.

Unactivated real profiles stay out of public person/community pages, including
when suspended before activation. Activated profiles remain visible after
suspension, and demonstration profiles remain available as gallery content.
New coauthors must be active, verified non-demo participants of the project turma.

The panel shows only metadata for the latest applicable access link: valid,
expired, used or revoked. Administrators can generate/reissue or revoke it.
The manual-delivery UI offers individual links through `Gerenciar`; it has no
`Preparar convites` button or bulk-selection panel. The existing atomic batch-grant
service remains available as a foundation for future automated delivery. The
application currently neither sends email nor records a fictional delivery status.
Raw URLs exist only in the immediate result.

No additional database migration is needed for Estudantes. It uses the reviewed
owner/turma schema already present in development and the isolated test branch.

## Checks

```sh
node --import tsx --test tests/student-import.test.ts tests/database-target.test.ts
npm run test:admin
```

The integration suite requires an ignored `.env.admin-test` on an isolated
`test/*` branch containing the current schema and an owner. It verifies the actual
Neon target before writing and deletes only its own fixtures. It also compares
all original rows after cleanup. It cannot run against production or development.

Browser validation uses disposable development fixtures and covers access control,
creation/editing/archive, individual addition, import preview/confirmation and
activation-link creation at desktop/mobile widths. It does not verify real email
delivery or new Google configuration.

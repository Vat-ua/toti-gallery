# Administration

`/admin/turmas` provides group
creation/editing, archive/restore, student membership and import preview.
`/admin/estudantes` provides the global student list, multi-turma management,
student access controls and activation/recovery links. `/admin/projetos` provides
project review and visibility moderation, also available within each turma.
`/admin/administradores` provides owner-only staff management and access links.

## Permissions

- Active non-demo `admin` and `owner` accounts manage turmas and students.
- Only `owner` may manage another staff account. Regular administrators cannot
  alter owner/admin memberships or issue access links for them.
- Public profiles never acquire staff rights from a turma or an import.
- At most one `owner` is enforced by a partial unique index. Bootstrap creates
  the first owner; existing staff are managed by that owner.
- Role/status checks run on the server for page reads and inside every mutation
  service. Mutating HTTP endpoints also require the configured trusted origin.
- Student suspension applies only to real accounts with the `user` role. Staff
  accounts and demo profiles cannot be suspended from Estudantes.
- Only the owner may create an administrator, promote an eligible existing user,
  or remove administrator rights. The owner account is protected from these actions.
- Ownership transfer and general account deletion are not exposed.

This guide describes application behavior, not a particular deployment's state.
For bootstrap see [Authentication](authentication.md#first-administrator); for
existing-schema upgrades see [Migrations](../migrations/README.md).

## Groups and imports

Each turma has a globally unique positive number, a course name and a start year.
Its display label is `Turma <number>`; archiving does not release the number.
The list separates `Gerenciar` from `Editar`. Forms and import use right-side
modal panels, fullscreen on mobile. Archive/restore requires confirmation and
does not save unfinished field edits. Legacy records may lack course/start-year
values; new saves require all three fields. Historical graduation year is not
relabeled as start year.

Archiving is organizational: students keep access and can publish in archived
turmas. Removing membership affects only that turma/user relationship; project
turma, authorship, likes and other memberships remain intact. There is no group
deletion action. Unactivated student registrations can be removed from Estudantes
under the safeguards described below.

Imports accept pasted spreadsheet TSV and UTF-8 CSV (comma or semicolon), with
`Nome` and `Email` columns, an optional header, and quoted fields. Limits are
500 students and 200 KB. Preview performs no writes. Invalid or duplicate rows
must be corrected or explicitly excluded before confirmation.

Input, preview and completion stay in the same panel. Returning from preview
preserves input; completion distinguishes new profiles, added memberships and
already-existing memberships.

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
participate in at least one turma. Staff without memberships belong to the
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
The panel lists current memberships with remove actions, a searchable add control
and a primary-turma choice when applicable. Registration/import selectors
prioritize recent active turmas while keeping archived groups available.

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

## Project moderation

The global list and a turma's `Projetos` tab share gallery cards, project/author
search and publication filters. The global view also filters by turma, including
archived groups. Filtering and stable creation-date/ID ordering run in SQL before
incremental loading (using the shared batch size, then `Mostrar mais projetos`). Previously
loaded cards remain visible, and filtering always searches the full database.
Filters and the number of loaded batches remain in the URL when returning from
review. Author matching includes coauthors without duplicate publications.
Actions are `Visualizar`, `Ocultar` and `Restaurar`; restoration shows the hiding
reason read-only before confirmation. Students retain separate table pagination.

Active administrators and the owner can hide a project with a required reason
(up to 1,000 characters), or restore it after confirmation. Both operations check
staff access inside the transaction and lock the project row. Stale actions return
409 when the expected visibility no longer matches. Moderation changes only
visibility, reason and the latest moderator/time; it retains publication ownership,
content, authors and likes. Restoration clears the reason but retains the latest
moderator/time. This is latest-action metadata, not an audit history.

Hidden projects disappear from the public gallery, profiles, related projects and
public detail URLs. Authors retain them in `Meus projetos`, with a private preview;
only the publication owner sees the reason and can edit or delete the publication.
Coauthors retain their existing leave action. Owner edits do not restore visibility.
The administration has a private review page with reason and latest-action metadata.
Private previews show a read-only like count. Public liking resumes after restoration.
Staff receive no general content-edit or permanent-deletion rights.

## Administrators

Only the active, non-demo owner can open the Administradores section, search
candidate profiles, or use its mutation services. Regular administrators do not
see this navigation entry and cannot use its API. Authorization is checked again
inside each database transaction; hiding controls is not an access boundary.

The list shows the owner first, followed by administrators, with their name,
email, permission and access status. Name/email search filters this small staff
list. The owner's row is read-only and labeled `Conta protegida`; profile and
password editing remain available through the existing personal editor.

`Adicionar administrador` uses the shared right-side panel with `Perfil existente`
and `Novo cadastro`. Existing-profile search queries the full database and returns
up to 25 eligible matches: real ordinary users who are active/verified or still
pending/unverified. Demo, suspended, and already administrative profiles are
excluded. Selecting a person and confirming `Conceder acesso` changes that same
user's role without changing their name, email, credentials, memberships, projects,
or author credits. A turma is not required for administrative access.

New registration requires name and email and creates a pending administrator
without credentials or memberships. Duplicate emails are rejected with guidance
to use the existing-profile tab; registration never silently promotes a match.
Provisioning and grant issuance are atomic. New accounts and promoted pending
profiles immediately display a copyable activation link in the same panel.
The existing Google or password activation flow retains the same person ID.

`Gerenciar` supports activation links for pending administrators and password
definition/recovery links for active ones. Latest grant metadata, reissue, and
revocation use the existing single-use grant model. Raw links appear only in the
immediate response; delivery is manual. The owner cannot be targeted through
these staff-management actions.

Removing administrator rights requires explicit confirmation and changes the
role back to `user`; it does not delete, suspend, or reactivate the account.
Profile, credentials, turmas, publications, credits, likes, and prior moderation
references remain. Both promotion and removal end the target's sessions and
revoke outstanding access links, so earlier student recovery links cannot gain
administrative access after promotion. A pending promotion issues a fresh
owner-created activation grant. The affected person must sign in again; a pending
account still needs activation. Concurrent role changes and link operations
serialize on the target user row and reject stale actions.

## Public profiles and primary turma

In Estudantes → Gerenciar → Turmas, people with several selected memberships
have a **Turma principal** selector. Choose a membership explicitly or leave
**Automática** to display the highest-numbered group, including archived groups.
Removing a chosen membership restores automatic selection. This affects public
presentation only: other memberships, publication eligibility and author credits
are retained. The community filter considers all memberships.

Profiles show the primary turma's number, course and start year. Public addresses
use a unique slug generated at creation; editing a name preserves the address.
Existing internal-ID URLs are not supported. Schema history and upgrade
prerequisites are documented in [Migrations](../migrations/README.md).

## Checks

See [Testing](testing.md#database-integration-suites) for `test:admin`, fixture
requirements and the distinction between CI and separately run suites.
Administrative tests cover permissions, imports, grants, memberships, moderation
and role changes. [Admin operations](admin-operations.md) describes transactional
guarantees. Neither local tests nor public screenshots establish that a new
deployment's authenticated admin routes work; check them after release.

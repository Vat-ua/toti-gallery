# User stories

A user story explains **who wants to do something and why**. These tables are
an overview of Toti Gallery's features, grouped by activity.

**Implemented** means the feature exists in the current code, including changes
still being reviewed locally. It does not necessarily mean it is live on Vercel.
**Planned** means it is intended for a later step.

## Exploring the gallery

| Who | Wants to | So they can | Status |
| --- | --- | --- | --- |
| Visitor | Browse projects and load more | Discover what other people are building | Implemented |
| Visitor | Search and filter by turma, technology, final projects, or highlights | Find relevant examples | Implemented |
| Visitor | Sort projects and share a filtered URL | Return to or share the same selection | Implemented |
| Visitor | Open a project and its code or live site | Understand the work and try it | Implemented |
| Visitor | Like a project without signing in | Show appreciation | Implemented |
| Visitor | Search community members and filter by turma | Find people from a course group | Implemented |
| Visitor | Open someone's profile | Explore their individual and group projects | Implemented |
| Visitor | Use the site on mobile or desktop and choose a theme | Browse comfortably | Implemented |

## Signing in and maintaining a profile

Accounts are added by the administration; there is no open registration.
Google and email/password can access the same profile.

| Who | Wants to | So they can | Status |
| --- | --- | --- | --- |
| Invited student | Activate their account through a link and create a password | Start using the platform | Implemented |
| Approved student | Sign in or activate with Google | Enter without creating a separate password | Implemented |
| User | Sign in with email and password, and sign out | Access their account without relying on Google | Implemented |
| User | Edit their name, bio, GitHub link, and photo | Keep their profile up to date | Implemented |
| User with a password | Change their password using the current one | Maintain account security | Implemented |
| Active user | Set or reset a password through a link provided by an administrator | Recover access or add password sign-in | Implemented |

## Publishing and working together

The publication owner is the person who manages the project. Coauthors receive
credit and see the project in their profiles, but cannot edit or delete it.

| Who | Wants to | So they can | Status |
| --- | --- | --- | --- |
| Student in a turma | Publish a project with a description, code link, and cover | Share their work | Implemented |
| Publication owner | Mark a project as a final course project | Make it recognizable and easy to find | Implemented |
| Publication owner | Add coauthors from the project's turma | Credit the team without duplicate publications | Implemented |
| Participant | See owned and coauthored work in Meus projetos | Find all their contributions together | Implemented |
| Publication owner | Edit project information and coauthors | Keep the publication accurate | Implemented |
| Publication owner | Delete their publication after confirmation | Remove a project they no longer want to publish | Implemented |
| Coauthor | Leave a project | Remove their credit without deleting anyone else's work | Implemented |
| Author of a hidden project | Open its private preview | Retain access to work that is no longer public | Implemented |

## Managing turmas and students

An administrator manages course groups, students, and access. The owner has
these permissions too.

| Who | Wants to | So they can | Status |
| --- | --- | --- | --- |
| Administrator | Create and edit a turma's number, course, and start year | Organize course groups | Implemented |
| Administrator | Archive or restore a turma | Organize past groups while keeping their projects and access | Implemented |
| Administrator | Register a student or add an existing profile to a turma | Give approved people access without duplicate accounts | Implemented |
| Administrator | Preview and import a spreadsheet or CSV list | Add many students without entering each one manually | Implemented |
| Administrator | Add or remove a person's turma memberships | Support several courses without creating another profile | Implemented |
| Administrator | Search, filter, and page through the student list | Find people in a growing roster | Implemented |
| Administrator | Correct names and eligible unactivated email addresses | Fix registration mistakes | Implemented |
| Administrator | Create, copy, reissue, or revoke individual access links | Help students activate or recover access | Implemented |
| Administrator | Suspend or restore a student's access | Control access while preserving their work | Implemented |
| Administrator | Delete an eligible registration that was never activated | Remove an accidental or test registration | Implemented |
| Administrator | Have staff accounts protected from ordinary student-management actions | Avoid changing another administrator's access by mistake | Implemented |

## Moderating projects

| Who | Wants to | So they can | Status |
| --- | --- | --- | --- |
| Administrator | Search and filter projects globally or within a turma | Find publications that need review | Implemented |
| Administrator | Hide a project and record a reason | Remove it from public view without deleting it | Implemented |
| Administrator | Read the hiding reason and confirm restoration | Make an informed decision before showing it again | Implemented |
| Administrator | Moderate visibility without taking over the project | Preserve the authors' content and ownership | Implemented |

## Managing administrators

These actions are available only to the owner. The owner's account is protected
from role removal and ownership transfer is not part of this workflow.

| Who | Wants to | So they can | Status |
| --- | --- | --- | --- |
| Owner | See and search the list of administrators | Know who has staff access | Implemented |
| Owner | Grant or remove administrator access on an existing profile | Delegate management while preserving the person's work | Implemented |
| Owner | Register an administrator without assigning a turma | Add staff who do not participate in a course | Implemented |
| Owner | Create, reissue, or revoke staff access links | Help administrators activate or recover access | Implemented |

## Planned improvements

These are agreed directions, not a fixed implementation schedule.

| Who | Wants to | So they can | Status |
| --- | --- | --- | --- |
| Administrator | Automatically email invitations to selected students | Avoid copying and sending each link manually | Planned |
| User who forgot their password | Request a recovery email directly | Recover access without asking an administrator for a link | Planned |

## Where to find the details

For permissions and administrative rules, see [Administration](administration.md).
For sign-in, activation, and password recovery, see [Authentication](authentication.md).
For tables, fields, and relationships, see [Database](database.md).

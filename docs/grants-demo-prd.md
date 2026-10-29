# PRD: Grant Application and Award Demo

Version 0.3 — October 29, 2026. Demo requirements; government operating policies remain subject to discovery.

## Purpose

Demonstrate an admin publishing a grant, an applicant applying with qualifying documents, and an admin reviewing and awarding funding. Applicants and admins see consistent decisions and simulated distributions.

## Users and jobs to be done

| User | Job to be done |
| --- | --- |
| Applicant | When I need funding, I want to find open grants and understand their requirements so I can choose where to apply. |
| Applicant | When preparing an application, I want to request funding and upload evidence so I can submit a complete application. |
| Applicant | After applying, I want to track the decision, award, and distributed amount so I know where I stand. |
| Admin | When managing funding, I want to see all grants and filter to those I created or review so I can find the work I own. |
| Admin | When offering funding, I want to publish requirements, set and adjust a budget, and assign a reviewer so applications reach the right decision-maker. |
| Admin | When reviewing an application, I want to inspect documents and requested funding, then approve an award or reject it so each application receives a clear decision. |
| Admin | When tracking allocations, I want to distinguish committed funding from distributions so I can manage the remaining budget. |

A persistent banner provides Applicant/Admin mode and a named demo-user selector. Seed at least two admins and two applicants. Display “Demo mode — no authentication. Use sample data only.” Switching identity preserves data.

All admins can browse grant summaries. The creator and one assigned reviewer can inspect applications and decide awards. Only the creator edits grant details, budget, and reviewer assignment. Applicants see only their own application records. The role selector illustrates permissions; authentication and full account administration are out of scope.

## Core flow

1. Admin opens All Grants and selects Create grant. The form contains editable sample requirements and budget.
2. Admin reviews the prefilled content, assigns another admin if needed, and publishes. Applicant and funding activity start at zero.
3. Applicant browses open grants, reads requirements, and begins an application with name, email, requested funding, and qualifying documents.
4. Applicant submits a complete application. Applicants cannot edit, withdraw, or resubmit after submission.
5. Admin filters All Grants to Created by me or Assigned to me, opens an unreviewed application, and reviews the latest submission and requested amount. Opening it does not mark it reviewed.
6. Creator or assigned reviewer approves with a confirmed award amount or rejects. The full award is committed; approval also records a simulated distribution of 25% of that applicant’s award.
7. Applicant sees the decision, requested amount, award, simulated distribution, and remaining award balance in My Applications. Decisions are final in the demo.

## Functional requirements

### Admin dashboard

- Default to All Grants. Provide All Grants, Created by me, and Assigned to me filters.
- Each grant shows title, status, applicant count, unreviewed count, budget, committed awards, and simulated distributions.
- Provide Create grant and an unreviewed queue for grants the active admin may review.
- Applicant count includes Unreviewed, Approved, and Rejected applications. Show totals for the selected filter without double-counting grants.

empty state handling:

- No grants: “No grants yet. Create a grant to start accepting applications.” Action: Create grant.
- Created by me is empty: “You haven’t created any grants yet.” Action: Create grant.
- Assigned to me is empty: “No grants are assigned to you.” Action: View all grants.
- Unreviewed queue is empty: “You’re all caught up. No applications need your decision.”

### Grant creation and lifecycle

- Required fields: title, description, eligibility requirements, required document descriptions, and total funding budget in USD.
- States: Draft → Open → Closed. Draft is admin-only; Open accepts submissions; Closed prevents new submissions but permits decisions on existing ones. Reopening is out of scope.
- Creator can edit details, adjust budget, and assign one existing admin as grant-level reviewer.
- Budget cannot fall below committed awards.
- A configurable form or workflow builder is not required.
- Prefill new grants with the sample below. All fields remain editable; nothing is saved until Save draft or Publish.

#### Grant creation prefill

| Field | Prefilled content |
| --- | --- |
| Title | Neighborhood Community Project Grant |
| Description | Funding for community-led projects that improve shared spaces, expand access to local activities, or connect neighbors. Examples include community gardens, free workshops, and neighborhood events. |
| Total funding budget | $100,000 |
| Eligibility requirements | Applicants must be nonprofit organizations or community groups with a nonprofit fiscal sponsor. Projects must serve local residents, be open to the community, and be completed within 12 months of the award. Funding may cover project materials, equipment rental, venue costs, and direct program delivery. Political campaigns, religious worship, and personal expenses are not eligible. |
| Required document 1 | Project proposal: describe the community need, planned activities, intended participants, timeline, and expected results. |
| Required document 2 | Project budget: list planned expenses and explain how the requested funding will be used. |
| Required document 3 | Eligibility evidence: provide nonprofit registration or a letter confirming fiscal sponsorship. |
| Reviewer | Current admin; creator may assign another demo admin. |
| Status | Draft |

Display “Sample grant — edit before publishing” above the form. These are fictional demo requirements.

empty state handling:

- New grants have zero applicants, zero awards, and zero distributions.

### Applicant catalog and application

- List open grants with basic title search.
- Grant detail shows description, eligibility, document requirements and Apply. Do not show the total grant budget or aggregate allocations in applicant views.
- Form requires name, valid email, requested funding in USD, and qualifying document uploads for each listed requirement; associate the record with the selected demo applicant identity.
- Accept PDF/JPG/PNG, maximum 10 MB per file. Validate required fields and uploads before submission.
- A failed upload must not create an apparently complete submission.
- Maintain one application record per applicant per grant. Prevent duplicate submissions from repeated clicks.
- Show submission confirmation and View application when already submitted.
- Existing applicants can access closed grant details from their profile.
- Submission requires all fields, a positive requested amount, and required documents. Submitted applications are read-only for applicants.

empty state handling:

- No open grants: “No grants are open right now. Check back for new opportunities.”
- No search results: “No grants match your search. Try another keyword.” Action: Clear search.
- No documents: “No documents uploaded. Add the required files before submitting.” Action: Upload documents.

### Admin grant detail and decisions

- Show total budget, available to award, committed awards, simulated distributions, and committed but undistributed balance.
- Show all applications, filterable by Unreviewed, Approved, and Rejected. Include applicant, submission date, status, requested amount, award, and simulated distribution.
- Application detail shows submitted information and documents, reviewer assignment, and a manual checklist reflecting grant requirements.
- Use Approve application and Reject application, rather than Yes/No.
- Prefill the approval amount from the applicant’s request. Admin may adjust it up to the requested amount. Approval requires a positive award amount within remaining available funding. Confirmation shows award amount and simulated initial 25% distribution.
- Rejection records the decision without creating an award or distribution.
- Record deciding admin and timestamp; allow an optional internal note hidden from applicants.
- Opening, assigning, or assessing an application leaves it Unreviewed until a final decision.
- Assignment applies to the entire grant and its unreviewed applications; it does not reopen decisions.
- Decisions are final in the demo. Repeated approval attempts must not create duplicate awards or distributions. Check funding again when saving a decision.

empty state handling:

- No applications: “No applications yet. Submitted applications will appear here.”
- No applications in a status filter: “No applications match this status.” Action: Clear filter.
- No awards: “No awards yet. Approve an application to allocate funding.”

### Applicant profile

- My Applications shows the selected applicant's submissions, grant titles, submission dates, and statuses.
- Unreviewed is displayed as “Submitted — awaiting decision”; rejected as “Not awarded.”
- Approved applications show award amount, simulated distributed amount, and remaining award balance.
- Show requested funding on each application detail.
- Detail includes submitted documents and grant information. Never expose other applicants' records.

empty state handling:

- No applications: “You haven’t submitted any applications yet. Explore open grants to get started.” Action: Browse grants.
- No awarded grants: “No grants awarded yet. Your award details will appear here after approval.”

## States

| Entity | Definition |
| --- | --- |
| Application | Unreviewed → Approved OR Rejected |
| Assignment | Separate from application status; one reviewer per grant |
| Award | Created exactly once on approval |
| Simulated distribution | Created exactly once on approval; later installments out of scope |

## Financial rules

| Label | Definition |
| --- | --- |
| Total funding budget | Maximum funding available across all applicants |
| Award amount | Amount committed to one approved applicant |
| Total awarded / committed | Sum of approved applicant awards |
| Available to award | Total budget minus total committed |
| Simulated distributed | Sum of simulated distributions; no actual money transfer |
| Committed but undistributed | Total committed minus simulated distributed |

Initial distribution is 25% of each applicant's award, rounded to cents, not 25% of the entire grant budget. Distribution does not reduce available funding a second time. Avoid “spent”: recipient expense tracking is outside this demo.

Example: $100,000 grant budget; $20,000 applicant award; $80,000 available to award; $5,000 simulated distributed; $15,000 committed but undistributed. Applicant sees $20,000 awarded, $5,000 distributed (simulated), and $15,000 remaining.

Reject negative budgets, zero/negative requests or awards, awards above the requested amount, and awards exceeding available funding. Requested funding does not reserve budget. At zero available funding, disable Apply with “Fully allocated”; existing unreviewed applications still need decisions.

## Data and demo behavior

Records: demo users, grants, applications, uploaded documents, awards, and simulated distributions. Link creator/reviewer to grant, applicant to application, documents to application, and distribution to award. Store requested amount, submission timestamp and decision actor/time. Derive financial totals from records rather than editing totals independently.

Persist submitted applications, uploaded documents, assignments, decisions, and totals across mode switches and refreshes. Storage implementation is an engineering decision.

Seed synthetic users and grants, including unreviewed, approved, and rejected applications. A Reset demo action requires confirmation and restores the baseline. Use sample information only.

## Acceptance criteria

1. Publishing a new grant shows zero applicants and financial activity and makes it discoverable.
2. Valid submission makes one application visible in applicant and admin views and increments counts once.
3. Invalid fields/uploads show actionable errors without creating a completed submission.
4. Assigned second admin can find the grant and decide applications.
5. Opening an application does not change its status.
6. Approval creates one award and one simulated 25% distribution, with matching totals across views.
7. Rejection reduces unreviewed count without changing funding totals.
8. Over-budget awards and budget reductions below commitments are blocked.
9. Switching applicants changes personal records displayed.
10. Refresh preserves changes; confirmed reset restores sample data.
11. All Grants is the default admin view; ownership and assignment filters show the correct subsets.
12. Applicant views hide the total grant budget and capture requested funding.
13. Grant creation opens with editable sample content and saves only on explicit action.
14. Empty lists and filters show the specified messages and relevant actions.

## Out of scope

- Applicant draft saving, edits after submission, withdrawal, and resubmission.

- Real payments, bank information, later installments, reconciliation, and payment integrations.
- Production authentication, SSO, account provisioning, security enforcement, and nonfunctional acceptance requirements.
- Deadline badges, notifications, calendar integrations, and automated reminders.
- Reviewer panels, scoring, appeals, admin requests for applicant revisions, and less-permissioned admin roles.
- Workflow/form builders, collaborative editing, and document version history.
- Government funding discovery, agreements, amendments, reimbursements, match tracking, and closeout.
- Compliance automation, required performance reports, customized reporting, exports, and external integrations.

Dashboard counts and funding totals are basic reporting only. Eligibility text and a manual checklist do not constitute regulatory compliance monitoring. These are explicit reductions from the original seven functional areas.

## Government discovery and attachment coverage

Source: GovTribe's extracted Attachment 1 — GMS Requirements spreadsheet: https://govtribe.com/file/government-file/attachment-1-gms-requirements-dot-xlsx

| Area | Attachment establishes | Discovery still needed |
| --- | --- | --- |
| Review process | #107 requires assignment/feedback tracking; optional #401–417 cover panels, scoring, decisions, approvals, appeals | Exact states, transitions, separation of review and approval, escalation and authority |
| Reporting | #513, #601–609, #901–902 describe due reports, financial/performance/risk summaries, match tracking, FFR generation and customizable reporting | Templates, deadlines, recipients, calculations and applicability to this workflow |
| Roles | #1106/#1108 require groups, privileges and role-based access; #707 includes auditor access | Permission matrix for creator, reviewer, approver, finance and auditor |
| Compliance | #511–512 require embedded controls/risk assessment; #616 covers document revisions | Specific rules, required evidence, thresholds, consequences and policy owners |

The attachment defines capability categories but does not settle local operating policy. Validate the official attachment before procurement use.


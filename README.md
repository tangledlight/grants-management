# Civic Grants

A working grant application and award demo built for a Concourse forward deployed product management assessment. It follows one connected workflow: an administrator publishes funding, an applicant submits evidence, and a reviewer makes a decision with consistent funding totals across both views.

**[Open the public demo](https://grants-management.vercel.app)** — no login required.

## Start here

- [Product requirements](docs/grants-demo-prd.md): users, scope, behavior, financial rules, and acceptance criteria.
- [Technical design and architecture diagrams](docs/grants-demo-technical-design.md): the original design proposal.
- [Implementation notes](docs/implementation.md): the deployed architecture, verification evidence, and remaining limits.
- [Sample applicant documents](supabase/fixtures/): fictional proposal, budget, and eligibility evidence for the upload flow.
- [Development reference](docs/development.md): local setup, API contracts, and testing.

## What to review

The demo makes a deliberately narrow set of grant workflows concrete. It includes persistent records and files, creator/reviewer permissions, evidence review, final decisions, and transactional budget checks. It does not move real money or authenticate real people.

A demo was chosen over a production-ready system because customer discovery still needs to establish operating policies: approval authority, review stages, reporting obligations, compliance controls, and actual user roles. Those decisions would materially affect production requirements. Production hardening and nonfunctional acceptance work are outside this assessment; the demo focuses on showing how the selected RFP capabilities become a coherent product.

## Suggested walkthrough

1. **Admin — Alex Morgan:** explore All Grants and ownership filters, then create a grant. Review the editable prefill, assign Jordan Lee, and publish. Its applicant count and financial activity begin at zero.
2. **Applicant — Sam Rivera or Taylor Chen:** find the new grant, request funding, and upload the three sample documents. Submit once, then open My Applications.
3. **Admin — Jordan Lee:** find the grant under Assigned to me or Review queue. Inspect the evidence, use the manual checklist, and approve a full or partial award, or reject the application.
4. **Applicant:** revisit the application. The requested amount, decision, award, simulated distribution, and remaining award balance should agree with the admin view.
5. **Admin:** inspect the funding totals or reset the shared dataset after the walkthrough. Reset requires confirmation and affects every visitor.

The baseline also contains Unreviewed, Approved, and Rejected applications, plus open, closed, and draft grants, so the main states can be inspected without first creating every record.

## Financial example

For a $100,000 grant and a $20,000 award:

| Metric | Amount |
| --- | ---: |
| Committed award | $20,000 |
| Available to award | $80,000 |
| Initial distribution — simulated | $5,000 |
| Committed but undistributed | $15,000 |

The whole award is committed at approval. The simulated distribution is 25% of that applicant’s award and does not reduce available funding a second time. Requests do not reserve funding; the database checks the current budget when a decision is saved.

## Verification

Five unit tests, full TypeScript checking, the production build, and the live API integration suite passed. Public browser checks covered desktop/mobile layouts, review confirmation, applicant privacy, document downloads and reload behavior, with zero API mutations. [Implementation notes](docs/implementation.md) record the architecture and exact verification scope.

## Boundaries

Use sample data only. The role and named-user selectors illustrate permissions; anyone with demo access can switch identities. Applications are final after submission, and decisions are final after review. Later payments, applicant drafts/revisions, production authentication, workflow builders, and compliance automation are outside scope. Full details are in the PRD.

# Current Objective — Project Check (`markleedr/project-check`)
Locked: 2026-09-19

## Objective

Implement the busy-manager UX audit in full: a four-step check (development → people files → spend → optional ads → review), outcome + export copy on each upload, compact column mapping, Excel accepted, spend double-count blocked, same development reused, report leads with actions then funnel then next dollar then the five questions.

## Done when

- [ ] New check is a short wizard, not one long page of equal-weight uploads
- [ ] Each upload states what you get, how to get the file, and what you lose if you skip
- [ ] Column mapping shows only the columns that matter unless they open the full list
- [ ] Excel (.xlsx) uploads work; CSV still works
- [ ] Unified spend plus platform spend cannot be submitted together
- [ ] A second check on the same development name stays on that project
- [ ] On-screen report and print PDF share the same order: actions, funnel, next dollar, questions, needs testing
- [ ] Tests and production build pass

## Explicitly out of scope

- Live Meta/Google/CRM connections
- Rich personas beyond basic CRM columns
- Dashboard they live in all week (PDF is v1)
- AppSwitcher URLs on the other eight products

## Environment note

No staging — one Supabase project, one branch. A push to `main` deploys the live site.

# Current Objective — Project Check (`markleedr/project-check`)
Locked: 2026-09-19

## Objective

Fix the RVLV live check: pipeline stages (site tour / EOI / contract / Settled) must drive the funnel, DATE and extra source columns on the leads file must map, Ads Manager total rows must be skipped, Meta spend must show against Facebook/social sources, and `google_search` in a postcode column must not be treated as a postcode.

## Done when

- [ ] Asana-style `Pipeline actions` maps to status, not Mailchimp Status
- [ ] `site tour` counts as a site visit, EOI stages as EOI, `Settled` / `contract signed` as a contract; `contract crashed` does not
- [ ] Leads `DATE` maps as enquiry date; `medium`, `campaign` and `Source alt` map
- [ ] Buyer `Email` wins over `Assignee Email`
- [ ] Meta campaign export total row is not added twice
- [ ] Meta spend appears on Facebook/social channels; Google spend still appears on Google/search
- [ ] Non-numeric postcodes are ignored
- [ ] Tests cover the cases above; production build passes

## Explicitly out of scope

- Live Meta/Google/CRM connections
- Parsing EOI/contract out of Asana subtask *names* when the parent has no pipeline stage
- Dashboard / CRM sync

## Environment note

No staging — a push to `main` deploys live.

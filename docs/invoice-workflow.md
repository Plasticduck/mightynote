# Invoice Approval — workflow & setup

End-to-end flow for the Invoice Approval app.

## The lifecycle (and the dashboard tabs)

```
 (email-in or manual submit)
        │
        ▼
   UNASSIGNED ──Accounting assigns site(s)+approver(s)──▶ QUEUE
                                                            │ Accounting "Submit Queue"
                                                            │ (emails each approver a summary)
                                                            ▼
                                                        ASSIGNED ──approver approves──▶ APPROVED
                                                            │                              │
                                                  approver denies                Accounting "Export to
                                                            │                    QuickBooks CSV" (AI-filled)
                                                            ▼                              ▼
                                                   NEEDS ATTENTION                     EXPORTED
                                                            │
                                          Accounting re-queues or cancels
```

- **Cancel** (Accounting/Admin only) moves an invoice to **CANCELLED** from any
  state except Exported. **Restart** sends a cancelled invoice back to Unassigned.
- **Multiple sites and multiple approvers** per invoice are supported. Only **one**
  approver needs to approve, even if several were assigned.
- An approver **must open the invoice file** before the Approve/Deny buttons unlock
  — enforced on the server (`viewed_by`), not just in the UI.

## Roles (server-authoritative — see `netlify/functions/_lib-roles.js`)

- **Accounting** (Mikala Niemeyer, Rebecca Hipp, Elda Pineda, Heather Murry,
  Berhl Robertson, Rebecca Jowers) + **Admins** see every invoice and run the
  workflow (assign, submit queue, export, cancel).
- **Approvers** see only invoices assigned to them and approve/deny those.
- Everyone else sees only invoices they submitted.

## AI-powered QuickBooks export

Clicking **Export to QuickBooks CSV** on the Approved tab:
1. Reads each approved invoice's attached PDF/image and asks Claude to extract the
   QuickBooks bill fields (vendor address, dates, terms, etc.) — cached per invoice.
2. Builds the QuickBooks Desktop bill-import CSV (one expense line per site; multi-site
   invoices split the amount evenly across QuickBooks Classes).
3. Records the export as a **batch** (the CSV is stored) and moves the invoices to
   **Exported**.

Re-downloading a batch from the Exported tab shows a **duplicate-import warning** —
re-importing the same file into QuickBooks would create duplicate bills.

### Required env var for AI extraction

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Anthropic API key (Console → API keys) |
| `ANTHROPIC_MODEL` | *(optional)* model id; defaults to `claude-opus-4-8` |

If `ANTHROPIC_API_KEY` is **not** set, export still works — it falls back to the
fields already in the database (vendor, amount, date, site) and leaves the
AI-only columns (address, terms, etc.) blank.

## All invoice endpoints require sign-in

Every `/.netlify/functions/invoices-*` endpoint requires a valid session token and
enforces the role rules above on the server (see [auth-security.md](auth-security.md)).
`AUTH_SECRET` must be set or no one can sign in.

## Email

Approver queue-summary emails and submitter decision emails go out via **Resend**
(`RESEND_API_KEY`, `INVOICE_FROM_EMAIL`). Emails are best-effort — a mail failure
never blocks the workflow action.

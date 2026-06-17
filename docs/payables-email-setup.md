# payables@washlyfe.com → Invoice Approval Inbox

Forward (or have vendors send) invoices to **payables@washlyfe.com**; each PDF/image
attachment is imported into MightyOps as an **Unassigned** invoice. Accounting/Admin users
open the **Inbox** tab on the Invoice Approval dashboard, fill in the details, and assign it
to an approver (who then gets the normal approval email).

There are two ways to feed mail in. **Use Path A** — it's free and keeps your Microsoft 365
email exactly as-is.

---

## Path A (recommended): free M365 shared mailbox + scheduled poller

washlyfe.com email runs on **Microsoft 365** (MX → `*.mail.protection.outlook.com`). This path
adds a **free shared mailbox** and a scheduled Netlify function that reads it via Microsoft Graph.
Nothing about your existing mail flow changes.

```
sender → payables@washlyfe.com (free M365 shared mailbox)
   → poll-payables-mailbox.js  (Netlify scheduled fn, every 5 min, Graph app-only)
   → invoices  (status='Unassigned')  → dashboard Inbox → Assign → Pending + approver emailed
```

### 1. Create the shared mailbox (free — no license)
**Microsoft 365 admin center** (admin.microsoft.com) → **Teams & groups → Shared mailboxes → Add a
shared mailbox**:
- Name: `Payables`  ·  Email: `payables@washlyfe.com` → **Save**.

Shared mailboxes are free (up to 50 GB) and coexist with all your normal mailboxes.

### 2. Register an Azure app for Graph access (free)
**Microsoft Entra admin center** (entra.microsoft.com) → **Identity → Applications → App
registrations → New registration**:
- Name: `MightyOps Payables Poller`  ·  Supported accounts: *this org only* → **Register**.
- On the Overview page, copy **Application (client) ID** and **Directory (tenant) ID**.
- **Certificates & secrets → New client secret** → copy the **Value** (shown once). Set expiry to
  24 months and put a reminder to rotate it before then.
- **API permissions → Add a permission → Microsoft Graph → Application permissions →** check
  **`Mail.ReadWrite`** → **Add**. Then click **Grant admin consent for <org>** (needs a Global Admin).
  - *(`Mail.Read` would be enough to read, but the poller also marks messages read so it doesn't
    re-import them — that needs `Mail.ReadWrite`.)*

> **Least-privilege (recommended):** by default the app can read *every* mailbox. Restrict it to
> only the payables mailbox with an **Application Access Policy** (Exchange Online PowerShell):
> ```powershell
> # one-time: put the shared mailbox in a mail-enabled security group, then:
> New-ApplicationAccessPolicy -AppId <client-id> `
>   -PolicyScopeGroupId payables-access@washlyfe.com `
>   -AccessRight RestrictAccess -Description "MightyOps poller: payables only"
> ```

### 3. Set Netlify environment variables
Netlify site (mightyops) → **Site configuration → Environment variables** → add:
| Key | Value |
|-----|-------|
| `GRAPH_TENANT_ID` | Directory (tenant) ID from step 2 |
| `GRAPH_CLIENT_ID` | Application (client) ID from step 2 |
| `GRAPH_CLIENT_SECRET` | the secret **Value** from step 2 |
| `PAYABLES_MAILBOX` | `payables@washlyfe.com` |

(`NETLIFY_DATABASE_URL` is already set. `INBOUND_EMAIL_SECRET` is **not** needed for this path.)
Then **Deploys → Trigger deploy** so the schedule and env vars take effect.

### 4. Verify
- Netlify → **Functions → poll-payables-mailbox** → check the logs; it runs every 5 minutes
  (`*/5 * * * *`, configured in `netlify.toml`).
- Send a test invoice (with a PDF) to **payables@washlyfe.com**. Within ~5 minutes it should appear
  in **invoice-approvals-dashboard.html → Inbox** (visible to Accounting/Admin) with **View** + **Assign**.
- Locally you can force a run with: `netlify functions:invoke poll-payables-mailbox`.

**Notes**
- Only non-inline `application/pdf` and `image/*` attachments are imported (inline signature
  logos are ignored); one invoice row per attachment.
- Imports are idempotent on `(internetMessageId, file_name)`, and messages are marked read after
  processing — so nothing is imported twice.
- Per-attachment cap is ~20 MB.

---

## Path B (alternative, not set up): HTTP intake for instant delivery

The generic HTTP endpoint **`/api/invoices-inbound`** ([invoices-inbound.js](../netlify/functions/invoices-inbound.js))
is still available for any email parser that can POST to it — useful if you ever want **instant**
(non-polling) import. It expects a JSON body `{ from, subject, message_id, attachments:[{filename,
contentType, base64}] }` and an `X-Inbound-Secret` header matching an `INBOUND_EMAIL_SECRET` env var.

The classic way to feed it is a **Cloudflare Email Worker**, but that requires a **spare domain**
you can point at Cloudflare (its Email Routing takes over the whole domain's MX, so it **cannot** be
washlyfe.com without breaking your M365 mail). The prebuilt Worker was removed in favor of the free
M365 path above — ask and it can be re-added.

# Publishing SmartReply to Microsoft marketplace (AppSource / Microsoft 365)

SmartReply is an **Outlook add-in** (Office Web Add-in) backed by this Next.js app. Listing it in the store is a combination of **manifest quality**, **hosting**, **compliance**, and the **Partner Center** submission.

## Submission readiness checklist

Run these before uploading a package in Partner Center:

1. **Deploy production** — The origin in `public/manifest.xml` (e.g. `https://smartreply.space`) must match your live deployment. Load `/taskpane`, `/support`, `/privacy`, and `/terms` over HTTPS with no errors.
2. **Build the .zip** — Partner Center’s **Packages** step expects a **`.zip`** that contains Microsoft’s **unified manifest** (`manifest.json` at the archive root), not XML alone. Root `icons` in `manifest.json` must use **Teams store rules**: **`color`** = **192×192** full-color PNG (`assets/icon-color-192.png`); **`outline`** = **32×32** PNG with **only pure white (#FFFFFF) or full transparency** (no gray anti-alias — `assets/icon-outline-32.png`). Regenerate those from `public/logo.png` with `pnpm generate:store-icons`, then run `pnpm package:addin`. The zip is written to `dist/smartreply-outlook-addin.zip`. The XML manifest remains useful for sideloading; keep `public/manifest.json` in sync when you change `public/manifest.xml` (or re-run `npx office-addin-manifest-converter convert public/manifest.xml` and re-apply icon paths and fixes).
3. **Environment** — Set `OPENAI_API_KEY` (and `RESEND_*` for support) on the host so reviewers can generate a reply without ad-hoc keys, **or** provide a test API key and exact steps in **Notes for certification**.
4. **Partner Center alignment** — `DisplayName` / `ProviderName` in the manifest should match (or closely match) the offer name and publisher. Check the box for Microsoft Entra / SSO on Product setup only if your shipped experience actually uses it.
5. **Store listing assets** — Prepare screenshots (and optional video) that show the add-in in Outlook; listing icons are separate from manifest icons.
6. **Certification notes** — Include how to open the task pane, how to trigger AI generation, and any test account or key the reviewer must use. Reviewers cannot email you for missing credentials.

## Before you submit

1. **Stable HTTPS hosting** — Deploy the Next.js app (e.g. Vercel, Azure). Every `SourceLocation`, `IconUrl`, and `AppDomain` in the manifest must use your production origin (no `localhost`).
2. **Unique add-in id** — `public/manifest.xml` `<Id>` is the production identity (UUID v4). **Keep it unchanged** across updates after you publish; changing it registers a different add-in. Only generate a new Id for a brand-new listing.
3. **Icons** — Replace placeholder PNGs under `public/assets/` with branded **16, 32, 64, 80, and 128** px assets. Store listings require professional artwork.
4. **Support & privacy** — Set `<SupportUrl>` to a real help or contact page. Publish a **privacy policy** URL that explains what data is processed (email content is sent to your server and then to OpenAI for generation in the current architecture).
5. **Name & description** — `DisplayName` and `Description` should match the store listing and avoid claiming official Microsoft or OpenAI affiliation.

## Partner Center

1. Enroll in the [Microsoft Partner Network](https://partner.microsoft.com/) if you have not already.
2. In [Partner Center](https://partner.microsoft.com/dashboard), create an offer for an **Office Add-in** / Microsoft 365 solution (flow names change over time; search for “Office add-in” or “Teams and Microsoft 365”).
3. Provide the **package** as required: Microsoft 365 / Copilot store flows expect a **`.zip`** with **`manifest.json`** (unified manifest) and packaged icons — use `pnpm package:addin`. Also supply screenshots, description, pricing (free/paid), and certification questionnaires.

## Certification expectations

Reviewers typically check:

- **Clear purpose** — What the add-in does with mailbox data.
- **External services** — Disclosure that content is sent to OpenAI (or your AI backend) and under what user control.
- **Authentication** — Phase 1 uses user-supplied or server env API keys; long-term store listings usually expect proper user auth and data handling. Plan to move keys server-side with per-user consent.
- **Manifest validity** — Schema version, correct permissions (`ReadWriteMailbox` is powerful; justify it because the add-in reads thread context and inserts reply text).

## Microsoft Learn references

- [Publish Office Add-ins to Microsoft Marketplace](https://learn.microsoft.com/office/dev/add-ins/publish/publish-office-add-ins-to-appsource)
- [Outlook add-in overview](https://learn.microsoft.com/office/dev/add-ins/outlook/outlook-add-ins-overview)
- [Manifest requirements](https://learn.microsoft.com/office/dev/add-ins/develop/add-in-manifests)

## OpenAI / compliance note

Store review may ask how prompts are retained, logged, and whether users can opt out. Align your privacy policy and in-product copy with your actual logging and retention practices.

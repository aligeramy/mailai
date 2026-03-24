# Publishing MailAI to Microsoft marketplace (AppSource / Microsoft 365)

MailAI is an **Outlook add-in** (Office Web Add-in) backed by this Next.js app. Listing it in the store is a combination of **manifest quality**, **hosting**, **compliance**, and the **Partner Center** submission.

## Before you submit

1. **Stable HTTPS hosting** — Deploy the Next.js app (e.g. Vercel, Azure). Every `SourceLocation`, `IconUrl`, and `AppDomain` in the manifest must use your production origin (no `localhost`).
2. **Unique add-in id** — In `public/manifest.xml`, replace `<Id>...</Id>` with a **new GUID** that you own for the lifetime of the add-in. Do not reuse the sample id from development.
3. **Icons** — Replace placeholder PNGs under `public/assets/` with branded **16, 32, 64, 80, and 128** px assets. Store listings require professional artwork.
4. **Support & privacy** — Set `<SupportUrl>` to a real help or contact page. Publish a **privacy policy** URL that explains what data is processed (email content is sent to your server and then to OpenAI for generation in the current architecture).
5. **Name & description** — `DisplayName` and `Description` should match the store listing and avoid claiming official Microsoft or OpenAI affiliation.

## Partner Center

1. Enroll in the [Microsoft Partner Network](https://partner.microsoft.com/) if you have not already.
2. In [Partner Center](https://partner.microsoft.com/dashboard), create an offer for an **Office Add-in** / Microsoft 365 solution (flow names change over time; search for “Office add-in” or “Teams and Microsoft 365”).
3. Provide the **manifest** (XML) or package as required, screenshots, description, pricing (free/paid), and certification questionnaires.

## Certification expectations

Reviewers typically check:

- **Clear purpose** — What the add-in does with mailbox data.
- **External services** — Disclosure that content is sent to OpenAI (or your AI backend) and under what user control.
- **Authentication** — Phase 1 uses user-supplied or server env API keys; long-term store listings usually expect proper user auth and data handling. Plan to move keys server-side with per-user consent.
- **Manifest validity** — Schema version, correct permissions (`ReadWriteItem` is powerful; justify it because the add-in inserts reply text).

## Microsoft Learn references

- [Publish Office Add-ins to Microsoft Marketplace](https://learn.microsoft.com/office/dev/add-ins/publish/publish-office-add-ins-to-appsource)
- [Outlook add-in overview](https://learn.microsoft.com/office/dev/add-ins/outlook/outlook-add-ins-overview)
- [Manifest requirements](https://learn.microsoft.com/office/dev/add-ins/develop/add-in-manifests)

## OpenAI / compliance note

Store review may ask how prompts are retained, logged, and whether users can opt out. Align your privacy policy and in-product copy with your actual logging and retention practices.

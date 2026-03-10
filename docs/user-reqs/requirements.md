# TransferNow VMI App — User Requirements

Based on the VMI Online/Offline transcripts and prereqs data (Login_User, Customers, Locations, Inventory, OrderLine). UX requirements are updated for a **modern app**: the app detects connectivity and guides the user instead of relying on a manual online/offline toggle.

---

## 1. High-level user requirements (who does what)

### What vendors / field users do (TSRs, VMI coordinators)

- **Log in** with a user ID and password (default 123456; option to change password).
- **Connection state**: The app **tells** the user if they’re online or offline (no manual toggle). User always sees current status (e.g. “Online” / “Offline” or a clear indicator) and the app enables or disables actions accordingly.
- **Online flow**: Select customer → select ship-to → view inventory (live) → search/scan items (CPN or CB part number) → add to cart → review → place order (normal or urgent) → “order placed, email sent” and later NetSuite QU email.
- **Offline flow** (app detects no/low connectivity and shows “Offline”):
  1. **While online (office/home):** User can **download** a customer + one or more ship-tos for use offline (e.g. “Download for offline” or proactive “Download this location before you go?”).
  2. **On site (no internet):** App shows “Offline”; user sees only downloaded locations and can place orders that are **saved locally** (repeat per ship-to). No need to “choose offline mode”—the app already knows.
  3. **Back online:** App **automatically** detects connectivity and **auto-syncs**: it notifies the user (e.g. “You’re back online — 3 orders ready to send”) and can auto-open the pending-orders screen so the user doesn’t have to hunt for it. User **reviews** and **edits** each saved order, then **sends** (or, if enabled in settings, orders can **auto-send** without review). “Order placed, email sent” per ship-to; then NetSuite QU as in online.
- **Search** by CPN or CB part number; **scan** barcode (camera) to fill CPN and find item.
- **Cart**: Add items with quantity; review and delete in cart; then review final order and place (online) or save (offline). Modern UX can simplify “order quantity” (e.g. tap to add to cart with default qty, or single clear action per line).

### What the app must do for users

- Enforce **role/location access**: show only customers (and thus locations/inventory) the user is allowed to see (e.g. by Account Number / region), per `Login_User.csv`.
- **Detect connectivity** and show the user their status (online/offline); enable or disable actions based on that (no manual online/offline switch).
- **Online**: Load customers, locations, and inventory from backend; place orders and send email; integrate with NetSuite for quote (QU) creation.
- **Offline**: Let users pre-download one customer + multiple ship-tos; support full scan/order flow without network; store orders locally. When back online: app **auto-syncs**—automatically detects connectivity, notifies the user, and can open the pending-orders screen; user can **review** and **edit** then send (default), or optionally **auto-send** saved orders without review if enabled in settings.
- Send **order confirmation emails** (e.g. “VMI order – customer number, ship-to, customer name”) with order details (date, time, quantity, bin location, CB part number, who placed it).
- Work on **mobile** (phone) for scanning and on-site use.

---

## 2. Technical requirements (how the app should be built)

### Platform & stack

- **Expo** (React Native) for a single codebase targeting iOS and Android, with optional web if needed.
- **Mobile-first**: camera/barcode scanning, touch-friendly UI, works on phone in the field.

### Data & backend

- **Users**: User ID, Name, Email, and **Account Number(s)** (one row per user–account pair in `Login_User.csv`). Filter customers/locations by these accounts.
- **Customers**: From `Tofino_Customers.csv` (Customer Name, Account, Customer Account, Customer_ID). Only expose customers whose Account matches the user’s accounts.
- **Locations (ship-tos)**: From `Tofino_Customer_Location.csv` (Customer Name, Account, Location, Location_ID). Scoped by customer/account.
- **Inventory**: From `Tofino_Customer_Inventory.csv` (Customer_Name, Account, Location, Bin_Location, Item, CPN/CB part numbers, barcode, etc.). Load per customer + location(s); support search by CPN and CB part number; support barcode scan (CPN from label).
- **Orders**: Persist order lines in a structure compatible with `OrderLine.csv` (e.g. VMI_ID, OrderID, LineNumber, CBSKU, CustSKU, BinLocation, Qty, UOM, etc.) and sync to backend/NetSuite.

### Offline

- **Offline-first capability**: App detects connectivity; “Download location” (for offline use) is only offered when online; when offline, only downloaded locations and “Save order” are available.
- **Local storage**: Store downloaded inventory and saved orders (e.g. SQLite or Expo secure storage) so scanning and “save order” work with no network.
- **Sync**: When back online, the app **auto-syncs**: it detects connectivity and **automatically** notifies the user (e.g. push or in-app) and can **auto-open** the pending-orders screen so they don’t have to navigate to it. Default: user **reviews** (and can edit) each order then **sends**; upload to backend, NetSuite, and email happen on send. Optional setting: **auto-send** saved orders when back online (upload without review) for users who prefer zero-tap sync.

### Integrations

- **NetSuite**: Submit orders to create quote requests; receive QU number (e.g. via email or API) for downstream processing.
- **Email**: Send order confirmation emails (customer, ship-to, order details) and support “high importance” for urgent orders.

### Auth & security

- **Login**: User ID + password; optional change-password flow.
- **No hardcoded default password in production**: Default 123456 only for initial setup / reset; enforce change or secure distribution.

### UX

- **Connectivity**: App **detects** online/offline (e.g. NetInfo / network state). User **does not** toggle; the app **shows** status (e.g. persistent “Online” / “Offline” pill or banner) and enables only actions that are valid for that state.
- **Unified flow**: One home/order flow that **adapts** by connection: when online, show live data and “Place order”; when offline, show downloaded data only and “Save order”; when back online with saved orders, prompt to review and send.
- **Offline sync flow**: When connectivity returns, app **auto-syncs**: automatically notifies and can auto-open the pending-orders screen. Default: user reviews and can edit each order, then sends. Optional: “Auto-send when back online” in settings for one-tap sync without review.
- **Search**: Single search bar for CPN or CB part number (type-ahead / instant results where possible).
- **Scan**: Camera permission; barcode scanner to read CPN from label and populate search/list.
- **Cart**: Cart icon; review and delete lines; “Review” then final order; primary action is “Place order” (online) or “Save order” (offline), with clear success feedback.

### Modern UX (improvements over legacy app)

- **No manual online/offline switch**: App infers connection and tells the user; actions (download, place order, sync) are shown or disabled based on state.
- **Always-visible connection status**: Small, non-intrusive indicator (e.g. “Online” / “Offline” in header or status bar) so the user never has to guess.
- **Auto-sync when back online**: App automatically detects “back online” and, if there are saved orders, notifies and can auto-open the pending-orders screen (user doesn’t have to remember to go there). Optional setting to auto-send orders without review.
- **Contextual prompts**: When online and user selects a location, offer “Download for offline”. When back online with pending orders, prompt “You have X orders to send” with a clear path to review and send.
- **Simpler order entry**: Reduce friction (e.g. “Add to cart” with quantity in one tap, or default “order quantity” to checked when user enters qty) so the flow feels like a modern shopping/order app.
- **Progressive disclosure**: Show only relevant options for current state (e.g. don’t show “Sync orders” when there’s nothing to sync; don’t show “Download” when offline).
- **Loading and feedback**: Skeleton or loading states when fetching; pull-to-refresh where appropriate; clear success/error messages (e.g. “Order saved for when you’re back online” vs “Order placed, email sent”).
- **Accessibility and touch**: Large tap targets, readable contrast, optional haptic feedback on scan success; support for device rotation where it helps (e.g. scan in landscape).

---

## 3. Full user requirements (detailed)

### 3.1 Authentication

| ID | Requirement | Source |
|----|-------------|--------|
| U1 | User can log in with User ID and password. | Transcripts |
| U2 | Default password is 6 digits (e.g. 123456); user can change password. | Transcripts |
| U3 | App shows only customers (and thus locations/inventory) for the user’s assigned Account Number(s). | Login_User.csv, transcripts |

### 3.2 Connectivity and mode (modern UX)

| ID | Requirement | Source |
|----|-------------|--------|
| U4 | App **detects** online/offline automatically (no manual toggle). User does not press “online” or “offline”; the app infers and shows status. | Modern UX |
| U5 | App **displays** connection status clearly (e.g. “Online” / “Offline” in header or status area) so the user always knows. | Modern UX |
| U6 | When **offline**: only downloaded locations are available; user can place orders that are saved locally; “Download location” and “Sync orders” are not offered or are disabled. | Offline transcript + Modern UX |
| U7 | When **online**: user can download locations for offline use, place orders (sent immediately), and if there are saved orders, sync (review → edit → send). | Transcripts + Modern UX |
| U8 | One **unified** flow: same order path; primary action is “Place order” when online and “Save order” when offline, based on detected state. | Modern UX |

### 3.3 Customer & location selection

| ID | Requirement | Source |
|----|-------------|--------|
| U9 | User can search customers by number or name (search bar). | Transcripts |
| U10 | User selects one customer, then one ship-to (online) or multiple ship-tos when downloading for offline. | Transcripts |
| U11 | When online, user can **download** a customer and one or more ship-tos to the device for offline use; this step requires internet. | Offline transcript + Modern UX |

### 3.4 Inventory & items

| ID | Requirement | Source |
|----|-------------|--------|
| U12 | App displays inventory for the selected customer and ship-to (from backend when online, or from downloaded set when offline). | Transcripts, Tofino_Customer_Inventory |
| U13 | User can search by Customer Part Number (CPN) or CB part number in a single search bar (type-ahead where possible). | Transcripts |
| U14 | User can open camera and scan a barcode; app uses CPN from label to find and show the item. | Transcripts |
| U15 | Each line shows item details (CPN, CB part number, bin location, description); user can add to cart with quantity (modern UX: simple “Add to cart” or clear order-qty control to reduce errors). | Transcripts + Modern UX |

### 3.5 Order entry & cart

| ID | Requirement | Source |
|----|-------------|--------|
| U16 | Only lines with quantity (and, if applicable, “order quantity” or add-to-cart confirmation) are in the cart. | Transcripts |
| U17 | User can open cart, review lines, and delete lines; then “Review” to final order screen (customer, ship-to, line details). | Transcripts |
| U18 | **Online**: User can mark Normal or Urgent; “Place order” submits and shows “order placed, email sent successfully.” | Online transcript |
| U19 | **Offline**: “Save order” stores order locally per ship-to; no email until user is back online and sends from “Sync orders” flow. | Offline transcript |

### 3.6 Offline sync (auto-sync when back online)

| ID | Requirement | Source |
|----|-------------|--------|
| U20 | When the app detects the user is back online and there are saved orders, it **auto-syncs**: automatically notifies (e.g. “You’re back online — X orders ready to send”) and can **auto-open** the pending-orders screen so the user doesn’t have to navigate to it. | Requirement |
| U21 | User sees the list of saved ship-to orders in the sync/pending-orders view (opened automatically or from home). | Offline transcript |
| U22 | **Default**: User **reviews** each saved order and can **edit** it (quantities, add/remove lines), then explicitly sends each one. **Optional setting**: “Auto-send when back online” uploads all saved orders without review (zero-tap sync). | Requirement |
| U23 | When user sends (or when auto-send is on), the app submits each order to NetSuite and sends email; then marks as synced. | Offline transcript |
| U24 | After all saved orders are sent, user can finish the flow (e.g. “Done” back to home). | Offline transcript |

### 3.7 Notifications & downstream

| ID | Requirement | Source |
|----|-------------|--------|
| U25 | App triggers order confirmation email (e.g. subject: VMI order – customer number, ship-to, customer name) with order details (date, time, quantity, bin location, CB part number, placer). | Transcripts |
| U26 | NetSuite creates quote request; user receives email with QU number to process order in NetSuite. | Transcripts |

### 3.8 Data model (from prereqs)

| Entity | Key fields | Purpose |
|--------|------------|---------|
| Login_User | User ID, Name, Email, Account Number | Auth and customer filtering |
| Tofino_Customers | Customer Name, Account, Customer_ID | Customer list per account |
| Tofino_Customer_Location | Customer Name, Account, Location, Location_ID | Ship-tos per customer |
| Tofino_Customer_Inventory | Customer_Name, Account, Location, Barcode, Item, Bin_Location, etc. | Items per location for search/scan |
| OrderLine | VMI_ID, OrderID, LineNumber, CBSKU, CustSKU, BinLocation, Qty, UOM | Order line structure for persistence and NetSuite |

---

## Summary

- **High-level**: Vendors/TSRs log in, see connection status (app tells them online/offline—no toggle), select customer and ship-to(s), search/scan inventory, build orders; when online they place order; when offline they save locally; when back online the app **auto-syncs** (notifies, can auto-open pending orders), then user reviews/edits and sends—or optionally auto-sends without review; app restricts data by account, sends emails, and feeds NetSuite.
- **Technical**: Build with Expo; detect connectivity (e.g. NetInfo); use prereqs CSVs or APIs; offline storage and sync; NetSuite and email; barcode scanning; modern UX (status always visible, unified flow, contextual prompts, no manual online/offline switch).
- **Full**: The tables above (U1–U26) and the data model section are the detailed user requirements; section 2 “Modern UX” describes improvements over the legacy app.

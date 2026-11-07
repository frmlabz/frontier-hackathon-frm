# Business OS — Product Vision

> **Talk to your company. It builds itself.**

---

## 1. The idea in one paragraph

Business OS is a platform where a small business owner opens a blank page, starts chatting with an AI, and ends up running their company on custom software built just for them. They never see code. The AI, called the **AI CEO**, learns how the business works, suggests tools that would help, then builds, hosts, monitors and repairs those tools in the background. It can also hire **AI Employees**: agents with their own workspace and access to the owner's existing tools (Gmail, Sheets, Docs, Excel…) who handle recurring work. Human employees can be invited too. Everything comes together in one calm, Notion-like workspace with a single dashboard for the whole business.

---

## 2. The problem

- Small businesses (restaurants, shops, workshops, clinics, agencies) still run on paper, WhatsApp, spreadsheets and memory.
- Off-the-shelf SaaS is generic. It covers about 70% of what they need, costs a subscription per tool, and none of the tools talk to each other.
- Custom software is out of reach: it's expensive, slow to get, and needs someone technical to keep it running.
- The owner knows their business deeply but can't turn that knowledge into tools.

## 3. The solution

A **conversation that turns into software.** The owner describes how they work; Business OS turns that into:

1. **Company Knowledge**: a living, structured picture of the business (people, suppliers, products, processes, pain points).
2. **Apps**: small custom applications built from that knowledge, which are hosted, connected to each other and maintained automatically.
3. **AI Employees**: agents that do ongoing work using the owner's tools and the apps.
4. **One Dashboard**: a single place to see how the whole business is doing, fed by every app.

The software is **regenerative**. The real source of truth is the *specification* (what the business needs), not the code. When needs change or something breaks, the system regenerates the affected parts from the updated spec instead of patching old code by hand. This is what makes it possible to maintain software for someone who will never read it.

---

## 4. Core concepts

| Concept | What it is, from the user's point of view |
|---|---|
| **Blank Slate** | The starting screen: an empty page and a chat. No setup wizards, no templates to pick. |
| **AI CEO** | The single AI you talk to. It interviews you, remembers everything, proposes solutions, builds apps, and hires AI Employees. It's your technical co-founder. |
| **Company Knowledge** | Everything the AI CEO has learned about your business, organized into pages you can read and edit (Notion-style): *Our Team, Suppliers, Menu, Daily Workflow, Problems to Solve…* |
| **Apps** | Custom tools built for you (Inventory, Invoice Import, Staff Schedule, Menu Website…). Each one appears in your sidebar and just works. Apps can be internal (for you and your staff) or public (for your customers). |
| **Dashboard** | One overview of the whole business. Every app contributes widgets: stock levels, spending, today's orders, alerts. |
| **AI Employees** | Agents the AI CEO hires for a role, e.g. *Bookkeeper*, *Purchasing Assistant*, *Developer*. Each has its own workspace, connectors (Gmail, Google Sheets, Docs, Excel…), storage, and can run code to process data. They work on their own and report back. |
| **Team** | Real people you invite (chef, waiter, manager). They get access to the apps relevant to their job. |
| **Modules** | Ready-made building blocks the AI can plug into any app: payments (Stripe), authentication, email/SMS notifications, PDF generation, OCR/document scanning, bookings… |

---

## 5. Product principles

1. **Chat is the front door.** Everything can be done by talking. Buttons and pages exist for convenience, not as a requirement.
2. **Zero technical surface.** No code, no deploys, no error messages, no "502". If something breaks, the user sees at most "We noticed an issue with Inventory and fixed it."
3. **Self-healing by default.** The platform monitors every app. Problems it detects, and problems the user reports in plain language ("the totals look wrong"), are fixed in the background by agents.
4. **Knowledge compounds.** Every conversation makes the AI CEO smarter about this specific business. The tenth app is easier to build than the first because the system already knows the suppliers, the products and the people.
5. **Apps work together.** They aren't isolated tools. The invoice importer adds stock to Inventory, Inventory feeds the Dashboard, and the Purchasing AI Employee reads Inventory to draft orders.
6. **Meet them where they are.** If the business already lives in a Google Sheet, connect it and build on top. Don't force a migration.
7. **The AI proposes, the owner decides.** The AI CEO suggests solutions proactively, but nothing is built or changed without a "yes".

---

## 6. User journey: Marko's restaurant

**Marko** owns a 40-seat bistro with 8 employees. He's not technical. His stock is tracked in a notebook, and supplier invoices are typed into a spreadsheet late at night.

### Step 1: Sign up, blank slate
Marko signs up and sees an empty page with a chat box.

> **AI CEO:** Hi! I'm here to help you run your business. Tell me a bit about what you do?
>
> **Marko:** I have a small restaurant, Mediterranean food.
>
> **AI CEO:** Nice. How many people work with you, and what does a typical day look like?

### Step 2: The interview, building Company Knowledge
The AI CEO keeps asking natural questions: team size and roles, opening hours, suppliers, how ordering works, what's annoying. While they talk, pages appear in Marko's sidebar on their own: **Company Profile**, **Team**, **Suppliers**, **Daily Workflow**, **Pain Points**. Marko can open and correct any of them.

### Step 3: A pain point becomes a proposal
> **Marko:** When a shipment comes in from a supplier, we write it in a notebook. Then the cooks write down what they use every day. It's a mess. Half of it is unreadable and the numbers never add up.
>
> **AI CEO:** Sounds like you need an **Inventory app**. I'd suggest:
> - **Inventory**: all your ingredients, current stock, low-stock alerts.
> - **Invoice Import**: snap a photo of a supplier invoice and the stock is added automatically.
> - **Daily Usage Import**: the cooks photograph their handwritten usage sheet and it's deducted from stock.
>
> Do you track any of this in a spreadsheet today? If so, I can connect to it and build on top instead of starting from zero.
>
> **Marko:** Yeah, there's a Google Sheet with the ingredient list.
>
> **AI CEO:** Perfect. I'll use that as the starting point. Shall I build it?
>
> **Marko:** Go.

### Step 4: Building in the background
Marko sees a calm progress card ("Building your Inventory app… setting up ingredient list… preparing invoice scanning…") and can keep chatting or leave. Behind the scenes, the AI CEO has turned the conversation into a specification, and the platform builds and hosts the app.

### Step 5: The app is live
**Inventory** appears in the sidebar. It shows his ingredients imported from the Sheet, current stock, and what's running low. The **Dashboard** now has its first widgets: *Stock value*, *Items running low*, *This week's supplier spend*.

### Step 6: Daily use
- A delivery arrives. Marko photographs the invoice, and 10 seconds later the stock is updated. He reviews the two lines the AI wasn't sure about.
- At closing, the chef photographs the handwritten usage sheet and the stock is reduced.
- Monday morning, the Dashboard shows that olive oil usage went up 30% this week.

### Step 7: Something goes wrong, and nobody notices
A new supplier uses a different invoice layout and the import misreads it. The platform detects the anomaly (quantities don't match the usual pattern) and agents fix the import in the background. Marko gets a short note: *"Invoices from Fresh Farm weren't reading correctly, so we fixed it and re-imported last Tuesday's invoice."*

### Step 8: Growth
Over the next weeks, through conversation:
- **AI Employee "Purchasing Assistant"** is hired. Every Thursday it checks Inventory, drafts orders for low items, and emails them to suppliers from Marko's Gmail after he approves.
- **Menu Website** (public app) lists the menu with prices, auto-hides dishes when key ingredients are out of stock, and takes table reservations.
- **Staff Schedule** app; Marko invites his 8 employees, who see their shifts on their phones.
- **AI Employee "Bookkeeper"** reads invoices from Gmail, keeps a monthly cost sheet, and flags price increases from suppliers.

Six weeks in, Marko runs his restaurant on five custom apps and two AI Employees, and he has never written a line of code or opened a settings page.

---

## 7. Other example businesses

| Business | First thing they'd build | What comes later |
|---|---|---|
| **Hair salon** | Booking page + client list | SMS reminders, product inventory, AI Employee replying to Instagram DMs |
| **Car repair shop** | Job tracker (car in → diagnosis → parts → done) | Customer status page, parts ordering, invoicing with Stripe |
| **Small construction firm** | Project and site log with photos | Worker timesheets, material tracking, AI Employee preparing weekly client reports |
| **Online shop on Instagram** | Order tracker from DMs | Storefront with payments, shipping labels, stock sync |
| **Accounting agency** | Client document intake (upload portal + OCR) | Deadline tracker, AI Employee chasing missing documents by email |

---

## 8. AI Employees in more detail

- **Hired, not built.** The owner says "I need someone to handle supplier emails," and the AI CEO creates the right AI Employee with a role, instructions, and the access it needs.
- **Own workspace.** Each AI Employee has its own sandbox: files, storage, and the ability to run code (e.g. Python to clean data or produce a report).
- **Connectors.** Gmail, Google Sheets/Docs/Drive, Excel/OneDrive, calendars, messaging, and the company's own Business OS apps.
- **Uses the company knowledge.** Every AI Employee knows the business: the suppliers, the menu, the team.
- **Specialists include a Developer.** App building itself can be done by a Developer AI Employee working in its own sandbox and shipping to the platform. The owner never manages it directly; the AI CEO does.
- **Supervised.** They report what they did, ask for approval on sensitive actions (sending emails, paying, deleting), and can be paused or "let go" at any time.

---

## 9. Future ideas

- **Modules marketplace:** Stripe payments, invoicing, bookings, loyalty programs, POS integrations, accounting exports, SMS/WhatsApp.
- **Knowledge Layer documents:** full company handbook generated from Company Knowledge (onboarding guides, SOPs, recipes, policies), always up to date.
- **Team roles and permissions:** chef sees Inventory, waiter sees Schedule, accountant sees costs.
- **Proactive AI CEO:** weekly business review ("food costs are up 12%, here's why and what I'd change").
- **Templates from similar businesses:** "Restaurants like yours usually also use…" (anonymized learnings across businesses).
- **Mobile-first apps for staff,** including offline-friendly photo capture.
- **Custom domains** for public apps (menu site, booking page, shop).
- **Data export and ownership:** the business always owns its data and can take it with it.
- **Multi-location** support for growing businesses.
- **Voice:** talk to the AI CEO while driving to the market.

---

## 10. Hackathon demo (suggested scope)

The goal is to show the magic moment: **chat → understanding → app → dashboard**.

1. Blank slate + AI CEO chat that interviews a restaurant owner and fills Company Knowledge pages live.
2. AI CEO proposes the Inventory solution and builds it on approval.
3. Working Inventory app with **invoice photo import** (OCR) and **handwritten usage import**.
4. Dashboard with widgets fed by the Inventory app.
5. *(Stretch)* One AI Employee, e.g. Purchasing Assistant drafting an order email.
6. *(Stretch)* A staged "self-healing" moment: an issue is detected and fixed, and the user just sees a friendly note.

---

## 11. Positioning

- **For:** non-technical small business owners (1–50 people).
- **Against:** generic SaaS stacks (one subscription per problem, nothing connected) and no-code builders (still need you to think like a developer).
- **Our edge:** you don't build anything. You describe your business, and Business OS builds, runs and fixes your software, with AI Employees doing the work.

**Tagline options**
- *Talk to your company. It builds itself.*
- *Your AI CEO. Your custom company software.*
- *The operating system for your business, built by conversation.*

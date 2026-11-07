# Competitive landscape

Research snapshot from 2026-11-07, gathered through web search and the companies' own pages. Funding, headcount, and revenue figures come from press releases, founder posts, or data aggregators (Tracxn, PitchBook, GetLatka, LinkedIn). Aggregator figures are estimates and frequently conflict; each is labeled with its source. Nothing here has been verified with the companies directly.

## Direction under evaluation

Proposed core: **observe work on the employee's computer, ask employees questions about it, and map workflows from both**. That combined dataset is the foundation for suggesting workflow improvements.

This differs from the current [MVP scope](mvp.md), which uses system exports and excludes desktop monitoring. If adopted, the MVP, architecture, and data-contract documents need revision. This document does not change them.

## Summary

| | Kye | Fluency | KYP.ai | Horizon | GodHands | Sona8 |
| --- | --- | --- | --- | --- | --- | --- |
| HQ | Toronto | Australia; hiring in San Francisco | Berlin | San Francisco; Montevideo; Buenos Aires | San Francisco | Cambridge, MA and San Francisco; German founders and network |
| Founded | 2024 | Not found (pre-seed 2025) | 2018 | 2024 | 2026 | 2026 |
| Funding | Undisclosed | US$1.5M pre-seed + US$6M seed (Accel) | €17.5M Series A (2023) | US$3.5M seed (NXTP) | YC standard deal | YC F26 (~$500K, aggregator) plus MIT, TUM, and ElevenLabs grants |
| Size | ~4 (LinkedIn) | Not found | ~64–70; ~$7.7M revenue (GetLatka estimate) | ~44 (aggregator) | 2 founders | 5 |
| Buyer | Mid-market CFO/COO | Enterprise CTO/COO, AI transformation lead | Enterprise OpEx, shared services, BPO | Enterprise transformation team | Head of Ops/Support, PE operating partner | Consultancies, transformation teams |
| Observes desktop | Yes | Yes | Yes | No | Yes | Yes (optional background app) |
| Asks employees | No | No ("nobody has to sit in an interview") | No | Yes, core product | No (Q&A on playbooks, not interviews) | Yes, core product |
| Ranks by ROI | Yes (hours, dollars, FTE) | Yes (time, frequency, rework, cost) | Yes | Yes (impact × effort, $) | No | Partial (findings) |
| Builds automation | Yes, own agents | Yes, own agents | Generates agent code | No (initiatives only) | Agents execute playbooks | No |
| Measures after change | Kye Pulse | Against observed baseline | Yes | Pulse surveys | No | Re-asks the employees involved after each initiative |

## Profiles

### Kye ([kye.ai](https://www.kye.ai))

- **What it is:** a desktop agent (Windows and macOS) that observes how operations teams use their applications, quantifies bottlenecks in hours, dollars, and FTE, then builds AI agents to fix them. It doesn't connect to the underlying systems.
- **Offer:** free *Ops Sprint* (5 users, 5 days). Then a 4-week *Operations X-ray* (process maps, bottleneck map, voice-of-customer baseline, 12-month roadmap), first agent in weeks 4–6, and further agents every 1–3 weeks. *Kye Pulse* keeps sampling activity to measure adoption and surface new findings. Includes a chat interface ("as easy as asking a question").
- **Capture details:** only whitelisted apps; read-only during the X-ray; PII scrubbing with Microsoft Presidio; optional VoIP capture for phone-heavy roles; VPC deployment on GCP and Azure.
- **Trust claims:** SOC 2 Type II, HIPAA (BAA available), GDPR (EU residency and DPA).
- **Customers named:** Mosaic (trucking), Cultivate BHE (40+ clinics), Amidyne, Certoplast, Imperial Capital, Nesto, Cartage.
- **Pitch:** positioned against consulting ($75K–$500K engagements) and against event-log process mining, which it says misses the spreadsheet, copy-paste, and email work in mid-market operations.
- **Team:** Caleb Gawne (CEO; formerly Rose Rocket, Veeva), Josh Winters (CTO; formerly VMware, Pivotal).
- **Funding:** not disclosed.
- Sources: [platform](https://www.kye.ai/platform), [FAQ](https://www.kye.ai/product-faq), [security](https://www.kye.ai/security), [about](https://www.kye.ai/about).

### Fluency ([usefluency.com](https://usefluency.com))

Legal entity: Farmor Software Pty Ltd. Not related to the adtech company at fluency.inc.

- **What it is:** an enterprise "work intelligence" platform. A desktop agent captures work across systems and builds a "work ontology" of processes, tasks, people, systems, and handoffs. It ranks automation candidates, deploys AI agents, and measures results against the observed baseline.
- **Modules:** Work Explorer (process map), Opportunities (classified as programmatic automation or AI-agent candidate, with projected hours and money), Automations (deploys agents with autonomy levels from shadow to autonomous).
- **Privacy position:** "observes work, not workers." Claims no keystroke logging, no screen recording, no attribution to individuals, and PII redaction. Deploys in under an hour with no integrations.
- **Customers named:** Aon, PVH, HMH, Specsavers, Johns Lyng Group (claims 40% capacity recaptured for back-office teams).
- **Founders:** Finnlay Morcombe, Oliver Farnill.
- **Funding:** US$1.5M pre-seed (2025). US$6M seed led by Accel (February 2026), with DST Global, Carya, Archangel Ventures, NextGen Ventures, and angels.
- Sources: [FAQ](https://usefluency.com/faq), [Work Explorer](https://usefluency.com/features/explorer), [seed announcement](https://www.linkedin.com/posts/finnlay_fluency-has-raised-a-us6m-seed-round-led-activity-7426746727874924544-L5fF), [pre-seed](https://usefluency.com/blog/fluency-raises-1-5m-to-transform-enterprise-operations).

### KYP.ai ([kyp.ai](https://kyp.ai))

- **What it is:** a mature enterprise platform, *Productivity 360*, marketed as "Agentic Process Intelligence." It combines task mining, process mining, digital interaction intelligence, automated time tracking, SOP creation, and a Concierge assistant.
- **Pillars:** a 360° view across people, processes, and technology; a Business Transformation Engine that quantifies inefficiency and automation ROI; and an Agentic AI Enabler that generates agent code for UiPath, SAP Joule, and Copilot Studio.
- **Verticals:** banking, insurance, BPO, shared services, airlines, private equity.
- **Customers named:** DHL, Alorica, Hollard, Mindsprint, Allied Global, Qinecsa.
- **Funding:** €17.5M Series A (September 2023), led by OTB Ventures with 42CAP and Tola Capital. CEO Adam Bujak.
- **Scale:** about 64–70 employees (PitchBook, LinkedIn); about $7.7M annual revenue (GetLatka estimate, not company-reported).
- Sources: [site](https://kyp.ai), [Series A](https://www.finsmes.com/2023/09/kyp-ai-raises-eur-17-5m-in-series-a-funding.html), [GetLatka](https://getlatka.com/companies/kyp.ai/funding).

### Horizon ([usehorizon.ai](https://usehorizon.ai))

- **What it is:** an AI-interview discovery platform for large enterprises. Agents interview every employee, adapting to role and seniority. It also ingests SOPs and policies, builds a Process Library, ranks insights by impact with supporting quotes, and generates initiatives with ROI estimates. Doesn't observe desktops.
- **Features:** Discovery Cycles, Process Library, Insights and Initiatives dashboards, Pulse, a "Superconsultant" advisor, Workspaces, and a *One Week Challenge* (interview Monday, ranked initiatives by Friday).
- **Tagline:** "Transformation teams can't fix what they can't see." This is nearly identical to our working tagline.
- **Customers named:** MercadoLibre (~2,000 people interviewed in four-day waves), Itaú, Rappi, Nubank, PedidosYa, PwC, SURA, Delivery Hero.
- **Team:** Nicolás Scopesi (CEO), Nicolás López (CPO), Miguel Langone (CTO). About 44 employees (aggregator).
- **Funding:** US$3.5M seed led by NXTP (January 2026).
- Sources: [about](https://usehorizon.ai/about), [product](https://usehorizon.ai/product).

### GodHands ([godhands.ai](https://godhands.ai))

- **What it is:** an agent-context company rather than an optimization tool. It watches how employees work in their existing apps (Gmail, Jira, Zendesk, Sheets, Salesforce, internal tools), with no integrations. It turns that into source-cited playbooks that people can query and AI agents can execute.
- **Use cases:** operations, support, sales, AI-agent context, onboarding, handovers when someone leaves, and M&A integration.
- **Overlap:** shares the observation layer. Doesn't rank inefficiencies or recommend process changes. Its value is preserving tacit knowledge.
- **Team:** Sai Vamshi Batchu (CEO), Aditya Bommakanti (CTO), both formerly at Graviton (high-frequency trading).
- **Funding:** Y Combinator F26 standard investment. No priced round found.
- Sources: [site](https://godhands.ai), [YC launch](https://www.ycombinator.com/launches/Vn7-godhands-agents-that-learn-by-watching-your-best-people).

### Sona8 ([sona8.com](https://sona8.com)), the closest match to the proposed direction

- **What it is:** AI voice agents that interview every employee about their work. Sona8 describes itself as "the context layer for AI automation, starting with what employees say."
  - The interview runs by phone or in the browser, in the employee's own language.
  - The agent asks follow-up questions, such as why a step is still done by hand or who else is involved.
  - Employees can also show their work: screen share ("show which fields they copy into another" system), phone camera for physical tasks, or a desktop app that runs in the background through the day.
  - It already combines both halves of the proposed core.
- **Workflow:**
  1. The client picks a question (for example sales quoting, or the processes in scope before an AI rollout) and the employees to involve.
  2. Each employee does a ~20–30 minute conversation.
  3. Output: process maps and a list of problems by site and team, with optimization and automation recommendations.
  4. After each initiative, the agent goes back to the employees involved and asks whether it was implemented and what changed. The company frames this as a project management office that has talked to every employee.
- **Second positioning:** a CEO "organizational listening" product with quarterly 30-minute calls with every employee ("invited, not sampled"), covering innovation, risk, engagement, and decisions. Findings are prioritized by department, severity, and strategic impact.
- **Roadmap:** "a live context graph of workflows by reading the systems a company already uses and connecting them to what employees say." AI tools would query it, and those queries are a priced usage component.
- **Go-to-market:** sells through consulting firms first; they use it for the stakeholder interviews at the start of an engagement and redeploy it across client projects. Also sells to enterprise corporate development and transformation teams. Started in its founders' German network, now building the US market from San Francisco.
- **Pricing model:** a platform fee plus usage-based components (interviews, queries from other AI tools). No published prices.
- **Privacy:** participation is voluntary. Results are anonymized and aggregated by team or site. Collection scope and access are agreed with the client before each deployment. The CEO says "data protection, security and co-determination have shaped our product from the very beginning."
- **Traction:** more than 10,000 employee interviews; one of the top-three management consulting firms signed. Significant German and EU press in September–October 2026.
- **Team (5):**
  - Anton Hantel, CEO (formerly MIT, BCG)
  - Thilo Tamme, CPO (formerly TUM, BCG X)
  - Madeleine Malmsten, CTO (formerly McKinsey)
  - Jakob Schepers, founding engineer (formerly TUM, Volkswagen)
  - Niklas Schneider, founding account executive (formerly ITONICS)
- **Funding:** Y Combinator F26; about $500K total per aggregators. Its site lists support from MIT Sandbox, MIT entrepreneurship, TUM Venture Labs, and ElevenLabs grants.
- Sources: [site](https://sona8.com), [about](https://sona8.com/about), [YC launch](https://www.ycombinator.com/launches/VMv-sona8-ai-voice-agents-surveying-employees-about-their-work), [Trending Topics](https://www.trendingtopics.eu/sona8-y-combinator-ai-interviews), [YC LinkedIn post](https://www.linkedin.com/posts/y-combinator_sona8-yc-f26-maps-a-companys-workflows-activity-7523732220365295616-c3xS).

## Is "observe + ask" a moat?

Not by itself.

- **The combination already exists.** Sona8 ships both. Kye adds phone capture to desktop capture. Horizon adds document ingestion to interviews.
- **Observation-first players can add questions cheaply,** and interview-first players can add a background app. Each side is one feature away from the other.
- **The dataset only becomes a moat if it compounds across customers** (benchmarks, recommendations that improve with each deployment). That takes scale and contract rights the competitors are also pursuing. See the brief's note on [data assets](project-brief.md).

Defensible angles are combinations the competitors' positioning makes awkward for them:

1. **Questions triggered by observation, not scheduled interviews.** The system asks a short question at the moment it sees something it can't explain: a re-check, a workaround, an exception. Contextual micro-questions tie each answer to a specific observed event. That produces the dataset neither side has: *what was done* linked to *why it was done*.
   - Fluency explicitly markets "nobody has to sit in an interview."
   - Horizon runs interview campaigns.
   - Sona8 is the nearest: employees can show their work during an interview, and its roadmap connects system data to what employees say. Its unit of work is still a scheduled interview campaign. This is the gap most at risk of closing.
2. **SMB and lower mid-market.** Fluency, KYP.ai, Horizon, and Sona8 sell to enterprises and consultancies. Kye is the only one targeting the mid-market, and it is very small. Self-serve onboarding, pricing that doesn't need a sales call, and no IT project are hard for enterprise players to offer without undercutting themselves.
3. **Vendor-neutral recommendations.** Kye, Fluency, KYP.ai, and GodHands all monetize by deploying their own agents, so their recommendations favor automation they can sell. Recommending a process change, a settings fix, or a cheap integration first is a credible difference. It has to be backed by a business model that doesn't depend on agent sales.
4. **Built for consent and works councils.** In Germany, task mining requires works-council approval under §87(1)(6) BetrVG, which adds weeks to deployment; GDPR applies across the EU. On-device processing, employee-visible capture, and employees reviewing what was recorded and their own answers would make this a sales accelerator in Europe rather than a blocker. This is a weak angle against Sona8: it has German roots, says co-determination shaped its product from the start, and anonymizes results by team or site. It remains a difference against the desktop-first, non-EU players (Kye, Fluency, GodHands).

Proving any of these needs customer validation. Competitors can copy features 1 and 4. Features 2 and 3 are business-model choices, which are harder to copy.

## Keyword positioning

### Terms already claimed

| Company | Core vocabulary |
| --- | --- |
| Kye | Ops X-ray, bottlenecks, recover margin, ground truth, zero-integration, Pulse |
| Fluency | work intelligence, work ontology, observe work not workers, observed baseline, AI transformation |
| KYP.ai | agentic process intelligence, Productivity 360, task mining, business transformation engine |
| Horizon | continuous discovery, AI interviews, discovery cycles, quick wins, "can't fix what they can't see" |
| GodHands | operating model, playbooks, tacit knowledge, learned from the work, cites the source |
| Sona8 | context layer, organizational intelligence, workflow graph, AI voice interviews |

Every one of them uses "how work actually happens," and that phrase no longer distinguishes anyone. Avoid these as well: *process intelligence*, *work intelligence*, *agentic*, *X-ray*, *AI transformation*, and the "can't fix/optimize what you can't see" tagline pattern.

### Unclaimed angles (hypotheses, not validated)

| Angle | Example phrasing | Backed by |
| --- | --- | --- |
| The *why*, not just the *what* | "Work, explained." / "See what your team does, and why." | Observation-triggered questions |
| A consultant you can afford | "An operations analyst for teams without one." / "The ops consultant that never leaves." | SMB focus; the brief's consultant framing |
| Fix before you automate | "Fix the process first. Automate what's left." / "Not every problem needs an AI agent." | Vendor-neutral recommendations |
| Built with the team, not on it | "Employees see what's captured and add the context." / "Works-council ready." | Consent-based capture |
| Evidence, not estimates | "Every recommendation shows its receipts." | Evidence provenance in the [data contracts](data-contracts.md) |

Before adopting any of these, check that the phrase and product name are free in the target market, and test the wording with the ops-leader buyer described in the [brief](project-brief.md).

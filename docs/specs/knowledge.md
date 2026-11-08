# Knowledge layer

**Contract:** `KnowledgeStore` in `contracts/platform.ts`.
**Prototype:** the CEO writes Markdown pages (`upsert_knowledge_page`), and every page goes into the CEO and employee prompts on every call.

## Design

- **Graph under the pages:** entities (person, supplier, product, process, pain point) and facts (subject, predicate, value, unit). Each fact carries its **provenance** (a conversation turn, an app record, an employee run, a connector event) and a **confidence**.
- **Writers:** the CEO, employees and connector ingest all *propose* facts. A proposal that contradicts an existing fact becomes one question to the owner, routed through the CEO, instead of a silent overwrite.
- **Readers:** retrieval by task. A builder gets the definitions and entities the spec references, and an employee gets its suppliers and target collections. Context stays bounded as the business grows.
- **Pages are views:** generated from the graph and editable. An edit to a page is parsed back into fact changes with the owner as the source.
- **Compounding:** new specs reuse entities and definitions that already exist, and research reports attach to the pain points they size.

## Migration from the prototype

1. Extract entities and facts from the existing pages into tables with source references, and keep the pages as they are.
2. Give the CEO a `lookup_knowledge` tool, and once retrieval covers what the full-page context covers today, drop the full-page context.

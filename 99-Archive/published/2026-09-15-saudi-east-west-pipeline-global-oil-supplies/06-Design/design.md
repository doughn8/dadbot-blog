---
title: "Design: Saudi Arabia’s Oil Bypass Is Down. What It Means for Global Supplies"
date: "2026-09-15"
description: "Saudi Arabia’s East–West oil pipeline is offline after attacks. Here’s what its storage clock, repair estimates and limited alternatives mean for global supplies."
desk: "news"
slug: "saudi-east-west-pipeline-global-oil-supplies"
status: "approved-for-final-approval"
workflow_stage: "design"
assigned_agent: "news-editor"
role_profile: "00-Control-Room/Agents/News Editor.md"
draft: true
publishable: false
approval_required: true
approved_by: "Sophie"
approved_at: "2026-09-15T20:41:47+02:00"
source_artifact: "../../05-Reviews/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/proofread.md"
source_proofread: "../../05-Reviews/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/proofread.md"
source_draft: "../../04-Drafts/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/draft.md"
source_brief: "../../02-Briefs/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/brief.md"
source_seo: "../../03-SEO/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/seo.md"
source_ledger: "../../05-Reviews/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/sources-ledger.json"
next_artifact: "../../07-Approval/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/approval.md"
next_stage: "final-approval"
sophie_decision: "approved-for-final-approval"
sophie_decision_date: "2026-09-15"
recommended_content_path: "content/news/2026-09-15-saudi-east-west-pipeline-global-oil-supplies.md"
tags:
  - "global-news"
  - "energy"
  - "oil"
  - "oil-prices"
  - "oil-supply"
  - "Saudi Arabia"
  - "Strait of Hormuz"
  - "Middle East"
tldr:
  headline: "Saudi Arabia’s East–West oil pipeline is offline, putting a key Hormuz bypass under pressure while stored barrels and alternative routes buy time."
  points:
    - "The pipeline’s seven-million-barrel-a-day capacity is not the same as current flow or confirmed lost supply."
    - "Recent estimates put the flow through Yanbu at roughly 2.6 million to four million barrels a day, with storage offering only a limited cushion."
    - "Repairs could take three to five weeks, but partial operation and alternative routes could change the market impact."
  takeaway: "The important number is not simply four per cent of global oil. It is how many barrels can still move, by which route, for how many days."
model_provenance:
  stage: "design"
  agent: "news-editor"
  model: "gpt-5.6-luna"
  provider: "openai-codex"
  created_at: "2026-09-15"
---

# Design: Saudi Arabia’s Oil Bypass Is Down. What It Means for Global Supplies

## Article

**Saudi Arabia’s Oil Bypass Is Down. What It Means for Global Supplies**

Source article:

```text
05-Reviews/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/proofread.md
```

The approved Proofread article is **1,178 words**. This Design package records presentation decisions only; it does not rewrite or duplicate the article body. The Final Approval artifact must carry the complete Proofread copy for Sophie’s final review.

## Visual direction

**Text-led Dadbot News article.** Use the established re-terminal treatment: Fira Code, compact spacing, square edges, restrained green accents and a clear text hierarchy. No new visual language or story-specific CSS is required.

The first screen should make the central correction legible quickly: the pipeline is offline, but its seven-million-barrel-a-day design capacity is not the same as seven million barrels of immediate lost supply. The standard TL;DR should state the storage-and-alternatives cushion and the repair uncertainty before the reader reaches the longer analysis.

Keep the article’s global frame visible rather than turning the design into a UK or EU price story. Asia’s direct Hormuz exposure should sit alongside Europe’s shipping and replacement-cargo exposure, the United States and Atlantic Basin response, and the wider effects on refined products, freight and consumers.

Keep the approved sequence intact:

1. Headline, metadata, tags and the standard TL;DR.
2. The opening explanation of the outage and why a replacement-barrel problem can be global without producing an immediate empty local tank.
3. What happened and how the East–West Pipeline bypasses Hormuz.
4. Why the route matters everywhere, with design capacity, recent flow and conditional lost-supply risk kept separate.
5. Global regional and refined-product effects.
6. Storage, repair estimates, partial-restart reporting and the time horizon.
7. Right-leaning and left-leaning frames, followed by their shared evidence.
8. Dadbot read and the visible Sources and caveats section.

Do not add a chart, map, hero treatment, dramatic callout or other decoration that makes an uncertain supply scenario look like a confirmed four-per-cent shortage.

## Layout and responsive notes

- Use the standard single News article template and existing article spacing; no new template or CSS is required for this story.
- Keep the title as one semantic H1 and preserve the proofread sentence-case H2 hierarchy.
- Keep the standard single TL;DR box prominent near the top, before the longer route, market and repair discussion. Do not duplicate it as a normal body section.
- Keep the headline, metadata, tags, TL;DR, paragraphs and headings in the normal article column. Do not introduce a bespoke two-column layout or horizontal visual treatment.
- Preserve the article’s prose distinction between design capacity, recent throughput, stored barrels and confirmed lost supply. Do not visually combine those numbers into one total.
- Keep the regional discussion in ordinary readable paragraphs. Do not turn Asia, Europe or the United States into colour-coded panels that imply different factual certainty.
- Keep “Sources and caveats” as normal readable content at the end: put the reader-facing caveat first, then a separate `## Sources` heading with compact bulleted descriptive links matching the Dutch Gold story. Long source titles and URLs must wrap rather than clip or widen the page.
- The article has no Markdown data table; do not invent one during implementation. If a later approved change introduces a table, use the existing `.post-content table` horizontal-overflow treatment rather than shrinking figures into unreadability.
- Check the long H1, H2 headings, inline citation markers, TL;DR points and source links at 390px, 768px and 1280px widths, plus the existing breakpoint edges around 480/481px, 600/601px, 684px and 900/901px.
- At every width, paragraphs and source links must remain readable without horizontal page scrolling; no content may be clipped by the article column or fixed site chrome.
- Preserve the existing external-link behaviour. No per-article script, template override or CSS change is needed.
- No internal link is required: the SEO review found no genuinely relevant existing Dadbot article to force into the copy.

## Accessibility and content safeguards

- Preserve one clear H1, ordered H2 sections and meaningful descriptive source-link text.
- Keep the TL;DR usable as a standalone summary for a reader who does not read the full article.
- Preserve the source attribution and uncertainty attached to attack responsibility, restart expectations, storage estimates and repair estimates.
- Do not communicate regional exposure, supply risk or political framing through colour alone; the prose and headings must carry the meaning.
- Keep focus states and source-link contrast governed by the existing site-wide styles.
- Preserve the distinction between nominal design capacity, recent actual flow, stored barrels and confirmed lost supply in both text order and emphasis.
- Keep Asia’s direct physical exposure, Europe’s route and replacement-cargo exposure, the United States and Atlantic Basin substitution, and global refined-product effects visible in the rendered copy.
- Keep “expected to resume soon” attributed to Chris Wright and separate from Reuters’ still-offline report; do not style the expectation as a status confirmation.
- Do not add a visual device that turns the four-per-cent conditional risk estimate into a confirmed market loss.
- Preserve the cover-free News rule and do not add image, hero, fallback or cover metadata.

## Text-only design policy

News, Blog and Conspiracy Corner are cover-free. Do not generate, source, recommend or attach covers, hero art, image notes or fallback images at any stage. Design checks text layout, TL;DR, accessibility and responsive readability. Books retain their separate sourced-cover workflow.

- No public article file is created at this stage.
- Do not add a per-article opt-out: the three desks are cover-free by default.
- For Books only, use the Book Review template and its cover-sourcing record.

## Current asset status

No cover asset applies: the News desk is text-led by standing Dadbot policy. No image, hero, fallback or cover metadata is assigned. Nothing has been moved into `content/news/`.

## Handoff contract

- Role profile: `00-Control-Room/Agents/News Editor.md`
- Current stage: Design
- Source artifacts: `../../05-Reviews/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/proofread.md`; upstream Draft, Brief and SEO artifacts; `../../05-Reviews/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/sources-ledger.json`
- Completed work: prepared the text-led News hierarchy, preserved the single TL;DR treatment, documented the global reading order, accessibility safeguards and responsive-readability matrix; specified the Dutch Gold-style caveat-first Sources presentation; no article-body rewrite and no public content creation
- Verified sources / evidence carried forward: Proofread’s artifact-specific ledger remains the source of citation IDs and evidence; 14 cited source IDs remain mapped to the same URLs; strict Proofread evidence verification passed before this transition; current-event cautions remain visible for final refresh
- Approved decisions and constraints: Sophie approved Proofread → Design on 2026-09-15 at 18:27:58 +02:00; preserve the global audience constraint — “remember this is a global story not just UK readers and the EU” — the calm News voice, capacity/throughput/lost-supply distinction, source attribution and cover-free rule
- Permitted changes at this stage: presentation, layout, accessibility and responsive-readability notes only; no factual refresh or substantive copy change without a new editorial decision
- Open questions / blockers: before Final Approval, refresh the pipeline’s restart/partial-restart status, Saudi primary-statement details, Yanbu stocks, tanker loadings, repair duration and dated market figures; manually inspect the full Saudi Press Agency statement; the existing site-wide `.coffee-button` fixed widget overlaps the lower-right of the TL;DR at 390–901px and needs a separate shell UI decision if it is to be moved; no article-specific Design blocker was found
- Quality checks completed: Design package frontmatter and repository paths checked; Proofread body remains the unchanged source payload; design contract and YAML parsing passed; draft-only and normal temporary Hugo builds passed; rendered route, workflow-note exclusion, and real-browser responsive-readability checks passed with the fixed-shell obstruction recorded separately
- Next gate: Final Approval → Local Publish
- Sophie decision: approved for Final Approval; final publication is recorded in the Approval artifact

## Verification record

- Source-presentation revision: temporary local preview returned HTTP 200 at the homepage, News listing and article route; the rendered caveat appears before the Sources heading, and all 14 reader-facing links render as compact list items. Citation IDs and URLs remain unchanged.

- Temporary preview source: disposable `/tmp` copy only; no public article file was created in the checkout.
- Browser matrix: 390px, 480px, 481px, 600px, 601px, 684px, 685px, 768px, 900px, 901px and 1280px.
- Hugo build: `hugo v0.163.3` draft-enabled build passed with 237 pages and 32 static files; the exact draft-only route rendered and the normal build passed with 222 pages and 32 static files while excluding that route. The rendered page contained the title, TL;DR and Sources, and contained no workflow notes or preview flags.
- Browser matrix: real Chromium ad-hoc probe passed at 390px, 480px, 481px, 600px, 601px, 684px, 685px, 768px, 900px, 901px and 1280px. At every width the article stayed inside the `.content` column, document/body scroll width equalled the scrollbar-adjusted client width, one H1 and the ordered H2 hierarchy rendered, the TL;DR was visible, all 14 source links wrapped inside `.post-content`, and no table existed to overflow.
- Geometry anchors: article width was 335px at the 390px request and 784px at 1280px; the requested/client-width difference was the expected 15px vertical scrollbar, not horizontal overflow.
- Visual captures: top-of-article captures were saved for 390px, 768px and 1280px; bottom-of-article captures were saved for 390px and 768px. Sources and caveats remained readable and wrapped. The pre-existing fixed `.coffee-button` at `z-index: 9999` intersected the TL;DR at every tested width from 390px through 901px, but not at 1280px; it was not changed in this article package.
- Result: article-specific Design checks pass. The fixed-shell overlap is an explicitly recorded separate follow-up, not silently treated as an article CSS defect.

## Approval gate

**Design → Final Approval:** approved by Sophie on 2026-09-15 at 20:41:47 +02:00.

*Design package approved for Final Approval. The final approval and local-publication record is in `07-Approval/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/approval.md`.*

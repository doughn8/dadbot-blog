# Approval Queue

> **New final-review runs (038):** follow `Dadbot Workflow.md`, “New runs: final-review contract”. Identify candidate ID/revision/run record; stage checkboxes mean completed/checked, not human-approved. Final Queue choices: Approve / Request changes / Reject / Hold; Approve means the agreed local publication only. Record payload hash and real decision separately. Existing entries below retain their historical meaning; do not migrate them.

This is where final Dadbot content waits for Sophie’s sign-off.

---

## Approval Rule

> No AI agent can publish.  
> Dadbot can prepare a recommendation.  
> Sophie makes the final decision.

---

## Awaiting Approval


## Approved

### Life beneath Antarctic ice: what scientists have found — revision 3

- Candidate: `2026-10-08-life-beneath-antarctic-ice`; revision 3; News; workflow_mode final-review
- Decision: Approve — user explicitly approved Antarctic-only release, publication, commit, push and cleanup; 909-word length exception accepted
- Status: published live; product `6ae615049d16288fbe274b716f37a7288e4d286a` pushed; Pages build/deploy `37845690755` succeeded
- Public article: `content/news/2026-10-08-life-beneath-antarctic-ice.md`
- Package: `99-Archive/published/2026-10-08-life-beneath-antarctic-ice/07-Approval/approval-revision-3.md`
- Run: `99-Archive/published/2026-10-08-life-beneath-antarctic-ice/01-Ideas/run.md`
- Archive: `99-Archive/published/2026-10-08-life-beneath-antarctic-ice`; complete stages, source evidence, prior reviewed packets and QA preserved locally
- Reviewed packet SHA-256: `066ca0a0c820948e5dd3a1f16af83598fc0cb22dd3e22e203ae1de32b293821b`
- Article payload SHA-256: `62f1f31c99a89330e0159b34cb49b1565d63ad009dffb31c09de527af7feae09`
- Body: 909 citation-stripped words; accepted below-target length; What we know so far section removed
- Checks: exact approved payload, clean frontmatter, full production build, homepage/News/route presence, excluded Moon route absent; source/QA evidence in archive
- Caveats: scientific uncertainties retained; existing 320px overflow and mobile coffee-badge obstruction unchanged
- Scope boundary: Moon remains local-only; release excludes its commit/file/control delta
- Release verification: exact public production payload and eight source links match live article; homepage/News/route 200; excluded Moon 404
- Cleanup: stages/evidence archived; owned preview server and QA browser stopped; disposable preview/cache removed
- Final record-only commit deployment verification and held-work restoration: retained in local archive; no further Antarctic editorial action

### Mirror-Image Molecules: The Chemistry Nobel Explained — revision 2

- Candidate: `2026-10-07-nobel-chemistry-mirror-molecules`; revision 2; News
- Status: published live; Nobel-only product release verified; complete workflow archived locally
- Content: `content/news/2026-10-07-nobel-chemistry-mirror-molecules.md`
- Route: `/news/nobel-chemistry-2026-mirror-molecules/`
- Archive: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules` (local-only)
- Approval: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules/07-Approval/2026-10-07-nobel-chemistry-mirror-molecules/approval-revision-2.md`
- Run: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules/01-Ideas/2026-10-07-nobel-chemistry-mirror-molecules/run.md`
- Approved payload SHA-256: `11487ae92e5dd43980bff5de6c5bad82cfe698c8f143004c6b4685d2500cc3cb`
- Reviewed packet SHA-256: `a7cbf633a9e08eb89c264388d223754c840ab6534c9fdfdbc261ee6b3072af0e`
- Public file SHA-256: `744b49b2ebea4b58a7bf0c0ffb80823f10efa6fd1e41e168adda1f4a6a9fc7d3`
- Decision: Approve at 2026-10-07T22:29:46.607765+02:00; “great, commit, push and clean up”; Moon explicitly excluded
- Checks: exact preserved public copy; production Hugo build; cover-free/tag-only/single TL;DR; homepage and News listing present
- Limitation: shared phone/tablet coffee-badge obstruction unchanged
- Next: verify follow-up records HEAD deployment, then restore held Moon locally unpushed; final readbacks remain in local archive

- [x] Approve
- [ ] Request changes
- [ ] Reject
- [ ] Hold

- Product commit: `7e6bb42294e73ecfc3b0c96547313704c4f5501e`; Pages run `37683545380`, build/deploy successful
- Live verified: homepage, News listing and exact approved article; seven source labels/URLs; one title/TL;DR; 2026-10-07T22:42:54+02:00
- Cleanup: complete stage/evidence archive preserved; isolated review root removed; normal checkout local preview available; QA browser stopped
### Why the G7 Is Releasing Fuel Reserves — revision 2

- Candidate: `2026-10-06-g7-fuel-reserves-us-eu`; revision 2; News
- Status: published live; product commit f97a9ba pushed/verified; workflow 37444963293 build/deploy passed; cleanup complete
- Content: `content/news/2026-10-06-g7-fuel-reserves-explained.md`
- Route: `/news/g7-fuel-reserves-explained/`
- Archive: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu` (local-only)
- Approval: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu/07-Approval/2026-10-06-g7-fuel-reserves-us-eu/approval-revision-2.md`
- Run: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu/01-Ideas/2026-10-06-g7-fuel-reserves-us-eu/run.md`
- Approved payload SHA-256: `329dd2a0b70ad01b5b0e7d07cb25867b91b8f952cd00094de3e8564dd8309dbb`
- Reviewed packet SHA-256: `a92b4adf2b30fe6c97b1035dce119ed23ec274cd2dfb9280772cb5641c2442cd`
- Public file SHA-256: `76d0146b91bd86751432ac2b2936bda9322f58839907bc0e38c10d79afe5f84f`
- Current decision packet SHA-256: `b8edec6cf958650fe980d076d533ebf992bd8f6281d54c897aa1eef8c49a6d3b`
- Decision: Approve; 942-word exception accepted; local publication, commit, push and cleanup authorised 2026-10-06T11:38:44.740281+02:00
- Checks: exact preserved article; cover-free/tag-only; production build and delivery verification in release log
- Limitations: inherited 320px shell overflow and phone/tablet coffee-badge overlap unchanged
- Next: no fuel editorial work; final records verification and Moon-only local restoration

- [x] Approve
- [ ] Request changes
- [ ] Reject
- [ ] Hold



### Why French pupils are protesting — and what happens next — revision 1

- Candidate: `2026-10-05-france-student-protests`; revision 1; News; final-review mode
- Status: Published live; product commit a47dbee pushed and verified; workflow 37375206883 build/deploy succeeded; cleanup complete; Moon excluded
- Content: `content/news/2026-10-05-france-student-protests.md`
- Route: `/news/france-student-protests-explained/`
- Archive: `99-Archive/published/2026-10-05-france-student-protests` (local-only)
- Approval: `99-Archive/published/2026-10-05-france-student-protests/07-Approval/2026-10-05-france-student-protests/approval.md`
- Run: `99-Archive/published/2026-10-05-france-student-protests/01-Ideas/2026-10-05-france-student-protests/run.md`
- Approved payload SHA-256: `b9c65eb24d345b838c18af882f9af2cbfb38738b158670f1abb1809cfe84b0a3`
- Reviewed packet SHA-256: `88a6d39ea476de40516ff7b79f89b4ab1956c607f9dd55377a4369eba50e7160`
- Public file SHA-256: `156af662fe5b16bc797c43f4f8bb0fce055e78b296d5f7bff3aa4255b11fc343`
- Decision: real user “commit, push and clean up. do not push the conspiracy corner artical yet” at `2026-10-05T23:08:31.800813+02:00`; separately approved local-only commit reordering/restoration
- Checks: full closing audit completed; exact approved article and metadata; cover-free/tag-only; all stages preserved locally
- Limitation: existing shared phone/tablet coffee badge unchanged
- Next: None for France. Moon explicitly withheld from GitHub/live.

- [x] Approve
- [ ] Request changes
- [ ] Reject
- [ ] Hold


### Bitcoin: How Much Control Is Convenience Worth?

- Candidate: `2026-10-03-blockchain-beyond-crypto`; approved revision 5; Blog / Tech
- Status: published live; product commit d6de2c0 pushed and verified; workflow 37143738157 build/deploy succeeded; cleanup complete
- Content: `content/posts/2026-10-03-bitcoin-control-convenience.md`
- Route: `/posts/bitcoin-control-convenience/`
- Archive: `99-Archive/published/2026-10-03-blockchain-beyond-crypto`
- Approval: `99-Archive/published/2026-10-03-blockchain-beyond-crypto/07-Approval/2026-10-03-blockchain-beyond-crypto/approval-revision-5.md`
- Run: `99-Archive/published/2026-10-03-blockchain-beyond-crypto/01-Ideas/2026-10-03-blockchain-beyond-crypto/run.md`
- Approved payload SHA-256: `64692199ed8e4a1b4bf1093c8cb63c52c44073c12d3ff788831c89338bb2f797`
- Reviewed packet SHA-256: `a878e2ee5aef9fee9025712cc0ba3c23401f37cb8d39547535c0a1ee18920a3f`
- Decision: Approve; local publication, local commit, origin/main push and task cleanup separately authorised on 2026-10-03
- Checks: exact approved public copy, 1629 prose words, same title/description/Tech/tags/TL;DR, six-step explanation, no Practical takeaway, no cover or preview-only flags; production build and listing/feed checks passed
- History: original broad crypto draft never published; all superseded active rows closed and moved into preserved archive history
- [x] Approve
- [ ] Request changes
- [ ] Reject
- [ ] Hold

### Flydubai Dubai–Tel Aviv Incident: What the Reports Say
  - Candidate: `2026-10-02-flydubai-dubai-tel-aviv-coverage`; revision 2; News
  - Status: published live; product commit e94004d pushed and verified; workflow 37058976020 succeeded; cleanup complete
  - Content: `content/news/2026-10-02-flydubai-dubai-tel-aviv-coverage.md`
  - Archive: `99-Archive/published/2026-10-02-flydubai-dubai-tel-aviv-coverage/` (local-only)
  - Approval: `99-Archive/published/2026-10-02-flydubai-dubai-tel-aviv-coverage/07-Approval/2026-10-02-flydubai-dubai-tel-aviv-coverage/approval-revision-2.md`
  - Payload SHA-256: `62a5a46a7f563fb332e551b49435699bc46ec7137b0719664eb20a808fcd0b56`
  - Reviewed packet SHA-256: `e2e13725fb09dca8dc017b8cf38bb943548a27a851cdf6e472825425b9b6ab35` (exact preserved packet at archive root)
  - Decision: “like it. lets commit, push and clean up” (2026-10-02T22:06:51+02:00); accepts disclosed 754-word body.
  - History: revision 1 superseded by Request changes; both revisions retained.
  - Limitation: existing shared phone/tablet coffee badge overlap unchanged.
- [x] Approve

### Bond Yields Jump as Energy Inflation Squeezes the World
  - Candidate: `2026-10-01-global-bond-yields-energy-inflation`; revision 2; News
  - Status: published live; product commit e1e4ea0 pushed and verified; workflow 36936194389 succeeded
  - Content: `content/news/2026-10-01-global-bond-yields-energy-inflation.md`
  - Archive: `99-Archive/published/2026-10-01-global-bond-yields-energy-inflation/` (local-only)
  - Approval: `99-Archive/published/2026-10-01-global-bond-yields-energy-inflation/07-Approval/2026-10-01-global-bond-yields-energy-inflation/approval-revision-2.md`
  - Payload SHA-256: `99771d47823c5dcf4b7738e074098860bc38c28edf34de47c00ccf2dba763cda`
  - Decision: “approved, commit push and clean up” (2026-10-02T00:34:59+02:00); accepts 825-word body.

### Manchester City’s Financial Verdict: Findings, Denial and Trophies
  - Candidate: `2026-09-30-manchester-city-financial-verdict`; revision 2; News
  - Status: published live; product commit c6e632e pushed and verified
  - Live: https://dadbot.blog/news/manchester-city-financial-verdict-explained/
  - Deployment: workflow 36779788404 succeeded; exact article, homepage and News listing verified
  - Content: `content/news/2026-09-30-manchester-city-financial-verdict.md`
  - Archive: `99-Archive/published/2026-09-30-manchester-city-financial-verdict/` (local-only)
  - Approval: `99-Archive/published/2026-09-30-manchester-city-financial-verdict/07-Approval/2026-09-30-manchester-city-financial-verdict/approval-revision-2.md`
  - Payload SHA-256: `320cfc9f3a3c4116ccd65b2fcdca81ba1c1e928857efcaa2807a0a340feeac55`
  - Decision: “ok great lets commit, push and clean up” (2026-09-30T23:27:14.964726+02:00); includes disclosed shorter prose.

- [x] Approve


### Is This the Year of the Linux Desktop?

Candidate: `2026-09-29-year-of-linux-desktop`; revision 2
Desk: Blog / Tech
Status: published live; product commit 8e40b01 pushed and verified
Content: `content/posts/2026-09-29-year-of-linux-desktop.md`
Archive: `99-Archive/published/2026-09-29-year-of-linux-desktop/` (local-only)
Run record: `99-Archive/published/2026-09-29-year-of-linux-desktop/01-Ideas/2026-09-29-year-of-linux-desktop/run.md`
Final Approval: `99-Archive/published/2026-09-29-year-of-linux-desktop/07-Approval/2026-09-29-year-of-linux-desktop/approval-revision-2.md`
Approved payload SHA-256: `11efb330f440915e5886fa4170520bfe0418214f74d5c35c197a2cae9e689561`
Public file SHA-256: `42724b47575bbc8f85b62ff6b8e54d634947407fc1c44fea84d741712e19426d`
Decision: “great lets commit, push and clean up” (2026-09-29T22:30:42.402377+02:00); local publication, commit, push and cleanup authorised separately.
- [x] Approve

History: revision 1 superseded by Request changes; both revisions preserved. Existing mobile badge obstruction unchanged. Workflow 36629527664 succeeded; exact live article, homepage and Blog listing verified. Product commit `8e40b01`.





### AMD’s $8.2bn World Labs Deal Is a Bet on AI Beyond Text

Candidate: `2026-09-29-amd-world-labs-acquisition`; revision 3
Status: published locally; commit and push authorised
Content: `content/news/2026-09-29-amd-world-labs-acquisition.md`
Archive: `99-Archive/published/2026-09-29-amd-world-labs-acquisition/`
Approval: `99-Archive/published/2026-09-29-amd-world-labs-acquisition/07-Approval/2026-09-29-amd-world-labs-acquisition/approval-revision-3.md`
Approved payload SHA-256: `a3bb07fc7c3419e5c9c15832d947bb8324eba385733c12269aab3b25455c43c8`
Decision: user said “great approved. commit and push” on 2026-09-29. Disclosed 990-word count accepted. Shared mobile badge issue unchanged.
- [x] Approve


### Book Review: A Christmas Carol by Charles Dickens

Candidate: `2026-09-25-a-christmas-carol-book-review`
Revision: 2
Desk: books / The Shelf Scout
Run record: `99-Archive/published/2026-09-25-a-christmas-carol-book-review/01-Ideas/2026-09-25-a-christmas-carol-book-review/run.md`
Final Approval: `99-Archive/published/2026-09-25-a-christmas-carol-book-review/07-Approval/2026-09-25-a-christmas-carol-book-review/approval-revision-2.md`
Content: `content/books/a-christmas-carol-book-review.md`
Archive: `99-Archive/published/2026-09-25-a-christmas-carol-book-review/`
Public file SHA-256: `d91b8dc71e58690a46e1d05a9ece32be607036ee15e3b255da8624fb6972549c`
Approved article payload SHA-256: `b8243ce1a6290df1615280390259c36bd1bd79017fe5b226b6d6ba3b37936782`
Visual treatment: Books cover-led — user-selected cover (Vintage Classics art: Scrooge facing the chained ghost of Marley; Open Library cover ID 10383242)
Status: Published live at https://dadbot.blog/books/a-christmas-carol-book-review/; committed and pushed (6971fe6) on 2026-09-25.
History: revision 1 (payload `c175a60a5976d1125f0d2f67b530242311864c02cc213990fbfe031758b7db8d`) superseded 2026-09-25 by the user's revision request (cover swap; provisional note removed; Best Quote replaced source-exact).
Decision (recorded separately from the payload hash, per the Queue contract):
- [x] Approve
- [ ] Request changes
- [ ] Reject
- [ ] Hold

Sophie approved revision 2 on 2026-09-25 ("approve") for local publication, then chose "Commit, push, verify live, then clean up".

### Made in EU: Europe Wants More Factories. Who Counts as European?

Candidate: `2026-09-25-made-in-eu`
Status: Published locally; commit and push authorised.
Content: `content/news/made-in-eu-industrial-policy-debate.md`
Archive: `99-Archive/published/2026-09-25-made-in-eu/`
Approved article payload SHA-256: `a9080b42d03f278304abe4478f7935e89d1038ac72c87f0bc6072636a4eab096`
Decision: user approved corrected preview and requested “commit, push and clean up” on 2026-09-25.


## Germany’s Largest Hadrian-Era Roman Coin Hoard Found Near Wesseling

Candidate: `2026-09-23-germany-roman-silver-coin-hoard`
Revision: 2
Desk: news / Europe
Run record: `99-Archive/published/2026-09-23-germany-roman-silver-coin-hoard/01-Ideas/2026-09-23-germany-roman-silver-coin-hoard/run.md`
Final Approval: `99-Archive/published/2026-09-23-germany-roman-silver-coin-hoard/07-Approval/2026-09-23-germany-roman-silver-coin-hoard/approval-revision-2.md`
Content: `content/news/2026-09-23-germany-roman-silver-coin-hoard-wesseling.md`
Visual treatment: text-led, no cover (News desk policy)
Editorial archive: `99-Archive/published/2026-09-23-germany-roman-silver-coin-hoard/`
Status: Published locally
Publish State: Published locally to `content/news/2026-09-23-germany-roman-silver-coin-hoard-wesseling.md`
Approved packet SHA-256 at decision: `f18377b54ea8a99a764b95cbd8bb322bd1ad0bc6ccdb4870b9ab3b33c173f13a`
Public file SHA-256: `e5586c18e393f181fb39b424f3287728bad030f5bcadae284b8594b08ee5ed68`
Body: 600 approved words; 591 public words after removing the template-rendered H1

Decision:
- [x] Publish locally
- [ ] Request changes
- [ ] Reject
- [ ] Hold

Sophie notes: Final Approval and local publication approved on 2026-09-23. No local commit, GitHub push or live deployment is authorised by this decision.

---

## El Niño 2026 Is Strengthening: What It Could Mean for Global Weather

Candidate: `2026-09-22-el-nino-global-weather`
Revision: 4
Desk: news / Global weather
Final Approval: `99-Archive/published/2026-09-22-el-nino-global-weather/07-Approval/2026-09-22-el-nino-global-weather/approval.md`
Content: `content/news/2026-09-22-el-nino-global-weather-switch.md`
Visual treatment: text-led, no cover (News desk policy)
Editorial archive: `99-Archive/published/2026-09-22-el-nino-global-weather/`
Status: Published locally
Publish state: Published locally to `content/news/2026-09-22-el-nino-global-weather-switch.md`.
Approved packet SHA-256 at decision: `8f38a284699d651cb6bc4a3bc980a5e4979a0162fd3b84201375f633ff8ce933`
Public file SHA-256: `de16fc8e773752874e91f376f6146085899ddcd7a2f9a4d0467733f6a53a1cde`

Decision:
- [x] Publish locally
- [ ] Request changes
- [ ] Reject
- [ ] Hold

Sophie notes: Final Approval and local publication approved on 2026-09-22. No local commit, GitHub push or live deployment is authorised by this decision.

---

## Tesla Announces a 1st of October Reveal for the Long-Delayed Roadster

Candidate: `2026-09-19-tesla-roadster-october-1-reveal`
Desk: news / Technology
Final Approval: `99-Archive/published/2026-09-19-tesla-roadster-october-1-reveal/07-Approval/2026-09-19-tesla-roadster-october-1-reveal/approval.md`
Content: `content/news/2026-09-19-tesla-roadster-october-1-reveal.md`
Visual treatment: text-led, no cover (News desk policy)
Editorial archive: `99-Archive/published/2026-09-19-tesla-roadster-october-1-reveal/`
Status: Published locally
Risk Level: Medium
Dadbot Verdict: Approved by Sophie and published locally
Publish State: Published locally to `content/news/2026-09-19-tesla-roadster-october-1-reveal.md`.
Approved packet SHA-256 at decision: `4b5235723ab7d8d8934eb00c83c00a756f01f502936f623ef31109e1378a2138`
Public file SHA-256: `421ede89b58e10861d10028076c64ddd4dab92f517c68007a1fd1153213bd138`

Decision:
- [x] Publish locally
- [ ] Request changes
- [ ] Reject
- [ ] Hold

Sophie notes: Final Approval and local publication approved on 2026-09-19. The local commit is explicitly approved; push and live deployment remain unapproved.

---

## Balcony Solar: Why Germany Loves It and What Britain’s New Law Changes

Desk: blog / Home
Final Approval: `99-Archive/published/2026-09-19-balcony-solar-germany-uk-global-adoption/07-Approval/approval.md`
Content: `content/posts/2026-09-19-balcony-solar-germany-uk-global-adoption.md`
Visual treatment: text-led, no cover (Blog desk policy)
Editorial archive: `99-Archive/published/2026-09-19-balcony-solar-germany-uk-global-adoption/`
Status: Published locally
Risk Level: Medium
Dadbot Verdict: Approved by Sophie and published locally
Publish State: Published locally to `content/posts/2026-09-19-balcony-solar-germany-uk-global-adoption.md`.
Approved packet SHA-256 at decision: `c6ba3e7744c5dfd081794d2ca892d9981cac7f27bf630eb8fe1b22268cc4d4a7`
Public file SHA-256: `aca048b0e70f26929c8c62b73443c9c40ece3c25f281d553e0ebad865334b79c`

Decision:
- [x] Publish locally
- [ ] Request changes
- [ ] Reject
- [ ] Hold

Sophie notes: Final Approval and local publication approved on 2026-09-19. The local commit is explicitly approved; push and live deployment remain unapproved.

---

## 2026-09-17 Canada and Europe Are Coming Together. What It Means for the Global Order

Desk: news / Global order
Final Approval: `99-Archive/published/2026-09-17-canada-eu-global-order/07-Approval/approval.md`
Content: `content/news/2026-09-17-canada-eu-global-order.md`
Visual treatment: text-led, no cover (News desk policy)
Editorial archive: `99-Archive/published/2026-09-17-canada-eu-global-order/`
Status: Published locally
Risk Level: Medium
Dadbot Verdict: Approved by Sophie and published locally
Publish State: Published locally to `content/news/2026-09-17-canada-eu-global-order.md`.
Approved packet SHA-256 at decision: `b4d3cd5627c6c73626a06bdead1507fe7c287a7c9c8423c640fbe3084527f634`
Public file SHA-256: `3a8c61dd5741a233df3fd67cebf9671781a0ef397fde4a2ffab5f753b6eea71d`

Decision:
- [x] Publish locally
- [ ] Request changes
- [ ] Reject
- [ ] Hold

Sophie notes: Final Approval and local publication approved on 2026-09-17. No commit, push or deployment performed.

---

## 2026-09-15 Saudi Arabia’s Oil Bypass Is Down. What It Means for Global Supplies

Desk: news / Global energy  
Final Approval: `99-Archive/published/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/07-Approval/approval.md`  
Content: `content/news/2026-09-15-saudi-east-west-pipeline-global-oil-supplies.md`  
Visual treatment: text-led, no cover (News desk policy)  
Editorial archive: `99-Archive/published/2026-09-15-saudi-east-west-pipeline-global-oil-supplies/`  
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/news/2026-09-15-saudi-east-west-pipeline-global-oil-supplies.md`.

Decision:
- [x] Publish locally
- [ ] Revise
- [ ] Hold
- [ ] Discard

Sophie notes: Final Approval and local publication approved on 2026-09-15. The separately requested commit, push and live-deployment release remains subject to exact build, workflow and live-route verification.

---

## 2026-09-14 Why Dutch Gold Is Moving to London — and What That Actually Tells Us

Desk: news  
Final Approval: `99-Archive/published/2026-09-14-dutch-gold-london/07-Approval/approval.md`  
Content: `content/news/2026-09-14-dutch-gold-london.md`  
Visual treatment: text-led, no cover (News desk policy)  
Editorial archive: `99-Archive/published/2026-09-14-dutch-gold-london/`  
Status: Published locally  
Risk Level: Low  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/news/2026-09-14-dutch-gold-london.md`.

Decision:
- [x] Publish locally
- [ ] Revise
- [ ] Hold
- [ ] Discard

Sophie notes: Approved to publish locally on 2026-09-14. No commit, push or deployment performed.

---

## 2026-09-11 MKUltra Was Real. The Mythology Is the Messy Part.

Desk: conspiracy-corner  
Final Approval: `99-Archive/published/2026-09-11-mkultra/07-Approval/approval.md`  
Content: `content/conspiracy-corner/2026-09-11-mkultra.md`  
Visual treatment: text-led, no cover (Conspiracy Corner policy)  
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/conspiracy-corner/2026-09-11-mkultra.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-09-11. No commit, push or deployment performed.

---

## 2026-09-10 Are Western Governments Turning Against Israel — or Its Settlement Policy?

Desk: news / World  
Content: `content/news/2026-09-10-uk-israel-settlement-sanctions-retaliation.md`  
Visual treatment: text-led, no cover (News desk policy)  
Editorial archive: `99-Archive/published/2026-09-10-uk-israel-settlement-sanctions-retaliation/`  
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/news/2026-09-10-uk-israel-settlement-sanctions-retaliation.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-09-10. No commit, push or deployment performed.

---

## 2026-09-08 Why a Quiet Bridge Between Russia and North Korea Matters

Desk: news / World  
Editorial archive: `99-Archive/published/2026-09-08-russia-north-korea-tumen-bridge/`  
Content: `content/news/2026-09-08-russia-north-korea-tumen-bridge.md`  
Visual treatment: text-led, no cover (News desk policy)  
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/news/2026-09-08-russia-north-korea-tumen-bridge.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-09-08. No commit, push or deployment performed.

---

## 2026-09-08 When Seeing Is No Longer Believing

Desk: blog / Tech  
Editorial archive: `99-Archive/published/2026-09-08-when-seeing-is-no-longer-believing/`  
Content: `content/posts/2026-09-08-when-seeing-is-no-longer-believing.md`  
Visual treatment: no cover (text-led)  
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/posts/2026-09-08-when-seeing-is-no-longer-believing.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-09-08. No commit, push or deployment performed.

---

## 2026-07-12 Operation Northwoods: The Conspiracy Plan That Was Actually Real

Desk: conspiracy-corner  
Editorial archive: `99-Archive/published/2026-07-12-operation-northwoods/`  
Content: `content/conspiracy-corner/2026-07-12-operation-northwoods.md`  
Visual treatment: text-led, no cover
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/conspiracy-corner/2026-07-12-operation-northwoods.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-12. No commit, push or deployment performed.

---

## 2026-07-12 Is VAR Helping Football? What the World Cup's Biggest Controversies Tell Us

Desk: blog / Sport  
Editorial archive: `99-Archive/published/2026-07-12-ifab-world-cup-rules/`  
Content: `content/posts/2026-07-12-is-var-helping-football.md`  
Visual treatment: text-led, no cover
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/posts/2026-07-12-is-var-helping-football.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-12. No commit, push or deployment performed.

---

## 2026-07-10 Book Review: Project Hail Mary by Andy Weir

Desk: books / Science fiction  
Editorial archive: `99-Archive/published/2026-07-10-project-hail-mary-book-review/`  
Content: `content/books/project-hail-mary-book-review.md`  
Cover: `static/images/books/cover-project-hail-mary-open-library.jpg`  
Status: Published locally  
Risk Level: Low  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/books/project-hail-mary-book-review.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-10.

---
## 2026-07-10 Why the EU Says Facebook and Instagram Are Designed to Keep Us Scrolling

Desk: news / Technology  
Editorial archive: `99-Archive/published/2026-07-10-meta-eu-addictive-design/`  
Content: `content/news/2026-07-10-meta-eu-addictive-design.md`  
Visual treatment: text-led, no cover
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/news/2026-07-10-meta-eu-addictive-design.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-10.

---
## 2026-07-08 Book Review: White Nights by Fyodor Dostoevsky

Desk: books  
Editorial archive: `99-Archive/published/2026-07-08-white-nights-book-review/`  
Content: `content/books/white-nights-book-review.md`  
Cover: `static/images/books/cover-white-nights-open-library.jpg`  
Status: Published locally  
Risk Level: Low  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/books/white-nights-book-review.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-08.

---
## 2026-07-08 Book Review: Animal Farm by George Orwell

Desk: books  
Editorial archive: `99-Archive/published/2026-07-08-animal-farm-book-review/`  
Content: `content/books/animal-farm-book-review.md`  
Cover: `static/images/books/cover-animal-farm-first-edition.jpg`  
Status: Published locally  
Risk Level: Low  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/books/animal-farm-book-review.md`.

Decision:
- [x] Approve to publish locally
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-08.

---

## 2026-07-05 What This Week’s Charlie Kirk Court Hearing Will Actually Decide

Desk: news / U.S. courts  
Editorial archive: `99-Archive/published/2026-07-05-charlie-kirk-preliminary-hearing/`  
Content: `content/news/2026-07-05-charlie-kirk-preliminary-hearing.md`  
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/news/2026-07-05-charlie-kirk-preliminary-hearing.md`.

Decision:
- [x] Approve
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-05.

---

## 2026-07-05 Chinese Underground Church Pastor Freed After U.S.-China Pressure

Desk: news / World  
Editorial archive: `99-Archive/published/2026-07-05-china-pastor-jin-mingri-release/`  
Content: `content/news/2026-07-05-china-pastor-jin-mingri-release.md`  
Status: Published locally  
Risk Level: Medium  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published locally to `content/news/2026-07-05-china-pastor-jin-mingri-release.md`.

Decision:
- [x] Approve
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-05.

---

## 2026-07-05 Emergency Funds Without the Panic

Desk: blog / Money  
Editorial archive: `99-Archive/published/2026-07-05-emergency-fund-without-panic/`  
Content: `content/posts/2026-07-05-emergency-fund-without-panic.md`  
Status: Published locally  
Risk Level: Low  
Dadbot Verdict: Approved by Sophie and published locally  
Publish State: Published to `content/posts/2026-07-05-emergency-fund-without-panic.md`.

Decision:
- [x] Approve
- [ ] Revise
- [ ] Discard
- [ ] Hold

Sophie notes: Approved to publish locally on 2026-07-05.

---


## 2026-06-28 The Voynich Manuscript, Explained: Code, Hoax, or Medieval Mystery? (removed locally)

Desk: conspiracy-corner  
Editorial archive: `99-Archive/published/2026-06-28-voynich-manuscript-explained/`  
Content: removed locally: `content/conspiracy-corner/2026-06-28-voynich-manuscript-explained.md`  
Status: Removed locally on 2026-09-11  
Risk Level: Low  
Dadbot Verdict: Active public copy removed per Sophie’s request  
Publish State: Removed from `content/conspiracy-corner/`; historical editorial record retained.

Decision:
- [x] Approve
- [ ] Revise
- [ ] Discard

Removal note: This is a local content removal, not a GitHub push or live-site deployment.

---


---

## Revision Needed

### Chemistry Nobel honours research into molecular mirror images — revision 1 — superseded

- Candidate: `2026-10-07-nobel-chemistry-mirror-molecules`; revision 1; News; final-review mode
- Status: historical; Request changes; superseded by approved revision 2
- Package: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules/07-Approval/2026-10-07-nobel-chemistry-mirror-molecules/approval.md`
- Run: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules/01-Ideas/2026-10-07-nobel-chemistry-mirror-molecules/run.md`
- Preview source: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules/06-Design/2026-10-07-nobel-chemistry-mirror-molecules/preview-source.md`
- Preview: http://localhost:1313/news/nobel-chemistry-2026-mirror-molecules/?local-review=1; direct-route-only; full existing-content mirror
- Preview root / owner: `/home/markhickinson/.cache/dadbot-local-previews/2026-10-07-nobel-chemistry-mirror-molecules`; PID 15258; session proc_d71d22a99606; loopback 1313
- Article payload SHA-256: `862b2bd10c4bfe01a9251eaf6d2f2b7a2e46a4e9b456d440708fbaded5a48e6d`
- Reviewed complete packet SHA-256: `62224d4ed71402c843e2ee26d2f480d3ce8950bcd5a2f6922b94d1384e5ea838`
- Preview source SHA-256: `27e27584b56158890e32d782a077c08342e09d86aa25ecc0459211f52d147d15`
- Body: 1059 citation-stripped prose words; Hugo full-page 1189 words / 6 minutes
- Checks: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules/07-Approval/2026-10-07-nobel-chemistry-mirror-molecules/final-approval-checks.json`; eight contracts, strict evidence, seven exact quotes, source refresh, payload equality, isolated/normal builds, no-leak/content preservation, 14-width browser geometry, sibling parity, keyboard/source links and desktop-pane current-copy readback
- Caveats: original abstract/Nature sign-in boundary; Nobel documents one evidence chain; unresolved origin-of-life history; existing coffee badge obscures some phone/tablet text
- Blockers: none article-specific; shared small-screen defect disclosed, not repaired
- Decision: Request changes at 2026-10-07T21:53:44.161985+02:00
- Approve: exact reviewed local publication only; no commit, push or deployment

- [ ] Approve
- [x] Request changes
- [ ] Reject
- [ ] Hold

Historical revision-1 preview/checks only. Exact reviewed packet: `99-Archive/published/2026-10-07-nobel-chemistry-mirror-molecules/07-Approval/2026-10-07-nobel-chemistry-mirror-molecules/approval-revision-1-reviewed.md`. Current decision packet SHA-256: `3955969d2a8eda63a21176cf157abff823389a4d9ebd4c095af6808cae0d1d58`.

### Why the US Wants Europe’s Fuel Reserves — Despite the Tariffs — revision 1 — superseded

- Candidate: `2026-10-06-g7-fuel-reserves-us-eu`; revision 1; News; final-review mode
- Status: historical; Request changes; revision 2 in preparation
- Package: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu/07-Approval/2026-10-06-g7-fuel-reserves-us-eu/approval.md`
- Run: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu/01-Ideas/2026-10-06-g7-fuel-reserves-us-eu/run.md`
- Preview source: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu/06-Design/2026-10-06-g7-fuel-reserves-us-eu/preview-source.md`
- Preview: `http://127.0.0.1:1313/news/g7-fuel-reserves-us-eu-tariffs/?local-review=1`; direct-route-only, isolated full existing-content mirror
- Preview owner: PID 10342; session proc_587654d3da8c; loopback 1313; root `/home/markhickinson/.cache/dadbot-local-previews/2026-10-06-g7-fuel-reserves-us-eu`
- Payload SHA-256: `814782794067ea40a1690b62655147b67f37c7f350b4a706dc66cfbad79c18f4`
- Reviewed packet SHA-256: `34bb3e7531a017e264c774df968a9d6d31b80878c86b1d94bcbbd153c6b97ce1`
- Preview source SHA-256: `bfc79abb85595d06296280beab1a6d3f98b543c0b4954b859b150d6a67bf63de`
- Body: 1,145 citation-stripped prose words, excluding title, TL;DR, Sources/caveat and wrappers
- Checks: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu/07-Approval/2026-10-06-g7-fuel-reserves-us-eu/final-approval-checks.json`; all eight contracts, strict evidence, exact quotes, refreshed six-source record, payload equality, isolated/production builds, browser QA and desktop readback
- Caveats: conditional future effects; no country-by-country schedule/diesel split or documented tariff-for-fuel bargain; existing 320px shell overflow and phone/tablet coffee-badge overlap unchanged
- Blockers: none article-specific
- Decision: Request changes at 2026-10-06T10:59:00.305616+02:00
- Approve: local publication of exact reviewed revision only; no commit, push or deployment

- [ ] Approve
- [x] Request changes
- [ ] Reject
- [ ] Hold

Historical preview/checks; not a current approval choice. Exact reviewed packet: `99-Archive/published/2026-10-06-g7-fuel-reserves-us-eu/07-Approval/2026-10-06-g7-fuel-reserves-us-eu/approval-revision-1-reviewed.md`; reviewed SHA-256 `34bb3e7531a017e264c774df968a9d6d31b80878c86b1d94bcbbd153c6b97ce1`; decision packet SHA-256 `f6ed7fbfacb57de7cbdba8bd54322a9c3dbe76a061117bcd5d79f121e97ecbf2`.


_No revisions requested yet._

---

## Discarded

## 2026-06-14 NASA’s Artemis III Crew Announcement, Explained Simply

Desk: news  
Editorial archive: `99-Archive/abandoned/2026-06-14-nasa-artemis-iii-crew/`  
Former approval folder: `07-Approval/2026-06-14-nasa-artemis-iii-crew/`  
Status: Discarded locally  
Risk Level: Low  
Dadbot Verdict: Discarded per Sophie’s decision  
Publish State: Not published. No `content/news/` article created.

Decision:
- [ ] Approve to publish
- [ ] Revise
- [x] Discard

Sophie notes: Discarded locally on 2026-07-08.



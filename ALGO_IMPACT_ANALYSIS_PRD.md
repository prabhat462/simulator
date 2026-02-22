# Algorithm Impact Analysis Dashboard
## Product Requirements Document — v1.0

> **Status:** DRAFT — For Review
> **Classification:** CONFIDENTIAL — INTERNAL
> **Feature Type:** New Feature — Extends PG Routing Simulator
> **Target Users:** Data Science, Payments Product, Engineering Leads, Business / Finance
> **Reviewed By:** Head of Payments, Engineering Lead, Analytics Lead

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Stakeholders & User Personas](#4-stakeholders--user-personas)
5. [System Architecture & Data Pipeline](#5-system-architecture--data-pipeline)
6. [Data Model & Database Schema](#6-data-model--database-schema)
7. [Analysis Framework — Full Taxonomy](#7-analysis-framework--full-taxonomy)
   - 7.1 [Global-Level Analysis](#71-global-level-analysis)
   - 7.2 [Payment Gateway Analysis](#72-payment-gateway-analysis)
   - 7.3 [Payment Mode Analysis](#73-payment-mode-analysis)
   - 7.4 [Bank & Issuer Analysis](#74-bank--issuer-analysis)
   - 7.5 [Merchant-Level Analysis](#75-merchant-level-analysis)
   - 7.6 [Temporal & Seasonality Analysis](#76-temporal--seasonality-analysis)
   - 7.7 [Amount Band & Transaction Value Analysis](#77-amount-band--transaction-value-analysis)
   - 7.8 [Failure Analysis & Root Cause](#78-failure-analysis--root-cause)
   - 7.9 [Routing Behaviour Analysis](#79-routing-behaviour-analysis)
   - 7.10 [Statistical Significance & Confidence](#710-statistical-significance--confidence)
8. [Dashboard UI Requirements](#8-dashboard-ui-requirements)
9. [Visualisation Catalogue](#9-visualisation-catalogue)
10. [Functional Requirements](#10-functional-requirements)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Database & Performance Architecture](#12-database--performance-architecture)
13. [Tech Stack](#13-tech-stack)
14. [Milestones & Delivery Plan](#14-milestones--delivery-plan)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Acceptance Criteria](#16-acceptance-criteria)
17. [Appendix: SQL Query Reference](#17-appendix-sql-query-reference)

---

## 1. Executive Summary

When a payment routing algorithm goes live in production, the most critical question every stakeholder asks is: **"Is it working?"** Today, answering that question requires a data scientist to manually write SQL, wrangle Parquet files, and produce ad-hoc charts — a process that takes days, is not reproducible, and cannot be shared easily with product and business teams.

The **Algorithm Impact Analysis Dashboard** is a self-service analytics product that answers this question definitively, at every level of granularity, with statistical rigour. A payments PM should be able to load before and after transaction data, specify a date range, and within minutes have a complete, visual, statistically-validated report showing exactly what changed — globally, per merchant, per gateway, per bank, per payment mode, and at every hour of the day.

The product is built on top of a persistent database that can hold 50M+ transactions for the "before" period and ongoing "after" data as the algorithm runs in production. The user specifies two date windows — a **Baseline Period** (pre-algorithm) and an **Algo Period** (post-enablement) — and the system computes every meaningful comparison between them.

> **Core Promise:** Given two date ranges and a database of transactions, produce an irrefutable, visual, statistically-grounded answer to "Did the routing algorithm improve payment success rates?" — at global, merchant, gateway, bank, and temporal granularity — in under 60 seconds.

---

## 2. Problem Statement

### 2.1 The Measurement Gap

Routing algorithms are evaluated in simulation before production deployment, but **simulation is not production**. Real traffic has confounders that simulators cannot fully model:

- **Traffic mix shifts**: the payment mode distribution on Tuesday may differ from the prior month's average
- **Seasonality**: a festival week has naturally higher SR; any algorithm looks good during Diwali
- **Merchant-specific effects**: some merchants onboarded new PG integrations in the "after" period unrelated to the algo
- **Bank-side changes**: banks push gateway routing table updates independently
- **Volume changes**: SR at 100K txns/day may behave differently than at 500K txns/day

Without a rigorous, multi-dimensional comparative analysis framework, it is impossible to attribute SR changes to the algorithm vs. these external factors.

### 2.2 The Analyst Bottleneck

Currently, post-deployment analysis requires:
1. A data engineer to export and join transaction data from production databases
2. A data scientist to write bespoke SQL/Python analysis (2–3 days)
3. Manual chart creation in notebooks or BI tools (1 day)
4. Slide preparation for stakeholder communication (1 day)

Total time: **4–5 days per analysis cycle**. This is too slow. Algorithm tuning requires rapid feedback — ideally within hours of a parameter change going live.

### 2.3 What "Proof" Requires

To conclusively prove an algorithm is working, you need:

1. **Global SR uplift** with statistical significance (not just observed delta)
2. **GMV impact** — translating SR delta to recovered revenue
3. **No regression proof** — every merchant, mode, and bank cohort maintained or improved
4. **Causal attribution** — SR change is due to routing change, not traffic mix shift
5. **Gateway behaviour** — algorithm is choosing the right gateways in the right contexts
6. **Temporal stability** — improvement holds across all hours, days, and traffic volumes
7. **Failure pattern shift** — failure reasons changed in the expected direction (fewer bank timeouts, fewer PG errors)

This PRD specifies a product that generates all seven of these proofs, automatically, from raw transaction data.

---

## 3. Goals & Non-Goals

### 3.1 Goals

| ID | Goal | Success Metric |
|---|---|---|
| **G1** | Load 50M+ "before" transactions and ongoing "after" transactions into a persistent DB | Query on 50M rows returns in < 5 seconds |
| **G2** | User specifies Baseline and Algo date ranges; system computes all comparative metrics | Analysis ready < 60 seconds after date selection |
| **G3** | Global-level SR comparison with statistical significance | p-value and 95% CI displayed for every headline metric |
| **G4** | Merchant-level breakdown: rank all merchants by SR change, identify winners and regressions | Works for 10,000+ distinct merchants |
| **G5** | Gateway-level analysis: routing share shift, per-PG SR change, preference changes | Every PG tracked across both periods |
| **G6** | Bank × Mode × Gateway cohort analysis | Granular enough to identify exactly which bank/mode/PG combo drove SR improvement |
| **G7** | Temporal analysis: SR by hour, day, week to isolate seasonality effects | Hour-of-day and day-of-week heatmaps |
| **G8** | Failure reason attribution: which failure codes decreased, which increased | Waterfall chart of failure reason shifts |
| **G9** | Traffic mix normalisation: adjust for volume distribution changes between periods | Mix-adjusted SR uplift reported alongside raw uplift |
| **G10** | Export: PDF report and CSV data export of all analysis | Single-click export |

### 3.2 Non-Goals

| Non-Goal | Rationale |
|---|---|
| Real-time streaming analysis | This is retrospective batch analysis, not live monitoring |
| Attribution to specific algorithm decisions | This feature proves impact at population level; decision-level trace is in the Simulator |
| Automated A/B test design | This analyses existing data; test design is out of scope |
| Cross-company benchmarking | Analysis is scoped to a single deployment's data |
| Predictive modelling / forecasting | This is backward-looking measurement, not prediction |

---

## 4. Stakeholders & User Personas

| Persona | Role | What They Need from This Feature | Primary Screens |
|---|---|---|---|
| **Payments PM** | Owns algo rollout decision | One-number verdict: "algo improved SR by X% with 99% confidence, saving ₹Y crore/month" | Executive Summary, Global Dashboard |
| **Data Scientist** | Validates algorithm behaviour | Deep dive: cohort-level SR, traffic mix adjustment, failure attribution, statistical tests | All screens — full drill-down |
| **Engineering Lead** | Decides whether to expand algo rollout | Gateway routing behaviour: is the algo choosing PGs correctly? Any regressions? | Gateway Analysis, Merchant Regressions |
| **Business / Finance** | Approves continued investment | Revenue impact: GMV saved, cost of failed transactions, projected annual impact | Global Dashboard, Merchant GMV Impact |
| **Merchant Success Team** | Manages merchant relationships | Per-merchant view: which merchants improved, which need attention | Merchant Analysis |
| **Algorithm Developer** | Tunes algorithm post-deployment | Granular cohort analysis: which (bank, mode, PG) combos are performing well/poorly | Cohort Drill-Down, Temporal Analysis |

---

## 5. System Architecture & Data Pipeline

### 5.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ALGORITHM IMPACT ANALYSIS SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         DATA INGESTION LAYER                        │ │
│  │                                                                     │ │
│  │  [CSV / Parquet Upload]  [Direct DB Connection]  [S3 / GCS Sync]   │ │
│  │                         ↓                                           │ │
│  │  [Schema Validator] → [Deduplicator] → [Partitioner] → [Indexer]   │ │
│  └────────────────────────────┬────────────────────────────────────────┘ │
│                               ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    PERSISTENT TRANSACTION DATABASE                   │ │
│  │                                                                     │ │
│  │   transactions (partitioned by date, indexed by merchant/PG/bank)   │ │
│  │   materialised views: daily_cohort_sr, merchant_daily_sr            │ │
│  │   pre-aggregated: hourly_sr_by_pg, bank_mode_sr                     │ │
│  └────────────────────────────┬────────────────────────────────────────┘ │
│                               ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      ANALYSIS ENGINE                                │ │
│  │                                                                     │ │
│  │  Input: { baseline_start, baseline_end, algo_start, algo_end }      │ │
│  │                                                                     │ │
│  │  [Global Aggregator] [Merchant Aggregator] [Gateway Aggregator]     │ │
│  │  [Bank/Mode Aggregator] [Temporal Aggregator] [Failure Aggregator]  │ │
│  │  [Stats Engine: z-tests, CIs, effect sizes] [Mix Normaliser]        │ │
│  └────────────────────────────┬────────────────────────────────────────┘ │
│                               ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         DASHBOARD UI                                │ │
│  │                                                                     │ │
│  │  [Date Range Picker] → [Analysis Config] → [7 Dashboard Screens]    │ │
│  │  [Export: PDF Report] [Export: CSV Data] [Share Link]               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Ingestion Flow

```
User Action                    System Action
───────────────────────────────────────────────────────────────────────
1. Upload "before" data       → Validate schema → Partition by date
   (CSV/Parquet, up to 50M+)    Deduplicate by transaction_id
                                 Index on: (date, merchant_id, payment_gateway,
                                            payment_mode, issuing_bank)
                                 Write to: transactions table (period='before')

2. Upload "after" data        → Same pipeline → period='after'
   (ongoing, incremental)        Support append mode (no full reload needed)

3. Select date ranges         → Analysis Engine receives:
   Baseline: [start1, end1]      - Filter: date BETWEEN start1 AND end1 AND period='before'
   Algo: [start2, end2]          - Filter: date BETWEEN start2 AND end2 AND period='after'
                                 - Run all 10 analysis modules in parallel
                                 - Return results to dashboard in < 60s
```

### 5.3 Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Database engine** | DuckDB (embedded) | In-process OLAP; queries 50M rows in 2–5s; no server setup; columnar storage |
| **Storage format** | Parquet partitioned by year/month/day | Predicate pushdown on date ranges; 10x compression vs CSV |
| **Aggregation strategy** | Pre-compute daily cohort SR on ingestion; compute period comparisons at query time | Balance between ingestion cost and query latency |
| **Parallelism** | All 10 analysis modules run in parallel (multiprocessing) | Keeps total analysis time < 60s |
| **Period separation** | `period` column ('before'/'after') + date range filter | Allows overlapping date ranges for edge cases; explicit is safer |

---

## 6. Data Model & Database Schema

### 6.1 Core Transaction Table

```sql
-- Primary table: all transactions (before + after algo)
CREATE TABLE transactions (
    -- Identifiers
    transaction_id      VARCHAR NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL,
    date                DATE NOT NULL,              -- partition key
    period              VARCHAR NOT NULL,           -- 'before' | 'after'

    -- Routing
    payment_gateway     VARCHAR NOT NULL,           -- PG used
    algo_recommended_pg VARCHAR,                   -- PG algo recommended (null if before period)
    was_algo_routing    BOOLEAN DEFAULT FALSE,     -- true = algo made this routing decision

    -- Transaction context
    payment_mode        VARCHAR NOT NULL,           -- upi | card | netbanking | wallet | bnpl
    card_network        VARCHAR,                    -- visa | mastercard | rupay | amex | null
    issuing_bank        VARCHAR NOT NULL,
    amount              DECIMAL(15,2) NOT NULL,
    merchant_id         VARCHAR NOT NULL,
    merchant_name       VARCHAR,
    merchant_category   VARCHAR,
    device_type         VARCHAR,
    state               VARCHAR,

    -- Outcome
    outcome             SMALLINT NOT NULL,          -- 1 = success, 0 = failure
    failure_reason      VARCHAR,                    -- decline code or category
    failure_category    VARCHAR,                    -- 'bank_decline' | 'pg_error' | 'timeout' | 'user_drop' | 'fraud'
    latency_ms          INTEGER,                    -- gateway response time in ms

    PRIMARY KEY (transaction_id),
    INDEX idx_date (date),
    INDEX idx_period_date (period, date),
    INDEX idx_merchant (merchant_id, date),
    INDEX idx_gateway (payment_gateway, date),
    INDEX idx_bank_mode (issuing_bank, payment_mode, date)
);
```

### 6.2 Pre-Aggregated Materialised Views

Pre-computed at ingestion time to accelerate dashboard queries.

```sql
-- Daily SR by every relevant dimension — the workhorse table
CREATE TABLE daily_cohort_sr AS
SELECT
    date,
    period,
    payment_gateway,
    payment_mode,
    card_network,
    issuing_bank,
    merchant_id,
    merchant_category,
    CASE
        WHEN amount < 500    THEN '0-500'
        WHEN amount < 5000   THEN '500-5k'
        WHEN amount < 50000  THEN '5k-50k'
        ELSE '50k+'
    END AS amount_band,
    EXTRACT(HOUR FROM timestamp) AS hour_of_day,
    EXTRACT(DOW FROM timestamp) AS day_of_week,
    failure_category,

    COUNT(*) AS total_txns,
    SUM(outcome) AS successful_txns,
    SUM(outcome)::FLOAT / COUNT(*) AS sr,
    SUM(amount) AS total_gmv,
    SUM(CASE WHEN outcome = 1 THEN amount ELSE 0 END) AS successful_gmv,
    AVG(latency_ms) AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms

FROM transactions
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;

-- Merchant daily SR (for merchant-level analysis)
CREATE TABLE merchant_daily_sr AS
SELECT
    date, period, merchant_id, merchant_name, merchant_category,
    payment_gateway,
    COUNT(*) AS total_txns,
    SUM(outcome) AS successful_txns,
    SUM(outcome)::FLOAT / COUNT(*) AS sr,
    SUM(amount) AS total_gmv,
    COUNT(DISTINCT issuing_bank) AS distinct_banks,
    COUNT(DISTINCT payment_mode) AS distinct_modes
FROM transactions
GROUP BY 1,2,3,4,5,6;

-- Gateway routing share by day
CREATE TABLE daily_gateway_share AS
SELECT
    date, period, payment_gateway,
    COUNT(*) AS txns,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY date, period) AS share_pct,
    SUM(outcome)::FLOAT / COUNT(*) AS sr
FROM transactions
GROUP BY 1,2,3;
```

### 6.3 Analysis Configuration Table

```sql
-- Store each analysis run for reproducibility
CREATE TABLE analysis_runs (
    run_id              VARCHAR PRIMARY KEY,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    baseline_start      DATE NOT NULL,
    baseline_end        DATE NOT NULL,
    algo_start          DATE NOT NULL,
    algo_end            DATE NOT NULL,
    baseline_txn_count  BIGINT,
    algo_txn_count      BIGINT,
    baseline_sr         FLOAT,
    algo_sr             FLOAT,
    sr_uplift           FLOAT,
    p_value             FLOAT,
    is_significant      BOOLEAN,
    result_json         JSON                        -- full cached results
);
```

---

## 7. Analysis Framework — Full Taxonomy

This is the intellectual core of the product. Every module below answers a specific question a PM, data scientist, or engineer would ask when evaluating algorithm impact.

---

### 7.1 Global-Level Analysis

**Question:** "At the highest level, did the algorithm improve payment success rates?"

#### 7.1.1 Headline Metrics (The "Verdict" Card)

These are the six numbers that go on the executive summary card at the top of the dashboard. Every stakeholder should be able to read this card and immediately understand the impact.

| Metric | Baseline | Algo Period | Delta | Significance |
|---|---|---|---|---|
| Overall SR | `sr_before` | `sr_after` | `Δsr` | p-value, 95% CI |
| Total Transactions | count | count | Δ% | N/A |
| Total GMV Processed | ₹X Cr | ₹Y Cr | Δ% | N/A |
| GMV Saved by Uplift | — | — | `Δsr × total_gmv` | Confidence range |
| Avg Transaction Value | ₹X | ₹Y | Δ% | Student's t-test |
| Avg Gateway Latency (ms) | X ms | Y ms | Δ% | Mann-Whitney U |

#### 7.1.2 Daily SR Trend Chart

A dual-period time series showing SR for every day in both the baseline and algo periods side by side. This is the most important single visualisation — it shows whether SR improvement is consistent or just a spike.

**Chart type:** Dual-period line chart with date on X-axis, SR on Y-axis
- Left panel: Baseline period daily SR with rolling 7-day average
- Right panel: Algo period daily SR with rolling 7-day average
- Horizontal reference lines: baseline mean SR (dashed) on both panels
- Shaded confidence band (95% CI) around each daily SR point
- Annotation: any known external events (bank downtime, holidays)

#### 7.1.3 Traffic Mix Analysis (Confounder Detection)

**Why this matters:** If the "after" period had a higher proportion of UPI transactions (which have naturally higher SR), the observed SR uplift might not be due to the algorithm at all. This analysis detects and quantifies this confounder.

**Computed metrics:**
- Payment mode distribution: before vs after (stacked bar comparison)
- Bank distribution: top 20 banks by volume, before vs after share
- Merchant category distribution: before vs after
- Amount band distribution: before vs after
- **Mix-adjusted SR**: what would the algo-period SR be if the traffic mix were identical to the baseline period?

```
Mix-Adjusted SR = Σ_i (baseline_share_i × algo_sr_i)

where i indexes each (mode, bank, amount_band) cohort
```

This gives the "pure algorithm effect" stripped of traffic mix changes.

#### 7.1.4 GMV Impact Waterfall

A waterfall chart showing the cumulative GMV recovered by the algorithm, broken down by contribution from each payment mode.

```
Baseline GMV rescued:     ₹X Cr  (baseline SR × baseline GMV)
Uplift from UPI routing:  +₹A Cr
Uplift from Card routing: +₹B Cr
Uplift from NB routing:   +₹C Cr
Algo period GMV rescued:  ₹Y Cr  (algo SR × algo GMV)
─────────────────────────────────────
Net additional GMV saved: ₹(Y-X) Cr
```

---

### 7.2 Payment Gateway Analysis

**Question:** "Which gateways did the algorithm prefer, and did those choices improve SR?"

#### 7.2.1 Gateway Routing Share Shift

The most direct evidence of algorithm behaviour: how did traffic distribution across gateways change?

**Metrics per gateway:**
- Baseline routing share (%): what % of transactions went through this PG
- Algo routing share (%): what % goes through this PG now
- Share delta: +/- percentage points
- Baseline SR for this PG
- Algo SR for this PG
- SR delta for this PG
- Volume change (absolute and %)

**Chart:** Grouped bar chart — one group per PG, two bars per group (before/after share)
**Secondary chart:** Dot plot — each PG is a dot; X-axis = routing share change, Y-axis = SR change. Quadrant labels:
- Top-right: "Algorithm correctly increased traffic AND SR improved" ✅
- Top-left: "SR improved, algorithm reduced traffic" (expected for a bad PG)
- Bottom-right: "Algorithm increased traffic BUT SR worsened" ⚠️ (regression signal)
- Bottom-left: "Algorithm reduced traffic, SR worsened" (expected for a bad PG)

#### 7.2.2 Per-Gateway SR Deep Dive

For each gateway, a comparative card showing:
- SR before vs after (with 95% CI and p-value)
- Volume before vs after
- Whether SR change is statistically significant
- Top failure reasons before vs after (for this gateway)
- Best performing modes on this gateway (before vs after)

#### 7.2.3 Gateway Preference Matrix

A heatmap showing which gateways the algorithm prefers for each payment mode:

| Gateway | UPI | Card | NetBanking | Wallet |
|---|---|---|---|---|
| PG-A | 45% → 62% | 30% → 28% | 15% → 10% | 50% → 55% |
| PG-B | 30% → 20% | 55% → 60% | 70% → 75% | 30% → 28% |
| PG-C | 25% → 18% | 15% → 12% | 15% → 15% | 20% → 17% |

Cell colour: green = algorithm increased share, red = decreased. Cell annotation: routing share % before → after.

#### 7.2.4 Gateway Fallback Analysis

When the algorithm's first-choice gateway fails, what happens?

- How often did fallback routing trigger? (before: 0% since no algo, after: X%)
- Which gateways served as fallback?
- What was the SR on fallback vs first-choice?
- How did fallback routing contribute to overall SR uplift?

---

### 7.3 Payment Mode Analysis

**Question:** "Did the algorithm improve SR equally across UPI, Cards, Net Banking, and Wallets?"

#### 7.3.1 Mode-Level SR Comparison

For each payment mode, a side-by-side comparison:

| Payment Mode | Baseline SR | Baseline Volume | Algo SR | Algo Volume | SR Delta | p-value | Significant? |
|---|---|---|---|---|---|---|---|
| UPI | 78.2% | 4.2M | 83.1% | 4.8M | +4.9pp | <0.001 | ✅ Yes |
| Credit Card | 82.1% | 1.8M | 84.3% | 1.9M | +2.2pp | 0.003 | ✅ Yes |
| Debit Card | 71.3% | 2.1M | 73.8% | 2.0M | +2.5pp | 0.012 | ✅ Yes |
| Net Banking | 88.4% | 0.6M | 89.1% | 0.5M | +0.7pp | 0.21 | ❌ No |
| Wallet | 91.2% | 0.3M | 90.8% | 0.4M | -0.4pp | 0.38 | ❌ No |

**Chart:** Butterfly chart (diverging bar) — modes on Y-axis, SR delta on X-axis. Green bars = improvement, red = regression.

#### 7.3.2 Mode × Gateway Contribution Matrix

Which (mode, gateway) combination drove the most SR uplift?

- 3D-style heatmap: Mode (rows) × Gateway (columns), cell = SR uplift in that combination
- Table: ranked by absolute SR uplift contribution (uplift × volume)

#### 7.3.3 Card Network Analysis (Sub-Mode)

For card payments, break down by card network:

| Network | Baseline SR | Algo SR | SR Delta | Preferred Gateway (Before) | Preferred Gateway (After) |
|---|---|---|---|---|---|
| Visa | 83.4% | 86.1% | +2.7pp | PG-A | PG-A |
| Mastercard | 81.2% | 84.8% | +3.6pp | PG-A | PG-B |
| RuPay | 68.1% | 74.2% | +6.1pp | PG-B | PG-A |
| Amex | 78.9% | 79.4% | +0.5pp | PG-C | PG-C |

---

### 7.4 Bank & Issuer Analysis

**Question:** "Which issuing banks benefited most? Are there any banks where performance regressed?"

This is one of the most granular and important analyses. Bank-level SR is highly variable and the algorithm's ability to route HDFC cards to the PG where HDFC has highest acceptance rate is a core value proposition.

#### 7.4.1 Bank SR Comparison Table

Ranked by transaction volume (top 30 banks):

| Bank | Baseline SR | Algo SR | SR Delta | Volume (Baseline) | Volume (Algo) | Δ Significant? | GMV Impact |
|---|---|---|---|---|---|---|---|
| HDFC Bank | 84.2% | 88.9% | +4.7pp | 2.1M | 2.3M | ✅ p<0.001 | +₹42Cr/mo |
| SBI | 71.3% | 76.8% | +5.5pp | 1.8M | 1.9M | ✅ p<0.001 | +₹28Cr/mo |
| ICICI Bank | 83.1% | 85.4% | +2.3pp | 1.4M | 1.5M | ✅ p<0.001 | +₹18Cr/mo |
| Axis Bank | 79.8% | 80.1% | +0.3pp | 0.9M | 0.9M | ❌ p=0.41 | +₹1Cr/mo |
| Kotak | 77.4% | 75.2% | -2.2pp | 0.4M | 0.5M | ⚠️ p=0.02 | -₹3Cr/mo |

**Chart:** Ranked bar chart, sorted by SR delta. Red bars for regressions. Tooltip: full stats.

#### 7.4.2 Bank × Mode Cohort Heatmap

The most granular view: each cell is a (bank, mode) cohort, coloured by SR delta.

- Rows: top 20 banks by volume
- Columns: payment modes (UPI, Credit Card, Debit Card, Net Banking, Wallet)
- Cell colour: green scale (improvement) / red scale (regression)
- Cell text: SR delta in percentage points
- Click any cell: expand to see gateway routing share shift for that cohort

**This visualisation is the single most powerful proof of algo impact** — it shows exactly where the algorithm is routing correctly and where it is not.

#### 7.4.3 Bank Preferred Gateway Shift

For each major bank, show which gateway the algorithm now prefers vs. before:

| Bank | Mode | Baseline Primary PG | Algo Primary PG | Switched? | SR Change |
|---|---|---|---|---|---|
| HDFC Bank | Credit Card | PG-A (64%) | PG-A (71%) | No | +3.2pp |
| SBI | UPI | PG-B (58%) | PG-A (72%) | ✅ Yes | +7.1pp |
| ICICI | Debit Card | PG-A (52%) | PG-C (61%) | ✅ Yes | +4.3pp |

**Insight generator:** For every bank where the algorithm switched the primary PG, show whether SR improved (validates the switch) or regressed (signals incorrect routing for that bank).

#### 7.4.4 New Bank Discovery

Were there issuing banks that had very low or zero transactions in the baseline period that now appear in the algo period? These represent new card issuers or previously unrouted transactions that the algorithm is now successfully handling.

---

### 7.5 Merchant-Level Analysis

**Question:** "Which merchants improved the most? Which regressed? Does the algo work consistently across all merchant types?"

This is critical for merchant relationship management and for proving the algo doesn't help some merchants at the expense of others.

#### 7.5.1 Merchant SR Change Leaderboard

Ranked table of all merchants by SR improvement, with minimum volume threshold filter (default: 1,000 transactions in algo period to ensure statistical validity).

**Columns:**
- Merchant name / ID
- Merchant category
- Baseline SR (with 95% CI)
- Algo SR (with 95% CI)
- SR Delta (pp)
- p-value (significant Y/N)
- Baseline volume / Algo volume
- GMV impact (₹Cr/month, annualised)
- Primary PG before / Primary PG after (did algo switch their PG?)
- Status badge: 🟢 Improved / 🔴 Regression / 🟡 No Change / ⬛ Insufficient Data

**Filter controls:**
- Minimum transaction volume (slider: 100 – 100,000)
- Merchant category (multi-select)
- SR delta range (slider: -20pp to +20pp)
- Significance filter (show only significant changes)
- Status filter (show regressions only — critical for ops team)

#### 7.5.2 Merchant Category Aggregate Analysis

SR improvement by merchant category:

| Category | Merchants | Baseline SR | Algo SR | SR Delta | GMV Impact |
|---|---|---|---|---|---|
| E-commerce | 2,341 | 79.2% | 83.8% | +4.6pp | +₹87Cr/mo |
| Travel & Transport | 412 | 72.1% | 77.4% | +5.3pp | +₹34Cr/mo |
| Food Delivery | 891 | 88.3% | 89.7% | +1.4pp | +₹12Cr/mo |
| Gaming | 234 | 74.8% | 81.2% | +6.4pp | +₹18Cr/mo |
| Utilities | 156 | 91.4% | 91.8% | +0.4pp | +₹2Cr/mo |
| BFSI | 89 | 83.7% | 84.1% | +0.4pp | +₹3Cr/mo |

**Chart:** Bubble chart — X = baseline SR, Y = algo SR, size = GMV volume, colour = category. Diagonal line = no change. Points above diagonal = improvement.

#### 7.5.3 Merchant Regression Deep Dive

For any merchant showing a statistically significant SR regression (algo SR < baseline SR, p < 0.05):

**Automated root cause analysis:**
1. Did their traffic mix change (more low-SR payment modes)?
2. Did the algo switch them to a different primary PG?
3. Is the regression concentrated in specific banks or modes?
4. Is the regression time-bounded (specific hours or days)?
5. Did other similar merchants (same category, similar volume) also regress?

**Output:** Per-merchant diagnosis card with probable cause and recommended action.

#### 7.5.4 Merchant GMV Impact Distribution

Distribution chart of per-merchant GMV impact:
- Histogram: number of merchants at each GMV impact bucket
- Cumulative curve overlay: % of total GMV impact concentrated in top X% of merchants
- Key insight: "Top 10% of merchants by volume contribute 78% of total GMV uplift"

#### 7.5.5 New Merchant Analysis

Merchants who appear in the algo period but not the baseline period (newly onboarded during algo period). These merchants cannot be compared, but their algo-period SR should be shown as a baseline for future comparison.

---

### 7.6 Temporal & Seasonality Analysis

**Question:** "Does the SR improvement hold consistently across all hours and days, or is it driven by a specific time window?"

This is critical for ruling out seasonality as the cause of observed SR uplift.

#### 7.6.1 Hour-of-Day SR Heatmap

**The single most important temporal visualisation.**

A heatmap where:
- X-axis: Hour of day (0–23)
- Y-axis: Day of week (Mon–Sun)
- Baseline panel vs. Algo panel side by side
- Cell colour: SR (green = high, red = low)
- Third panel: delta heatmap (algo minus baseline)

**Interpretation:** If SR improvement is uniform across all hours and days, it's a strong signal the algorithm is responsible. If improvement only appears in certain hours, it may be a confounder.

#### 7.6.2 Intraday SR Trend

Line chart: Average SR by hour of day for both periods on the same axes.
- Baseline: grey/dashed line with shaded CI
- Algo period: coloured line with shaded CI
- Annotate hours where delta is statistically significant
- Secondary axis: transaction volume by hour (bar chart in background)

**Why this matters:** Routing algorithms often have the most impact during peak hours (6–9 PM) when bank congestion is highest. Seeing a large positive delta during peak hours is strong evidence the algorithm is making better PG choices under load.

#### 7.6.3 Day-of-Week SR Comparison

Bar chart: SR by day of week, before vs after, for each day as a paired bar.
- Include 95% CI error bars
- Highlight any days with statistically significant improvement
- Table below: full stats for each day

#### 7.6.4 Weekly SR Trend (Algo Period Only)

For the algo period: SR by week, with any algorithm parameter changes annotated on the timeline. This shows whether the algo improves over time as it learns, or stays flat.

#### 7.6.5 SR Volatility Analysis

**Standard deviation of daily SR:**
- Baseline SD: how variable was SR day-to-day before algo?
- Algo period SD: is SR more or less volatile with algo?
- Lower volatility = algorithm is stabilising SR (fewer extreme bad days)
- Chart: violin plot or box plot comparing SR distribution shape before vs after

---

### 7.7 Amount Band & Transaction Value Analysis

**Question:** "Did the algorithm improve SR across all transaction sizes, or did it only help small/large transactions?"

#### 7.7.1 Amount Band SR Comparison

| Amount Band | Baseline SR | Baseline Volume | Baseline Avg ₹ | Algo SR | Algo Volume | SR Delta | p-value |
|---|---|---|---|---|---|---|---|
| ₹0 – ₹500 | 88.3% | 2.8M | ₹220 | 89.1% | 3.1M | +0.8pp | 0.002 |
| ₹500 – ₹5,000 | 81.2% | 3.4M | ₹1,850 | 84.7% | 3.6M | +3.5pp | <0.001 |
| ₹5,000 – ₹50,000 | 74.8% | 1.9M | ₹12,400 | 79.3% | 2.0M | +4.5pp | <0.001 |
| ₹50,000+ | 68.1% | 0.4M | ₹1,24,000 | 73.9% | 0.4M | +5.8pp | <0.001 |

**Key insight:** Larger transactions typically have lower SR (more risk controls, more bank friction). If the algorithm shows the highest uplift for large transactions, it's having an outsized positive impact on GMV.

**Chart:** Connected dot plot — each amount band is a row, two dots per row (before/after), connected by a line. Line colour: green if improved, red if regressed.

#### 7.7.2 High-Value Transaction Deep Dive

For transactions above ₹10,000 (configurable threshold):
- Which gateways have highest SR for high-value transactions?
- Did the algorithm correctly route high-value transactions to the best-performing PG?
- What are the failure reasons specific to high-value transactions?
- Merchant-level breakdown for high-value transaction SR

#### 7.7.3 GMV-Weighted SR

Traditional SR treats all transactions equally. GMV-weighted SR weights each transaction by its amount:

```
GMV-Weighted SR = Σ(amount_i × outcome_i) / Σ(amount_i)
```

This is the "₹-terms" SR — what % of the rupee value of attempted transactions was successfully collected. Show both unweighted and GMV-weighted SR, as their difference reveals whether failures are concentrated in high or low-value transactions.

---

### 7.8 Failure Analysis & Root Cause

**Question:** "Did the algorithm reduce failures? Which failure reasons decreased most? Are there any new failure patterns?"

This analysis is the "proof of mechanism" — it shows *why* SR improved, not just *that* it did.

#### 7.8.1 Failure Reason Attribution Waterfall

A waterfall chart starting from baseline failed transactions and building up to algo period failed transactions:

```
Baseline failures:          1,000,000 txns  (100%)
────────────────────────────────────────────────────
Reduction: Bank declines:    -180,000        (-18%)    ← Algorithm routing to banks with better acceptance
Reduction: PG timeouts:      -120,000        (-12%)    ← Routing away from congested PGs
Reduction: Gateway errors:    -80,000         (-8%)    ← Routing to more stable PGs
New: Auth failures:           +15,000         (+1.5%)  ← Slight increase (investigate)
New: Network errors:           +5,000         (+0.5%)  ← Slight increase (investigate)
────────────────────────────────────────────────────
Algo period failures:         640,000 txns   (64%)    ← Net 36% reduction in failures
```

#### 7.8.2 Failure Category Comparison Table

| Failure Category | Baseline Count | Baseline % | Algo Count | Algo % | Change | Comment |
|---|---|---|---|---|---|---|
| Bank Hard Decline | 420K | 42% | 280K | 43.8% | -140K (-33%) | ✅ Major improvement |
| Bank Soft Decline | 180K | 18% | 110K | 17.2% | -70K (-39%) | ✅ Major improvement |
| PG Timeout | 150K | 15% | 85K | 13.3% | -65K (-43%) | ✅ Major improvement |
| PG Technical Error | 110K | 11% | 62K | 9.7% | -48K (-44%) | ✅ Major improvement |
| User Drop-off | 100K | 10% | 72K | 11.3% | -28K (-28%) | ✅ Some improvement |
| Fraud Decline | 25K | 2.5% | 26K | 4.1% | +1K (+4%) | ⚠️ Monitor |
| Auth Failure | 15K | 1.5% | 5K | 0.8% | -10K (-67%) | ✅ Large improvement |

**Chart:** Side-by-side horizontal bar chart (stacked 100%), before and after. Colour-coded by failure category.

#### 7.8.3 Per-Gateway Failure Pattern

For each gateway: which failure reasons are most common, before vs. after?

This reveals whether the algorithm is avoiding gateways with high timeout rates, or routing towards gateways with better bank relationships.

**Chart:** Grouped horizontal bar per gateway, showing top 5 failure reasons by frequency, before vs. after.

#### 7.8.4 Bank Decline Code Analysis

For "bank decline" failures specifically, break down by bank decline reason code:

- `INSUFFICIENT_FUNDS`: expected to stay roughly constant (not routing-driven)
- `CARD_BLOCKED`: expected to stay constant (not routing-driven)
- `TECHNICAL_DECLINE`: should decrease (routing to PGs with better bank connectivity)
- `AUTHENTICATION_FAILED`: may change based on PG 3DS implementation quality
- `EXCEEDED_LIMIT`: should stay constant (not routing-driven)

Seeing a large reduction in `TECHNICAL_DECLINE` (and stable `INSUFFICIENT_FUNDS`) is strong causal evidence that routing improvement — not payment behavior change — drove the SR uplift.

#### 7.8.5 Retry Success Analysis

For transactions that failed on first attempt:
- How many were retried (in both periods)?
- What was the SR on retry attempts?
- Did the algorithm improve retry success rates by choosing better gateways on retry?

---

### 7.9 Routing Behaviour Analysis

**Question:** "Is the algorithm behaving as expected? Is it actually making different routing decisions, not just the same decisions as the old system?"

This section proves that the algorithm is actually *doing something different* — not just labelling the same routing decisions as "algorithm-driven."

#### 7.9.1 Routing Decision Change Rate

```
Routing Decision Change Rate = (# txns where algo_recommended_pg ≠ old_default_pg) / total_txns

If this is close to 0%, the algorithm is not changing routing behaviour → SR uplift from other factors
If this is very high (>50%), the algorithm may be over-routing aggressively
```

For the baseline period: routing change rate = 0% (no algo, all deterministic)
For the algo period: show actual change rate, and correlation with SR improvement

#### 7.9.2 Algorithm Exploration vs. Exploitation Ratio

From the algo-period data:
- What % of transactions went to the algorithm's current "best" PG (exploitation)?
- What % went to a non-best PG (exploration)?
- How does this ratio evolve over time? (should see more exploitation as algo learns)

**Chart:** Area chart — exploration% vs exploitation% over time during algo period.

#### 7.9.3 Routing Decision Quality Score

For each routing decision the algorithm made (where `algo_recommended_pg` is set):
- Was the recommended PG actually the best PG for that context at that time? (using oracle SR from historical data)
- **Decision Quality Score** = % of decisions where algo chose the optimal (or near-optimal) PG
- How does this compare to the baseline default routing?

#### 7.9.4 Context-Conditioned Routing Shift

For each major context dimension, show how routing distribution changed:

**By time of day:**
- During peak hours (6–9 PM), did the algorithm shift traffic away from congested PGs?
- Heatmap: hour × PG, showing routing share change

**By bank:**
- For HDFC card transactions, did routing shift toward the PG with highest HDFC acceptance rate?
- Ranked list of (bank, mode) → PG routing shifts

**By amount:**
- Did the algorithm route high-value transactions differently?

---

### 7.10 Statistical Significance & Confidence

**Question:** "How confident are we that the observed improvements are real and not random noise?"

This section ensures every metric shown in the dashboard has honest statistical backing.

#### 7.10.1 Statistical Methods Applied

| Analysis | Statistical Test | When Applied |
|---|---|---|
| SR comparison (two periods) | Two-proportion z-test | All SR before/after comparisons |
| SR comparison (small samples) | Fisher's exact test | When either period has < 100 transactions |
| Mean comparison (latency, amount) | Welch's t-test | Comparing continuous variables |
| Distribution comparison | Mann-Whitney U test | Non-normal distributions (latency, amount) |
| Multiple comparisons correction | Benjamini-Hochberg FDR | When testing 100+ merchant comparisons simultaneously |
| Effect size | Cohen's h (for proportions) | Alongside p-values to gauge practical significance |
| Minimum detectable effect | Power analysis | Shows minimum SR uplift detectable at current sample size |

#### 7.10.2 Significance Dashboard

A dedicated panel showing the statistical health of the analysis:

- **Total sample size**: baseline N, algo N, and whether sample sizes are adequate
- **Overall SR test result**: z-statistic, p-value, 95% CI, Cohen's h
- **Power analysis**: "At current sample sizes (N_before, N_after), we can detect SR differences of ±X pp with 80% power"
- **Multiple comparison burden**: "X out of Y merchant comparisons are significant at FDR 5%"
- **Effect size guidance**: Small (<0.2), Medium (0.2–0.5), Large (>0.5) Cohen's h labels

#### 7.10.3 Confidence Interval Display Standard

**All percentage metrics in the dashboard must display confidence intervals.** This is non-negotiable.

Format: `84.3% [83.8%, 84.8%]` (95% CI in brackets)

Never show a bare percentage without CI for SR metrics. If CI is too wide (> 5pp), display warning: "⚠️ Wide confidence interval — consider increasing sample size."

#### 7.10.4 Minimum Sample Size Warning

Before showing any cohort-level analysis, compute minimum required sample size:

```python
# Minimum transactions needed to detect 1pp SR uplift at 80% power, α=0.05
from statsmodels.stats.power import NormalIndPower
analysis = NormalIndPower()
n_required = analysis.solve_power(
    effect_size=0.01 / (baseline_sr * (1 - baseline_sr)) ** 0.5,
    alpha=0.05, power=0.80
)
```

Show warning on any cohort with fewer transactions than `n_required`:
> "⚠️ Only 847 transactions in this cohort. Minimum 2,400 needed to detect 1pp SR difference. Results may not be reliable."

---

## 8. Dashboard UI Requirements

### 8.1 Date Range Selection — The Primary Control

The date range selector is the most important UI element in the product. It must be prominent, clear, and prevent common mistakes.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ANALYSIS CONFIGURATION                                                  │
│                                                                          │
│  📅 Baseline Period (Pre-Algorithm)          📅 Algo Period               │
│  ┌─────────────────────────────┐            ┌─────────────────────────┐  │
│  │  From: [Jan 1, 2025    ▼]   │            │ From: [Feb 15, 2025 ▼]  │  │
│  │  To:   [Feb 14, 2025   ▼]   │            │ To:   [Feb 28, 2025 ▼]  │  │
│  │                             │            │                         │  │
│  │  45 days | 28.4M txns       │            │  13 days | 8.1M txns    │  │
│  └─────────────────────────────┘            └─────────────────────────┘  │
│                                                                          │
│  ⚠️  Date ranges must not overlap.                                       │
│  ✅  Sufficient data for analysis (p80 power to detect 0.5pp uplift).   │
│                                                                          │
│  [Run Analysis]    [Save Configuration]    [Load Previous Run]           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Validation rules:**
- Baseline end date must be before algo start date (no overlap)
- Warn if algo period is < 3 days (too short for reliable analysis)
- Warn if baseline period is < 14 days (too short for seasonality baseline)
- Show transaction count and data coverage for each selected period
- Show power analysis estimate based on selected periods' transaction counts

### 8.2 Dashboard Navigation Structure

```
Sidebar Navigation:
┌──────────────────────────────┐
│ 📊 Executive Summary          │  ← Most stakeholders stop here
│ 🌐 Global Analysis           │
│ 🏦 Gateway Analysis          │
│ 💳 Payment Mode Analysis     │
│ 🏛️  Bank & Issuer Analysis    │
│ 🏪 Merchant Analysis         │
│ ⏰ Temporal Analysis          │
│ 💰 Amount Band Analysis      │
│ ❌ Failure Analysis           │
│ 🔀 Routing Behaviour         │
│ 📈 Statistics & Confidence   │
│ ───────────────────────────  │
│ 📄 Export Report             │
│ 💾 Download Data             │
└──────────────────────────────┘
```

### 8.3 Executive Summary Screen

The first screen — designed for a business stakeholder who has 2 minutes.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ALGORITHM IMPACT ANALYSIS                                           │
│  Baseline: Jan 1–Feb 14, 2025 (45 days)  vs  Algo: Feb 15–28 (13d) │
├────────────┬────────────┬───────────────┬───────────────────────────┤
│ VERDICT                                                              │
│                                                                      │
│  ✅ ALGORITHM IS WORKING                                             │
│  Success Rate improved +4.2pp (from 79.1% to 83.3%)                │
│  p < 0.001  |  99% confident  |  Effect size: Large                 │
│  ₹47 Crore additional GMV rescued per month                         │
├────────────┬────────────┬───────────────┬───────────────────────────┤
│ Before SR  │ After SR   │ Uplift        │ GMV Impact               │
│ 79.1%      │ 83.3%      │ +4.2pp        │ +₹47Cr/month             │
│ [82.9–79.3]│[83.1–83.5] │ [3.9–4.5pp]   │ [₹44Cr–₹50Cr]            │
├────────────┴────────────┴───────────────┴───────────────────────────┤
│ KEY FINDINGS                                                         │
│ • All top 5 payment modes improved SR (no regressions)              │
│ • HDFC, SBI, ICICI all show significant improvement                 │
│ • PG routing changed for 34% of transactions                        │
│ • No merchant category showed significant regression                │
│ • Peak hour (6–9 PM) showed largest improvement: +6.1pp            │
├──────────────────────────────────────────────────────────────────────┤
│ ⚠️  ITEMS REQUIRING ATTENTION                                        │
│ • Kotak Bank card transactions: -2.2pp SR (p=0.02, 40K txns)       │
│ • Wallet transactions: not statistically significant (+0.4pp)        │
│ • 23 merchants show significant regression (investigate)             │
└──────────────────────────────────────────────────────────────────────┘
```

**Verdict logic (auto-computed):**
- `✅ WORKING`: Overall SR uplift is statistically significant (p < 0.05) AND positive AND no major mode regressions
- `⚠️ MIXED RESULTS`: SR uplift is significant globally but significant regressions exist in specific segments
- `❌ NOT WORKING`: Overall SR uplift is not statistically significant OR overall SR declined
- `⬛ INSUFFICIENT DATA`: Sample sizes too small for reliable conclusion

### 8.4 Common UI Components

#### Filter Bar (Persistent across all screens)
```
Filters: [Payment Mode: All ▼] [Gateway: All ▼] [Merchant Category: All ▼] [Min Volume: 1,000 ▼] [Amount Band: All ▼]
```
Filters applied client-side to pre-fetched results (no re-query on filter change).

#### Metric Card Standard
Every metric card must show:
- Large number: the primary metric
- Smaller: before vs after values
- 95% CI in brackets
- p-value and significance badge (🟢 Significant / 🟡 Marginal / ⬛ Not Significant)
- Trend arrow: ↑ ↓ ↔

#### Statistical Badge System
```
🟢 p < 0.001   "Highly Significant"
🟢 p < 0.01    "Significant"
🟡 p < 0.05    "Marginally Significant"
⬛ p ≥ 0.05    "Not Significant"
⚠️              "Insufficient sample"
```

---

## 9. Visualisation Catalogue

Complete specification of every chart in the dashboard, with chart type, axes, and purpose.

### 9.1 Global Analysis Charts

| Chart ID | Name | Type | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|
| G-01 | Daily SR Trend | Dual-period line | Date | SR (%) | Show day-by-day SR in both periods |
| G-02 | Traffic Mix Comparison | Grouped bar | Payment Mode | Volume share (%) | Detect traffic mix shift as confounder |
| G-03 | GMV Impact Waterfall | Waterfall bar | Contribution category | GMV (₹Cr) | Show GMV recovery by mode contribution |
| G-04 | SR Distribution | Overlaid histogram | SR value | Frequency | Show spread of daily SR in each period |
| G-05 | Mix-Adjusted SR | Dumbbell plot | Period | SR (%) | Raw vs mix-adjusted SR comparison |

### 9.2 Gateway Analysis Charts

| Chart ID | Name | Type | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|
| GW-01 | Routing Share Shift | Grouped bar | Gateway | Routing share (%) | Show traffic redistribution |
| GW-02 | Routing vs SR Scatter | Quadrant scatter | Share change (pp) | SR change (pp) | Validate algorithm routing decisions |
| GW-03 | Gateway Preference Matrix | Heatmap | Mode | Gateway | Routing share by mode, before→after |
| GW-04 | Per-Gateway SR Comparison | Bar + error bars | Gateway | SR (%) | Parallel comparison of PG performance |
| GW-05 | Gateway Fallback Sankey | Sankey/Flow | Primary PG | Fallback PG | Show fallback routing flow |

### 9.3 Bank & Mode Analysis Charts

| Chart ID | Name | Type | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|
| BM-01 | Bank SR Ranked Bar | Horizontal bar | SR delta (pp) | Bank | Rank banks by SR improvement |
| BM-02 | Bank × Mode Heatmap | Heatmap | Mode | Bank | Cohort-level SR delta matrix |
| BM-03 | Mode SR Butterfly | Diverging bar | SR delta (pp) | Mode | Mode-level SR improvement direction |
| BM-04 | Card Network SR | Grouped bar | Card Network | SR (%) | Card network breakdown |
| BM-05 | Bank PG Preference Shift | Sankey/table | Bank | PG | Which PG each bank now goes to |

### 9.4 Merchant Analysis Charts

| Chart ID | Name | Type | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|
| M-01 | Merchant SR Distribution | Density plot / histogram | SR delta | Merchant count | Distribution of merchant-level improvements |
| M-02 | Merchant Category Bubble | Bubble | Baseline SR | Algo SR | Category performance, size = GMV |
| M-03 | GMV Impact Distribution | Histogram + CDF | GMV impact (₹Cr) | Merchant count | Show GMV concentration |
| M-04 | Regression Merchant Table | Sortable table | — | — | Flagged regressions with diagnosis |
| M-05 | Top 20 Winners/Losers | Paired bar | Merchant | SR before/after | Most impacted merchants |

### 9.5 Temporal Analysis Charts

| Chart ID | Name | Type | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|
| T-01 | Hour × Day SR Heatmap | Dual heatmap | Hour (0-23) | Day of week | Temporal SR pattern, before vs after |
| T-02 | Intraday SR Line | Multi-line | Hour (0-23) | SR (%) | Same-axis before/after hourly SR |
| T-03 | Day-of-Week SR Bars | Grouped bar + CI | Day of week | SR (%) | Day-level comparison with error bars |
| T-04 | Weekly SR Trend (Algo) | Line + annotations | Week | SR (%) | SR stability during algo period |
| T-05 | SR Volatility Box Plot | Box plot | Period | SR (%) | Distribution of daily SR values |

### 9.6 Failure Analysis Charts

| Chart ID | Name | Type | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|
| F-01 | Failure Attribution Waterfall | Waterfall | Failure category | Count | Show net failure reduction by category |
| F-02 | Failure Category Stacked Bar | 100% stacked bar | Period | Failure share (%) | Failure composition shift |
| F-03 | Per-Gateway Failure Bar | Grouped horizontal bar | Failure count | Gateway | Failure reasons per PG |
| F-04 | Bank Decline Code Sankey | Sankey | Decline code | Period | Decline reason flow shift |
| F-05 | Failure Rate by Mode | Grouped bar | Mode | Failure rate (%) | Failure rate improvement per mode |

### 9.7 Amount Band Charts

| Chart ID | Name | Type | X-axis | Y-axis | Purpose |
|---|---|---|---|---|---|
| A-01 | Amount Band SR | Connected dot plot | Period | SR (%) | SR improvement per amount tier |
| A-02 | GMV-Weighted SR | Dumbbell | Period | SR (%) | Unweighted vs GMV-weighted SR |
| A-03 | High-Value Txn SR | Bar + CI | Gateway | SR (%) | High-value routing analysis |
| A-04 | Amount Distribution | Violin plot | Period | Amount (₹) | Transaction size distribution shift |

---

## 10. Functional Requirements

### FR-1: Data Ingestion

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Accept CSV and Parquet files via drag-and-drop upload; support files up to 10GB per upload | P0 |
| FR-1.2 | Support incremental append for "after" data (add new days without full reload) | P0 |
| FR-1.3 | Validate schema on upload: check required columns, data types, value ranges | P0 |
| FR-1.4 | Deduplicate by `transaction_id` on ingestion (idempotent uploads) | P0 |
| FR-1.5 | Assign `period` tag ('before'/'after') based on user-specified period at upload time | P0 |
| FR-1.6 | Support direct database connection as alternative to file upload (PostgreSQL, MySQL, BigQuery) | P2 |
| FR-1.7 | Show ingestion progress: rows processed, duplicates removed, validation errors | P1 |
| FR-1.8 | Auto-compute and store pre-aggregated tables (daily_cohort_sr, merchant_daily_sr) on ingestion | P0 |
| FR-1.9 | PII masking: hash `transaction_id` and `merchant_id` if configured | P1 |

### FR-2: Analysis Configuration

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Date range picker: separate selectors for baseline start/end and algo start/end | P0 |
| FR-2.2 | Validate: no date range overlap; warn if algo period < 3 days; warn if baseline < 14 days | P0 |
| FR-2.3 | Show transaction count and coverage percentage for each selected period before running | P0 |
| FR-2.4 | Show power analysis estimate (minimum detectable effect) for selected sample sizes | P1 |
| FR-2.5 | Allow saving analysis configurations and reloading them | P1 |
| FR-2.6 | Allow comparing two algo periods against the same baseline (e.g., week 1 vs week 2 of algo) | P2 |

### FR-3: Analysis Engine

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | All 10 analysis modules run in parallel; results delivered within 60 seconds | P0 |
| FR-3.2 | Global SR comparison with two-proportion z-test, 95% CI, Cohen's h | P0 |
| FR-3.3 | Traffic mix normalisation: compute mix-adjusted SR uplift | P0 |
| FR-3.4 | Merchant-level analysis: support 10,000+ distinct merchants with FDR correction | P0 |
| FR-3.5 | Gateway routing share shift analysis with per-PG statistical tests | P0 |
| FR-3.6 | Bank × Mode cohort heatmap: all combinations of top 30 banks × 5 modes | P0 |
| FR-3.7 | Temporal analysis: hour-of-day × day-of-week SR heatmap for both periods | P0 |
| FR-3.8 | Failure reason attribution with waterfall computation | P0 |
| FR-3.9 | Amount band analysis with GMV-weighted SR computation | P1 |
| FR-3.10 | Routing behaviour analysis (change rate, exploration/exploitation ratio) | P1 |
| FR-3.11 | Minimum sample size check before showing cohort results; display warnings | P0 |
| FR-3.12 | Multiple comparison correction (Benjamini-Hochberg) on merchant-level tests | P0 |

### FR-4: Dashboard UI

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Executive Summary screen with auto-computed verdict (Working / Mixed / Not Working) | P0 |
| FR-4.2 | All 9 analysis screens with full visualisation catalogue (37 charts total) | P0 |
| FR-4.3 | Persistent filter bar: payment mode, gateway, merchant category, min volume, amount band | P1 |
| FR-4.4 | All filters apply client-side without re-running analysis | P1 |
| FR-4.5 | All percentage metrics display 95% CI in brackets; significance badge displayed | P0 |
| FR-4.6 | Click-through from any chart to supporting data table | P1 |
| FR-4.7 | Merchant regression drill-down: click merchant → auto-generated root cause diagnosis | P1 |
| FR-4.8 | All charts: hover tooltips with exact values, sample sizes, and CIs | P0 |
| FR-4.9 | Export any chart as PNG | P2 |

### FR-5: Export & Sharing

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | PDF report: all sections, all charts, all statistics, generated in < 60 seconds | P0 |
| FR-5.2 | CSV export: full analysis results for every module | P1 |
| FR-5.3 | Share link: read-only access to analysis results, valid 30 days | P2 |
| FR-5.4 | Analysis run history: list of past analyses with key metrics | P1 |

---

## 11. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| **Performance** | Analysis of 50M baseline + 5M algo transactions | < 60 seconds total |
| **Performance** | Dashboard page load (results already computed) | < 2 seconds |
| **Performance** | Client-side filter application (no re-query) | < 200ms |
| **Performance** | PDF export generation | < 90 seconds |
| **Scale** | Maximum database size supported | 200M total transactions |
| **Scale** | Maximum distinct merchants | 50,000 |
| **Reliability** | Analysis run failure recovery (restart from checkpoint) | Resume in < 30 seconds |
| **Accuracy** | All SR metrics match manual SQL calculation | ≤ 0.001% error |
| **Accuracy** | Statistical test results match scipy reference | ≤ 0.0001 p-value error |
| **Storage** | Storage for 200M transactions (Parquet, compressed) | ≤ 20 GB |
| **Security** | No transaction data egress from deployment | Air-gapped mode supported |
| **Usability** | PM persona completes first analysis unaided | < 10 minutes |

---

## 12. Database & Performance Architecture

### 12.1 Why DuckDB

For 50M+ transaction analysis, DuckDB is the optimal embedded engine:

- **Columnar storage**: queries only read columns needed (date, sr, merchant_id, etc.) — 10x faster than row stores
- **Vectorised execution**: SIMD-accelerated aggregations on large datasets
- **Parquet-native**: reads compressed Parquet directly without loading to memory
- **Zero server setup**: embedded in the Python process, runs on a laptop or small VM
- **Proven scale**: benchmarks show 50M row aggregation queries in 2–5 seconds on commodity hardware

### 12.2 Partitioning Strategy

```
data/
├── transactions/
│   ├── period=before/
│   │   ├── year=2025/month=01/day=01/part-0001.parquet
│   │   ├── year=2025/month=01/day=02/part-0001.parquet
│   │   └── ... (one file per day)
│   └── period=after/
│       ├── year=2025/month=02/day=15/part-0001.parquet
│       └── ...
├── aggregates/
│   ├── daily_cohort_sr.parquet
│   ├── merchant_daily_sr.parquet
│   └── daily_gateway_share.parquet
└── analysis_runs/
    └── {run_id}.json
```

Partitioning by (period, year, month, day) enables DuckDB's partition pruning — when a user selects date range Jan 1–Feb 14, only those 45 day-partitions are scanned.

### 12.3 Query Optimisation

```sql
-- Example: optimised global SR query using pre-aggregated table
SELECT
    period,
    SUM(total_txns) AS total_txns,
    SUM(successful_txns) AS successful_txns,
    SUM(successful_txns)::FLOAT / SUM(total_txns) AS sr,
    SUM(total_gmv) AS total_gmv
FROM daily_cohort_sr
WHERE date BETWEEN ? AND ?           -- baseline range
   OR date BETWEEN ? AND ?           -- algo range
GROUP BY period;

-- This scans the pre-aggregated table (much smaller than raw transactions)
-- Returns in < 100ms for 50M underlying transactions
```

### 12.4 Parallel Analysis Execution

```python
# engine/analysis_orchestrator.py
from concurrent.futures import ProcessPoolExecutor

def run_analysis(config: AnalysisConfig) -> AnalysisResults:
    modules = [
        GlobalAnalysisModule,
        GatewayAnalysisModule,
        ModeAnalysisModule,
        BankAnalysisModule,
        MerchantAnalysisModule,
        TemporalAnalysisModule,
        AmountAnalysisModule,
        FailureAnalysisModule,
        RoutingBehaviourModule,
        StatisticsModule,
    ]

    with ProcessPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(module().run, config): module.__name__
            for module in modules
        }
        results = {}
        for future in as_completed(futures):
            module_name = futures[future]
            results[module_name] = future.result()

    return AnalysisResults(**results)
```

---

## 13. Tech Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| **Database** | DuckDB | 0.10+ | In-process OLAP; 50M rows in < 5s; columnar; Parquet-native |
| **Data Format** | Parquet (Snappy compression) | — | 5–10x compression vs CSV; partition pruning; fast column reads |
| **Analysis Engine** | Python | 3.11+ | NumPy/Pandas/SciPy ecosystem |
| **Statistical Tests** | SciPy + Statsmodels | Latest | z-tests, t-tests, Mann-Whitney, power analysis |
| **API Layer** | FastAPI | 0.110+ | Async endpoints; efficient streaming of analysis results |
| **Frontend** | React 18 + TypeScript | — | Type-safe; rich chart ecosystem |
| **Charts** | Recharts (standard) + D3.js (custom heatmaps) | — | Recharts for bars/lines; D3 for hour×day heatmap |
| **PDF Export** | Puppeteer (headless Chrome) | — | Pixel-perfect PDF of HTML charts |
| **Containerisation** | Docker + Docker Compose | — | One-command deployment |

### 13.1 Project Structure

```
pg-impact-analysis/
├── ingestion/
│   ├── ingestor.py              # CSV/Parquet upload, validation, dedup
│   ├── schema_validator.py      # Schema checking and type coercion
│   ├── partitioner.py           # Write to partitioned Parquet store
│   └── aggregator.py            # Build daily_cohort_sr and other MVs
├── database/
│   ├── duck.py                  # DuckDB connection + query helpers
│   ├── schema.sql               # Table definitions
│   └── migrations/              # Schema version management
├── analysis/
│   ├── orchestrator.py          # Parallel module runner
│   ├── config.py                # AnalysisConfig dataclass
│   ├── modules/
│   │   ├── base.py              # BaseAnalysisModule interface
│   │   ├── global_module.py     # Global SR, GMV, mix adjustment
│   │   ├── gateway_module.py    # Gateway routing share + SR
│   │   ├── mode_module.py       # Payment mode analysis
│   │   ├── bank_module.py       # Bank + bank×mode cohort
│   │   ├── merchant_module.py   # Merchant leaderboard + regressions
│   │   ├── temporal_module.py   # Hour×day heatmap, volatility
│   │   ├── amount_module.py     # Amount band + GMV-weighted SR
│   │   ├── failure_module.py    # Failure attribution waterfall
│   │   ├── routing_module.py    # Routing behaviour analysis
│   │   └── statistics_module.py # Significance, power, FDR
│   └── stats/
│       ├── tests.py             # Statistical test implementations
│       ├── power.py             # Sample size and power calculations
│       └── mix_adjust.py        # Traffic mix normalisation
├── api/
│   ├── main.py                  # FastAPI app
│   └── routes/
│       ├── ingestion.py         # POST /data/upload, /data/append
│       ├── analysis.py          # POST /analysis/run, GET /analysis/:id
│       └── export.py            # GET /export/pdf, /export/csv
├── frontend/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── ExecutiveSummary/
│   │   │   ├── GlobalAnalysis/
│   │   │   ├── GatewayAnalysis/
│   │   │   ├── ModeAnalysis/
│   │   │   ├── BankAnalysis/
│   │   │   ├── MerchantAnalysis/
│   │   │   ├── TemporalAnalysis/
│   │   │   ├── AmountAnalysis/
│   │   │   ├── FailureAnalysis/
│   │   │   ├── RoutingBehaviour/
│   │   │   └── Statistics/
│   │   ├── components/
│   │   │   ├── MetricCard/      # Standard metric card with CI
│   │   │   ├── SignificanceBadge/
│   │   │   ├── DateRangePicker/
│   │   │   ├── FilterBar/
│   │   │   └── charts/          # All 37 chart components
│   │   └── api/                 # API client
│   └── package.json
├── reporting/
│   ├── pdf_generator.py         # Puppeteer-based PDF export
│   └── csv_exporter.py          # CSV generation for all modules
├── docker-compose.yml
└── README.md
```

---

## 14. Milestones & Delivery Plan

**Team:** 1 Backend Engineer, 1 Data Engineer, 1 Frontend Engineer, 1 Data Scientist, 0.5 PM
**Total Duration:** 16 weeks

| Milestone | Deliverables | Duration | Exit Criteria |
|---|---|---|---|
| **M1: Data Foundation** | DuckDB schema, ingestion pipeline, Parquet partitioner, pre-aggregation, deduplication, schema validator | 3 weeks | 50M row dataset loaded and queryable in < 5s; daily_cohort_sr accurate |
| **M2: Analysis Engine Core** | Global, Gateway, Mode, Bank modules; stats engine (z-tests, CI, Cohen's h); mix-adjustment; parallel orchestrator | 3 weeks | All 4 modules produce correct results vs manual SQL; runs in < 60s on 50M rows |
| **M3: Deep Analysis Modules** | Merchant, Temporal, Amount, Failure, Routing Behaviour, Statistics modules; FDR correction; power analysis | 3 weeks | Merchant analysis works on 10K merchants; all 37 chart data endpoints functional |
| **M4: API Layer** | FastAPI endpoints for ingestion, analysis, export; incremental append support; analysis run persistence | 1 week | Full API test suite passes; incremental append works correctly |
| **M5: UI — Core Screens** | Executive Summary, Global, Gateway, Mode screens fully implemented with all charts | 3 weeks | PM persona reads Executive Summary and understands verdict without assistance |
| **M6: UI — Deep Screens** | Bank, Merchant, Temporal, Amount, Failure, Routing, Statistics screens | 2 weeks | Data scientist can complete full diagnostic analysis within dashboard |
| **M7: Export & Polish** | PDF report generation, CSV export, filter bar, tooltips, error states, performance optimisation | 1 week | PDF exports in < 90s; all P0 NFRs pass; UAT with 3 internal users |

---

## 15. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| **Seasonality confounder**: SR improves in algo period due to Diwali/IPL/year-end, not the algorithm | High — false positive verdict | Medium | Mix-adjusted SR + hour×day heatmap make this visible; user must confirm confounder checks before accepting verdict |
| **Volume change**: algo period has 2x transaction volume, inflating SR (larger denominator effect) | Medium | Low | All SR comparisons use proportion tests (not absolute counts); volume change is explicitly shown and noted |
| **50M row query too slow** for 60s target on standard hardware | High — unusable product | Medium | Pre-aggregated tables serve most queries in < 100ms; raw table only queried when necessary; document minimum hardware spec |
| **Merchant churn**: merchants who churned between periods distort merchant-level analysis | Medium | Medium | Flag merchants present in only one period; exclude from SR comparison analysis; show separately |
| **Data quality**: uploaded "after" data has gaps (missing days) creating artificial SR dips | High — misleading analysis | Medium | Data coverage checker shows % of dates with data; warn if > 5% of dates in selected range have zero transactions |
| **Multiple comparisons inflation**: testing 10K merchants with p < 0.05 would flag 500 as significant by chance | High — false regression alerts | Low | Benjamini-Hochberg FDR correction mandatory for merchant-level tests; shown prominently in Statistics screen |
| **PG outage during algo period**: a gateway going down inflates SR of remaining PGs | Medium | Low | Annotate detected gateway outages on all time series; offer to exclude outage windows from analysis |

---

## 16. Acceptance Criteria

### 16.1 Data Ingestion
- [ ] 50M row Parquet file ingests in < 10 minutes
- [ ] Duplicate transactions (same `transaction_id`) are silently deduplicated; count reported post-ingestion
- [ ] Schema validation catches and reports missing required columns before ingestion proceeds
- [ ] Incremental append adds 1M new "after" rows in < 2 minutes without touching existing data

### 16.2 Analysis Correctness
- [ ] Global SR matches manual calculation: `SUM(outcome) / COUNT(*)` on raw transactions for selected date range
- [ ] Two-proportion z-test result matches scipy's `proportions_ztest` on the same inputs (tolerance: 0.0001)
- [ ] Mix-adjusted SR matches manual computation using baseline mode shares applied to algo-period mode SRs
- [ ] Merchant leaderboard SR values match per-merchant manual SQL groupby for all merchants with > 1,000 transactions
- [ ] Benjamini-Hochberg correction applied on merchant tests: confirmed by comparing uncorrected vs corrected p-values on a known dataset

### 16.3 Performance
- [ ] Full analysis (all 10 modules) completes in < 60 seconds on 50M baseline + 5M algo transactions (8 vCPU, 16GB RAM)
- [ ] Dashboard loads analysis results in < 2 seconds (results pre-computed)
- [ ] Client-side filter application (mode, gateway, category) takes < 200ms

### 16.4 UI / UX
- [ ] PM persona reads Executive Summary and correctly identifies verdict (Working / Mixed / Not Working) without explanation
- [ ] All charts display 95% CI on SR metrics; significance badge shown for every percentage comparison
- [ ] Merchant regression drill-down generates automated root cause text for at least 3 diagnosis patterns (traffic mix shift, PG switch, time-specific)
- [ ] Executive Summary verdict is correct for three reference datasets with known ground truth

---

## 17. Appendix: SQL Query Reference

Core queries used by the analysis engine. All queries operate on the `daily_cohort_sr` pre-aggregated table for performance.

### Global SR Comparison

```sql
SELECT
    period,
    SUM(total_txns) AS total_txns,
    SUM(successful_txns) AS successful_txns,
    ROUND(SUM(successful_txns)::FLOAT / SUM(total_txns), 6) AS sr,
    SUM(total_gmv) AS total_gmv
FROM daily_cohort_sr
WHERE (period = 'before' AND date BETWEEN :baseline_start AND :baseline_end)
   OR (period = 'after'  AND date BETWEEN :algo_start AND :algo_end)
GROUP BY period;
```

### Gateway Routing Share Shift

```sql
SELECT
    period,
    payment_gateway,
    SUM(total_txns) AS total_txns,
    ROUND(SUM(total_txns) * 100.0 / SUM(SUM(total_txns)) OVER (PARTITION BY period), 4) AS share_pct,
    ROUND(SUM(successful_txns)::FLOAT / SUM(total_txns), 6) AS sr,
    SUM(total_gmv) AS total_gmv
FROM daily_cohort_sr
WHERE (period = 'before' AND date BETWEEN :baseline_start AND :baseline_end)
   OR (period = 'after'  AND date BETWEEN :algo_start AND :algo_end)
GROUP BY period, payment_gateway
ORDER BY period, total_txns DESC;
```

### Bank × Mode Cohort Heatmap

```sql
SELECT
    period,
    issuing_bank,
    payment_mode,
    SUM(total_txns) AS total_txns,
    ROUND(SUM(successful_txns)::FLOAT / SUM(total_txns), 6) AS sr
FROM daily_cohort_sr
WHERE (period = 'before' AND date BETWEEN :baseline_start AND :baseline_end)
   OR (period = 'after'  AND date BETWEEN :algo_start AND :algo_end)
  AND issuing_bank IN (
    -- Top 30 banks by total volume
    SELECT issuing_bank FROM daily_cohort_sr
    GROUP BY issuing_bank ORDER BY SUM(total_txns) DESC LIMIT 30
  )
GROUP BY period, issuing_bank, payment_mode;
```

### Merchant SR Leaderboard

```sql
SELECT
    m.merchant_id,
    m.merchant_name,
    m.merchant_category,
    SUM(CASE WHEN m.period = 'before' THEN m.total_txns ELSE 0 END) AS baseline_txns,
    ROUND(SUM(CASE WHEN m.period = 'before' THEN m.successful_txns ELSE 0 END)::FLOAT /
          NULLIF(SUM(CASE WHEN m.period = 'before' THEN m.total_txns ELSE 0 END), 0), 6) AS baseline_sr,
    SUM(CASE WHEN m.period = 'after' THEN m.total_txns ELSE 0 END) AS algo_txns,
    ROUND(SUM(CASE WHEN m.period = 'after' THEN m.successful_txns ELSE 0 END)::FLOAT /
          NULLIF(SUM(CASE WHEN m.period = 'after' THEN m.total_txns ELSE 0 END), 0), 6) AS algo_sr,
    ROUND(SUM(CASE WHEN m.period = 'after' THEN m.total_gmv ELSE 0 END), 2) AS algo_gmv
FROM merchant_daily_sr m
WHERE (m.period = 'before' AND m.date BETWEEN :baseline_start AND :baseline_end)
   OR (m.period = 'after'  AND m.date BETWEEN :algo_start AND :algo_end)
GROUP BY m.merchant_id, m.merchant_name, m.merchant_category
HAVING SUM(CASE WHEN m.period = 'after' THEN m.total_txns ELSE 0 END) >= :min_volume
ORDER BY (algo_sr - baseline_sr) DESC;
```

### Hour × Day SR Heatmap

```sql
SELECT
    period,
    day_of_week,
    hour_of_day,
    SUM(total_txns) AS total_txns,
    ROUND(SUM(successful_txns)::FLOAT / SUM(total_txns), 6) AS sr
FROM daily_cohort_sr
WHERE (period = 'before' AND date BETWEEN :baseline_start AND :baseline_end)
   OR (period = 'after'  AND date BETWEEN :algo_start AND :algo_end)
GROUP BY period, day_of_week, hour_of_day
ORDER BY period, day_of_week, hour_of_day;
```

### Mix-Adjusted SR

```sql
-- Step 1: Compute baseline traffic share per (mode, bank, amount_band) cohort
WITH baseline_shares AS (
    SELECT
        payment_mode, issuing_bank, amount_band,
        SUM(total_txns) AS cohort_txns,
        SUM(total_txns)::FLOAT / SUM(SUM(total_txns)) OVER () AS share
    FROM daily_cohort_sr
    WHERE period = 'before' AND date BETWEEN :baseline_start AND :baseline_end
    GROUP BY payment_mode, issuing_bank, amount_band
),
-- Step 2: Compute algo-period SR per same cohort
algo_sr AS (
    SELECT
        payment_mode, issuing_bank, amount_band,
        SUM(successful_txns)::FLOAT / SUM(total_txns) AS cohort_sr
    FROM daily_cohort_sr
    WHERE period = 'after' AND date BETWEEN :algo_start AND :algo_end
    GROUP BY payment_mode, issuing_bank, amount_band
)
-- Step 3: Mix-adjusted SR = sum of (baseline_share × algo_sr)
SELECT ROUND(SUM(b.share * a.cohort_sr), 6) AS mix_adjusted_sr
FROM baseline_shares b
JOIN algo_sr a USING (payment_mode, issuing_bank, amount_band);
```

### Failure Attribution

```sql
SELECT
    period,
    failure_category,
    SUM(total_txns) AS failed_txns
FROM daily_cohort_sr
WHERE outcome_type = 'failure'    -- assuming pre-split table; adjust for actual schema
  AND ((period = 'before' AND date BETWEEN :baseline_start AND :baseline_end)
    OR (period = 'after'  AND date BETWEEN :algo_start AND :algo_end))
GROUP BY period, failure_category
ORDER BY period, failed_txns DESC;
```

---

### Key API Endpoints

```
# Data Ingestion
POST   /api/data/upload                  Upload before/after CSV or Parquet file
POST   /api/data/append                  Append new after-period transactions
GET    /api/data/status                  DB stats: row count, date coverage, periods loaded
GET    /api/data/quality                 Data quality report: missing values, coverage gaps

# Analysis
POST   /api/analysis/run                 Start analysis: { baseline_start, baseline_end, algo_start, algo_end }
GET    /api/analysis/:run_id             Poll analysis status + retrieve results
GET    /api/analysis/history             List all past analysis runs

# Results (all return pre-computed results from a run)
GET    /api/results/:run_id/global       Global SR, GMV, mix-adjustment
GET    /api/results/:run_id/gateways     Gateway routing share + SR comparison
GET    /api/results/:run_id/modes        Payment mode analysis
GET    /api/results/:run_id/banks        Bank + bank×mode cohort matrix
GET    /api/results/:run_id/merchants    Merchant leaderboard (paginated, filterable)
GET    /api/results/:run_id/temporal     Hour×day heatmap data
GET    /api/results/:run_id/amounts      Amount band analysis
GET    /api/results/:run_id/failures     Failure attribution waterfall
GET    /api/results/:run_id/routing      Routing behaviour metrics
GET    /api/results/:run_id/statistics   Statistical significance summary

# Export
GET    /api/export/:run_id/pdf           Download full PDF report
GET    /api/export/:run_id/csv/:module   Download CSV for specific module
POST   /api/export/:run_id/share         Create read-only share link
```

---

*Algorithm Impact Analysis Dashboard — PRD v1.0 — CONFIDENTIAL*
*This document is the authoritative source of truth for the Impact Analysis feature scope and design.*

# Dynamic SR Simulation Sandbox
## Product Requirements Document — v1.0

> **Status:** DRAFT — For Engineering Review
> **Classification:** INTERNAL
> **Feature Type:** New Feature — Extends PG Routing Simulator
> **Parent Product:** PG Routing Algorithm Simulator
> **Target Users:** Algorithm Developers, Data Scientists, Payments Engineers
> **Reviewed By:** Engineering Lead, Head of Payments

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Motivation](#2-problem-statement--motivation)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [User Personas](#4-user-personas)
5. [Feature Overview & Mental Model](#5-feature-overview--mental-model)
6. [Core Concepts & Terminology](#6-core-concepts--terminology)
7. [User Flows](#7-user-flows)
8. [UI Requirements — Full Specification](#8-ui-requirements--full-specification)
   - 8.1 [PG Configuration Panel](#81-pg-configuration-panel)
   - 8.2 [Algorithm Selection Panel](#82-algorithm-selection-panel)
   - 8.3 [Simulation Control Bar](#83-simulation-control-bar)
   - 8.4 [Live SR Manipulation Panel](#84-live-sr-manipulation-panel)
   - 8.5 [Real-time Metrics Dashboard](#85-real-time-metrics-dashboard)
   - 8.6 [Convergence Analysis Panel](#86-convergence-analysis-panel)
   - 8.7 [Event Timeline](#87-event-timeline)
   - 8.8 [Per-PG Deep Dive Panel](#88-per-pg-deep-dive-panel)
9. [Simulation Engine Requirements](#9-simulation-engine-requirements)
   - 9.1 [Traffic Generation Model](#91-traffic-generation-model)
   - 9.2 [SR Model & Noise](#92-sr-model--noise)
   - 9.3 [Pause / Resume Mechanics](#93-pause--resume-mechanics)
   - 9.4 [SR Change Application](#94-sr-change-application)
   - 9.5 [Convergence Detection](#95-convergence-detection)
   - 9.6 [Algorithm State Management](#96-algorithm-state-management)
10. [Scenario System](#10-scenario-system)
11. [Metrics & Measurements](#11-metrics--measurements)
12. [Data Models](#12-data-models)
13. [Functional Requirements](#13-functional-requirements)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Tech Stack & Architecture](#15-tech-stack--architecture)
16. [Milestones & Delivery Plan](#16-milestones--delivery-plan)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Appendix: Algorithm State Equations](#18-appendix-algorithm-state-equations)

---

## 1. Executive Summary

When a routing algorithm is deployed to production, engineers need to understand a fundamental property: **how quickly does it respond to sudden changes in gateway quality?** If PG-A's success rate drops from 92% to 15% due to a bank outage, how many transactions does the algorithm waste on PG-A before it routes traffic away? And when PG-A recovers, how long before the algorithm trusts it again?

Today, answering these questions requires running the full simulator against historical data with injected outage events — a slow, indirect process. Engineers cannot interactively "turn the knob" on a gateway's SR and watch the algorithm's reaction in real time.

The **Dynamic SR Simulation Sandbox** is an interactive, real-time playground where users define a gateway environment from scratch, choose a routing algorithm, run live simulated traffic, and at any moment **pause the simulation, drag sliders to change each PG's SR, resume traffic, and observe exactly how fast the algorithm detects and adapts** to the new reality.

It is a controlled laboratory for routing algorithm behaviour — no historical data needed, no batch processing, results in seconds.

> **Core Value Proposition:** Give any engineer a knob. Let them break a gateway. Watch the algorithm react. Measure the damage. Repeat until they understand the algorithm deeply enough to tune it for production.

---

## 2. Problem Statement & Motivation

### 2.1 The Calibration Problem

Routing algorithms have hyperparameters — window size, discount factor, epsilon — that control the speed vs. accuracy trade-off. A large window makes SR estimates stable but slow to react to outages. A small window reacts fast but produces noisy estimates on sparse data.

The correct hyperparameter setting depends on the **frequency and severity of SR changes in production**. But engineers have no interactive way to test: "If I set window=50, how fast does it react to a gateway dropping from 90% to 20%?" They must run full simulations, read output logs, adjust, and repeat — a slow feedback loop.

### 2.2 The "Convergence" Knowledge Gap

Every routing algorithm has a **convergence latency** after a SR change — the number of transactions it takes to statistically detect the change and shift routing behaviour accordingly. This is the hidden cost of every gateway outage: it's not just the downtime, it's the algorithm's delayed reaction.

Engineers currently have no tool to:
- Measure convergence latency precisely
- Compare convergence latency across algorithms with identical conditions
- Understand how convergence latency scales with outage severity (5% SR drop vs 60% drop)
- Identify the "recovery overshoot" problem: algorithms that route too aggressively back to a recovered PG

### 2.3 Why Interactive Sliders?

The slider interaction is the key design insight. SR changes in production are not discrete events that happen at known times — they are continuous, often gradual, and sometimes multi-step. An engineer needs to:

- **Drag a slider down** to simulate a PG slowly degrading
- **Snap a slider to zero** to simulate an instant outage
- **Drag a slider back up in stages** to simulate partial recovery
- **Change two PGs simultaneously** to simulate traffic redistribution

This level of experimentation is impossible with batch simulation. It requires real-time interactive control.

### 2.4 Existing Gap in the Simulator

The existing PG Routing Algorithm Simulator supports:
- Replay of historical transaction data
- Fixed synthetic scenario templates (e.g., "Gateway Outage at T=5000")

What it **does not support**:
- User-defined PG environments (choose your own number of PGs, set their SR)
- Live SR modification mid-simulation
- Pause/resume with state preservation
- Real-time convergence measurement
- Interactive comparison of two algorithms under identical SR shock

---

## 3. Goals & Non-Goals

### 3.1 Goals

| ID | Goal | Success Metric |
|---|---|---|
| **G1** | User can define 2–10 PGs with custom names and initial SR values | PG config saved and simulation starts within 5 seconds |
| **G2** | Simulation runs live traffic at configurable speed (100–10,000 txns/sec simulated time) | UI updates smoothly at ≥ 30 fps at all simulation speeds |
| **G3** | User can pause simulation, adjust any PG's SR via slider, and resume | State perfectly preserved across pause/resume; SR applied exactly at resume |
| **G4** | Convergence latency measured and displayed after every SR change event | Convergence latency displayed in transactions and real-time seconds within 5s of convergence |
| **G5** | Run up to 3 algorithms simultaneously under identical conditions for direct comparison | All algorithms receive identical transaction stream; results shown side by side |
| **G6** | Event timeline shows every SR change, pause, and convergence event with full context | Every event annotated on all charts with timestamp, delta, and per-algorithm response |
| **G7** | Save and share simulation configurations and replay SR change sequences | Config exported as JSON; any saved config reproducible with same random seed |
| **G8** | Pre-built scenario library with 8+ named scenarios | Each scenario loads in < 2s and immediately starts running |

### 3.2 Non-Goals

| Non-Goal | Rationale |
|---|---|
| Historical data replay | This feature is for synthetic/live environments only; replay is handled by the existing Simulator |
| Production routing decisions | This is a research and education sandbox, not a live routing system |
| Network latency simulation | Gateway SR is the only variable; latency simulation is out of scope |
| Fraud / risk simulation | Out of scope; all transactions are treated as non-fraudulent |
| More than 10 PGs | Beyond 10, the UI becomes unreadable; 10 is the validated maximum |

---

## 4. User Personas

| Persona | Background | Primary Goal | How They Use This Feature |
|---|---|---|---|
| **Algorithm Developer** | ML/data science background | Tune hyperparameters for production | Set up their exact production PG environment; test different window sizes; measure convergence latency at each setting |
| **Payments Engineer** | Backend engineering | Understand algorithm behaviour for implementation | Run "outage drill" scenarios; verify algorithm routes away from bad PG within acceptable transaction count |
| **New Team Member** | Any background | Learn how routing algorithms work | Use pre-built scenarios with explanatory text; watch real-time routing decisions to build intuition |
| **Payments PM** | Product background | Build intuition for algorithm properties | Use pre-built scenarios; watch the "Convergence Story" panel that explains in plain English what is happening |

---

## 5. Feature Overview & Mental Model

### 5.1 The Simulation Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIMULATION LOOP                               │
│                                                                  │
│  1. TICK: Generate synthetic transaction                         │
│     • Random context (mode, bank, amount)                        │
│     • No historical data needed                                  │
│                                                                  │
│  2. ROUTE: Each algorithm calls select(context)                  │
│     • Returns chosen PG                                          │
│     • Logged for comparison                                      │
│                                                                  │
│  3. OUTCOME: Resolve success/failure                             │
│     • success = (random() < current_sr[chosen_pg])              │
│     • SR is the user-set slider value + noise                    │
│                                                                  │
│  4. UPDATE: Each algorithm calls update(pg, reward)             │
│     • Algorithm internal state updated                           │
│                                                                  │
│  5. METRICS: Update all real-time charts                         │
│     • Routing share, SR estimates, regret, convergence           │
│                                                                  │
│  ↕  PAUSE: User drags sliders to change SR values               │
│     • Simulation frozen; state preserved                         │
│     • SR changes staged but not applied yet                      │
│                                                                  │
│  ↕  RESUME: New SR values take effect at next tick              │
│     • Convergence measurement starts                             │
│     • Event logged on timeline                                   │
│                                                                  │
│  6. REPEAT from step 1                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 What "Convergence" Means

When a PG's SR changes, the algorithm does not instantly know. It must observe enough new outcomes to statistically detect the change. The **convergence point** is defined as:

> The first transaction T after a SR change event where the algorithm's routing share for the changed PG shifts more than 10% (configurable) in the correct direction AND stays shifted for at least 20 consecutive transactions.

**Convergence latency** = T − T_change_event

This is the core metric the feature measures.

### 5.3 The Three Phases of Every SR Change

Every slider drag creates a three-phase narrative that the UI makes visible:

```
Phase 1: BLINDNESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SR changes at T=0. Algorithm has no idea yet.
Still routing traffic to the changed PG at old rates.
Each transaction on this PG is at the new (worse) SR.
"Damage" is accumulating: unnecessary failures.

Phase 2: DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Algorithm starts seeing failures on the changed PG.
SR estimate starts drifting toward true value.
Routing share begins to shift.
Different algorithms exit Phase 1 at different speeds.

Phase 3: CONVERGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Algorithm's routing behaviour has fully adapted.
Routing share stabilised at new equilibrium.
Convergence point marked. Latency measured.
"Recovery SR" computed: what SR did this PG serve during adaptation?
```

---

## 6. Core Concepts & Terminology

| Term | Definition |
|---|---|
| **PG** | Payment Gateway — an "arm" in the bandit. Has a name, colour, and a current SR |
| **True SR** | The actual success rate of the PG — set by the slider. This is ground truth |
| **Estimated SR** | The algorithm's internal belief about a PG's SR based on observed outcomes |
| **SR Shock** | A user-initiated SR change event — slider dragged to a new value |
| **Convergence Latency** | Number of transactions from SR Shock to when algorithm fully adapts routing |
| **Routing Share** | % of traffic the algorithm is currently sending to a PG |
| **Exploration Bonus** | Extra weight given to underexplored PGs (UCB) or randomness (Thompson) |
| **Damage Window** | Transactions processed during Phase 1 + Phase 2 at degraded SR |
| **Dead PG** | A PG whose slider is set to 0% SR — simulates complete outage |
| **Recovery Overshoot** | When algorithm routes more traffic to a recovered PG than optimal, then corrects |
| **Tick** | One simulated transaction |
| **Simulation Speed** | Ticks per second of real time (controls how fast the simulation runs visually) |
| **Epoch** | A period of stable SR values between two SR change events |
| **Warm-up Period** | First N ticks where algorithm explores before exploitation begins |

---

## 7. User Flows

### 7.1 Primary Flow: From Scratch

```
Step 1: CONFIGURE PGs
User opens "New Simulation"
→ Default: 3 PGs with SR 90%, 80%, 70%
→ User adds PG-D (clicks "+ Add Gateway")
→ Names each PG (PG-A, PG-B, PG-C, PG-D)
→ Sets initial SR via slider for each (92%, 85%, 70%, 60%)
→ Sets colour for each PG (auto-assigned, user can change)

Step 2: SELECT ALGORITHMS
→ Selects SW-UCB (window=200) and Thompson Sampling
→ Both will run simultaneously on identical traffic

Step 3: CONFIGURE TRAFFIC
→ Sets simulation speed: 500 txns/sec simulated
→ Sets warm-up: 100 ticks (exploration only)
→ Sets noise level: Low (±2% SR random noise)

Step 4: RUN
→ Clicks "Start Simulation"
→ Real-time charts begin populating
→ Watches routing shares stabilise toward PG-A (highest SR)
→ Watches SR estimates converge on true values

Step 5: PAUSE & SHOCK
→ Clicks "Pause" (simulation freezes, state preserved)
→ Drags PG-A slider from 92% → 18% (simulates outage)
→ Sees preview: "This will trigger a convergence test for both algorithms"
→ Clicks "Resume"
→ Watches BOTH algorithms react — SW-UCB and Thompson side by side

Step 6: OBSERVE
→ Convergence panel shows:
   SW-UCB: detected at txn 847, fully converged at txn 1,203 (356 txn latency)
   Thompson: detected at txn 912, fully converged at txn 1,089 (177 txn latency)
→ Damage metric: SW-UCB wasted 847 txns on bad PG; Thompson wasted 912 txns
→ Event logged on timeline

Step 7: RECOVERY TEST
→ Pauses again
→ Drags PG-A slider from 18% → 88% (simulates recovery)
→ Resumes
→ Watches algorithms route back to PG-A
→ Measures recovery convergence latency
→ Notes: Thompson recovers in 234 txns; SW-UCB in 421 txns

Step 8: SAVE & EXPORT
→ Clicks "Save Scenario"
→ Exports JSON config + results summary
→ Shares link with team
```

### 7.2 Quick Flow: Pre-Built Scenario

```
User opens "Scenarios" tab
→ Selects "Sudden Outage: One PG Dies"
→ Scenario loads with 4 PGs pre-configured
→ Clicks "Run" — simulation starts
→ After 500 ticks, PG-B auto-drops to 5% SR (pre-programmed)
→ User watches convergence play out
→ After convergence, scenario pauses and shows summary card
```

### 7.3 Comparison Flow: Head-to-Head

```
User wants to compare SW-UCB window=50 vs window=200

→ Creates PG environment (3 PGs: 90%, 75%, 60%)
→ Adds TWO instances of SW-UCB: one with window=50, one with window=200
→ Runs simulation for 1000 ticks (warm-up)
→ Pauses → drags PG-1 from 90% → 20%
→ Resumes
→ Comparison panel shows BOTH algorithms converging side by side
→ Clear winner visible: window=50 converges in 180 txns vs window=200 in 420 txns
→ But: window=50 has 3x more routing variance during stable periods
→ Trade-off made visible, quantified, and actionable
```

---

## 8. UI Requirements — Full Specification

### 8.1 PG Configuration Panel

**Location:** Left sidebar, always visible during setup and collapsible during simulation.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  PAYMENT GATEWAYS                      [+ Add PG]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ● PG-A  [Razorpay_________]  [████░░░░░] 92%  [🗑] │
│                                INITIAL SR            │
│                                                      │
│  ● PG-B  [Cashfree__________] [██████░░░] 85%  [🗑] │
│                                                      │
│  ● PG-C  [PayU_____________]  [████████░] 70%  [🗑] │
│                                                      │
│  ● PG-D  [Paytm____________]  [██░░░░░░░] 60%  [🗑] │
│                                                      │
├─────────────────────────────────────────────────────┤
│  [+ Add Gateway]                  Max: 10 gateways  │
└─────────────────────────────────────────────────────┘
```

**Detailed Requirements:**

- **PG count:** Minimum 2, maximum 10. "+ Add PG" button disabled when 10 PGs exist.
- **PG name field:** Free text input, max 20 characters, defaults to "PG-A", "PG-B", etc. Name is used in all charts and logs.
- **Colour indicator:** Each PG gets a distinct colour from a 10-colour palette (auto-assigned, user cannot change in v1). Colour is consistent across ALL charts, tables, and logs in the session.
- **Initial SR slider:** Horizontal slider 0%–100% with 1% granularity. Number field next to slider allows direct numeric entry. Slider and field stay in sync.
- **Delete button:** Removes PG from configuration. Disabled if only 2 PGs remain. Removing a PG during simulation stops simulation and asks user to confirm reset.
- **SR value annotation:** Show percentage as large readable number next to slider, coloured:
  - Green: SR ≥ 80%
  - Amber: SR 50–79%
  - Red: SR < 50%

**Validation:**
- At least 1 PG must have SR > 50% to start simulation (prevents trivially degenerate environment)
- Warn (but allow) if all PGs have the same SR (no routing differentiation possible)
- Warn if SR difference between best and worst PG is < 5pp (algorithm will have little to differentiate)

**Advanced Settings (expandable accordion):**
- **Transaction volume distribution:** slider for each PG defining relative weight of transactions originating from it (default: uniform). This is NOT routing — this is the mix of incoming transactions regardless of how algo routes them.
- **SR noise level per PG:** how much random noise is added to the true SR each tick. Options: None, Low (±2%), Medium (±5%), High (±10%). Default: Low.
- **SR drift rate:** Optional slow drift of SR over time (e.g., PG-C degrades 0.1% per 100 ticks). Default: None. This simulates gradual degradation without manual slider intervention.

---

### 8.2 Algorithm Selection Panel

**Location:** Below PG config panel in left sidebar.

```
┌─────────────────────────────────────────────────────┐
│  ALGORITHMS                                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✅  SW-UCB              [Configure ▼]              │
│      Window size:   [━━━━━●━━━] 200                 │
│      Paper: Garivier & Moulines, 2011               │
│                                                      │
│  ✅  Thompson Sampling   [Configure ▼]              │
│      Alpha prior:   [━━●━━━━━━] 1.0                 │
│      Beta prior:    [━━●━━━━━━] 1.0                 │
│      Paper: Agrawal & Goyal, 2012                   │
│                                                      │
│  ☐   Discounted UCB      [Configure ▼]              │
│  ☐   Epsilon-Greedy      [Configure ▼]              │
│  ☐   Round Robin         [Baseline]                 │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Max 3 algorithms simultaneously                     │
└─────────────────────────────────────────────────────┘
```

**Detailed Requirements:**

- Maximum 3 algorithms simultaneously (beyond 3, the comparison charts become unreadable)
- Each algorithm card shows name, enable/disable toggle, hyperparameter controls inline
- Hyperparameters rendered from `get_hyperparameter_schema()` — same plugin interface as main Simulator
- "Paper" link shows citation on hover; clicks open in new tab
- Each algorithm gets a **line style** (solid, dashed, dotted) in addition to a shared colour per algorithm:
  - Algorithm 1: always solid line
  - Algorithm 2: always dashed line
  - Algorithm 3: always dotted line
  - PG colours: always from the PG colour palette
  - This prevents chart confusion: PG colour = what gateway; line style = which algorithm
- **Duplicate algorithm support:** User can add the same algorithm twice with different hyperparameters (e.g., "SW-UCB (w=50)" vs "SW-UCB (w=200)"). Each instance gets a user-editable display name.

---

### 8.3 Simulation Control Bar

**Location:** Persistent top bar, full width, always visible.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ▶ START   ⏸ PAUSE   ⏹ RESET    │  Speed: [━━━━━●━━━] 500 txns/s   │  T: 4,231  │
│                                  │  Warm-up: 100 txns  ✅ Complete   │  Elapsed: 8.4s│
└──────────────────────────────────────────────────────────────────────────────────┘
```

**States and Transitions:**

```
IDLE ──[Start]──→ RUNNING ──[Pause]──→ PAUSED ──[Resume]──→ RUNNING
  ↑                  │                    │
  └──────────────────┘                    │
          [Reset]                         └──[Reset]──→ IDLE
```

**Control Elements:**

- **START / RESUME button:** Begins simulation from tick 0 (Start) or resumes from current tick (Resume). Shows "Start" before first run, "Resume" when paused.
- **PAUSE button:** Instantly freezes simulation. All chart updates stop. UI remains fully interactive — sliders can be moved, panels explored. Active while simulation is RUNNING.
- **RESET button:** Returns to IDLE state. Clears all simulation data and charts. Asks for confirmation if simulation has been running for > 100 ticks. Does NOT clear PG configuration or algorithm selection.
- **Speed slider:** Simulation ticks per second of wall-clock time. Range: 10 – 10,000 txns/sec (logarithmic scale). Default: 500 txns/sec. Label updates dynamically: "Slow (10/s)", "Normal (500/s)", "Fast (10K/s)".
  - At speed > 5,000 txns/sec: charts update every 100 ticks (not every tick) to prevent UI jank
  - At speed ≤ 500 txns/sec: charts update every tick
- **Tick counter (T):** Shows current simulation tick in real time. Formatted with comma separators.
- **Elapsed time:** Wall-clock time elapsed since simulation started (excludes paused time).
- **Warm-up indicator:** Shows warm-up progress bar during the first N ticks (configurable, default 100). During warm-up, algorithms explore uniformly and convergence measurement is suppressed.

**Keyboard shortcuts:**
- `Space`: Toggle pause/resume
- `R`: Reset (with confirmation dialog)
- `↑/↓` arrows: Increase/decrease speed by one step
- `S`: Save current state

---

### 8.4 Live SR Manipulation Panel

**This is the centrepiece UI element of the entire feature.**

**Location:** Right sidebar, expands to prominent position when simulation is PAUSED.

**States:**

- **RUNNING state:** Panel shows current sliders as READ-ONLY with live-updating labels. Sliders are visually muted with a lock icon. A banner reads: *"Pause simulation to adjust SR values"*
- **PAUSED state:** Panel becomes fully interactive. Sliders are active. Banner reads: *"Simulation paused — adjust SR values, then Resume to apply"*

**Paused State Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  ⏸ SIMULATION PAUSED                                        │
│  Adjust gateway success rates. Changes apply on Resume.      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ● PG-A (Razorpay)                        CURRENT: 92%      │
│  NEW:    [█████████████░░░░░░░░░░░░░░] 72%                  │
│          ↓ -20pp change staged                              │
│                                                              │
│  ● PG-B (Cashfree)                        CURRENT: 85%      │
│  NEW:    [████████████████░░░░░░░░░░░] 85%  (no change)     │
│                                                              │
│  ● PG-C (PayU)                            CURRENT: 70%      │
│  NEW:    [░░░░░░░░░░░░░░░░░░░░░░░░░░░]  5%                  │
│          ↓ -65pp change staged  ⚠️ Major drop               │
│                                                              │
│  ● PG-D (Paytm)                           CURRENT: 60%      │
│  NEW:    [████████████████████████░░░] 95%                  │
│          ↑ +35pp change staged  ⚠️ Major increase           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  STAGED CHANGES SUMMARY                                      │
│  • 3 gateways modified (PG-A, PG-C, PG-D)                  │
│  • PG-A: 92% → 72%   (−20pp)                                │
│  • PG-C: 70% → 5%    (−65pp) ← New optimal: PG-D at 95%    │
│  • PG-D: 60% → 95%   (+35pp)                                │
│                                                              │
│  Estimated convergence test: High complexity                 │
│  (3 simultaneous changes; multiple rank reversals)           │
│                                                              │
│  [Reset to Current]    [▶ Apply & Resume]                   │
└─────────────────────────────────────────────────────────────┘
```

**Slider Detailed Requirements:**

- **Range:** 0% to 100%, step 1%. Slider supports both drag and click-to-set.
- **Direct input:** Numeric text field next to slider. Validates 0–100, integer only. Updates slider position in sync.
- **"Current" label:** Shows the SR value at the time of pause — does not update as user drags.
- **"New" label:** Shows user's staged value. Updated live as slider moves.
- **Delta annotation:** Below each slider, shows the change in pp:
  - No change: "(no change)" in grey
  - Positive delta: "+Xpp change staged" in green
  - Negative delta: "−Xpp change staged" in amber/red depending on magnitude
  - Large drop (>30pp): "⚠️ Major drop" warning label
- **Colour coding:** Slider track colour matches PG's assigned colour
- **Instant-set shortcuts:** Double-click slider → dialog to type exact value. Right-click slider → context menu: "Set to 0% (Dead PG)", "Set to 50%", "Set to 100%", "Reset to current"
- **[Reset to Current] button:** Resets ALL staged changes back to current values. Does not resume.
- **[Apply & Resume] button:** Applies all staged SR changes simultaneously at the next simulation tick, then resumes. This is the primary action button — large, prominent, blue.

**Staged Changes Preview:**
When any slider is moved, a "Staged Changes Summary" box appears at the bottom showing:
- List of modified PGs and their before/after SR
- Which PG becomes the new optimal after the change
- "Estimated convergence test complexity" (Simple / Moderate / High) based on:
  - Number of PGs changed
  - Magnitude of changes
  - Whether rank order of PGs changes

---

### 8.5 Real-time Metrics Dashboard

**Location:** Main content area, centre of screen.

**Layout: 4 live charts updating in real time**

```
┌─────────────────────────────────────────────────────────────────────┐
│  CHART 1: Routing Share Over Time          [Toggle: Stacked | Lines]│
│                                                                      │
│  100% ┤                                   ╔══════════════════        │
│       │             ╔══════════════════════╝ PG-A (algo 1)          │
│   75% ┤            ╔╝                                               │
│       │        ════╝                        PG-A (algo 2) - - -     │
│   50% ┤    ════╝                                                    │
│       │════╝                                PG-B ────               │
│   25% ┤                                     PG-C ─ ─ ─              │
│    0% ┼────────────────────────────────────────────────────── T     │
│       0     500    1000    1500   2000   2500   3000   3500  4000   │
│                            ↑                                         │
│                     [SR Change Event]                                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────────┐
│  CHART 2: True SR vs         │  │  CHART 3: Cumulative Regret      │
│  Estimated SR per Algorithm  │  │  Over Time                       │
│                              │  │                                  │
│  True SR:   ══════════       │  │  Algorithm 1 (SW-UCB) ──────     │
│  Est. (A1): ─ ─ ─ ─ ─        │  │  Algorithm 2 (Thompson) ─ ─ ─    │
│  Est. (A2): ── ── ──         │  │                                  │
│                              │  │  Lower = better                  │
│  [PG selector: PG-A ▼]       │  │                                  │
└──────────────────────────────┘  └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CHART 4: Rolling SR (Actual Outcomes)    [Window: 50 ▼] txns      │
│                                                                      │
│  Overall SR (algo 1) ─────────────────────────────────────         │
│  Overall SR (algo 2) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─           │
│  True Optimal SR ═══════════════════════════════════════            │
│                                                                      │
│  (The gap between True Optimal and Actual = regret per unit time)   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Chart 1: Routing Share Over Time

- **Purpose:** Show how each algorithm distributes traffic across PGs as SR changes.
- **X-axis:** Transaction number (tick count)
- **Y-axis:** Routing share % (0–100%)
- **Series:** One line per PG per algorithm. PG colour = PG's colour. Line style = algorithm's style (solid/dashed/dotted)
- **Vertical event markers:** Red dashed vertical line at every SR change event. Hover shows: "SR Change: PG-A 92%→18%, PG-C 70%→5%"
- **Toggle:** Stacked area chart OR multi-line chart. Default: multi-line.
- **Annotations:** At convergence points, a small circle marker with tooltip: "Algo 1 converged in 356 txns"
- **Live update:** Appends new data point at every tick (throttled to every 10 ticks at high speed)
- **Pan/zoom:** User can drag to pan historical view; scroll to zoom. "Follow live" button snaps back to latest.

#### Chart 2: True SR vs Estimated SR

- **Purpose:** Show how each algorithm's internal SR estimate tracks the true SR over time. This makes "Phase 1 Blindness" visually obvious.
- **X-axis:** Transaction number
- **Y-axis:** SR % (0–100%)
- **PG selector:** Dropdown to choose which PG to view (one PG at a time, to avoid overload)
- **Series:**
  - True SR: thick solid black line — the actual slider value. Steps immediately at SR change events.
  - Estimated SR (Algo 1): dashed line in Algo 1's colour
  - Estimated SR (Algo 2): dotted line in Algo 2's colour
- **The gap** between True SR and Estimated SR during Phase 1 is visually highlighted as a shaded region
- **Key visual:** When true SR drops suddenly, the black line steps down; the algorithm lines follow slowly, then catch up — this is the convergence story made visual

#### Chart 3: Cumulative Regret Over Time

- **Purpose:** Show total "damage" from sub-optimal routing decisions.
- **Formula:** `regret(T) = Σ_{t=1}^{T} [optimal_sr(t) - algorithm_sr_on_chosen_pg(t)]`
- **X-axis:** Transaction number
- **Y-axis:** Cumulative regret (sum of lost SR points)
- **Series:** One line per algorithm (line style per algorithm)
- **Interpretation:** Flat line = algorithm is routing optimally. Steep slope = algorithm is making bad routing decisions. Slope increases sharply at SR change events — shows damage accumulation during blindness phase.
- **Regret rate:** Secondary Y-axis (right side) shows regret rate = slope of regret line (running derivative over 50-txn window). High regret rate = currently routing poorly.

#### Chart 4: Rolling Achieved SR

- **Purpose:** Show the actual SR being achieved (outcomes) by each algorithm's routing decisions, with a configurable rolling window.
- **X-axis:** Transaction number
- **Y-axis:** SR % (0–100%)
- **Series:**
  - Achieved SR for each algorithm (line per algorithm)
  - True Optimal SR (thick black dashed horizontal line — the best possible SR if always routing to best PG)
- **Rolling window selector:** 10, 50, 100, 500 ticks. Default: 50. Shorter window = noisier but more reactive.
- **The gap** between True Optimal and achieved SR is the regret visualised differently (in SR terms vs cumulative terms)

---

### 8.6 Convergence Analysis Panel

**Location:** Below the four main charts, expands when an SR change event occurs.

**State: Empty (no SR change events yet)**
```
┌─────────────────────────────────────────────────────────────────────┐
│  CONVERGENCE ANALYSIS                                                │
│  Pause the simulation and adjust gateway SR values to begin         │
│  measuring convergence latency.                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**State: During Phase 1/2 (SR changed, not yet converged)**
```
┌─────────────────────────────────────────────────────────────────────┐
│  CONVERGENCE ANALYSIS — EVENT #1 in progress                        │
│  SR Change: PG-C dropped 70% → 5%  at T=1,200                      │
│                                                                      │
│  Algorithm         │ Phase          │ Elapsed    │ Est. Remaining   │
│  ─────────────────────────────────────────────────────────────      │
│  SW-UCB (w=200)    │ 🔴 Blindness   │ 147 txns   │ ~300 txns        │
│  Thompson Sampling │ 🟡 Detecting   │ 147 txns   │ ~80 txns         │
│                                                                      │
│  LIVE DAMAGE METER                                                   │
│  Transactions sent to PG-C since SR drop:                           │
│  SW-UCB:    ████████████████████████░░░░░░░░░  89 txns on bad PG   │
│  Thompson:  ██████████████████░░░░░░░░░░░░░░░  61 txns on bad PG   │
│                                                                      │
│  Estimated failures caused (damage):                                 │
│  SW-UCB:    ~76 extra failures  (89 txns × 65% failure rate)        │
│  Thompson:  ~52 extra failures                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**State: Converged**
```
┌─────────────────────────────────────────────────────────────────────┐
│  CONVERGENCE ANALYSIS — EVENT #1 COMPLETE  ✅                        │
├─────────────────────────────────────────────────────────────────────┤
│  SR Change: PG-C  70% → 5%  at T=1,200   │  New Optimal PG: PG-A  │
├────────────────────┬──────────────┬───────────┬────────────────────┤
│  Algorithm         │ Conv. Latency│ Txns on   │ Estimated          │
│                    │ (txns)       │ Bad PG    │ Extra Failures     │
├────────────────────┼──────────────┼───────────┼────────────────────┤
│  SW-UCB (w=200)    │    356 txns  │   247 txns│    ~161 failures   │
│  Thompson Sampling │    177 txns  │   142 txns│    ~92 failures    │
├────────────────────┼──────────────┼───────────┼────────────────────┤
│  Winner            │  Thompson ✅ │Thompson ✅│   Thompson ✅      │
└────────────────────┴──────────────┴───────────┴────────────────────┘
│                                                                      │
│  CONVERGENCE NARRATIVE                                               │
│  "Thompson Sampling converged 2.0x faster than SW-UCB on this      │
│  event. Thompson's Bayesian updates responded to PG-C's drop        │
│  within 177 transactions, while SW-UCB's window (200) was still     │
│  dominated by pre-drop successes, causing slower adaptation.         │
│                                                                      │
│  At 500 txns/sec simulation speed, this represents 0.35s vs 0.71s   │
│  of real-world routing blindness — at 1M txns/min in production,    │
│  this would mean 2,950 vs 5,933 failed transactions during the      │
│  convergence window."                                               │
│                                                                      │
│  [View Detail]    [See in Chart]    [Next Event →]                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Multiple Events:** When more than one SR change event has occurred, the panel shows a tabbed list (Event #1, Event #2, Event #3...) with a summary comparison table at the top:

```
EVENT SUMMARY (3 events)
─────────────────────────────────────────────────────────────────────
                    │ Event #1         │ Event #2         │ Event #3
                    │ PG-C 70%→5%      │ PG-A 92%→18%     │ PG-C 5%→80%
────────────────────┼──────────────────┼──────────────────┼──────────────
SW-UCB (w=200)      │ 356 txns         │ 412 txns         │ 289 txns
Thompson Sampling   │ 177 txns   ✅    │ 198 txns  ✅     │ 341 txns ✅*
                    │                  │                  │ *recovery overshoot
────────────────────┴──────────────────┴──────────────────┴──────────────
Average Convergence │ SW: 352 txns     │ Thompson: 239 txns (Thompson wins 2/3)
```

---

### 8.7 Event Timeline

**Location:** Horizontal strip below the Convergence Analysis Panel, spanning full width.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
T=0        T=500       T=1000      T=1200    T=1556    T=2000       T=3000
[▶ Start]  [Paused]   [Resumed]  [SR Event] [Conv ✅] [SR Event]   [Conv ✅]
            :30s        :45s      PG-C       Both       PG-A         SW-UCB
            (3s wall)   (resume)  70%→5%     conv       92%→18%      356t
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Every event is a dot on the timeline: pause, resume, SR change, convergence milestone
- Click any event → scroll all charts to that tick position
- Hover any event → tooltip with full event details
- Timeline scrolls horizontally as simulation progresses
- SR change events shown in red; convergence events in green; pause/resume in blue

---

### 8.8 Per-PG Deep Dive Panel

**Location:** Accessible by clicking any PG's colour dot on the charts or clicking a PG name in the config panel.

**Slide-out panel (right side) showing for one selected PG:**

```
┌──────────────────────────────────────────────────────┐
│  PG-C (PayU)  ●                               [Close]│
├──────────────────────────────────────────────────────┤
│  TRUE SR HISTORY                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                  │
│  70% ═══════════════════╗                           │
│   5%                    ╚══════════════ (current)   │
│                                                      │
│  ROUTING SHARE RECEIVED (per algorithm)             │
│  SW-UCB:    ████████████████████░░░░░░░░░ 42% → 8%  │
│  Thompson:  ████████████████░░░░░░░░░░░░░ 38% → 3%  │
│                                                      │
│  ALGORITHM ESTIMATED SR                              │
│  SW-UCB:    73% (true: 5%) — Still blind!  ⚠️       │
│  Thompson:  28% (true: 5%) — Detecting      🟡      │
│                                                      │
│  TRANSACTION STATS (since last SR change)           │
│  Total routed:    SW-UCB: 247 | Thompson: 142       │
│  Successes:       SW-UCB: 25  | Thompson: 17        │
│  Failures:        SW-UCB: 222 | Thompson: 125       │
│  Implied SR:      SW-UCB: 10% | Thompson: 12%       │
│                                                      │
│  SR EVENTS ON THIS PG                               │
│  T=1,200: 70% → 5%   (−65pp)  [Jump to]            │
└──────────────────────────────────────────────────────┘
```

---

## 9. Simulation Engine Requirements

### 9.1 Traffic Generation Model

The simulation generates synthetic transactions at each tick. No historical data is required.

```python
@dataclass
class SyntheticTransaction:
    tick: int
    payment_mode: str        # sampled from configurable distribution
    amount_band: str         # sampled uniformly from bands
    issuing_bank: str        # sampled from configurable bank pool
    # ... other context fields for contextual algorithm support

def generate_transaction(tick: int, config: SimConfig) -> SyntheticTransaction:
    """
    Generate one synthetic transaction per tick.
    Context fields are randomly sampled — they don't affect outcome
    in the basic simulation (SR is PG-level only).
    For contextual algorithms, context can be used.
    """
    return SyntheticTransaction(
        tick=tick,
        payment_mode=random.choice(['upi', 'card', 'netbanking'], p=config.mode_weights),
        amount_band=random.choice(['0-500', '500-5k', '5k-50k', '50k+'], p=[0.3, 0.4, 0.2, 0.1]),
        issuing_bank=random.choice(config.bank_pool),
    )
```

**Traffic generation is deterministic given a seed** — same seed produces identical transaction sequence, enabling reproducibility.

### 9.2 SR Model & Noise

The outcome of routing a transaction to a PG is determined by:

```python
def resolve_outcome(pg_id: str, tick: int, sr_state: SRState, noise_config: NoiseConfig) -> int:
    """
    Resolve transaction outcome.
    Returns 1 (success) or 0 (failure).
    
    The true SR for a PG at any tick is:
        true_sr = slider_value + drift(tick) + noise(tick)
    
    Noise is sampled per-tick per-PG to simulate natural SR variation.
    This prevents algorithms from converging to exact SR values.
    """
    base_sr = sr_state.current_sr[pg_id]
    
    # Optional: slow drift toward a target SR (for gradual degradation simulation)
    drifted_sr = base_sr + sr_state.compute_drift(pg_id, tick)
    
    # Gaussian noise: mean=0, std=noise_config.std_dev (default: 0.02 = ±2%)
    noise = np.random.normal(0, noise_config.std_dev_per_pg[pg_id])
    effective_sr = np.clip(drifted_sr + noise, 0.0, 1.0)
    
    return 1 if np.random.random() < effective_sr else 0
```

**SR state transitions:**

```python
class SRState:
    """
    Manages the true SR for each PG across the simulation.
    SR changes are applied atomically at resume (not mid-tick).
    """
    current_sr: dict[str, float]        # pg_id → current true SR
    staged_changes: dict[str, float]    # pg_id → new SR to apply at next resume
    change_history: list[SRChangeEvent] # full audit log
    
    def apply_staged_changes(self, tick: int) -> list[SRChangeEvent]:
        """Called exactly once at simulation resume. Returns list of change events."""
        events = []
        for pg_id, new_sr in self.staged_changes.items():
            old_sr = self.current_sr[pg_id]
            if old_sr != new_sr:
                self.current_sr[pg_id] = new_sr
                events.append(SRChangeEvent(
                    tick=tick, pg_id=pg_id, 
                    old_sr=old_sr, new_sr=new_sr,
                    delta_pp=(new_sr - old_sr) * 100
                ))
        self.staged_changes.clear()
        return events
```

### 9.3 Pause / Resume Mechanics

This is the most critical correctness requirement in the feature.

**Requirements:**

1. **Instant pause:** Pause must halt the simulation loop within the current tick — no partial tick processing.
2. **State preservation:** All algorithm internal states, SR values, tick counter, and metric accumulators are frozen at the exact tick of pause. Nothing changes during paused state.
3. **Slider changes are staging only:** While paused, moving sliders updates the `SRState.staged_changes` dict but does NOT update `SRState.current_sr`. The simulation sees only `current_sr`.
4. **Resume atomicity:** On resume, the very first action is `SRState.apply_staged_changes(current_tick)`. This is applied before any algorithm's `select()` is called at that tick. All SR change events are emitted and logged at exactly this tick.
5. **No SR changes without pause:** SR sliders in RUNNING state are locked. The UI enforces this — there is no way to change SR while running.

```python
async def simulation_loop(state: SimulationState):
    while True:
        # Check pause flag first — never start a tick mid-pause
        await state.pause_event.wait()  # blocks if pause_event is cleared
        
        # Apply any staged SR changes (only if just resumed)
        if state.just_resumed:
            events = state.sr_state.apply_staged_changes(state.tick)
            for event in events:
                state.event_log.append(event)
                state.convergence_tracker.register_event(event)
            state.just_resumed = False
        
        # Generate transaction
        transaction = generate_transaction(state.tick, state.config)
        
        # Run all algorithms
        for algo in state.active_algorithms:
            chosen_pg = algo.select(transaction.context)
            outcome = resolve_outcome(chosen_pg, state.tick, state.sr_state, state.noise_config)
            algo.update(chosen_pg, outcome, transaction.context)
            state.metrics.record(algo.id, chosen_pg, outcome, state.tick)
        
        # Update convergence tracking
        state.convergence_tracker.tick(state.tick, state.sr_state.current_sr)
        
        state.tick += 1
        
        # Throttle to configured speed
        await asyncio.sleep(1.0 / state.config.speed_tps)
```

### 9.4 SR Change Application

When SR changes are applied at resume:

1. All changed PGs are recorded in the event log with (tick, pg_id, old_sr, new_sr)
2. Convergence tracker is notified for each changed PG
3. Vertical marker is emitted to all live charts
4. Phase 1 (Blindness) counter starts for each algorithm × changed PG combination
5. Algorithm states are NOT reset — they continue from their current internal state with no knowledge of the change

**Critical:** The algorithms must NOT be told about SR changes. They discover them through observed outcomes only. The engine enforces this by never exposing `SRState.current_sr` to algorithm instances.

### 9.5 Convergence Detection

The convergence tracker monitors each (algorithm, changed_pg) pair after every SR change event.

```python
class ConvergenceTracker:
    """
    Monitors algorithm routing share shifts after SR change events.
    Detects convergence when routing share has durably shifted.
    """
    
    def register_event(self, event: SRChangeEvent):
        """Called when an SR change occurs. Starts monitoring for this PG."""
        self.active_events[event.event_id] = ConvergenceMonitor(
            pg_id=event.pg_id,
            start_tick=event.tick,
            old_sr=event.old_sr,
            new_sr=event.new_sr,
            pre_event_share=self.get_current_shares(event.pg_id),  # snapshot
        )
    
    def tick(self, tick: int, current_sr: dict[str, float]):
        """Called every tick. Updates all active monitors."""
        for event_id, monitor in self.active_events.items():
            for algo in self.active_algorithms:
                current_share = self.get_routing_share(algo.id, monitor.pg_id, 
                                                        window=50)  # last 50 txns
                monitor.update(algo.id, tick, current_share)
                
                if not monitor.is_converged(algo.id):
                    if monitor.detect_convergence(algo.id, current_share):
                        monitor.mark_converged(algo.id, tick)
                        self.emit_convergence_event(event_id, algo.id, tick, monitor)
    
    def detect_convergence(self, monitor, algo_id, current_share) -> bool:
        """
        Convergence = routing share shifted by > CONVERGENCE_THRESHOLD
        in the correct direction AND stable for STABILITY_WINDOW ticks.
        
        Correct direction:
          - SR dropped: share should decrease
          - SR increased: share should increase
        """
        threshold = self.config.convergence_threshold  # default: 10pp shift
        stability_window = self.config.stability_window  # default: 20 ticks
        
        share_delta = current_share - monitor.pre_event_share[algo_id]
        
        # Check direction
        sr_dropped = monitor.new_sr < monitor.old_sr
        if sr_dropped:
            direction_correct = share_delta < -threshold
        else:
            direction_correct = share_delta > threshold
        
        if not direction_correct:
            return False
        
        # Check stability: has share stayed shifted for stability_window consecutive ticks?
        return monitor.consecutive_shifted_ticks[algo_id] >= stability_window
```

**Convergence configuration (user-adjustable in Advanced Settings):**
- `convergence_threshold`: minimum routing share shift to count as convergence (default: 10pp)
- `stability_window`: consecutive ticks the shift must hold (default: 20 ticks)
- These defaults are based on Dream11's production convergence benchmarks

### 9.6 Algorithm State Management

The simulation engine manages all algorithm instances:

```python
class SimulationState:
    algorithms: list[BaseAlgorithm]     # from plugin interface (same as main Simulator)
    sr_state: SRState                   # ground truth SR per PG
    metrics: MetricsAccumulator         # rolling metrics for all charts
    convergence_tracker: ConvergenceTracker
    event_log: list[SimulationEvent]
    tick: int
    config: SimConfig
    
    # Control
    pause_event: asyncio.Event          # cleared = paused, set = running
    just_resumed: bool                  # flag to apply staged changes on next tick

@dataclass
class SimConfig:
    pgs: list[PGConfig]                 # names, initial SRs, colours, noise config
    algorithms: list[AlgorithmConfig]   # ids, hyperparameters
    speed_tps: float                    # simulated transactions per wall-clock second
    warm_up_ticks: int                  # ticks before convergence measurement starts
    random_seed: int                    # for reproducibility
    convergence_threshold: float        # default 0.10 (10pp)
    stability_window: int               # default 20 ticks
    noise_mode: str                     # 'none' | 'low' | 'medium' | 'high'
```

---

## 10. Scenario System

### 10.1 Pre-Built Scenarios

8 named scenarios included at launch. Each scenario defines: PG configuration, algorithm defaults, simulation speed, and an optional "auto-SR-change sequence" that runs without user intervention.

| # | Scenario Name | Description | PGs | Auto-Events |
|---|---|---|---|---|
| 1 | **Sudden Death** | One PG drops to 0% SR instantly | 3 PGs: 92%, 85%, 78% | T=500: PG-1 drops to 0% |
| 2 | **Slow Poison** | One PG gradually degrades over time | 3 PGs: 90%, 80%, 70% | PG-2 drifts -1%/100 ticks from T=200 |
| 3 | **Dead Cat Bounce** | PG drops, partially recovers, drops again | 4 PGs: 88%, 82%, 75%, 65% | T=300: PG-1 → 10%; T=800: PG-1 → 60%; T=1200: PG-1 → 15% |
| 4 | **Musical Chairs** | Best PG rotates: was PG-A, then PG-B, then PG-C | 3 PGs: equal start | T=500: swap; T=1000: swap again |
| 5 | **The Comeback** | PG that was dead recovers to best PG | 4 PGs: 90%, 85%, 80%, 0% | T=800: dead PG → 95% |
| 6 | **Perfect Storm** | Multiple PGs degrade simultaneously | 4 PGs: 92%, 88%, 82%, 78% | T=400: PG-1,PG-2 both drop 50pp |
| 7 | **New Kid** | New PG appears mid-simulation with unknown SR | 3 PGs (start) | T=600: PG-4 added at unknown SR |
| 8 | **Stability Stress** | All PGs have very similar SR — can algo find the best? | 4 PGs: 82%, 81%, 80%, 79% | None — pure exploration challenge |

### 10.2 Scenario Schema

```json
{
  "scenario_id": "sudden_death",
  "name": "Sudden Death",
  "description": "One PG drops to 0% SR instantly at T=500. Tests how quickly your algorithm detects and routes around a complete gateway failure.",
  "difficulty": "beginner",
  "estimated_duration_ticks": 2000,
  "pgs": [
    { "id": "pg_a", "name": "PG-A", "initial_sr": 0.92, "noise": "low" },
    { "id": "pg_b", "name": "PG-B", "initial_sr": 0.85, "noise": "low" },
    { "id": "pg_c", "name": "PG-C", "initial_sr": 0.78, "noise": "low" }
  ],
  "recommended_algorithms": ["sw_ucb", "thompson_sampling"],
  "default_speed": 500,
  "warm_up_ticks": 200,
  "auto_events": [
    {
      "trigger_tick": 500,
      "type": "sr_change",
      "changes": { "pg_a": 0.00 },
      "description": "PG-A fails completely"
    }
  ],
  "learning_objectives": [
    "How many transactions does the algorithm route to PG-A before detecting the failure?",
    "Compare convergence latency between SW-UCB and Thompson Sampling",
    "How does window size affect detection speed?"
  ]
}
```

### 10.3 Custom Scenario Save/Load

Users can save their current configuration + SR change history as a named scenario:

```json
{
  "scenario_id": "my_production_test_v3",
  "name": "My Production Test v3",
  "created_at": "2025-03-01T14:22:00Z",
  "random_seed": 42,
  "pgs": [ ... ],
  "algorithms": [ ... ],
  "speed": 500,
  "warm_up": 100,
  "sr_change_sequence": [
    { "tick": 1200, "changes": { "pg_c": 0.05 } },
    { "tick": 2800, "changes": { "pg_a": 0.18 } },
    { "tick": 4100, "changes": { "pg_c": 0.80, "pg_a": 0.92 } }
  ]
}
```

When loaded, the simulation can run automatically (auto-apply SR changes at specified ticks) OR interactively (stop at each SR change tick and wait for user to resume).

---

## 11. Metrics & Measurements

### 11.1 Per-Algorithm Metrics (updated every tick)

| Metric | Definition | Update Frequency |
|---|---|---|
| `routing_share[pg]` | % of last N ticks routed to this PG (rolling, N=50 default) | Every tick |
| `estimated_sr[pg]` | Algorithm's internal SR estimate for this PG (from `get_state()`) | Every tick |
| `cumulative_regret` | Σ(oracle_sr[t] - chosen_pg_sr[t]) from T=0 | Every tick |
| `regret_rate` | Slope of cumulative regret over last 50 ticks | Every tick |
| `rolling_achieved_sr` | Actual SR of outcomes over last N ticks | Every tick |
| `exploration_ratio` | % of ticks where non-best-estimate PG was chosen | Every 10 ticks |

### 11.2 Per-SR-Change-Event Metrics (computed at convergence)

| Metric | Definition |
|---|---|
| `convergence_latency_txns` | Ticks from SR change to convergence |
| `convergence_latency_wall_s` | Wall-clock seconds (at current simulation speed) |
| `convergence_latency_production_txns` | Projected production transactions during convergence window (user-configurable production TPS) |
| `damage_txns` | Total ticks algorithm routed to changed PG during Phase 1+2 |
| `damage_failures` | Estimated extra failures: damage_txns × (old_sr - new_sr) if SR dropped |
| `detection_tick` | First tick where algorithm's routing share began shifting (Phase 2 start) |
| `phase1_duration` | detection_tick - change_tick (pure blindness ticks) |
| `phase2_duration` | convergence_tick - detection_tick (detection phase ticks) |
| `recovery_overshoot` | For SR increases: whether algorithm over-routed to recovered PG (bool + magnitude) |

### 11.3 Session Summary Metrics

Shown after simulation ends or exported:

| Metric | Definition |
|---|---|
| `total_ticks` | Total transactions simulated |
| `total_sr_change_events` | Number of SR shocks applied |
| `avg_convergence_latency` | Mean convergence latency across all events and algorithms |
| `best_algorithm` | Which algorithm had lowest average convergence latency |
| `total_regret` | Cumulative regret at end of simulation |
| `regret_per_1000_txns` | Normalised regret rate |
| `algorithm_rank` | Ranking of algorithms by convergence latency + total regret |

### 11.4 Production Impact Estimation

A configurable "Production TPS" field (default: 10,000 txns/minute) that scales convergence metrics to production reality:

```
Production convergence window = convergence_latency_txns / production_tps_per_minute

Example:
  Convergence latency = 356 txns
  Production TPS = 10,000 txns/min
  Production window = 356 / 10,000 minutes = 0.0356 minutes = ~2.1 seconds

  At 60% SR drop (90% → 30%), failure rate during window:
  Extra failures = 356 × (0.90 - 0.30) = 214 failures
  Production equivalent: 214 failures in 2.1 seconds
```

---

## 12. Data Models

### 12.1 Core State Types

```python
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class SimulationStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"

@dataclass
class PGConfig:
    pg_id: str                          # unique identifier, e.g. "pg_a"
    name: str                           # display name, e.g. "Razorpay"
    initial_sr: float                   # 0.0 to 1.0
    colour: str                         # hex colour code, auto-assigned
    noise_std: float = 0.02             # SR noise standard deviation
    drift_rate: float = 0.0             # SR drift per 100 ticks (optional)
    drift_target: Optional[float] = None  # drift stops at this SR

@dataclass
class AlgorithmConfig:
    algorithm_id: str                   # from plugin registry
    display_name: str                   # user-editable, e.g. "SW-UCB (w=200)"
    hyperparameters: dict               # from get_hyperparameter_schema()
    line_style: str                     # 'solid' | 'dashed' | 'dotted'

@dataclass
class SimConfig:
    pgs: list[PGConfig]
    algorithms: list[AlgorithmConfig]
    speed_tps: float = 500.0
    warm_up_ticks: int = 100
    random_seed: int = 42
    noise_mode: str = "low"
    convergence_threshold: float = 0.10
    stability_window: int = 20
    production_tps_per_minute: int = 10_000

@dataclass
class SRChangeEvent:
    event_id: str
    tick: int
    pg_id: str
    old_sr: float
    new_sr: float
    delta_pp: float                     # (new_sr - old_sr) * 100
    triggered_by: str                   # 'user' | 'auto_scenario'

@dataclass
class ConvergenceResult:
    event_id: str
    algorithm_id: str
    convergence_tick: Optional[int]     # None if not yet converged
    convergence_latency_txns: Optional[int]
    detection_tick: Optional[int]       # when Phase 2 started
    phase1_duration: Optional[int]
    phase2_duration: Optional[int]
    damage_txns: int
    estimated_extra_failures: float
    recovery_overshoot: Optional[float] # None if SR dropped (not a recovery event)

@dataclass
class TickMetrics:
    tick: int
    # Per algorithm
    routing_shares: dict[str, dict[str, float]]   # algo_id → {pg_id → share}
    estimated_srs: dict[str, dict[str, float]]    # algo_id → {pg_id → est_sr}
    cumulative_regret: dict[str, float]            # algo_id → regret
    rolling_achieved_sr: dict[str, float]          # algo_id → rolling SR
    # Global
    true_srs: dict[str, float]                     # pg_id → true SR
    optimal_sr: float                              # best available SR

@dataclass
class SimulationSession:
    session_id: str
    config: SimConfig
    status: SimulationStatus
    tick: int
    events: list[SRChangeEvent]
    convergence_results: list[ConvergenceResult]
    metrics_history: list[TickMetrics]             # sampled (not every tick for memory)
    created_at: str
    seed_used: int
```

---

## 13. Functional Requirements

### FR-1: PG Configuration

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Support 2–10 PGs; enforce minimum 2 and maximum 10 | P0 |
| FR-1.2 | Each PG has: unique ID, display name (20 chars max), initial SR (0–100%), auto-assigned colour | P0 |
| FR-1.3 | Initial SR configurable via slider (1% step) AND direct numeric input | P0 |
| FR-1.4 | Warn if all PGs have same SR; warn if best-worst SR gap < 5pp | P1 |
| FR-1.5 | Per-PG noise level: None / Low (±2%) / Medium (±5%) / High (±10%) | P1 |
| FR-1.6 | Per-PG optional drift: rate (pp per 100 ticks) and target SR | P2 |
| FR-1.7 | PG config preserved across pause/resume cycles (only changes on explicit Reset) | P0 |

### FR-2: Algorithm Configuration

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Support 1–3 algorithms simultaneously; enforce maximum 3 | P0 |
| FR-2.2 | All algorithms from main Simulator plugin registry available | P0 |
| FR-2.3 | Same algorithm can be added twice with different hyperparameters and display names | P0 |
| FR-2.4 | Hyperparameter forms auto-generated from `get_hyperparameter_schema()` | P0 |
| FR-2.5 | Each algorithm assigned a consistent line style (solid/dashed/dotted) | P0 |

### FR-3: Simulation Control

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Simulation speed: 10–10,000 txns/sec, logarithmic slider, real-time adjustable during RUNNING | P0 |
| FR-3.2 | Pause: halts simulation within current tick; full state preserved | P0 |
| FR-3.3 | Resume: applies staged SR changes atomically at first tick after resume | P0 |
| FR-3.4 | Reset: clears all simulation data; preserves PG and algorithm config; requires confirmation after >100 ticks | P0 |
| FR-3.5 | Warm-up period: configurable 0–1000 ticks; no convergence measurement during warm-up | P1 |
| FR-3.6 | Keyboard shortcuts: Space (pause/resume), R (reset), arrow keys (speed) | P1 |
| FR-3.7 | Simulation state (full) exportable as JSON at any point | P1 |

### FR-4: SR Manipulation

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | SR sliders visible but locked (read-only) during RUNNING state | P0 |
| FR-4.2 | SR sliders fully interactive during PAUSED state | P0 |
| FR-4.3 | Staged changes shown with before/after delta annotation per PG | P0 |
| FR-4.4 | "Staged Changes Summary" box shows all pending changes before apply | P0 |
| FR-4.5 | [Reset to Current] button reverts all staged changes | P0 |
| FR-4.6 | [Apply & Resume] applies all staged changes simultaneously and resumes | P0 |
| FR-4.7 | Right-click slider shortcuts: set to 0%, 50%, 100%, reset to current | P1 |
| FR-4.8 | Preview in summary: "New optimal PG after this change: PG-D at 95%" | P1 |
| FR-4.9 | Maximum 10 SR change events per session (prevents unbounded complexity) | P2 |

### FR-5: Real-time Charts

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | Chart 1 (Routing Share): updates every tick (throttled to every 10 ticks at >5K speed) | P0 |
| FR-5.2 | Chart 2 (True vs Estimated SR): per-PG, selectable PG dropdown | P0 |
| FR-5.3 | Chart 3 (Cumulative Regret): one line per algorithm | P0 |
| FR-5.4 | Chart 4 (Rolling Achieved SR): configurable window (10/50/100/500 ticks) | P0 |
| FR-5.5 | All charts: vertical event markers at SR change and convergence ticks | P0 |
| FR-5.6 | All charts: hover tooltips with exact values at any data point | P0 |
| FR-5.7 | All charts: pan/zoom; "Follow live" button to snap back to latest | P1 |
| FR-5.8 | Charts maintain ≥ 30 fps render rate at all simulation speeds | P0 |
| FR-5.9 | UI remains fully interactive (sliders, panels) during chart updates | P0 |

### FR-6: Convergence Analysis

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | Convergence detection starts automatically at every SR change event resume | P0 |
| FR-6.2 | Live convergence panel shows Phase (Blindness / Detecting / Converged) per algorithm during event | P0 |
| FR-6.3 | Convergence latency reported in transactions AND projected production time | P0 |
| FR-6.4 | Damage metrics: txns on bad PG, estimated extra failures during convergence window | P0 |
| FR-6.5 | Post-convergence narrative in plain English: "Thompson was 2x faster because..." | P1 |
| FR-6.6 | Multi-event summary table for sessions with > 1 SR change event | P1 |
| FR-6.7 | Convergence threshold and stability window user-configurable in Advanced Settings | P1 |
| FR-6.8 | Recovery overshoot detection for SR increase events | P2 |

### FR-7: Scenarios

| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | 8 pre-built scenarios available from scenario library | P0 |
| FR-7.2 | Each scenario loads in < 2 seconds | P0 |
| FR-7.3 | Auto-events in scenarios apply at specified ticks without user interaction | P1 |
| FR-7.4 | Save current config + SR event sequence as named custom scenario | P1 |
| FR-7.5 | Load custom scenario from JSON file | P1 |
| FR-7.6 | Share scenario config via URL | P2 |

---

## 14. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| **Performance** | Chart render rate during simulation | ≥ 30 fps at all simulation speeds |
| **Performance** | UI interaction responsiveness (slider drag, panel open) | < 16ms (60 fps UI thread) |
| **Performance** | SR change applied at resume | Within 1 tick of resume — no delay |
| **Performance** | Maximum simulation speed | 10,000 txns/sec (real time) |
| **Correctness** | Pause state preservation | Zero state drift during any pause duration |
| **Correctness** | SR applied atomically | All staged SR changes applied at tick T; none at tick T-1 or T+1 |
| **Correctness** | Algorithm isolation | Algorithms share no state; each has independent internal model |
| **Correctness** | Convergence detection accuracy | Convergence tick reported within ±5 ticks of true convergence |
| **Reproducibility** | Same seed + same config + same SR sequence | Identical metrics across runs |
| **Memory** | Maximum metrics history stored | 100,000 ticks of full metrics (throttled storage beyond this) |
| **Browser** | Supported browsers | Chrome, Firefox, Safari (latest 2 versions) |
| **Accessibility** | Keyboard navigable | All controls reachable and operable via keyboard |

---

## 15. Tech Stack & Architecture

### 15.1 Frontend Architecture

The simulation runs entirely in the browser via a Web Worker — this keeps the UI thread free for smooth 60fps rendering even at 10,000 txns/sec simulation speed.

```
┌───────────────────────────────────────────────────────────────┐
│  Browser Main Thread                                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  React 18 + TypeScript                                   │ │
│  │  ├── PG Config Panel (left sidebar)                      │ │
│  │  ├── Algorithm Panel (left sidebar)                      │ │
│  │  ├── Control Bar (top)                                   │ │
│  │  ├── SR Manipulation Panel (right sidebar)               │ │
│  │  ├── Charts (Recharts + D3.js)                           │ │
│  │  ├── Convergence Panel (bottom)                          │ │
│  │  └── Event Timeline (bottom strip)                       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          ↕ postMessage (structured clone)      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Web Worker (simulation_worker.ts)                       │ │
│  │  ├── SimulationLoop (async generator)                    │ │
│  │  ├── SRState (ground truth SR)                           │ │
│  │  ├── AlgorithmInstances[] (runs plugin algorithms)       │ │
│  │  ├── MetricsAccumulator (rolling metrics)                │ │
│  │  └── ConvergenceTracker                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Message Protocol (Main Thread ↔ Worker):**

```typescript
// Main → Worker commands
type WorkerCommand =
  | { type: 'START'; config: SimConfig }
  | { type: 'PAUSE' }
  | { type: 'RESUME'; staged_changes: Record<string, number> }
  | { type: 'RESET' }
  | { type: 'SET_SPEED'; tps: number }
  | { type: 'REQUEST_STATE' };     // worker responds with full state snapshot

// Worker → Main updates (emitted continuously during RUNNING)
type WorkerUpdate =
  | { type: 'TICK_METRICS'; metrics: TickMetrics }           // every tick (or batched)
  | { type: 'SR_CHANGE_EVENT'; event: SRChangeEvent }        // on SR change
  | { type: 'CONVERGENCE_EVENT'; result: ConvergenceResult } // on convergence detection
  | { type: 'STATUS_CHANGE'; status: SimulationStatus }
  | { type: 'STATE_SNAPSHOT'; state: SimulationSession };    // response to REQUEST_STATE
```

**Batched updates:** At simulation speeds > 1,000 txns/sec, the worker batches metrics and sends them every 50ms (not every tick) to avoid saturating the main thread's message queue.

### 15.2 Algorithm Execution in Browser

Algorithms run as JavaScript (compiled from Python via Pyodide, or re-implemented as TypeScript). For v1, the 5 built-in algorithms are implemented natively in TypeScript for performance.

```typescript
// algorithms/base.ts — browser-side algorithm interface
interface BaseAlgorithm {
  initialize(arms: string[], config: Record<string, unknown>): void;
  select(context: TransactionContext): string;
  update(arm: string, reward: number, context: TransactionContext): void;
  getState(): Record<string, ArmState>;
  explainLastDecision(): string;
}

interface ArmState {
  estimatedSR: number;
  selectionScore: number;
  totalSelections: number;
  windowData?: number[];   // for SW-UCB
  alpha?: number;          // for Thompson
  beta?: number;           // for Thompson
}
```

### 15.3 Chart Rendering

- **Recharts** for Chart 1 (Routing Share), Chart 3 (Regret), Chart 4 (Rolling SR) — standard line charts
- **Custom D3.js component** for Chart 2 (True vs Estimated SR) — needs dynamic annotation layers
- **Virtual scrolling** on Event Timeline for sessions with many events
- **Canvas-based rendering** (not SVG) for Routing Share chart when simulation speed > 5,000 txns/sec (SVG DOM updates too slow at high throughput)

### 15.4 State Management

- **Zustand** (lightweight React state manager) for UI state (panel open/close, selected PG, zoom state)
- **Worker-owned state** for simulation state (authoritative source of truth)
- **React refs** for chart data buffers (not React state, to avoid re-render overhead on every tick)

### 15.5 Project Structure

```
pg-routing-simulator/
├── src/
│   ├── features/
│   │   └── dynamic-simulation/         # This feature's home
│   │       ├── SimulationSandbox.tsx   # Root component (layout)
│   │       ├── panels/
│   │       │   ├── PGConfigPanel.tsx
│   │       │   ├── AlgorithmPanel.tsx
│   │       │   ├── ControlBar.tsx
│   │       │   ├── SRManipulationPanel.tsx
│   │       │   ├── ConvergencePanel.tsx
│   │       │   └── EventTimeline.tsx
│   │       ├── charts/
│   │       │   ├── RoutingShareChart.tsx
│   │       │   ├── TrueVsEstimatedSRChart.tsx
│   │       │   ├── CumulativeRegretChart.tsx
│   │       │   └── RollingAchievedSRChart.tsx
│   │       ├── worker/
│   │       │   ├── simulation.worker.ts  # Web Worker entry point
│   │       │   ├── simulation_loop.ts
│   │       │   ├── sr_state.ts
│   │       │   ├── metrics.ts
│   │       │   └── convergence_tracker.ts
│   │       ├── algorithms/               # TypeScript implementations
│   │       │   ├── base.ts
│   │       │   ├── sw_ucb.ts
│   │       │   ├── thompson.ts
│   │       │   ├── d_ucb.ts
│   │       │   ├── epsilon_greedy.ts
│   │       │   └── round_robin.ts
│   │       ├── scenarios/
│   │       │   ├── scenario_loader.ts
│   │       │   └── prebuilt/             # 8 scenario JSON files
│   │       ├── hooks/
│   │       │   ├── useSimulation.ts      # Main hook: worker comms
│   │       │   ├── useChartData.ts       # Chart buffer management
│   │       │   └── useConvergence.ts     # Convergence state
│   │       └── types.ts                  # All shared TypeScript types
│   └── ...
```

---

## 16. Milestones & Delivery Plan

**Team:** 1 Frontend Engineer, 1 Algorithm/Backend Engineer (TypeScript port of algorithms)
**Total Duration:** 10 weeks

| Milestone | Deliverables | Duration | Exit Criteria |
|---|---|---|---|
| **M1: Core Engine** | Web Worker simulation loop, SRState, MetricsAccumulator, 5 algorithm TypeScript ports, pause/resume with state preservation | 2 weeks | Simulation runs at 10K txns/sec in browser; pause/resume preserves state exactly; SR changes apply atomically at resume tick |
| **M2: PG Config + Controls** | PG Configuration Panel, Algorithm Selection Panel, Control Bar, SR Manipulation Panel (PAUSED state) | 2 weeks | User can configure 2–10 PGs, select algorithms, start/pause/resume/reset, stage SR changes and apply |
| **M3: Core Charts** | All 4 real-time charts wired to worker output; vertical event markers; pan/zoom | 2 weeks | Charts update at ≥ 30fps at 500 txns/sec; event markers appear correctly; pan/zoom works |
| **M4: Convergence Engine + Panel** | ConvergenceTracker, all three phase states, Convergence Panel (live + post-convergence + multi-event summary), plain English narrative | 2 weeks | Convergence detected within ±5 ticks; damage metrics accurate; narrative generated for each event |
| **M5: Scenarios + Polish** | 8 pre-built scenarios, scenario loader, Event Timeline, Per-PG Deep Dive panel, save/load config, keyboard shortcuts | 2 weeks | All 8 scenarios load in < 2s; custom scenario saves/loads correctly; keyboard shortcuts work |

---

## 17. Acceptance Criteria

### 17.1 Simulation Engine Correctness

- [ ] Same seed + same config + same SR change sequence produces identical `cumulative_regret` values across two independent runs (deterministic)
- [ ] SR change applied at resume: `sr_state.current_sr[pg]` is updated at exactly tick T (first tick after resume), verified by logging expected vs actual tick in tests
- [ ] During PAUSED state: simulation tick counter does not advance; algorithm states do not change; metric accumulators do not change — confirmed by checksum of state before and after a 30-second pause
- [ ] At speed=10,000 txns/sec: simulation runs for 60 seconds without memory leak (memory usage < 200MB); chart render rate ≥ 30fps measured via browser performance API
- [ ] With 3 algorithms running simultaneously, each algorithm's total routing share sums to 100% at every measured tick (±0.01% floating point tolerance)

### 17.2 Convergence Detection

- [ ] On reference scenario "Sudden Death" with SW-UCB window=200: convergence latency is within ±10 ticks of manually calculated expected value (verified against reference implementation)
- [ ] Convergence panel transitions correctly through Phase 1 → Phase 2 → Converged states in correct order; no skipping
- [ ] Multi-event summary table shows correct worst/best/average convergence latency per algorithm across 3 test events
- [ ] Recovery overshoot correctly detected when an algorithm routes > 5pp more than equilibrium share to a recovered PG for > 10 consecutive ticks

### 17.3 UI Behaviour

- [ ] SR sliders cannot be moved during RUNNING state (locked); confirmed by attempting programmatic slider drag and verifying `staged_changes` dict is empty
- [ ] [Apply & Resume] with no staged changes does not emit any SR change event and does not mark any convergence monitor as started
- [ ] Pressing Space during RUNNING pauses; pressing Space while PAUSED resumes — both confirmed with keyboard event simulation tests
- [ ] Chart 2 (True vs Estimated SR): the "True SR" line steps instantaneously at the SR change event tick; algorithm estimated SR lines do not step (they follow gradually) — confirmed visually and by data point inspection

### 17.4 Scenario System

- [ ] All 8 pre-built scenarios load in < 2 seconds from click to simulation start
- [ ] "Sudden Death" scenario: PG-A SR changes to 0% at exactly T=500 (verified by event log)
- [ ] Custom scenario saved with seed=42 and reloaded produces identical simulation state at T=1000 as original run with seed=42

### 17.5 Performance

- [ ] At speed=10,000 txns/sec with 3 algorithms and 5 PGs: UI main thread frame time < 16ms (measured via `requestAnimationFrame` timing, excluding intentional animation frames)
- [ ] Worker postMessage round-trip for a `PAUSE` command: < 5ms from command send to `STATUS_CHANGE: paused` receipt
- [ ] Memory usage after 60-second run at 10,000 txns/sec (600,000 ticks): < 200MB (metrics throttled to every 10 ticks in storage)

---

## 18. Appendix: Algorithm State Equations

Reference equations for the TypeScript implementations.

### Sliding Window UCB

```
Given: window W, total ticks N, arm history as deque of last W rewards

select():
  for each arm a:
    if |history[a]| == 0: return a  (cold start)
    n_a = |history[a]|
    sr_a = sum(history[a]) / n_a
    bonus_a = sqrt(2 * ln(N) / n_a)
    score[a] = sr_a + bonus_a
  return argmax(score)

update(arm, reward):
  history[arm].append(reward)   # deque maxlen=W: oldest auto-discarded
```

### Discounted UCB

```
Given: discount factor γ ∈ (0,1)

State: n_eff[a], s_eff[a] for each arm a (initialised to 0)
N_eff = sum(n_eff[a]) for all a

select():
  for each arm a:
    if n_eff[a] == 0: return a
    sr_a = s_eff[a] / n_eff[a]
    bonus_a = sqrt(2 * ln(N_eff) / n_eff[a])
    score[a] = sr_a + bonus_a
  return argmax(score)

update(arm, reward):
  for each arm a:
    n_eff[a] *= γ
    s_eff[a] *= γ
  n_eff[arm] += 1
  s_eff[arm] += reward
```

### Thompson Sampling (Bernoulli)

```
State: alpha[a], beta[a] for each arm a (initialised from priors)

select():
  for each arm a:
    theta[a] = sample from Beta(alpha[a], beta[a])
  return argmax(theta)

update(arm, reward):
  if reward == 1: alpha[arm] += 1
  else:           beta[arm]  += 1

Estimated SR for arm a = alpha[a] / (alpha[a] + beta[a])
```

### Epsilon-Greedy

```
State: counts[a], successes[a]; epsilon (decays by decay_rate each tick)

select():
  if random() < epsilon: return random arm (exploration)
  else: return argmax(successes[a] / counts[a] for a with counts[a] > 0)

update(arm, reward):
  counts[arm] += 1
  if reward == 1: successes[arm] += 1
  epsilon *= (1 - decay_rate)
```

### Oracle (for Regret Calculation)

```
At each tick t, oracle_sr[t] = max(true_sr[a] for all arms a)

Per-tick regret contribution:
  regret_contribution[t] = oracle_sr[t] - true_sr[chosen_arm[t]]
  (Note: use true SR of chosen arm, not observed outcome, to smooth noise)

Cumulative regret:
  regret[T] = sum(regret_contribution[t] for t in 0..T)
```

---

*Dynamic SR Simulation Sandbox — PRD v1.0 — INTERNAL*
*Parent feature: PG Routing Algorithm Simulator — see `PG_ROUTING_SIMULATOR_PRD.md`*

# Payment Gateway Routing Algorithm Simulator
## Product Requirements Document — v1.0

> **Status:** DRAFT — For Review  
> **Classification:** CONFIDENTIAL — INTERNAL  
> **Target Users:** Data Science, Engineering, Product, Business  
> **Reviewed By:** Engineering Lead, Head of Payments

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Motivation](#2-problem-statement--motivation)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Stakeholders & User Personas](#4-stakeholders--user-personas)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Core Module: Algorithm Engine](#6-core-module-algorithm-engine)
7. [Algorithm Plugin Interface — API Contract](#7-algorithm-plugin-interface--api-contract)
8. [Data Layer: Inputs & Scenarios](#8-data-layer-inputs--scenarios)
9. [UI Requirements](#9-ui-requirements)
10. [Reporting & Transparency Engine](#10-reporting--transparency-engine)
11. [Functional Requirements](#11-functional-requirements)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Tech Stack Recommendation](#13-tech-stack-recommendation)
14. [Milestones & Delivery Plan](#14-milestones--delivery-plan)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Acceptance Criteria](#16-acceptance-criteria)
17. [Appendix: Algorithm Reference](#17-appendix-algorithm-reference)

---

## 1. Executive Summary

Selecting the optimal Payment Gateway (PG) for each transaction is one of the highest-leverage engineering decisions a payment company can make. A 1% improvement in Success Rate (SR) at INR 10,000 crore GMV translates to INR 100 crore of rescued transactions annually. SR is not static — it changes by payment mode, issuing bank, time of day, and due to gateway outages — making this a fundamentally **non-stationary optimisation problem**.

The **PG Routing Algorithm Simulator** is a standalone platform that allows data science, product, and engineering teams to:
- Upload historical transaction data
- Configure routing algorithm parameters
- Run head-to-head simulations across multiple algorithms simultaneously
- Generate transparent, audit-ready reports

All of this happens **before deploying any algorithm to production**, de-risking the decision entirely.

The simulator is built ground-up with a **pluggable architecture** — new algorithms (bandit variants, ML models, rule-based hybrids) can be added by implementing a single interface, with zero changes to core infrastructure. Every routing decision made by every algorithm is logged and fully explainable.

> **Core Value Proposition:** De-risk algorithm selection. Quantify SR uplift with statistical confidence. Reduce time-to-production from months to days. Make routing decisions transparent to all stakeholders — not just the data science team.

---

## 2. Problem Statement & Motivation

### 2.1 The Routing Problem

When a payment transaction is initiated, the system must select one of N available Payment Gateways. Each gateway has a different historical success rate that varies across dimensions:

| Dimension | Description |
|---|---|
| **Payment Mode** | UPI SR may differ dramatically from Net Banking SR on the same gateway |
| **Issuing Bank** | HDFC card transactions succeed more on PG-A; SBI transactions on PG-B |
| **Time of Day** | Banks have maintenance windows (2–4 AM), peak-hour degradation (6–9 PM) |
| **Amount Band** | High-value transactions may trigger additional bank-side risk checks |
| **Gateway State** | Gateways suffer intermittent outages, slow degradation, sudden recovery |

This is formally equivalent to the **Non-Stationary Multi-Armed Bandit** problem: each gateway is an "arm", and the reward distribution (SR) changes over time in unpredictable ways.

### 2.2 Why Simulate Before Deploying?

Production A/B testing of routing algorithms is expensive — every sub-optimal route is a lost transaction. Teams need a safe, reproducible environment to:

- Compare multiple algorithms on the **same historical dataset** simultaneously
- Tune hyperparameters (window size, discount factor, epsilon) **offline** before going live
- Understand failure modes — what does the algorithm do during a simulated gateway outage?
- Build **statistical confidence** in projected SR uplift before seeking stakeholder sign-off
- Onboard new engineers to routing concepts with interactive, visual feedback

### 2.3 Why a Pluggable Architecture?

The field moves fast. Dream11 deployed Sliding Window UCB in 2023. Adyen shipped NNLinUCB in 2024. New contextual bandit variants, transformer-based approaches, and hybrid ML systems will continue to emerge.

**Requirement:** Adding a new algorithm must take under 2 hours of engineering time — by implementing a well-defined interface — without modifying the core simulation engine, UI, or reporting layer.

---

## 3. Goals & Non-Goals

### 3.1 Goals

| ID | Goal | Success Metric |
|---|---|---|
| **G1** | Accept historical transaction data (CSV/Parquet) and replay it through routing algorithms | Data ingested and validated < 60s for 10M rows |
| **G2** | Ship with 5 built-in algorithms: SW-UCB, D-UCB, Thompson Sampling, Epsilon-Greedy, Round Robin baseline | All 5 produce verifiably correct decisions on reference dataset |
| **G3** | Enable any new algorithm to be plugged in via a defined interface without modifying core code | New algorithm deployed in < 2hrs engineering time |
| **G4** | Provide a rich, interactive UI for configuring experiments and viewing results in real-time | Non-technical stakeholder can run a simulation independently |
| **G5** | Generate a self-contained, shareable PDF report for every simulation run | Report is audit-ready with full methodology transparency |
| **G6** | Support multi-dimensional segmentation: results by PG, mode, bank, amount band, time | Segment filters work without re-running simulation |
| **G7** | Statistical significance testing on SR uplift claims | p-value and 95% CI reported for every algorithm comparison |
| **G8** | Simulation completes within acceptable time for interactive use | 10M transaction simulation finishes in < 2 minutes |

### 3.2 Non-Goals

| Non-Goal | Rationale |
|---|---|
| Real-time production routing | Simulator is a research & decision tool, not a live system |
| Payment gateway API integration | Simulator works entirely on historical logged data |
| Fraud detection / risk scoring | Out of scope; routed transaction assumed non-fraudulent |
| Multi-currency / cross-border (v1) | Future milestone; v1 focuses on INR transactions |
| Model training / AutoML | Simulator evaluates pre-defined algorithms; ML training is separate |

---

## 4. Stakeholders & User Personas

| Persona | Role | Primary Need | Key Features |
|---|---|---|---|
| **Data Scientist** | Owns algorithm selection | Run controlled experiments, tune hyperparameters, produce statistically valid comparisons | Algorithm config panel, regret plots, significance tests, segment drill-downs |
| **Payments PM** | Owns success rate KPIs | Understand projected SR uplift, build business case for algorithm change | Executive dashboard, SR uplift table, PDF report, plain-language summaries |
| **Backend Engineer** | Implements routing service | Understand winning algorithm well enough to implement correctly in production | Transparency panel, pseudocode view, decision trace logs |
| **Engineering Lead** | Signs off on production changes | Verify simulation methodology is sound and reproducible | Methodology docs, audit log, reproducibility seed, config export |
| **Business / Finance** | Monitors GMV impact | Translate SR numbers to INR GMV impact | GMV calculator, downtime impact analysis, cost-of-wrong-routing metric |

---

## 5. System Architecture Overview

### 5.1 Architecture Principle

> The simulator follows a strict **layered architecture**. Data flows in one direction: `Data Layer → Simulation Engine → Results Store → UI & Reporting`. The Algorithm Plugin Layer is a pure side-input to the Simulation Engine — algorithms only implement a standard interface and have no access to other layers.

### 5.2 Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     PG ROUTING SIMULATOR                         │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                       UI LAYER                              │ │
│  │   [Config Panel]  [Live Dashboard]  [Report Viewer]         │ │
│  │   [Results Explorer]  [Transparency Panel]                  │ │
│  └────────────────────────┬────────────────────────────────────┘ │
│                           │ HTTP / WebSocket                      │
│  ┌────────────────────────▼────────────────────────────────────┐ │
│  │              SIMULATION ENGINE (Core)                        │ │
│  │   [Transaction Replayer]  [Arm State Manager]  [Evaluator]  │ │
│  └────┬─────────────────────────────────────────────────────── ┘ │
│       │  Algorithm Interface (select / update / get_state)        │
│  ┌────▼──────────────────────────────────────────────────────┐   │
│  │               ALGORITHM PLUGIN LAYER                       │   │
│  │   [SW-UCB]  [D-UCB]  [Thompson]  [ε-Greedy]  [Custom...]  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌──────────────────────┐    ┌─────────────────────────────────┐  │
│  │     DATA LAYER       │    │        RESULTS STORE            │  │
│  │  CSV / Parquet /     │    │  SQLite / Parquet +             │  │
│  │  Synthetic Generator │    │  Report Engine (PDF / JSON)     │  │
│  └──────────────────────┘    └─────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow (Step by Step)

| Step | Component | Description |
|---|---|---|
| 1 | **Data Ingestion** | User uploads CSV/Parquet. System validates schema, computes summary stats, stores in Data Layer |
| 2 | **Experiment Config** | User selects algorithms, hyperparameters, date range, segment filters via Config Panel |
| 3 | **Simulation Dispatch** | Engine replays transactions chronologically. At each transaction, calls `select(context)` on each algorithm |
| 4 | **Reward Feedback** | Engine looks up actual outcome; calls `update(pg, reward)` on each algorithm to update internal state |
| 5 | **Metrics Accumulation** | Evaluator accumulates per-algorithm metrics: cumulative SR, regret, exploration rate, per-segment SR |
| 6 | **Results Persistence** | All decisions, states, metrics written to Results Store |
| 7 | **Live Dashboard** | UI streams real-time metrics during simulation via WebSocket |
| 8 | **Report Generation** | On completion, Reporting Engine produces structured PDF + JSON export |

---

## 6. Core Module: Algorithm Engine

### 6.1 Engine Responsibilities

- Replay transactions in strict **chronological order** (preserving temporal causality)
- Maintain **independent state** for each algorithm instance across the simulation
- Call algorithm `select()` and `update()` hooks at correct points in the replay loop
- Enforce the **"no look-ahead" constraint**: algorithms may only see transactions up to current time T
- Support **parallel execution** of multiple algorithms on the same transaction stream for fair comparison
- Track and expose: cumulative regret, per-step decisions, arm state snapshots, exploration/exploitation ratio

### 6.2 Simulation Loop

```python
# Core Simulation Loop
for transaction in replay_dataset.chronological_order():
    context = extract_context(transaction)     # mode, bank, amount, time, etc.
    actual_pg = transaction.pg_used            # what was actually used historically
    actual_outcome = transaction.outcome       # 1 = success, 0 = failure
    optimal_pg = oracle.best_pg(context)       # ground truth for regret calculation

    for algorithm in active_algorithms:
        chosen_pg = algorithm.select(context)           # → Plugin interface call
        predicted_outcome = simulate_outcome(
            chosen_pg, context, historical_sr_model     # counterfactual SR estimate
        )
        algorithm.update(chosen_pg, predicted_outcome)  # → Plugin interface call

        metrics[algorithm].record(
            chosen_pg, predicted_outcome, optimal_pg, context
        )

# Regret = Σ over T of (oracle_sr[t] - algorithm_sr[t])
```

### 6.3 Counterfactual Outcome Estimation

Since the simulator replays historical data, it must estimate what would have happened if a **different gateway** had been chosen. Three modes are supported, configurable per experiment:

| Mode | Method | When to Use | Bias Risk |
|---|---|---|---|
| **Direct Replay** | Only evaluate when algorithm's chosen PG matches historically used PG | Unbiased but uses only ~1/N of data | Low |
| **IPS Reweighting** | Inverse Propensity Scoring: reweight outcomes by `P(algo_choice) / P(historical_choice)` | Best statistical approach for logged data | Medium |
| **SR Interpolation** | Use per-`(PG, mode, bank, hour)` SR from training window to estimate outcome | Fast, intuitive; acceptable for most experiments | Medium-High |

> **Default recommendation:** Use IPS for production algorithm selection decisions. Use SR Interpolation for exploratory hyperparameter tuning. Always disclose the mode used in reports.

### 6.4 Oracle SR (Regret Baseline)

The oracle knows, for each transaction context, which gateway has the highest true SR. Regret is computed as:

```
cumulative_regret(T) = Σ_{t=1}^{T} [ oracle_sr(context_t) - algorithm_sr(context_t, chosen_pg_t) ]
```

Lower regret = better algorithm. An algorithm with zero regret would always choose the optimal gateway.

---

## 7. Algorithm Plugin Interface — API Contract

> **Design Principle (Open/Closed):** The simulator engine is **closed to modification** but **open to extension**. Every algorithm — built-in or custom — must implement the same interface. The engine never reaches inside an algorithm object; it only calls interface methods.

### 7.1 Data Types

```python
# transactions/context.py

from dataclasses import dataclass

@dataclass
class TransactionContext:
    payment_mode: str           # 'upi' | 'card' | 'netbanking' | 'wallet' | 'bnpl'
    card_network: str | None    # 'visa' | 'mastercard' | 'rupay' | 'amex' | None
    issuing_bank: str           # 'HDFC' | 'SBI' | 'ICICI' | 'AXIS' | ...
    amount: float               # transaction amount in INR
    amount_band: str            # '0-500' | '500-5k' | '5k-50k' | '50k+'
    hour: int                   # 0–23
    day_of_week: int            # 0=Monday, 6=Sunday
    merchant_category: str      # 'ecomm' | 'travel' | 'gaming' | 'utilities' | ...
    device_type: str | None     # 'mobile_app' | 'mobile_web' | 'desktop' | None
    state: str | None           # Indian state code or None
```

### 7.2 BaseAlgorithm Interface

```python
# algorithms/base.py

from abc import ABC, abstractmethod
from typing import List, Dict, Any
from transactions.context import TransactionContext


class BaseAlgorithm(ABC):
    """
    Every routing algorithm — built-in or custom plugin — must implement this interface.
    The simulator engine ONLY calls these methods. No other coupling exists.
    """

    # ── Lifecycle ────────────────────────────────────────────────────────────

    @abstractmethod
    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        """
        Called once at simulation start.
        
        Args:
            arms:   List of PG identifiers available for routing (e.g. ['razorpay', 'cashfree', 'payu'])
            config: Dict of hyperparameter values from experiment configuration
        """

    # ── Core: called on every transaction ────────────────────────────────────

    @abstractmethod
    def select(self, context: TransactionContext) -> str:
        """
        Select a gateway for this transaction.
        
        Args:
            context: Transaction features available at routing time
            
        Returns:
            PG identifier string (must be one of the arms passed to initialize)
            
        Constraints:
            - Must NOT access any future transaction data
            - Must NOT raise exceptions (handle internally and return best-effort choice)
            - Must complete in < 10ms
        """

    @abstractmethod
    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        """
        Receive outcome feedback after a routing decision.
        
        Args:
            arm:     The PG identifier that was used (may differ from select() return in replay mode)
            reward:  1 = transaction succeeded, 0 = transaction failed
            context: Same context that was passed to the corresponding select() call
        """

    # ── State & Transparency ─────────────────────────────────────────────────

    @abstractmethod
    def get_state(self) -> Dict[str, Any]:
        """
        Return current internal arm state for UI transparency panel.
        
        Expected structure (extend as needed):
        {
            "arm_id": {
                "estimated_sr": float,          # current SR estimate (0.0–1.0)
                "selection_score": float,        # score used for arm selection (e.g. UCB value)
                "total_selections": int,
                "total_successes": int,
                "total_failures": int,
                "window_data": [...],            # algorithm-specific (e.g. sliding window)
            }
        }
        """

    def explain_last_decision(self) -> str:
        """
        Human-readable explanation of the most recent select() decision.
        Used in the Transparency Panel decision timeline.
        Override to provide meaningful explanations.
        
        Example: "Chose razorpay (UCB=0.934: SR=0.891 + bonus=0.043) over cashfree (UCB=0.901)"
        """
        return "No explanation provided by this algorithm."

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        """
        JSON Schema for this algorithm's hyperparameters.
        Used to auto-generate the configuration form in the UI.
        
        Example:
        {
            "window_size": {
                "type": "integer", "default": 200, "min": 10, "max": 10000,
                "description": "Number of most recent transactions per gateway to consider"
            }
        }
        """
        return {}

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        """
        Algorithm metadata displayed in the UI algorithm card.
        Override in every implementation.
        """
        return {
            "name": cls.__name__,
            "short_name": cls.__name__,
            "description": "No description provided.",
            "paper": "",                        # Full citation string
            "paper_url": "",                    # arXiv or DOI link
            "category": "bandit",               # 'bandit' | 'ml' | 'rule_based' | 'hybrid'
            "non_stationary": "false",          # 'true' if handles distribution shift
        }
```

### 7.3 Complete Example: Sliding Window UCB

```python
# algorithms/sw_ucb.py

import math
from collections import deque
from typing import List, Dict, Any
from algorithms.base import BaseAlgorithm
from transactions.context import TransactionContext


class SlidingWindowUCB(BaseAlgorithm):
    """
    Sliding Window Upper Confidence Bound algorithm for non-stationary bandits.
    
    Reference: Garivier & Moulines (2011), "On Upper-Confidence Bound Policies 
    for Non-Stationary Bandit Problems" — arXiv:0805.3415
    
    Only the most recent `window_size` transactions per gateway are considered,
    allowing the algorithm to forget outdated SR observations and adapt quickly
    to gateway state changes (outages, recovery events).
    """

    def initialize(self, arms: List[str], config: Dict[str, Any]) -> None:
        self.arms = arms
        self.window_size = config.get("window_size", 200)
        # Deque with maxlen automatically discards oldest entries
        self.history: Dict[str, deque] = {
            arm: deque(maxlen=self.window_size) for arm in arms
        }
        self.total_selections = 0
        self._last_scores: Dict[str, float] = {}
        self._last_chosen: str = ""

    def select(self, context: TransactionContext) -> str:
        self.total_selections += 1
        scores = {}

        for arm in self.arms:
            hist = self.history[arm]
            n = len(hist)

            if n == 0:
                # Cold-start: unexplored arm gets priority — return immediately
                # to ensure all arms are tried before pure exploitation begins
                self._last_chosen = arm
                self._last_scores = {a: float('inf') if a == arm else 0.0 for a in self.arms}
                return arm

            sr = sum(hist) / n
            # UCB exploration bonus: decreases as arm is selected more, 
            # increases as total selections grow
            exploration_bonus = math.sqrt(2 * math.log(self.total_selections) / n)
            scores[arm] = sr + exploration_bonus

        self._last_scores = scores
        self._last_chosen = max(scores, key=scores.get)
        return self._last_chosen

    def update(self, arm: str, reward: int, context: TransactionContext) -> None:
        self.history[arm].append(reward)

    def get_state(self) -> Dict[str, Any]:
        state = {}
        for arm in self.arms:
            hist = self.history[arm]
            n = len(hist)
            state[arm] = {
                "estimated_sr": sum(hist) / n if n > 0 else None,
                "selection_score": self._last_scores.get(arm),
                "window_count": n,
                "window_capacity": self.window_size,
                "window_successes": sum(hist),
                "window_failures": n - sum(hist),
                "all_rewards": list(hist),  # full window for timeline scrubbing
            }
        return state

    def explain_last_decision(self) -> str:
        if not self._last_chosen or not self._last_scores:
            return "No decision made yet."
        chosen = self._last_chosen
        score = self._last_scores.get(chosen, 0)
        hist = self.history[chosen]
        n = len(hist)
        sr = sum(hist) / n if n > 0 else 0
        bonus = score - sr
        others = {a: f"{s:.4f}" for a, s in self._last_scores.items() if a != chosen}
        return (
            f"Chose '{chosen}' with UCB={score:.4f} "
            f"(SR={sr:.3f} + exploration_bonus={bonus:.4f}, window_n={n}). "
            f"Other scores: {others}"
        )

    def get_hyperparameter_schema(self) -> Dict[str, Any]:
        return {
            "window_size": {
                "type": "integer",
                "default": 200,
                "min": 10,
                "max": 10000,
                "description": (
                    "Number of most recent transactions per gateway to consider. "
                    "Smaller = faster adaptation but noisier estimates. "
                    "Dream11 production optimal: 200."
                )
            }
        }

    @classmethod
    def metadata(cls) -> Dict[str, str]:
        return {
            "name": "Sliding Window UCB",
            "short_name": "SW-UCB",
            "description": (
                "Non-stationary UCB using a sliding window. Forgets old observations, "
                "enabling fast adaptation to gateway outages and SR changes."
            ),
            "paper": "Garivier & Moulines (2011). On Upper-Confidence Bound Policies for Non-Stationary Bandit Problems. ALT 2011.",
            "paper_url": "https://arxiv.org/abs/0805.3415",
            "category": "bandit",
            "non_stationary": "true",
        }
```

### 7.4 Plugin Registration

Algorithms are registered via `plugins.yaml`. The engine scans this at startup and dynamically imports registered classes. **No engine code changes needed.**

```yaml
# plugins.yaml

algorithms:
  # ── Built-in algorithms ──────────────────────────────────────────
  - id: sw_ucb
    class: algorithms.sw_ucb.SlidingWindowUCB
    built_in: true
    enabled: true

  - id: d_ucb
    class: algorithms.d_ucb.DiscountedUCB
    built_in: true
    enabled: true

  - id: thompson_sampling
    class: algorithms.thompson.ThompsonSampling
    built_in: true
    enabled: true

  - id: epsilon_greedy
    class: algorithms.epsilon_greedy.EpsilonGreedy
    built_in: true
    enabled: true

  - id: round_robin
    class: algorithms.round_robin.RoundRobin
    built_in: true
    enabled: true

  # ── Custom / plugin algorithms ───────────────────────────────────
  # To add your own: implement BaseAlgorithm, add an entry below
  # - id: my_custom_algo
  #   class: mypackage.my_module.MyAlgorithm
  #   built_in: false
  #   enabled: true
```

### 7.5 Plugin Engine Loader

```python
# engine/plugin_loader.py

import importlib
import yaml
from algorithms.base import BaseAlgorithm


def load_algorithms(plugins_path: str = "plugins.yaml") -> dict[str, type[BaseAlgorithm]]:
    """
    Dynamically load all enabled algorithm classes from plugins.yaml.
    Returns dict of {algorithm_id: AlgorithmClass}
    """
    with open(plugins_path) as f:
        config = yaml.safe_load(f)

    registry = {}
    for entry in config["algorithms"]:
        if not entry.get("enabled", True):
            continue
        module_path, class_name = entry["class"].rsplit(".", 1)
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)

        # Validate interface compliance
        assert issubclass(cls, BaseAlgorithm), (
            f"{entry['class']} must extend BaseAlgorithm"
        )

        registry[entry["id"]] = cls

    return registry
```

---

## 8. Data Layer: Inputs & Scenarios

### 8.1 Required Input Schema

All uploaded transaction data must conform to this schema. Columns marked Required must be present and non-null for every row.

| Column | Type | Required | Description |
|---|---|---|---|
| `transaction_id` | string | ✅ | Unique transaction identifier |
| `timestamp` | datetime (ISO-8601) | ✅ | Transaction initiation time |
| `payment_gateway` | string | ✅ | PG used (name or ID) |
| `payment_mode` | enum | ✅ | `upi` \| `card` \| `netbanking` \| `wallet` \| `bnpl` |
| `card_network` | enum | ❌ | `visa` \| `mastercard` \| `rupay` \| `amex` \| null |
| `issuing_bank` | string | ✅ | Bank name or code (e.g. `HDFC`, `SBI`) |
| `amount` | float | ✅ | Transaction amount in INR |
| `merchant_id` | string | ❌ | For merchant-level analysis |
| `merchant_category` | string | ❌ | MCC or category code |
| `outcome` | int (0 or 1) | ✅ | `1` = success, `0` = failure |
| `failure_reason` | string | ❌ | Decline code, timeout, gateway error, etc. |
| `device_type` | enum | ❌ | `mobile_app` \| `mobile_web` \| `desktop` \| `api` |
| `state` | string | ❌ | Indian state for geographic segmentation |

### 8.2 Data Models

```python
# data/models.py

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Transaction:
    transaction_id: str
    timestamp: datetime
    payment_gateway: str
    payment_mode: str           # 'upi' | 'card' | 'netbanking' | 'wallet' | 'bnpl'
    issuing_bank: str
    amount: float
    outcome: int                # 1 = success, 0 = failure
    card_network: Optional[str] = None
    merchant_id: Optional[str] = None
    merchant_category: Optional[str] = None
    failure_reason: Optional[str] = None
    device_type: Optional[str] = None
    state: Optional[str] = None


@dataclass
class DatasetStats:
    total_transactions: int
    date_range_start: datetime
    date_range_end: datetime
    gateways: list[str]
    overall_sr: float
    sr_by_gateway: dict[str, float]
    sr_by_mode: dict[str, float]
    volume_by_mode: dict[str, int]
    volume_by_gateway: dict[str, int]
    missing_values: dict[str, int]
    data_quality_score: float   # 0–100 composite score


@dataclass
class SimulationConfig:
    run_id: str
    run_name: str
    dataset_hash: str
    date_range_start: datetime
    date_range_end: datetime
    algorithms: list[dict]      # [{id, class, hyperparameters}]
    counterfactual_mode: str    # 'direct_replay' | 'ips' | 'sr_interpolation'
    warm_up_transactions: int   # default 0
    random_seed: int
    segment_filter: Optional[dict] = None


@dataclass
class AlgorithmResult:
    algorithm_id: str
    total_transactions: int
    total_successes: int
    overall_sr: float
    sr_confidence_interval: tuple[float, float]  # 95% CI
    cumulative_regret: float
    exploration_ratio: float    # % of non-greedy selections
    sr_by_gateway: dict[str, float]
    sr_by_mode: dict[str, dict]
    sr_by_bank: dict[str, dict]
    regret_over_time: list[float]
    sr_over_time: list[float]
    decisions: list[dict]       # sampled decision log
```

### 8.3 Synthetic Data Generator

For teams without sufficient historical data or for controlled algorithm testing, the simulator ships a configurable synthetic data generator.

```python
# data/synthetic.py

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GatewayConfig:
    id: str
    base_sr: dict[str, float]   # {mode: base_success_rate}
    bank_modifiers: dict[str, float] = field(default_factory=dict)
    # bank_modifiers: e.g. {"HDFC": +0.05, "SBI": -0.03}


@dataclass  
class OutageEvent:
    gateway_id: str
    start_transaction: int      # which transaction number outage begins
    end_transaction: int        # which transaction number outage ends
    degraded_sr: float          # SR during outage (e.g. 0.15)
    onset_type: str = "abrupt"  # 'abrupt' | 'gradual'


@dataclass
class SyntheticScenarioConfig:
    n_transactions: int = 100_000
    gateways: list[GatewayConfig] = field(default_factory=list)
    outage_events: list[OutageEvent] = field(default_factory=list)
    hour_sr_modifier: dict[int, float] = field(default_factory=dict)
    # hour_sr_modifier: e.g. {18: -0.10, 19: -0.12, 20: -0.10}  # peak hour drop
    transaction_mix: dict[str, float] = field(default_factory=dict)
    # transaction_mix: e.g. {"upi": 0.45, "card": 0.35, "netbanking": 0.20}
    random_seed: int = 42
```

### 8.4 Built-In Scenario Templates

| Template | Description | Tests |
|---|---|---|
| **Gateway Outage** | PG-A SR drops to 15% at T=5,000; recovers at T=7,000 | Outage detection speed and traffic re-routing |
| **Gradual Degradation** | PG-B SR drifts 92% → 60% over 10,000 transactions | Discount factor / window size sensitivity |
| **Peak Hour Stress** | All gateways SR drops 15% during hours 18–21 | Time-aware routing adaptation |
| **New Gateway Onboard** | PG-C added at T=3,000 with unknown SR | Cold-start handling and exploration |
| **Stable Production** | All gateways maintain steady SR ±2% | Verify algorithm doesn't over-explore in stable conditions |
| **Bank-Mode Interaction** | HDFC card SR: 95% on PG-A, 60% on PG-B; reversed for SBI | Contextual algorithm advantage over context-free bandit |

---

## 9. UI Requirements

### 9.1 Screen Overview

The UI consists of **five core screens** accessible from a persistent left-sidebar navigation.

| Screen | Route | Purpose | Primary User |
|---|---|---|---|
| Experiment Setup | `/setup` | Configure dataset, algorithms, hyperparameters, launch run | Data Scientist |
| Live Dashboard | `/run/:id/live` | Real-time progress and streaming metrics during simulation | Data Scientist, Engineer |
| Results Explorer | `/run/:id/results` | Interactive charts, segment drill-downs, algorithm comparison | All stakeholders |
| Transparency Panel | `/run/:id/transparency` | Per-decision explainability, arm state timeline, pseudocode | Engineer, Lead |
| Report Center | `/run/:id/report` | Generate, preview, export PDF/JSON reports | PM, Business |

### 9.2 Screen 1: Experiment Setup

#### Dataset Panel
- Drag-and-drop upload zone accepting `.csv` and `.parquet` files up to 5GB
- Auto-detect column types; display preview of first 100 rows with schema mapping UI
- Data quality report on upload: missing values, date range, PG list, per-mode SR, volume distribution
- "Use Synthetic Scenario" toggle: select from 6 template cards or configure custom scenario
- Date range selector: restrict simulation to a sub-window of uploaded data

#### Algorithm Configuration Panel
- Grid of algorithm cards — one per registered algorithm (built-in + plugins)
- Each card displays: algorithm name, short description, paper citation, category badge, enable toggle
- Expanded card: dynamically-generated hyperparameter form from `get_hyperparameter_schema()`
- Each hyperparameter field has: type-appropriate input (slider/number/dropdown), default value, tooltip with description and paper reference
- **Preset buttons** per algorithm: `Dream11 Optimal` (window=200), `Conservative`, `Aggressive Exploration`
- **Multi-instance mode**: run same algorithm with different hyperparameters simultaneously — add up to 3 instances per algorithm

#### Experiment Settings
- Counterfactual mode selector: `Direct Replay` | `IPS Reweighting` | `SR Interpolation` — each with explanation tooltip
- Segment filter: optionally restrict to specific payment mode, bank list, or amount range
- Reproducibility seed: numeric field (default random; shown in all reports)
- Warm-up period: number of initial transactions for exploration-only before metrics begin
- Run name and description (free text, required for report labelling)

### 9.3 Screen 2: Live Dashboard

Displayed during active simulation. Receives real-time updates via WebSocket every 500 transactions.

- **Progress bar**: transactions processed / total, % complete, elapsed time, estimated remaining, throughput (txns/sec)
- **Cumulative SR chart**: multi-line, one line per algorithm, updates in real-time
- **Arm selection frequency**: bar chart showing per-gateway routing share per algorithm (grouped bars, last 1,000 transactions)
- **Arm state table**: per-gateway current estimated SR and selection score for each algorithm
- **Anomaly detector**: if any gateway's SR drops >20% in last 100 transactions, highlight row in red with tooltip
- **Live decision log**: last 20 routing decisions with: timestamp, mode, bank, amount, chosen PG, outcome
- Controls: `Pause` | `Resume` | `Cancel` | `Skip to End` (batch mode)

### 9.4 Screen 3: Results Explorer

#### Primary Comparison Chart
- Multi-line chart: Cumulative Success Rate vs Transaction Number for all algorithms
- Confidence band (95% CI) shaded around each line
- Vertical dashed annotations at detected SR change-points (gateway outages/recoveries)
- Zoom / pan; click any data point to open sidebar with routing decision and full arm state at that moment
- Toggle: Cumulative SR | Rolling SR (last N transactions) | Cumulative Regret

#### Key Metrics Panel

| Metric | Definition | Display |
|---|---|---|
| **Overall SR** | Total successes / Total transactions | `%` with 95% CI |
| **SR Uplift vs Baseline** | Algorithm SR − Round Robin SR | `Δ%` with significance badge |
| **Cumulative Regret** | Σ(oracle_sr − algorithm_sr) | Line chart + final value |
| **Exploration Ratio** | % of non-greedy selections | `%` by transaction decile |
| **Detection Latency** | Transactions to re-route after simulated outage | Count |
| **Projected GMV Saved** | SR uplift × avg txn value × annual volume | INR crore/year |

#### Segment Drill-Down Panel
- Multi-select filter chips: `Payment Mode` | `Issuing Bank` | `Amount Band` | `Hour` | `Day of Week` | `Merchant Category`
- Filter applies client-side (no re-run needed)
- Heatmap view: Algorithm × Segment grid with SR values; colour-coded green-red
- Per-segment winner badge: best algorithm highlighted in each cell
- Export segment breakdown as CSV

#### Head-to-Head Comparison Table
- All algorithms vs all algorithms across all key metrics
- Winner highlighted per metric row
- Statistical significance: p-value (two-proportion z-test) and 95% CI for each SR comparison
- `Recommend` button: auto-selects best algorithm with one-paragraph plain-language rationale

### 9.5 Screen 4: Algorithm Transparency Panel

> **Principle:** Every routing decision made during simulation must be fully explainable. An engineer must be able to click any transaction and understand exactly why the algorithm chose that gateway.

#### Decision Timeline
- Paginated, searchable log of all routing decisions
- Columns: Transaction #, Timestamp, Mode, Bank, Amount, Chosen PG, Score, Outcome, Algorithm
- Click any row → expand drawer with:
  - Full `get_state()` output at that moment (all gateway scores/counts)
  - `explain_last_decision()` text from the algorithm
  - Counterfactual: estimated SR for each gateway at this context
- Filter by: algorithm | gateway chosen | outcome | payment mode | bank

#### Arm State Timeline
- Horizontal slider: scrub through simulation time (in transaction units)
- At each scrub position: show current estimated SR per gateway as bar chart with error bars
- Overlay: which gateway was the current "primary" (highest score) at each point
- Marks: when algorithm switched primary gateway

#### Algorithm Internals Panel (per algorithm)
- Human-readable formula display (e.g. `UCB(arm) = SR_window + √(2·ln(N) / n_window)`)
- Pseudocode with current hyperparameter values substituted in
- Hyperparameter sensitivity chart: pre-computed SR vs hyperparameter value curve (built-in algorithms)
- Research paper citation with clickable link

#### Counterfactual Explorer
- Pick any transaction from the timeline
- Display: estimated outcome probability for every gateway at that transaction's context
- Highlight: which gateway was optimal (oracle), which was chosen, and the SR gap

### 9.6 Screen 5: Report Center
- Full-page PDF preview of generated report (rendered via iframe)
- Section toggles: show/hide individual sections before export
- `Download PDF` | `Download JSON` | `Copy Share Link` (read-only URL, valid 90 days)
- Run history sidebar: all past simulations with quick-stats card (date, algorithms, winning SR, dataset)
- `Compare with another run` button: opens diff view between two simulation results

---

## 10. Reporting & Transparency Engine

### 10.1 Report Structure

Every simulation auto-generates a structured report. Reports must be **self-contained** — a reader who was not present must be able to fully understand, reproduce, and validate the results.

| # | Section | Content | Audience |
|---|---|---|---|
| 1 | **Executive Summary** | Best algorithm recommendation, SR uplift, projected GMV impact, plain-language rationale | Business, PM |
| 2 | **Simulation Configuration** | Dataset details, all algorithm hyperparameters, counterfactual mode, random seed | Engineering, Audit |
| 3 | **Dataset Statistics** | Volume by mode/bank/PG, SR distribution, data quality score, outlier analysis | Data Science |
| 4 | **Algorithm Results Summary** | Head-to-head metrics table: SR, regret, exploration ratio, detection latency, significance | All |
| 5 | **Cumulative SR Charts** | One chart per algorithm with CI bands; combined overlay | All |
| 6 | **Regret Analysis** | Cumulative regret over time; regret decomposition | Data Science |
| 7 | **Segment Performance** | SR heatmap per algorithm × segment; best algorithm per segment | Product, DS |
| 8 | **Gateway Analysis** | Per-gateway routing share, detected downtime events, recovery latency | Engineering |
| 9 | **Algorithm Transparency** | Formula, hyperparameter choices with rationale, paper citation | Engineering, Lead |
| 10 | **Statistical Validity** | CIs, p-values, sample size adequacy, test methodology | Data Science, Audit |
| 11 | **Recommendations** | Ranked recommendation, suggested production hyperparameters, phased rollout plan | PM, Lead |
| 12 | **Appendix** | Decision log sample, config JSON, reproduction instructions | Engineering |

### 10.2 Transparency Requirements

| Requirement | Detail |
|---|---|
| **Reproducibility** | Every report includes the exact config JSON to reproduce the simulation bit-for-bit (same seed + config = identical results) |
| **No Black Box** | Every algorithm's internal formula displayed with actual hyperparameter values substituted in — not just the algorithm name |
| **Statistical Honesty** | SR differences without statistical significance flagged with `⚠ Not Statistically Significant` warning |
| **Counterfactual Disclosure** | Report explicitly states which counterfactual mode was used and its known bias direction |
| **Data Quality Score** | Composite 0–100 score assessing completeness, recency, volume adequacy, distribution balance |
| **Assumption Logging** | Any engine assumption (e.g. missing SR estimated from global mean) listed in Appendix |

### 10.3 Statistical Methods

```python
# reporting/stats.py
from scipy import stats
import numpy as np


def compare_success_rates(
    successes_a: int, total_a: int,
    successes_b: int, total_b: int,
    confidence: float = 0.95
) -> dict:
    """
    Two-proportion z-test for comparing algorithm success rates.
    Returns p-value, confidence interval, and significance verdict.
    """
    sr_a = successes_a / total_a
    sr_b = successes_b / total_b
    
    # Pooled proportion under H0: SR_A == SR_B
    p_pool = (successes_a + successes_b) / (total_a + total_b)
    se = np.sqrt(p_pool * (1 - p_pool) * (1/total_a + 1/total_b))
    
    z_stat = (sr_a - sr_b) / se if se > 0 else 0
    p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))
    
    # Confidence interval for (SR_A - SR_B)
    alpha = 1 - confidence
    z_crit = stats.norm.ppf(1 - alpha/2)
    se_diff = np.sqrt((sr_a*(1-sr_a)/total_a) + (sr_b*(1-sr_b)/total_b))
    ci_low = (sr_a - sr_b) - z_crit * se_diff
    ci_high = (sr_a - sr_b) + z_crit * se_diff
    
    return {
        "sr_a": sr_a, "sr_b": sr_b,
        "difference": sr_a - sr_b,
        "z_statistic": z_stat,
        "p_value": p_value,
        "confidence_interval": (ci_low, ci_high),
        "is_significant": p_value < (1 - confidence),
        "interpretation": (
            f"Algorithm A SR ({sr_a:.3%}) is {'significantly' if p_value < 0.05 else 'not significantly'} "
            f"{'higher' if sr_a > sr_b else 'lower'} than Algorithm B ({sr_b:.3%}). "
            f"p={p_value:.4f}, 95% CI: [{ci_low:+.3%}, {ci_high:+.3%}]"
        )
    }
```

### 10.4 GMV Impact Calculator

```
Monthly GMV Saved = SR_uplift × Monthly_Volume × Avg_Transaction_Value

Inputs (configurable):
  - Monthly Transaction Volume: default from dataset extrapolation
  - Average Transaction Value: default from dataset mean
  - Current Baseline SR: auto from Round Robin result
  - Projected SR Uplift: auto from winning algorithm result

Example:
  SR uplift = 1.2%
  Monthly volume = 1,000,000 transactions  
  Avg value = INR 2,500
  → Monthly GMV Saved = 0.012 × 1,000,000 × 2,500 = INR 3 crore/month
  → Annual GMV Saved = INR 36 crore/year
```

---

## 11. Functional Requirements

### FR-1: Data Management

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Accept CSV and Parquet files up to 5GB; Parquet recommended for >50M rows | P0 |
| FR-1.2 | Schema validation on upload with clear per-column error messages | P0 |
| FR-1.3 | Auto-compute dataset stats (date range, PG list, mode distribution, overall SR) after upload | P0 |
| FR-1.4 | Synthetic generator with all 6 built-in scenario templates + custom configuration | P1 |
| FR-1.5 | PII auto-masking: hash `transaction_id` and `merchant_id` before simulation if configured | P0 |
| FR-1.6 | Dataset versioning: assign content hash to each dataset for reproducibility | P1 |

### FR-2: Algorithm Management

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Ship 5 built-in algorithms: SW-UCB, D-UCB, Thompson Sampling, Epsilon-Greedy, Round Robin | P0 |
| FR-2.2 | Any class extending `BaseAlgorithm` registered via `plugins.yaml` runs without engine code changes | P0 |
| FR-2.3 | Hyperparameter forms auto-generated from `get_hyperparameter_schema()` | P1 |
| FR-2.4 | Up to 10 algorithm instances (including duplicates with different hyperparameters) per run | P1 |
| FR-2.5 | Algorithm state fully isolated between instances — no shared mutable state permitted | P0 |
| FR-2.6 | Algorithm exceptions caught, logged, simulation continues with remaining algorithms | P1 |

### FR-3: Simulation Engine

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Transactions replayed in strict chronological order; no temporal leakage enforced | P0 |
| FR-3.2 | Support all 3 counterfactual modes: Direct Replay, IPS Reweighting, SR Interpolation | P1 |
| FR-3.3 | SR Interpolation warm-up window: configurable (default: first 20% of data) | P1 |
| FR-3.4 | Oracle SR calculated as best-possible SR given ground truth per-context SRs | P0 |
| FR-3.5 | Arm state snapshotted every 1,000 transactions for UI timeline scrubbing | P1 |
| FR-3.6 | Same seed + config + dataset → identical simulation results (deterministic) | P0 |
| FR-3.7 | Algorithms execute in parallel per transaction (multiprocessing or vectorised) | P1 |

### FR-4: UI

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Live dashboard streams metric updates every 500 transactions via WebSocket | P1 |
| FR-4.2 | All charts interactive: zoom, pan, hover tooltips with exact values | P1 |
| FR-4.3 | Segment filter changes apply without re-running simulation | P1 |
| FR-4.4 | Decision timeline: searchable, sortable, paginated log of all routing decisions | P2 |
| FR-4.5 | Arm state scrubber: view arm state at any simulation timestep | P2 |
| FR-4.6 | Mobile-responsive layout for report viewing (full editing requires desktop) | P2 |

### FR-5: Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | PDF report auto-generated on simulation completion | P0 |
| FR-5.2 | JSON export of all metrics, config, and sampled decision logs | P1 |
| FR-5.3 | Report contains all 12 sections including full transparency disclosures | P0 |
| FR-5.4 | Two-proportion z-test with p-value and 95% CI for every SR comparison | P0 |
| FR-5.5 | Share link: read-only URL valid 90 days | P2 |
| FR-5.6 | Comparison report: diff view between two simulation runs | P2 |

---

## 12. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| **Performance** | 10M transaction simulation with 5 algorithms | < 2 minutes on 8-core server, 16GB RAM |
| **Performance** | UI initial results view load | < 3 seconds |
| **Performance** | Live dashboard update latency (data → screen) | < 500ms |
| **Scalability** | Concurrent simulation runs | Up to 5 parallel runs per deployment |
| **Reliability** | Simulation state checkpointed; resume after process crash | No data loss on crash |
| **Security** | Uploaded data encrypted at rest | AES-256 |
| **Security** | No transaction data egress from deployment environment | Air-gapped data mode supported |
| **Accuracy** | SR metrics match manual calculation on reference dataset | < 0.001% error |
| **Usability** | Non-technical PM runs first simulation unaided | < 10 minutes onboarding |
| **Extensibility** | New algorithm plugin deployed | < 2 hours engineering time |
| **Observability** | All simulation runs logged with full audit trail | Retained 12 months |
| **Portability** | Deployable on Docker (local), Kubernetes (cloud), standalone Python | All three modes supported |

---

## 13. Tech Stack Recommendation

| Layer | Technology | Rationale |
|---|---|---|
| **Simulation Engine** | Python 3.11+ | NumPy/Pandas vectorisation; rich ML ecosystem for algorithm plugins |
| **Parallelism** | `multiprocessing` + Ray (optional) | Ray validated by Dream11 at 10K+ TPS; `multiprocessing` for simpler deployments |
| **Data Layer** | DuckDB + Parquet | In-process SQL on Parquet; handles 500M rows without a separate DB server |
| **Results Store** | SQLite (local) / PostgreSQL (cloud) | Lightweight for single-user; swap to Postgres for team deployments |
| **API Layer** | FastAPI + WebSocket | Async Python; native WebSocket for live dashboard streaming |
| **Frontend** | React 18 + TypeScript | Component ecosystem; strong type safety |
| **Charts** | Recharts + D3.js | Recharts for standard charts; D3 for custom arm state timeline |
| **PDF Reports** | WeasyPrint or Puppeteer | HTML → PDF with full CSS support; charts rendered as SVG |
| **Containerisation** | Docker + Docker Compose | One-command local deployment; Kubernetes Helm chart for cloud |
| **Testing** | pytest + Hypothesis | Property-based testing for algorithm correctness; snapshot tests for UI |

### 13.1 Project Structure

```
pg-routing-simulator/
├── algorithms/
│   ├── base.py                 # BaseAlgorithm interface (do not modify)
│   ├── sw_ucb.py               # Sliding Window UCB
│   ├── d_ucb.py                # Discounted UCB
│   ├── thompson.py             # Thompson Sampling
│   ├── epsilon_greedy.py       # Epsilon-Greedy
│   └── round_robin.py          # Round Robin baseline
├── engine/
│   ├── simulation.py           # Core simulation loop
│   ├── evaluator.py            # Metrics accumulation
│   ├── counterfactual.py       # Counterfactual estimation modes
│   ├── oracle.py               # Oracle SR for regret calculation
│   └── plugin_loader.py        # Dynamic algorithm class loader
├── data/
│   ├── ingestor.py             # CSV/Parquet upload + validation
│   ├── models.py               # Transaction, DatasetStats, etc.
│   ├── synthetic.py            # Synthetic data generator
│   └── scenarios/              # 6 built-in scenario configs (YAML)
├── api/
│   ├── main.py                 # FastAPI app + WebSocket endpoint
│   ├── routes/
│   │   ├── experiments.py      # POST /experiments, GET /experiments/:id
│   │   ├── datasets.py         # POST /datasets/upload
│   │   ├── results.py          # GET /results/:run_id
│   │   └── reports.py          # GET /reports/:run_id/pdf, /json
│   └── schemas.py              # Pydantic request/response models
├── reporting/
│   ├── report_generator.py     # Orchestrates report sections
│   ├── stats.py                # Statistical significance testing
│   ├── gmv_calculator.py       # GMV impact projections
│   └── templates/              # HTML/CSS templates for PDF rendering
├── frontend/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── ExperimentSetup/
│   │   │   ├── LiveDashboard/
│   │   │   ├── ResultsExplorer/
│   │   │   ├── TransparencyPanel/
│   │   │   └── ReportCenter/
│   │   ├── components/         # Shared UI components
│   │   ├── hooks/              # useSimulation, useWebSocket, etc.
│   │   └── api/                # API client layer
│   └── package.json
├── tests/
│   ├── algorithms/             # Correctness tests for each algorithm
│   ├── engine/                 # Simulation loop integration tests
│   ├── data/                   # Ingestor + schema validation tests
│   └── reporting/              # Report generation tests
├── plugins.yaml                # Algorithm plugin registry
├── docker-compose.yml
└── README.md
```

---

## 14. Milestones & Delivery Plan

**Team:** 1 Backend Engineer, 1 Frontend Engineer, 1 Data Scientist, 0.5 PM  
**Total Duration:** 18 weeks

| Milestone | Deliverables | Duration | Exit Criteria |
|---|---|---|---|
| **M1: Foundation** | `BaseAlgorithm` interface, plugin registry, simulation loop (headless), 5 built-in algorithms, pytest suite | 3 weeks | All 5 algorithms correct on reference dataset; new plugin deployed < 2hrs |
| **M2: Data Layer** | CSV/Parquet ingestor, schema validator, synthetic generator with 6 templates, DuckDB results store | 2 weeks | 10M row simulation < 2min; SR Interpolation counterfactual validated |
| **M3: API Layer** | FastAPI endpoints (upload, configure, run, status, results); WebSocket streaming | 2 weeks | Postman collection passes all endpoint tests; streaming latency < 500ms |
| **M4: UI — Setup & Live** | Experiment Setup screen, Live Dashboard, all charts wired to API | 3 weeks | PM persona configures and launches simulation without assistance |
| **M5: UI — Results & Transparency** | Results Explorer, Transparency Panel, decision timeline, arm state scrubber | 3 weeks | Engineer traces any routing decision to exact arm state and score |
| **M6: Reporting Engine** | PDF generator, JSON export, all 12 sections, GMV calculator, statistical significance | 2 weeks | Report fully reproducible from config; p-values validated against scipy |
| **M7: Polish & Hardening** | Error handling, performance tuning, security review, Docker packaging, UAT | 2 weeks | All P0/P1 NFRs pass; 3 internal users complete UAT with no blocking issues |
| **M8: Launch** | Internal release, documentation, algorithm contributor guide, video walkthrough | 1 week | First real-dataset simulation completed and report signed off by stakeholders |

---

## 15. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| **Counterfactual bias**: SR Interpolation produces misleading estimates for algorithms that choose rarely-used gateways | High | High | Default to IPS for production recommendations; flag SR Interpolation results with prominent bias warning in report |
| **Algorithm plugin crash** brings down simulation mid-run | Medium | Medium | Sandbox each algorithm in subprocess; catch all exceptions; save partial results on failure |
| **Performance**: 10M row simulation exceeds 2min on target hardware | Medium | Medium | Vectorised NumPy inner loop; profile before M7; document minimum hardware spec |
| **Hyperparameter overfitting**: engineers tune to test dataset, creating false production confidence | High | Medium | Enforce train/test split; mark hyperparameter-tuned runs as "Exploratory" in report, not "Production Ready" |
| **PM adoption**: UI complexity overwhelms non-technical stakeholders | Medium | Medium | Ship "Simple Mode" showing only: winner card, SR uplift, GMV impact, one-click report download |
| **Data privacy**: historical transaction data uploaded to shared environment | High | Low | Air-gapped Docker mode (data never leaves machine); PII auto-masking on upload |

---

## 16. Acceptance Criteria

### 16.1 Algorithm Correctness
- [ ] SW-UCB (window=200) on reference dataset produces SR within 0.1% of manually computed values
- [ ] D-UCB (discount=0.6) re-routes away from a failing gateway within 150 transactions of outage start
- [ ] Thompson Sampling Beta distribution updates match `scipy.stats.beta` reference implementation
- [ ] Round Robin distributes traffic ±2% evenly across all gateways over 10,000+ transactions
- [ ] A custom algorithm implementing `BaseAlgorithm` registers and runs without any engine code changes

### 16.2 Performance
- [ ] 10M transaction simulation with 5 algorithms completes in < 2 minutes (8 vCPU, 16GB RAM)
- [ ] Live dashboard updates visible within 500ms of engine writing checkpoint
- [ ] PDF report generates in < 30 seconds after simulation completion

### 16.3 UI / UX
- [ ] PM persona (non-technical) completes end-to-end simulation and downloads report in < 15 minutes, first try, unaided
- [ ] Engineer can find and inspect any specific routing decision in the transparency panel within 3 clicks
- [ ] All charts render correctly on Chrome, Firefox, Safari (latest 2 versions each)

### 16.4 Report Quality
- [ ] Two independent engineers reproduce identical simulation results from the config JSON in the report
- [ ] Statistical significance badges match manual two-proportion z-test calculation on same inputs
- [ ] GMV calculator output matches manual formula: `SR_uplift × volume × avg_value`

---

## 17. Appendix: Algorithm Reference

### Algorithm 1: Sliding Window UCB

| Property | Value |
|---|---|
| **Class** | `algorithms.sw_ucb.SlidingWindowUCB` |
| **Research Basis** | Garivier & Moulines (2011) — arXiv:0805.3415 |
| **Best For** | Abrupt gateway outages and sudden SR drops |
| **Hyperparameters** | `window_size` (int, default 200): most recent transactions per gateway to consider |
| **Select Formula** | `score(arm) = SR_window(arm) + √(2·ln(N_total) / n_window(arm))` |
| **Update Rule** | Append reward to arm's deque; oldest entry auto-discarded when window full |
| **Cold-Start** | Arms with zero observations selected first (ensures all gateways tried before exploitation) |
| **Weakness** | Window size must be tuned; too small = noisy; too large = slow adaptation |

### Algorithm 2: Discounted UCB

| Property | Value |
|---|---|
| **Class** | `algorithms.d_ucb.DiscountedUCB` |
| **Research Basis** | Garivier & Moulines (2011) — arXiv:0805.3415 |
| **Best For** | Gradual SR drift over time |
| **Hyperparameters** | `discount` (float 0–1, default 0.6): multiplicative decay applied to past observations each step |
| **Select Formula** | `score(arm) = n_eff_success / n_eff_total + √(2·ln(N_eff_total) / n_eff_total(arm))` |
| **Update Rule** | `n_eff_success *= γ; n_eff_success += reward`; same for `n_eff_total` |
| **Cold-Start** | Arms with `n_eff_total < 1` selected first |
| **Weakness** | Discount factor difficult to tune without domain knowledge of SR change rate |

### Algorithm 3: Thompson Sampling (Bernoulli)

| Property | Value |
|---|---|
| **Class** | `algorithms.thompson.ThompsonSampling` |
| **Research Basis** | Agrawal & Goyal (2012), COLT 2012 — arXiv:1111.1797 |
| **Best For** | Sparse data, delayed feedback, probabilistic routing |
| **Hyperparameters** | `alpha_prior`, `beta_prior` (float, default 1.0): Beta distribution prior parameters |
| **Select Formula** | Sample `θ_i ~ Beta(α_i, β_i)` for each arm; return `argmax θ_i` |
| **Update Rule** | Success: `α_i += 1`; Failure: `β_i += 1` |
| **Cold-Start** | `Beta(1,1) = Uniform[0,1]` ensures uniform exploration initially |
| **Weakness** | Standard TS is stationary; use with sliding window or discounting for non-stationary environments |

### Algorithm 4: Epsilon-Greedy

| Property | Value |
|---|---|
| **Class** | `algorithms.epsilon_greedy.EpsilonGreedy` |
| **Research Basis** | Sutton & Barto, Reinforcement Learning (2018) |
| **Best For** | Simple baseline; easily interpretable exploration behaviour |
| **Hyperparameters** | `epsilon` (float 0–1, default 0.1): exploration probability; `decay_rate` (float, default 0.0): per-step epsilon decay |
| **Select Formula** | With prob `ε`: random arm; else: `argmax empirical_SR(arm)` |
| **Update Rule** | Update global empirical SR per arm; `ε *= (1 - decay_rate)` each step |
| **Cold-Start** | High ε at start; decays toward exploitation if `decay_rate > 0` |
| **Weakness** | Uniform random exploration wastes budget on known bad arms; no theoretical optimality guarantee |

### Algorithm 5: Round Robin (Baseline)

| Property | Value |
|---|---|
| **Class** | `algorithms.round_robin.RoundRobin` |
| **Research Basis** | Deterministic baseline — no research paper |
| **Best For** | Establishing minimum acceptable performance benchmark |
| **Hyperparameters** | None |
| **Select Formula** | `return arms[step_count % len(arms)]` |
| **Update Rule** | None — no state update |
| **Cold-Start** | N/A — cycles uniformly from step 0 |
| **Weakness** | Uses no outcome feedback whatsoever; purely exploratory; never exploits |

---

### Key API Endpoints

```
POST   /api/datasets/upload              Upload CSV or Parquet transaction file
GET    /api/datasets/:id/stats           Get computed dataset statistics
GET    /api/datasets/synthetic/templates List all 6 built-in scenario templates

POST   /api/experiments                  Create and launch simulation run
GET    /api/experiments/:id/status       Poll simulation progress
WS     /api/experiments/:id/stream       WebSocket: live metrics stream

GET    /api/results/:id                  Full simulation results
GET    /api/results/:id/segments         Segment-filtered results (query params)
GET    /api/results/:id/decisions        Paginated decision log
GET    /api/results/:id/arm-state/:t     Arm state snapshot at transaction T

GET    /api/reports/:id/pdf              Download generated PDF report
GET    /api/reports/:id/json             Download results as JSON
POST   /api/reports/:id/share            Generate read-only share link

GET    /api/algorithms                   List all registered algorithms with metadata
GET    /api/algorithms/:id/schema        Get hyperparameter schema for algorithm
```

---

*PG Routing Algorithm Simulator — PRD v1.0 — CONFIDENTIAL*  
*For questions or contributions, see the Algorithm Contributor Guide in `/docs/contributing.md`*

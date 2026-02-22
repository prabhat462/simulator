/**
 * Hybrid Ensemble (SW-UCB + Thompson Sampling + Discounted UCB) — TypeScript port
 * Reference: HYBRID_ALGORITHM.md, Dream11 (240M txns), Razorpay production
 *
 * Combines three non-stationary bandit algorithms:
 * - Sliding Window UCB: Fast reaction to crashes
 * - Thompson Sampling: Bayesian uncertainty
 * - Discounted UCB: Gradual drift tracking
 *
 * Lives in the dynamic sandbox without context segmentation.
 */

import { BaseAlgorithm, SeededRNG } from './base';
import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

interface ArmStateInternal {
    // Layer 2A: Sliding Window UCB
    window: number[]; // outcomes
    windowSize: number;

    // Layer 2B: Thompson Sampling
    alpha: number;
    beta: number;
    tsDecay: number;

    // Layer 2C: Discounted UCB
    discSum: number;
    discCount: number;
    discRound: number;
    discountFactor: number;

    // Layer 0: Circuit Breaker
    cbHistory: number[];
    cbBlockedUntil: number;
}

export class HybridEnsemble implements BaseAlgorithm {
    private arms: string[] = [];
    private armsState: Map<string, ArmStateInternal> = new Map();
    private totalSelections = 0;

    // Hyperparameters
    private windowSize = 200;
    private tsAlphaPrior = 1.0;
    private tsBetaPrior = 1.0;
    private tsDecay = 0.995;
    private discountFactor = 0.70;
    private ucbWeight = 0.60; // within SW component
    private swWeight = 0.70; // SW vs D-UCB
    private cbThreshold = 0.30;
    private cbEvalWindow = 20;
    private cbRecoveryRounds = 200;
    private degradedPenalty = 0.15;

    // Decision tracking
    private lastScores: Record<string, number> = {};
    private lastComponentScores: Record<string, { swUcb: number; tsSample: number; dUcb: number }> = {};
    private lastChosen = '';
    private rng!: SeededRNG;

    initialize(arms: string[], config: Record<string, number>): void {
        this.arms = arms;

        // Layer 2A: Sliding Window UCB
        this.windowSize = config.window_size ?? 200;

        // Layer 2B: Thompson Sampling
        this.tsAlphaPrior = config.ts_alpha_prior ?? 1.0;
        this.tsBetaPrior = config.ts_beta_prior ?? 1.0;
        this.tsDecay = config.ts_decay ?? 0.995;

        // Layer 2C: Discounted UCB
        this.discountFactor = config.discount_factor ?? 0.70;

        // Layer 3: Ensemble
        this.ucbWeight = config.ucb_weight ?? 0.60;
        this.swWeight = config.sw_weight ?? 0.70;

        // Layer 0: Circuit Breaker
        this.cbThreshold = config.cb_threshold ?? 0.30;
        this.cbEvalWindow = config.cb_eval_window ?? 20;
        this.cbRecoveryRounds = config.cb_recovery_rounds ?? 200;
        this.degradedPenalty = config.degraded_penalty ?? 0.15;

        // Initialize arm states
        this.armsState = new Map();
        for (const arm of arms) {
            this.armsState.set(arm, {
                window: [],
                windowSize: this.windowSize,

                alpha: this.tsAlphaPrior,
                beta: this.tsBetaPrior,
                tsDecay: this.tsDecay,

                discSum: 0.0,
                discCount: 0.0,
                discRound: 0,
                discountFactor: this.discountFactor,

                cbHistory: [],
                cbBlockedUntil: 0,
            });
        }

        this.totalSelections = 0;
        this.lastScores = {};
        this.lastComponentScores = {};
        this.lastChosen = '';
        this.rng = new SeededRNG(config.seed ?? 42);
    }

    private checkCircuitBreaker(arm: string): 'CLOSED' | 'HALF_OPEN' | 'OPEN' {
        const state = this.armsState.get(arm)!;
        const currentRound = this.totalSelections;

        // Check if recovery period has elapsed
        if (state.cbBlockedUntil > 0) {
            if (currentRound >= state.cbBlockedUntil) {
                state.cbBlockedUntil = 0;
                state.cbHistory = [];
            } else {
                return 'OPEN';
            }
        }

        // Evaluate recent SR
        if (state.cbHistory.length >= this.cbEvalWindow) {
            const recentSr = state.cbHistory.reduce((s, v) => s + v, 0) / state.cbHistory.length;

            if (recentSr < this.cbThreshold) {
                state.cbBlockedUntil = currentRound + this.cbRecoveryRounds;
                return 'OPEN';
            } else if (recentSr < 0.5) {
                return 'HALF_OPEN';
            }
        }

        return 'CLOSED';
    }

    private computeSwUcbScore(arm: string): number {
        const state = this.armsState.get(arm)!;
        const n = state.window.length;

        if (n === 0) {
            return Infinity;
        }

        const sr = state.window.reduce((s, v) => s + v, 0) / n;
        const bonus = Math.sqrt(2 * Math.log(Math.max(this.totalSelections, 1)) / n);
        return sr + bonus;
    }

    private computeTsSample(arm: string): number {
        const state = this.armsState.get(arm)!;
        return this.rng.betavariate(state.alpha, state.beta);
    }

    private computeDUcbScore(arm: string): number {
        const state = this.armsState.get(arm)!;
        const n = state.discCount;

        if (n < 1.0) {
            return Infinity;
        }

        const sr = state.discSum / n;
        const t = Math.max(state.discRound, 1);
        const bonus = Math.sqrt(2 * Math.log(t) / n);
        return sr + bonus;
    }

    select(_context: TransactionContext): string {
        this.totalSelections++;

        // Layer 0: Filter by Circuit Breaker
        const availableArms: string[] = [];
        const armCbStates: Record<string, string> = {};

        for (const arm of this.arms) {
            const cbState = this.checkCircuitBreaker(arm);
            armCbStates[arm] = cbState;
            if (cbState !== 'OPEN') {
                availableArms.push(arm);
            }
        }

        // Fallback: if all blocked, pick least bad
        if (availableArms.length === 0) {
            this.lastChosen = this.arms[0];
            this.lastScores = Object.fromEntries(this.arms.map(a => [a, 0]));
            return this.lastChosen;
        }

        // Layer 2 & 3: Compute ensemble scores
        const finalScores: Record<string, number> = {};

        for (const arm of availableArms) {
            // Layer 2A: SW-UCB
            const swUcbScore = this.computeSwUcbScore(arm);

            // Layer 2B: Thompson Sampling
            const tsSample = this.computeTsSample(arm);

            // Layer 2C: D-UCB
            const dUcbScore = this.computeDUcbScore(arm);

            // Layer 3: Ensemble combination
            let swComponent: number;
            if (swUcbScore === Infinity) {
                swComponent = Infinity;
            } else {
                swComponent = this.ucbWeight * swUcbScore + (1 - this.ucbWeight) * tsSample;
            }

            let finalScore: number;
            if (swComponent === Infinity || dUcbScore === Infinity) {
                finalScore = Infinity;
            } else {
                finalScore = this.swWeight * swComponent + (1 - this.swWeight) * dUcbScore;
            }

            // Apply circuit breaker penalty
            if (armCbStates[arm] === 'HALF_OPEN') {
                finalScore -= this.degradedPenalty;
            }

            finalScores[arm] = finalScore;

            // Store component scores for explanation
            this.lastComponentScores[arm] = {
                swUcb: swUcbScore === Infinity ? 999 : swUcbScore,
                tsSample,
                dUcb: dUcbScore === Infinity ? 999 : dUcbScore,
            };
        }

        // Select arm with highest score
        this.lastScores = finalScores;
        this.lastChosen = Object.entries(finalScores).reduce((best, [arm, score]) =>
            score > best[1] ? [arm, score] : best,
            ['', -Infinity]
        )[0] as string;

        return this.lastChosen;
    }

    update(arm: string, reward: number, _context: TransactionContext): void {
        const state = this.armsState.get(arm)!;

        // Layer 2A: Update sliding window
        state.window.push(reward);
        if (state.window.length > state.windowSize) {
            state.window.shift();
        }

        // Layer 2B: Update Thompson Sampling with time decay
        if (reward === 1) {
            state.alpha += 1.0;
        } else {
            state.beta += 1.0;
        }
        // Apply exponential decay
        const decayFactor = state.tsDecay;
        state.alpha = 1.0 + (state.alpha - 1.0) * decayFactor;
        state.beta = 1.0 + (state.beta - 1.0) * decayFactor;

        // Layer 2C: Update Discounted UCB
        // First decay all arms
        for (const s of this.armsState.values()) {
            s.discSum *= state.discountFactor;
            s.discCount *= state.discountFactor;
        }
        // Then add new observation
        state.discSum += reward;
        state.discCount += 1.0;
        state.discRound += 1;

        // Layer 0: Update circuit breaker
        state.cbHistory.push(reward);
        if (state.cbHistory.length > this.cbEvalWindow) {
            state.cbHistory.shift();
        }
    }

    getState(): Record<string, ArmState> {
        const state: Record<string, ArmState> = {};

        for (const arm of this.arms) {
            const armState = this.armsState.get(arm)!;

            // SW-UCB
            const windowSr =
                armState.window.length > 0
                    ? armState.window.reduce((s, v) => s + v, 0) / armState.window.length
                    : null;

            // Thompson
            const a = armState.alpha;
            const b = armState.beta;
            const tsMean = a + b > 0 ? a / (a + b) : null;

            // D-UCB
            const discSr = armState.discCount > 0 ? armState.discSum / armState.discCount : null;

            // Circuit breaker
            const cbRecentSr =
                armState.cbHistory.length > 0
                    ? armState.cbHistory.reduce((s, v) => s + v, 0) / armState.cbHistory.length
                    : null;

            state[arm] = {
                estimatedSR: windowSr ?? tsMean ?? discSr,
                selectionScore: this.lastScores[arm] ?? null,

                // Extended state for transparency
                totalSelections: armState.window.length,
                windowCapacity: armState.windowSize,
                tsAlpha: Math.round(a * 100) / 100,
                tsBeta: Math.round(b * 100) / 100,
                tsPostMean: tsMean ? Math.round(tsMean * 10000) / 10000 : null,
                discSum: Math.round(armState.discSum * 100) / 100,
                discCount: Math.round(armState.discCount * 100) / 100,
                discSr: discSr ? Math.round(discSr * 10000) / 10000 : null,
                cbRecentSr: cbRecentSr,
                cbState: this.checkCircuitBreaker(arm),
            };
        }

        return state;
    }

    explainLastDecision(): string {
        if (!this.lastChosen) return 'No decision made yet.';

        const score = this.lastScores[this.lastChosen] ?? 0;
        const comps = this.lastComponentScores[this.lastChosen];
        const cbState = this.checkCircuitBreaker(this.lastChosen);

        if (!comps) return `Chose '${this.lastChosen}' with score=${score.toFixed(4)}`;

        return (
            `Chose '${this.lastChosen}' with final_score=${score.toFixed(4)} ` +
            `(SW-UCB=${comps.swUcb.toFixed(4)}, TS=${comps.tsSample.toFixed(4)}, ` +
            `D-UCB=${comps.dUcb.toFixed(4)}, CB=${cbState})`
        );
    }

    getHyperparameterSchema(): HyperparameterSchema {
        return {
            // Layer 2A
            window_size: {
                type: 'integer',
                default: 200,
                min: 10,
                max: 10000,
                description: 'Sliding window size. Lower = faster, noisier. Higher = smoother.',
            },
            // Layer 2B
            ts_alpha_prior: {
                type: 'number',
                default: 1.0,
                min: 0.01,
                max: 100.0,
                description: 'Beta distribution prior alpha.',
            },
            ts_beta_prior: {
                type: 'number',
                default: 1.0,
                min: 0.01,
                max: 100.0,
                description: 'Beta distribution prior beta.',
            },
            ts_decay: {
                type: 'number',
                default: 0.995,
                min: 0.99,
                max: 0.999,
                description: 'Exponential decay rate for Thompson Sampling.',
            },
            // Layer 2C
            discount_factor: {
                type: 'number',
                default: 0.70,
                min: 0.01,
                max: 1.0,
                description: 'Discount factor for D-UCB. Lower = forgets faster.',
            },
            // Layer 3
            ucb_weight: {
                type: 'number',
                default: 0.60,
                min: 0.0,
                max: 1.0,
                description: 'Weight of UCB within SW component (0=pure TS, 1=pure UCB).',
            },
            sw_weight: {
                type: 'number',
                default: 0.70,
                min: 0.0,
                max: 1.0,
                description: 'Weight of SW component vs D-UCB (0=pure D-UCB, 1=pure SW).',
            },
            // Layer 0
            cb_threshold: {
                type: 'number',
                default: 0.30,
                min: 0.1,
                max: 0.7,
                description: 'Circuit breaker opens below this SR.',
            },
            cb_eval_window: {
                type: 'integer',
                default: 20,
                min: 5,
                max: 100,
                description: 'Transactions to evaluate for circuit breaker.',
            },
            cb_recovery_rounds: {
                type: 'integer',
                default: 200,
                min: 10,
                max: 2000,
                description: 'Transactions before circuit breaker auto-recovers.',
            },
            degraded_penalty: {
                type: 'number',
                default: 0.15,
                min: 0.0,
                max: 1.0,
                description: 'Score penalty for half-open circuit state.',
            },
        };
    }

    metadata(): AlgorithmMetadata {
        return {
            name: 'Hybrid Ensemble (SW-UCB + TS + D-UCB)',
            shortName: 'Hybrid',
            description:
                'Production hybrid algorithm combining Sliding Window UCB, Thompson Sampling, and Discounted UCB ' +
                'with circuit breaker protection. Proven 0.92–6% SR uplift on 240M+ real transactions.',
            paper: 'Garivier & Moulines (2011), Agrawal & Goyal (2012), Bygari et al. (2021)',
            paperUrl: 'https://arxiv.org/abs/0805.3415',
            category: 'bandit',
        };
    }
}

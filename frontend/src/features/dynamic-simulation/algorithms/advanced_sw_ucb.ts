/**
 * Advanced Sliding Window UCB (Adv. SW-UCB) — TypeScript port
 * Reference: Garivier & Moulines (2011), with recovery detection modifications
 *
 * Enhanced SW-UCB with configurable exploration budget to detect when
 * previously failed gateways recover. Balances exploitation with proactive recovery detection.
 */

import { BaseAlgorithm, SeededRNG } from './base';
import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

export class AdvancedSlidingWindowUCB implements BaseAlgorithm {
    private arms: string[] = [];
    private windowSize = 200;
    private explorationRate = 0.05; // 5% default
    private history: Map<string, number[]> = new Map();
    private totalSelections = 0;
    private lastScores: Record<string, number> = {};
    private lastChosen = '';
    private lastWasExploration = false;
    private rng!: SeededRNG;

    initialize(arms: string[], config: Record<string, number>): void {
        this.arms = arms;
        this.windowSize = config.window_size ?? 200;
        this.explorationRate = config.exploration_rate ?? 0.05;
        this.history = new Map();
        for (const arm of arms) {
            this.history.set(arm, []);
        }
        this.totalSelections = 0;
        this.lastScores = {};
        this.lastChosen = '';
        this.lastWasExploration = false;
        this.rng = new SeededRNG(config.seed ?? 42);
    }

    select(_context: TransactionContext): string {
        this.totalSelections++;

        // Decide: explore or exploit?
        const useExploration = this.rng.random() < this.explorationRate && this.arms.length > 1;

        if (useExploration) {
            // Exploration: randomly select an arm
            this.lastWasExploration = true;
            const randomIndex = Math.floor(this.rng.random() * this.arms.length);
            this.lastChosen = this.arms[randomIndex];
            // Still compute scores for state tracking
            this.computeScores();
            return this.lastChosen;
        }

        // Exploitation: use UCB-based selection
        this.lastWasExploration = false;
        const scores: Record<string, number> = {};

        for (const arm of this.arms) {
            const hist = this.history.get(arm)!;
            const n = hist.length;
            if (n === 0) {
                this.lastChosen = arm;
                this.lastScores = Object.fromEntries(
                    this.arms.map(a => [a, a === arm ? Infinity : 0])
                );
                return arm;
            }
            const sr = hist.reduce((s, v) => s + v, 0) / n;
            const bonus = Math.sqrt(2 * Math.log(this.totalSelections) / n);
            scores[arm] = sr + bonus;
        }

        this.lastScores = scores;
        this.lastChosen = Object.entries(scores).reduce((best, [arm, score]) =>
            score > best[1] ? [arm, score] : best,
            ['', -Infinity]
        )[0] as string;
        return this.lastChosen;
    }

    private computeScores(): void {
        const scores: Record<string, number> = {};
        for (const arm of this.arms) {
            const hist = this.history.get(arm)!;
            const n = hist.length;
            if (n === 0) {
                scores[arm] = Infinity;
            } else {
                const sr = hist.reduce((s, v) => s + v, 0) / n;
                const bonus = Math.sqrt(2 * Math.log(this.totalSelections) / n);
                scores[arm] = sr + bonus;
            }
        }
        this.lastScores = scores;
    }

    update(arm: string, reward: number, _context: TransactionContext): void {
        const hist = this.history.get(arm)!;
        hist.push(reward);
        if (hist.length > this.windowSize) {
            hist.shift();
        }
    }

    getState(): Record<string, ArmState> {
        const state: Record<string, ArmState> = {};
        for (const arm of this.arms) {
            const hist = this.history.get(arm)!;
            const n = hist.length;
            const sum = hist.reduce((s, v) => s + v, 0);
            state[arm] = {
                estimatedSR: n > 0 ? sum / n : null,
                selectionScore: this.lastScores[arm] ?? null,
                totalSelections: n,
                windowCapacity: this.windowSize,
            };
        }
        return state;
    }

    explainLastDecision(): string {
        if (!this.lastChosen) return 'No decision made yet.';

        const hist = this.history.get(this.lastChosen)!;
        const n = hist.length;
        const sr = n > 0 ? hist.reduce((s, v) => s + v, 0) / n : 0;

        if (this.lastWasExploration) {
            return (
                `[EXPLORATION] Randomly chose '${this.lastChosen}' ` +
                `(SR=${sr.toFixed(3)}, window_n=${n}) to detect potential recovery.`
            );
        }

        const score = this.lastScores[this.lastChosen] ?? 0;
        return (
            `[EXPLOITATION] Chose '${this.lastChosen}' with UCB=${score.toFixed(4)} ` +
            `(SR=${sr.toFixed(3)}, window_n=${n})`
        );
    }

    getHyperparameterSchema(): HyperparameterSchema {
        return {
            window_size: {
                type: 'integer',
                default: 200,
                min: 10,
                max: 10000,
                description: 'Number of most recent transactions per gateway. Smaller = faster adaptation but noisier.',
            },
            exploration_rate: {
                type: 'number',
                default: 0.05,
                min: 0.0,
                max: 0.50,
                step: 0.01,
                description: 'Fraction of traffic for random exploration (0-50%). Higher = more probing for recovery.',
            },
        };
    }

    metadata(): AlgorithmMetadata {
        return {
            name: 'Advanced Sliding Window UCB',
            shortName: 'Adv. SW-UCB',
            description:
                'Enhanced SW-UCB with configurable exploration budget to detect when previously failed gateways recover. ' +
                'Balances exploitation with proactive recovery detection.',
            paper: 'Garivier & Moulines (2011), with recovery detection modifications',
            paperUrl: 'https://arxiv.org/abs/0805.3415',
            category: 'bandit',
        };
    }
}

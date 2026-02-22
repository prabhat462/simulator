/**
 * Sliding Window UCB (SW-UCB) — TypeScript port
 * Reference: Garivier & Moulines (2011), arXiv:0805.3415
 */

import { BaseAlgorithm, SeededRNG } from './base';
import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

export class SlidingWindowUCB implements BaseAlgorithm {
    private arms: string[] = [];
    private windowSize = 200;
    private history: Map<string, number[]> = new Map();
    private totalSelections = 0;
    private lastScores: Record<string, number> = {};
    private lastChosen = '';

    initialize(arms: string[], config: Record<string, number>): void {
        this.arms = arms;
        this.windowSize = config.window_size ?? 200;
        this.history = new Map();
        for (const arm of arms) {
            this.history.set(arm, []);
        }
        this.totalSelections = 0;
        this.lastScores = {};
        this.lastChosen = '';
    }

    select(_context: TransactionContext): string {
        this.totalSelections++;
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
            score > best[1] ? [arm, score] : best, ['', -Infinity]
        )[0] as string;
        return this.lastChosen;
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
        const score = this.lastScores[this.lastChosen] ?? 0;
        const hist = this.history.get(this.lastChosen)!;
        const n = hist.length;
        const sr = n > 0 ? hist.reduce((s, v) => s + v, 0) / n : 0;
        return `Chose '${this.lastChosen}' with UCB=${score.toFixed(4)} (SR=${sr.toFixed(3)}, window_n=${n})`;
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
        };
    }

    metadata(): AlgorithmMetadata {
        return {
            name: 'Sliding Window UCB',
            shortName: 'SW-UCB',
            description: 'Non-stationary UCB using a sliding window. Forgets old observations for fast adaptation.',
            paper: 'Garivier & Moulines (2011)',
            paperUrl: 'https://arxiv.org/abs/0805.3415',
            category: 'bandit',
        };
    }
}

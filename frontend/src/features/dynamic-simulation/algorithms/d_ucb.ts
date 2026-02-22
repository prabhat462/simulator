/**
 * Discounted UCB (D-UCB) — TypeScript port
 * Reference: Garivier & Moulines (2011), arXiv:0805.3415
 */

import { BaseAlgorithm } from './base';
import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

export class DiscountedUCB implements BaseAlgorithm {
    private arms: string[] = [];
    private discount = 0.6;
    private nEff: Record<string, number> = {};
    private sEff: Record<string, number> = {};
    private totalNEff = 0;
    private totalSelections = 0;
    private lastScores: Record<string, number> = {};
    private lastChosen = '';

    initialize(arms: string[], config: Record<string, number>): void {
        this.arms = arms;
        this.discount = config.discount ?? 0.6;
        this.nEff = {};
        this.sEff = {};
        for (const arm of arms) {
            this.nEff[arm] = 0;
            this.sEff[arm] = 0;
        }
        this.totalNEff = 0;
        this.totalSelections = 0;
        this.lastScores = {};
        this.lastChosen = '';
    }

    select(_context: TransactionContext): string {
        this.totalSelections++;
        const scores: Record<string, number> = {};

        for (const arm of this.arms) {
            const n = this.nEff[arm];
            if (n < 1.0) {
                this.lastChosen = arm;
                this.lastScores = Object.fromEntries(
                    this.arms.map(a => [a, a === arm ? Infinity : 0])
                );
                return arm;
            }
            const sr = this.sEff[arm] / n;
            const bonus = Math.sqrt(2 * Math.log(this.totalNEff) / n);
            scores[arm] = sr + bonus;
        }

        this.lastScores = scores;
        this.lastChosen = Object.entries(scores).reduce((best, [arm, score]) =>
            score > best[1] ? [arm, score] : best, ['', -Infinity]
        )[0] as string;
        return this.lastChosen;
    }

    update(arm: string, reward: number, _context: TransactionContext): void {
        const gamma = this.discount;
        for (const a of this.arms) {
            this.nEff[a] *= gamma;
            this.sEff[a] *= gamma;
        }
        this.nEff[arm] += 1.0;
        this.sEff[arm] += reward;
        this.totalNEff = Object.values(this.nEff).reduce((s, v) => s + v, 0);
    }

    getState(): Record<string, ArmState> {
        const state: Record<string, ArmState> = {};
        for (const arm of this.arms) {
            const n = this.nEff[arm];
            state[arm] = {
                estimatedSR: n > 0 ? this.sEff[arm] / n : null,
                selectionScore: this.lastScores[arm] ?? null,
                totalSelections: Math.round(n),
                nEffective: Math.round(n * 100) / 100,
            };
        }
        return state;
    }

    explainLastDecision(): string {
        if (!this.lastChosen) return 'No decision made yet.';
        const score = this.lastScores[this.lastChosen] ?? 0;
        const n = this.nEff[this.lastChosen];
        const sr = n > 0 ? this.sEff[this.lastChosen] / n : 0;
        return `Chose '${this.lastChosen}' with D-UCB=${score.toFixed(4)} (SR=${sr.toFixed(3)}, n_eff=${n.toFixed(1)})`;
    }

    getHyperparameterSchema(): HyperparameterSchema {
        return {
            discount: {
                type: 'number',
                default: 0.6,
                min: 0.01,
                max: 1.0,
                step: 0.05,
                description: 'Discount factor (γ). Lower = forgets faster.',
            },
        };
    }

    metadata(): AlgorithmMetadata {
        return {
            name: 'Discounted UCB',
            shortName: 'D-UCB',
            description: 'Non-stationary UCB using discounted counters for gradual adaptation.',
            paper: 'Garivier & Moulines (2011)',
            paperUrl: 'https://arxiv.org/abs/0805.3415',
            category: 'bandit',
        };
    }
}

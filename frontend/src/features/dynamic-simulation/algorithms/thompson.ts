/**
 * Thompson Sampling (Bernoulli) — TypeScript port
 * Reference: Agrawal & Goyal (2012), COLT 2012
 */

import { BaseAlgorithm, SeededRNG } from './base';
import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

export class ThompsonSampling implements BaseAlgorithm {
    private arms: string[] = [];
    private alphaPrior = 1.0;
    private betaPrior = 1.0;
    private alpha: Record<string, number> = {};
    private beta: Record<string, number> = {};
    private lastSamples: Record<string, number> = {};
    private lastChosen = '';
    private rng!: SeededRNG;

    initialize(arms: string[], config: Record<string, number>): void {
        this.arms = arms;
        this.alphaPrior = config.alpha_prior ?? 1.0;
        this.betaPrior = config.beta_prior ?? 1.0;
        this.alpha = {};
        this.beta = {};
        for (const arm of arms) {
            this.alpha[arm] = this.alphaPrior;
            this.beta[arm] = this.betaPrior;
        }
        this.lastSamples = {};
        this.lastChosen = '';
        this.rng = new SeededRNG(config.seed ?? 42);
    }

    select(_context: TransactionContext): string {
        const samples: Record<string, number> = {};
        for (const arm of this.arms) {
            samples[arm] = this.rng.betavariate(this.alpha[arm], this.beta[arm]);
        }
        this.lastSamples = samples;
        this.lastChosen = Object.entries(samples).reduce((best, [arm, sample]) =>
            sample > best[1] ? [arm, sample] : best, ['', -Infinity]
        )[0] as string;
        return this.lastChosen;
    }

    update(arm: string, reward: number, _context: TransactionContext): void {
        if (reward === 1) {
            this.alpha[arm] += 1.0;
        } else {
            this.beta[arm] += 1.0;
        }
    }

    getState(): Record<string, ArmState> {
        const state: Record<string, ArmState> = {};
        for (const arm of this.arms) {
            const a = this.alpha[arm];
            const b = this.beta[arm];
            state[arm] = {
                estimatedSR: (a + b) > 0 ? a / (a + b) : null,
                selectionScore: this.lastSamples[arm] ?? null,
                totalSelections: Math.round(a + b - this.alphaPrior - this.betaPrior),
                alpha: Math.round(a * 100) / 100,
                beta: Math.round(b * 100) / 100,
            };
        }
        return state;
    }

    explainLastDecision(): string {
        if (!this.lastChosen) return 'No decision made yet.';
        const sample = this.lastSamples[this.lastChosen] ?? 0;
        const a = this.alpha[this.lastChosen];
        const b = this.beta[this.lastChosen];
        const mean = a / (a + b);
        return `Chose '${this.lastChosen}' with θ=${sample.toFixed(4)} (Beta(α=${a.toFixed(1)}, β=${b.toFixed(1)}), mean=${mean.toFixed(3)})`;
    }

    getHyperparameterSchema(): HyperparameterSchema {
        return {
            alpha_prior: {
                type: 'number',
                default: 1.0,
                min: 0.01,
                max: 100.0,
                description: 'Prior alpha for Beta distribution. 1.0 = uniform prior.',
            },
            beta_prior: {
                type: 'number',
                default: 1.0,
                min: 0.01,
                max: 100.0,
                description: 'Prior beta for Beta distribution. 1.0 = uniform prior.',
            },
        };
    }

    metadata(): AlgorithmMetadata {
        return {
            name: 'Thompson Sampling',
            shortName: 'TS',
            description: 'Bayesian approach sampling from posterior Beta distributions.',
            paper: 'Agrawal & Goyal (2012)',
            paperUrl: 'https://arxiv.org/abs/1111.1797',
            category: 'bandit',
        };
    }
}

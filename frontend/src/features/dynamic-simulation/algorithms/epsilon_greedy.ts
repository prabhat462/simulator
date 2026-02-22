/**
 * Epsilon-Greedy — TypeScript port
 * Reference: Sutton & Barto, Reinforcement Learning (2018)
 */

import { BaseAlgorithm, SeededRNG } from './base';
import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

export class EpsilonGreedy implements BaseAlgorithm {
    private arms: string[] = [];
    private epsilon = 0.1;
    private decayRate = 0.0;
    private successes: Record<string, number> = {};
    private counts: Record<string, number> = {};
    private totalSelections = 0;
    private lastChosen = '';
    private wasExploration = false;
    private rng!: SeededRNG;

    initialize(arms: string[], config: Record<string, number>): void {
        this.arms = arms;
        this.epsilon = config.epsilon ?? 0.1;
        this.decayRate = config.decay_rate ?? 0.0;
        this.successes = {};
        this.counts = {};
        for (const arm of arms) {
            this.successes[arm] = 0;
            this.counts[arm] = 0;
        }
        this.totalSelections = 0;
        this.lastChosen = '';
        this.wasExploration = false;
        this.rng = new SeededRNG(config.seed ?? 42);
    }

    select(_context: TransactionContext): string {
        this.totalSelections++;

        if (this.rng.random() < this.epsilon) {
            // Explore
            this.lastChosen = this.arms[this.rng.randint(this.arms.length)];
            this.wasExploration = true;
        } else {
            // Exploit
            let bestArm = this.arms[0];
            let bestSR = -1;
            for (const arm of this.arms) {
                if (this.counts[arm] === 0) {
                    bestArm = arm;
                    break;
                }
                const sr = this.successes[arm] / this.counts[arm];
                if (sr > bestSR) {
                    bestSR = sr;
                    bestArm = arm;
                }
            }
            this.lastChosen = bestArm;
            this.wasExploration = false;
        }

        if (this.decayRate > 0) {
            this.epsilon *= (1 - this.decayRate);
        }

        return this.lastChosen;
    }

    update(arm: string, reward: number, _context: TransactionContext): void {
        this.counts[arm] += 1;
        this.successes[arm] += reward;
    }

    getState(): Record<string, ArmState> {
        const state: Record<string, ArmState> = {};
        for (const arm of this.arms) {
            const n = this.counts[arm];
            state[arm] = {
                estimatedSR: n > 0 ? this.successes[arm] / n : null,
                selectionScore: n > 0 ? this.successes[arm] / n : null,
                totalSelections: n,
            };
        }
        return state;
    }

    explainLastDecision(): string {
        if (!this.lastChosen) return 'No decision made yet.';
        const mode = this.wasExploration ? 'exploration' : 'exploitation';
        const n = this.counts[this.lastChosen];
        const sr = n > 0 ? this.successes[this.lastChosen] / n : 0;
        return `Chose '${this.lastChosen}' via ${mode} (ε=${this.epsilon.toFixed(4)}, SR=${sr.toFixed(3)}, n=${n})`;
    }

    getHyperparameterSchema(): HyperparameterSchema {
        return {
            epsilon: {
                type: 'number',
                default: 0.1,
                min: 0.0,
                max: 1.0,
                step: 0.01,
                description: 'Exploration probability. 0 = pure exploitation, 1 = pure exploration.',
            },
            decay_rate: {
                type: 'number',
                default: 0.0,
                min: 0.0,
                max: 0.1,
                step: 0.001,
                description: 'Per-step epsilon decay. 0 = no decay.',
            },
        };
    }

    metadata(): AlgorithmMetadata {
        return {
            name: 'Epsilon-Greedy',
            shortName: 'ε-Greedy',
            description: 'Explore with probability ε, exploit with 1-ε. Optional decay.',
            paper: 'Sutton & Barto (2018)',
            paperUrl: 'http://incompleteideas.net/book/the-book.html',
            category: 'bandit',
        };
    }
}

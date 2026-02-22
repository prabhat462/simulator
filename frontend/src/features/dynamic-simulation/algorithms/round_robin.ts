/**
 * Round Robin — TypeScript port
 * Deterministic baseline cycling through all gateways.
 */

import { BaseAlgorithm } from './base';
import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

export class RoundRobin implements BaseAlgorithm {
    private arms: string[] = [];
    private stepCount = 0;
    private successes: Record<string, number> = {};
    private counts: Record<string, number> = {};

    initialize(arms: string[], _config: Record<string, number>): void {
        this.arms = arms;
        this.stepCount = 0;
        this.successes = {};
        this.counts = {};
        for (const arm of arms) {
            this.successes[arm] = 0;
            this.counts[arm] = 0;
        }
    }

    select(_context: TransactionContext): string {
        const chosen = this.arms[this.stepCount % this.arms.length];
        this.stepCount++;
        return chosen;
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
                selectionScore: null,
                totalSelections: n,
            };
        }
        return state;
    }

    explainLastDecision(): string {
        const idx = (this.stepCount - 1) % this.arms.length;
        return `Round Robin: selected '${this.arms[idx]}' at step ${this.stepCount}.`;
    }

    getHyperparameterSchema(): HyperparameterSchema {
        return {};
    }

    metadata(): AlgorithmMetadata {
        return {
            name: 'Round Robin',
            shortName: 'RR',
            description: 'Deterministic baseline cycling through all gateways. No outcome feedback.',
            paper: 'Deterministic baseline',
            paperUrl: '',
            category: 'rule_based',
        };
    }
}

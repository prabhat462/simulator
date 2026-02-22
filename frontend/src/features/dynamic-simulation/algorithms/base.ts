/**
 * BaseAlgorithm — browser-side algorithm interface.
 * All algorithms implement this contract. The simulation worker calls only these methods.
 */

import { TransactionContext, ArmState, AlgorithmMetadata, HyperparameterSchema } from '../types';

export interface BaseAlgorithm {
    initialize(arms: string[], config: Record<string, number>): void;
    select(context: TransactionContext): string;
    update(arm: string, reward: number, context: TransactionContext): void;
    getState(): Record<string, ArmState>;
    explainLastDecision(): string;
    getHyperparameterSchema(): HyperparameterSchema;
    metadata(): AlgorithmMetadata;
}

/**
 * Seeded Pseudo-Random Number Generator (mulberry32)
 * Deterministic given a seed — enables reproducible simulations.
 */
export class SeededRNG {
    private state: number;

    constructor(seed: number) {
        this.state = seed;
    }

    /** Returns a float in [0, 1) */
    random(): number {
        this.state |= 0;
        this.state = (this.state + 0x6D2B79F5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** Beta-variate sampling using Jöhnk's algorithm for small alpha/beta */
    betavariate(alpha: number, beta: number): number {
        const gammaA = this.gammaSample(alpha);
        const gammaB = this.gammaSample(beta);
        return gammaA / (gammaA + gammaB);
    }

    /** Gamma distribution sampling (Marsaglia & Tsang) */
    private gammaSample(shape: number): number {
        if (shape < 1) {
            return this.gammaSample(shape + 1) * Math.pow(this.random(), 1.0 / shape);
        }
        const d = shape - 1.0 / 3.0;
        const c = 1.0 / Math.sqrt(9.0 * d);
        while (true) {
            let x: number;
            let v: number;
            do {
                x = this.normalSample();
                v = 1.0 + c * x;
            } while (v <= 0);
            v = v * v * v;
            const u = this.random();
            if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
    }

    /** Box-Muller transform for normal sampling */
    private normalSample(): number {
        const u1 = this.random();
        const u2 = this.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    /** Returns a random integer in [0, n) */
    randint(n: number): number {
        return Math.floor(this.random() * n);
    }
}

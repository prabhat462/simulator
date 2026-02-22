/**
 * Scenario Loader — pre-built scenarios for the Dynamic SR Simulation Sandbox.
 */

import { Scenario, PG_COLOURS } from '../types';

export const SCENARIOS: Scenario[] = [
    {
        scenarioId: 'sudden_death',
        name: '☠️ Sudden Death',
        description: 'Best gateway crashes instantly from 95% to 10%. Tests rapid detection.',
        difficulty: 'beginner',
        estimatedDurationTicks: 500,
        pgs: [
            { pgId: 'pg_a', name: 'Razor', initialSR: 0.95, colour: PG_COLOURS[0], noiseStd: 0.02 },
            { pgId: 'pg_b', name: 'Stripe', initialSR: 0.80, colour: PG_COLOURS[1], noiseStd: 0.02 },
            { pgId: 'pg_c', name: 'Adyen', initialSR: 0.75, colour: PG_COLOURS[2], noiseStd: 0.02 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'thompson', 'epsilon_greedy'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [
            { triggerTick: 200, type: 'sr_change', changes: { pg_a: 0.10 }, description: '☠️ Razor crashes to 10%' },
        ],
        learningObjectives: [
            'Observe how fast each algorithm stops routing to a dead gateway',
            'Compare convergence latency across algorithms',
            'Understand the "damage" caused during blindness phase',
        ],
    },
    {
        scenarioId: 'slow_poison',
        name: '🐌 Slow Poison',
        description: 'Top gateway degrades gradually over 200 ticks. Tests drift sensitivity.',
        difficulty: 'intermediate',
        estimatedDurationTicks: 800,
        pgs: [
            { pgId: 'pg_a', name: 'PayU', initialSR: 0.92, colour: PG_COLOURS[0], noiseStd: 0.02 },
            { pgId: 'pg_b', name: 'CC Ave', initialSR: 0.82, colour: PG_COLOURS[1], noiseStd: 0.02 },
            { pgId: 'pg_c', name: 'PayTM', initialSR: 0.78, colour: PG_COLOURS[2], noiseStd: 0.02 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'd_ucb', 'thompson'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [
            { triggerTick: 200, type: 'sr_change', changes: { pg_a: 0.85 }, description: 'PayU dips to 85%' },
            { triggerTick: 300, type: 'sr_change', changes: { pg_a: 0.75 }, description: 'PayU drops to 75%' },
            { triggerTick: 400, type: 'sr_change', changes: { pg_a: 0.60 }, description: 'PayU falls to 60%' },
            { triggerTick: 500, type: 'sr_change', changes: { pg_a: 0.45 }, description: 'PayU collapses to 45%' },
        ],
        learningObjectives: [
            'See which algorithms detect gradual degradation early',
            'Compare SW-UCB (window-based) vs D-UCB (discount-based) on drift',
        ],
    },
    {
        scenarioId: 'dead_cat_bounce',
        name: '🐱 Dead Cat Bounce',
        description: 'Gateway crashes, partially recovers, then crashes again.',
        difficulty: 'advanced',
        estimatedDurationTicks: 1000,
        pgs: [
            { pgId: 'pg_a', name: 'Alpha', initialSR: 0.90, colour: PG_COLOURS[0], noiseStd: 0.02 },
            { pgId: 'pg_b', name: 'Beta', initialSR: 0.70, colour: PG_COLOURS[1], noiseStd: 0.02 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'thompson', 'epsilon_greedy'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [
            { triggerTick: 200, type: 'sr_change', changes: { pg_a: 0.20 }, description: 'Alpha crashes to 20%' },
            { triggerTick: 400, type: 'sr_change', changes: { pg_a: 0.85 }, description: 'Alpha partially recovers to 85%' },
            { triggerTick: 600, type: 'sr_change', changes: { pg_a: 0.15 }, description: 'Alpha crashes again to 15%' },
        ],
        learningObjectives: [
            'Test if algorithms fall for the false recovery',
            'Observe double-convergence: how fast do they readapt after second crash',
        ],
    },
    {
        scenarioId: 'musical_chairs',
        name: '🎵 Musical Chairs',
        description: 'The best gateway keeps changing every 150 ticks.',
        difficulty: 'intermediate',
        estimatedDurationTicks: 900,
        pgs: [
            { pgId: 'pg_a', name: 'Gateway-1', initialSR: 0.90, colour: PG_COLOURS[0], noiseStd: 0.02 },
            { pgId: 'pg_b', name: 'Gateway-2', initialSR: 0.70, colour: PG_COLOURS[1], noiseStd: 0.02 },
            { pgId: 'pg_c', name: 'Gateway-3', initialSR: 0.50, colour: PG_COLOURS[2], noiseStd: 0.02 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'thompson', 'round_robin'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [
            { triggerTick: 250, type: 'sr_change', changes: { pg_a: 0.50, pg_b: 0.90 }, description: 'Gateway-2 takes the lead' },
            { triggerTick: 450, type: 'sr_change', changes: { pg_b: 0.50, pg_c: 0.90 }, description: 'Gateway-3 takes the lead' },
            { triggerTick: 650, type: 'sr_change', changes: { pg_c: 0.50, pg_a: 0.90 }, description: 'Gateway-1 returns to lead' },
        ],
        learningObjectives: [
            'See how frequently-changing winners affect algorithm performance',
            'Compare Round Robin (ignores SR) vs adaptive algorithms in volatile environments',
        ],
    },
    {
        scenarioId: 'the_comeback',
        name: '🏆 The Comeback',
        description: 'Worst gateway improves to become the best. Tests positive adaptation.',
        difficulty: 'beginner',
        estimatedDurationTicks: 600,
        pgs: [
            { pgId: 'pg_a', name: 'FastPay', initialSR: 0.90, colour: PG_COLOURS[0], noiseStd: 0.02 },
            { pgId: 'pg_b', name: 'SlowPay', initialSR: 0.40, colour: PG_COLOURS[1], noiseStd: 0.02 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'epsilon_greedy', 'round_robin'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [
            { triggerTick: 200, type: 'sr_change', changes: { pg_b: 0.95 }, description: 'SlowPay upgraded to 95%!' },
        ],
        learningObjectives: [
            'Explore the tradeoff: do algorithms keep exploring enough to discover the improvement?',
            'See why ε-Greedy sometimes finds the new best faster due to constant exploration',
        ],
    },
    {
        scenarioId: 'perfect_storm',
        name: '🌪️ Perfect Storm',
        description: 'All gateways degrade simultaneously. No escape.',
        difficulty: 'advanced',
        estimatedDurationTicks: 600,
        pgs: [
            { pgId: 'pg_a', name: 'Pay-A', initialSR: 0.90, colour: PG_COLOURS[0], noiseStd: 0.02 },
            { pgId: 'pg_b', name: 'Pay-B', initialSR: 0.85, colour: PG_COLOURS[1], noiseStd: 0.02 },
            { pgId: 'pg_c', name: 'Pay-C', initialSR: 0.80, colour: PG_COLOURS[2], noiseStd: 0.02 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'thompson', 'd_ucb'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [
            { triggerTick: 200, type: 'sr_change', changes: { pg_a: 0.30, pg_b: 0.35, pg_c: 0.25 }, description: '🌪️ All gateways crash!' },
        ],
        learningObjectives: [
            'When everything is bad, how do algorithms distribute traffic?',
            'Observe regret: no algorithm can achieve a high SR — but some minimize damage',
        ],
    },
    {
        scenarioId: 'new_kid',
        name: '🆕 New Kid on the Block',
        description: 'Start with 2 gateways, then a new excellent gateway appears (simulate by improving a dormant PG).',
        difficulty: 'beginner',
        estimatedDurationTicks: 600,
        pgs: [
            { pgId: 'pg_a', name: 'OldGuard', initialSR: 0.80, colour: PG_COLOURS[0], noiseStd: 0.02 },
            { pgId: 'pg_b', name: 'Legacy', initialSR: 0.75, colour: PG_COLOURS[1], noiseStd: 0.02 },
            { pgId: 'pg_c', name: 'NewPG', initialSR: 0.30, colour: PG_COLOURS[2], noiseStd: 0.02 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'thompson', 'epsilon_greedy'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [
            { triggerTick: 200, type: 'sr_change', changes: { pg_c: 0.95 }, description: '🆕 NewPG goes live at 95%!' },
        ],
        learningObjectives: [
            'See how exploration helps discover the new superior gateway',
            'A gateway that was initially bad can become the best — will algorithms find it?',
        ],
    },
    {
        scenarioId: 'stability_stress',
        name: '🧘 Stability Stress',
        description: 'Stable environment with high noise. Tests robustness to noise without real SR changes.',
        difficulty: 'intermediate',
        estimatedDurationTicks: 500,
        pgs: [
            { pgId: 'pg_a', name: 'Noisy-A', initialSR: 0.85, colour: PG_COLOURS[0], noiseStd: 0.10 },
            { pgId: 'pg_b', name: 'Noisy-B', initialSR: 0.75, colour: PG_COLOURS[1], noiseStd: 0.10 },
            { pgId: 'pg_c', name: 'Noisy-C', initialSR: 0.65, colour: PG_COLOURS[2], noiseStd: 0.10 },
        ],
        recommendedAlgorithms: ['sw_ucb', 'thompson', 'd_ucb'],
        defaultSpeed: 100,
        warmUpTicks: 100,
        autoEvents: [],
        learningObjectives: [
            'See how high noise causes routing churn without real SR changes',
            'Compare which algorithm is most stable in noisy environments',
        ],
    },
];

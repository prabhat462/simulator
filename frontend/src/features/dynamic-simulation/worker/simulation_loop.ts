/**
 * SimulationLoop — main tick loop for the Dynamic SR Simulation Sandbox.
 * Runs inside the Web Worker. Generates transactions, routes through algorithms,
 * resolves outcomes, updates metrics, and tracks convergence.
 */

import { SimConfig, TickMetrics, TransactionContext, TransactionDetail, WorkerUpdate, SRChangeEvent, NOISE_STD_MAP, ScenarioAutoEvent } from '../types';
import { BaseAlgorithm, SeededRNG } from '../algorithms/base';
import { SlidingWindowUCB } from '../algorithms/sw_ucb';
import { AdvancedSlidingWindowUCB } from '../algorithms/advanced_sw_ucb';
import { ThompsonSampling } from '../algorithms/thompson';
import { DiscountedUCB } from '../algorithms/d_ucb';
import { EpsilonGreedy } from '../algorithms/epsilon_greedy';
import { RoundRobin } from '../algorithms/round_robin';
import { HybridEnsemble } from '../algorithms/hybrid_ensemble';
import { SRState } from './sr_state';
import { MetricsAccumulator } from './metrics';
import { ConvergenceTracker } from './convergence_tracker';

// ─── Algorithm Factory ───────────────────────────────────────

function createAlgorithm(algorithmId: string): BaseAlgorithm {
    switch (algorithmId) {
        case 'sw_ucb': return new SlidingWindowUCB();
        case 'advanced_sw_ucb': return new AdvancedSlidingWindowUCB();
        case 'thompson': return new ThompsonSampling();
        case 'd_ucb': return new DiscountedUCB();
        case 'epsilon_greedy': return new EpsilonGreedy();
        case 'round_robin': return new RoundRobin();
        case 'hybrid_ensemble': return new HybridEnsemble();
        default: throw new Error(`Unknown algorithm: ${algorithmId}`);
    }
}

// ─── Transaction Generation ──────────────────────────────────

const MODES = ['upi', 'card', 'netbanking'];
const AMOUNT_BANDS = ['0-500', '500-5k', '5k-50k', '50k+'];
const BANKS = ['HDFC', 'SBI', 'ICICI', 'AXIS', 'KOTAK'];

function generateTransaction(rng: SeededRNG, config: SimConfig): TransactionContext {
    const profile = config.trafficProfile;

    let paymentMode = MODES[rng.randint(MODES.length)];
    if (profile?.modeDistribution === 'fixed' && profile.fixedMode) {
        paymentMode = profile.fixedMode;
    }

    // Merchant logic (not used in context yet, but good to have for future)
    // const merchant = profile?.merchantDistribution === 'fixed' ? profile.fixedMerchant : 'random';

    return {
        paymentMode,
        amountBand: AMOUNT_BANDS[rng.randint(AMOUNT_BANDS.length)],
        issuingBank: BANKS[rng.randint(BANKS.length)],
    };
}

// ─── Outcome Resolution ─────────────────────────────────────

function resolveOutcome(trueSR: number, noiseStd: number, rng: SeededRNG): number {
    // Add Gaussian noise (Box-Muller already in SeededRNG)
    let effectiveSR = trueSR;
    if (noiseStd > 0) {
        const u1 = rng.random();
        const u2 = rng.random();
        const noise = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2) * noiseStd;
        effectiveSR = Math.max(0, Math.min(1, trueSR + noise));
    }
    return rng.random() < effectiveSR ? 1 : 0;
}

// ─── Simulation State ────────────────────────────────────────

export class SimulationLoop {
    private config!: SimConfig;
    private rng!: SeededRNG;
    private srState = new SRState();
    private metrics = new MetricsAccumulator();
    private convergenceTracker = new ConvergenceTracker();
    private algorithms: Map<string, BaseAlgorithm> = new Map();
    private tick = 0;
    private running = false;
    private paused = false;
    private justResumed = false;
    private startTime = 0;
    private pausedTime = 0;
    private pauseStart = 0;
    private noiseStds: Record<string, number> = {};
    private autoEvents: ScenarioAutoEvent[] = [];
    private postMessage: (msg: WorkerUpdate) => void;

    constructor(postMessage: (msg: WorkerUpdate) => void) {
        this.postMessage = postMessage;
    }

    start(config: SimConfig, autoEvents: ScenarioAutoEvent[] = []): void {
        this.config = config;
        this.rng = new SeededRNG(config.randomSeed);
        this.tick = 0;
        this.running = true;
        this.paused = false;
        this.justResumed = false;
        this.startTime = performance.now();
        this.pausedTime = 0;
        this.autoEvents = autoEvents;

        // Initialize SR state
        const pgSRs: Record<string, number> = {};
        for (const pg of config.pgs) {
            pgSRs[pg.pgId] = pg.initialSR;
        }
        this.srState.initialize(pgSRs);

        // Compute noise stds
        const globalNoiseStd = NOISE_STD_MAP[config.noiseMode] ?? 0.02;
        this.noiseStds = {};
        for (const pg of config.pgs) {
            this.noiseStds[pg.pgId] = pg.noiseStd ?? globalNoiseStd;
        }

        // Initialize algorithms
        this.algorithms = new Map();
        const armIds = config.pgs.map(pg => pg.pgId);
        for (const algoConfig of config.algorithms) {
            const algo = createAlgorithm(algoConfig.algorithmId);
            algo.initialize(armIds, { ...algoConfig.hyperparameters, seed: config.randomSeed + this.algorithms.size });
            this.algorithms.set(algoConfig.instanceId, algo);
        }

        // Initialize metrics
        const algoIds = config.algorithms.map(a => a.instanceId);
        this.metrics.initialize(armIds, algoIds);

        // Initialize convergence tracker
        this.convergenceTracker.initialize(algoIds, armIds, config.convergenceThreshold, config.stabilityWindow);

        this.postMessage({ type: 'STATUS_CHANGE', status: 'running', tick: 0 });
        this.postMessage({
            type: 'EVENT',
            event: { type: 'start', tick: 0, wallTime: 0, details: 'Simulation started' }
        });

        this.loop();
    }

    pause(): void {
        this.paused = true;
        this.pauseStart = performance.now();
        this.postMessage({ type: 'STATUS_CHANGE', status: 'paused', tick: this.tick });
        this.postMessage({
            type: 'EVENT',
            event: { type: 'pause', tick: this.tick, wallTime: this.getWallTime(), details: 'Simulation paused' }
        });
    }

    resume(stagedChanges: Record<string, number>): void {
        this.srState.stageChanges(stagedChanges);
        this.justResumed = true;
        this.paused = false;
        this.pausedTime += performance.now() - this.pauseStart;
        this.postMessage({ type: 'STATUS_CHANGE', status: 'running', tick: this.tick });
        this.postMessage({
            type: 'EVENT',
            event: { type: 'resume', tick: this.tick, wallTime: this.getWallTime(), details: 'Simulation resumed' }
        });
        this.loop();
    }

    stepOne(stagedChanges: Record<string, number>): void {
        if (!this.config) return;

        // Apply staged changes first
        this.srState.stageChanges(stagedChanges);
        const srEvents = this.srState.applyStagedChanges(this.tick);
        for (const event of srEvents) {
            this.convergenceTracker.registerEvent(event);
            this.postMessage({ type: 'SR_CHANGE_EVENT', event });
            this.postMessage({
                type: 'EVENT',
                event: {
                    type: 'sr_change',
                    tick: this.tick,
                    wallTime: this.getWallTime(),
                    details: `${event.pgId}: ${(event.oldSR * 100).toFixed(0)}% → ${(event.newSR * 100).toFixed(0)}%`,
                    srChangeEvent: event,
                }
            });
        }

        // Check auto events
        for (const autoEvent of this.autoEvents) {
            if (autoEvent.triggerTick === this.tick) {
                const aevents = this.srState.applyAutoEvent(this.tick, autoEvent.changes);
                for (const event of aevents) {
                    this.convergenceTracker.registerEvent(event);
                    this.postMessage({ type: 'SR_CHANGE_EVENT', event });
                }
            }
        }

        // Generate transaction context
        const pgIds = this.config.pgs.map(pg => pg.pgId);
        const txn = generateTransaction(this.rng, this.config);
        const optimalSR = this.srState.getOptimalSR();

        const decisions: TransactionDetail['decisions'] = {};
        const estimatedSRs: Record<string, Record<string, number>> = {};

        for (const [instanceId, algo] of this.algorithms) {
            const chosenPg = algo.select(txn);
            const trueSR = this.srState.getTrueSR(chosenPg);
            const outcome = resolveOutcome(trueSR, this.noiseStds[chosenPg] ?? 0, this.rng);
            algo.update(chosenPg, outcome, txn);
            this.metrics.record(instanceId, chosenPg, outcome, trueSR, optimalSR);
            this.convergenceTracker.recordRouting(instanceId, chosenPg, pgIds);

            const state = algo.getState();
            const estSRs: Record<string, number> = {};
            for (const pgId of pgIds) {
                estSRs[pgId] = (state[pgId]?.estimatedSR ?? 0) * 100;
            }
            estimatedSRs[instanceId] = estSRs;

            decisions[instanceId] = {
                chosenPg,
                outcome,
                trueSR: trueSR * 100,
                estimatedSRs: estSRs,
                routingShares: {},
                regretIncurred: optimalSR - trueSR,
            };
        }

        // Compute tick metrics
        const trueSRsPercent: Record<string, number> = {};
        for (const pgId of pgIds) {
            trueSRsPercent[pgId] = this.srState.getTrueSR(pgId) * 100;
        }

        const tickMetrics = this.metrics.getTickMetrics(this.tick, trueSRsPercent, estimatedSRs);
        this.postMessage({ type: 'TICK_BATCH', metrics: [tickMetrics] });

        // Send detailed step info
        const detail: TransactionDetail = {
            tick: this.tick,
            transaction: txn,
            decisions,
            trueSRs: trueSRsPercent,
            optimalSR: optimalSR * 100,
        };
        this.postMessage({ type: 'STEP_DETAIL', detail });

        this.tick++;
        this.postMessage({ type: 'STATUS_CHANGE', status: 'paused', tick: this.tick });
    }

    reset(): void {
        this.running = false;
        this.paused = false;
        this.tick = 0;
        this.postMessage({ type: 'STATUS_CHANGE', status: 'idle', tick: 0 });
        this.postMessage({
            type: 'EVENT',
            event: { type: 'reset', tick: 0, wallTime: 0, details: 'Simulation reset' }
        });
    }

    setSpeed(tps: number): void {
        if (this.config) {
            this.config.speedTPS = tps;
        }
    }

    private getWallTime(): number {
        return performance.now() - this.startTime - this.pausedTime;
    }

    private async loop(): Promise<void> {
        const pgIds = this.config.pgs.map(pg => pg.pgId);
        let batchMetrics: TickMetrics[] = [];
        let lastFlush = performance.now();
        const FLUSH_INTERVAL = 50; // ms — flush metrics to main thread every 50ms

        while (this.running && !this.paused) {
            // Apply staged SR changes at resume
            if (this.justResumed) {
                const events = this.srState.applyStagedChanges(this.tick);
                for (const event of events) {
                    this.convergenceTracker.registerEvent(event);
                    this.postMessage({ type: 'SR_CHANGE_EVENT', event });
                    this.postMessage({
                        type: 'EVENT',
                        event: {
                            type: 'sr_change',
                            tick: this.tick,
                            wallTime: this.getWallTime(),
                            details: `${event.pgId}: ${(event.oldSR * 100).toFixed(0)}% → ${(event.newSR * 100).toFixed(0)}%`,
                            srChangeEvent: event,
                        }
                    });
                }
                this.justResumed = false;
            }

            // Check auto events
            for (const autoEvent of this.autoEvents) {
                if (autoEvent.triggerTick === this.tick) {
                    const events = this.srState.applyAutoEvent(this.tick, autoEvent.changes);
                    for (const event of events) {
                        this.convergenceTracker.registerEvent(event);
                        this.postMessage({ type: 'SR_CHANGE_EVENT', event });
                        this.postMessage({
                            type: 'EVENT',
                            event: {
                                type: 'auto_event',
                                tick: this.tick,
                                wallTime: this.getWallTime(),
                                details: autoEvent.description,
                                srChangeEvent: event,
                            }
                        });
                    }
                }
            }

            // Generate transaction context
            const txn = generateTransaction(this.rng, this.config);
            const optimalSR = this.srState.getOptimalSR();

            // Run all algorithms
            const routingDecisions: Record<string, string> = {};
            const estimatedSRs: Record<string, Record<string, number>> = {};

            for (const [instanceId, algo] of this.algorithms) {
                // Select
                const chosenPg = algo.select(txn);
                routingDecisions[instanceId] = chosenPg;

                // Resolve outcome
                const trueSR = this.srState.getTrueSR(chosenPg);
                const outcome = resolveOutcome(trueSR, this.noiseStds[chosenPg] ?? 0, this.rng);

                // Update algorithm
                algo.update(chosenPg, outcome, txn);

                // Record metrics
                this.metrics.record(instanceId, chosenPg, outcome, trueSR, optimalSR);

                // Track routing for convergence
                this.convergenceTracker.recordRouting(instanceId, chosenPg, pgIds);

                // Get estimated SRs
                const state = algo.getState();
                const estSRs: Record<string, number> = {};
                for (const pgId of pgIds) {
                    estSRs[pgId] = (state[pgId]?.estimatedSR ?? 0) * 100;
                }
                estimatedSRs[instanceId] = estSRs;
            }

            // Update convergence tracking (after warm-up)
            if (this.tick >= this.config.warmUpTicks) {
                const convResults = this.convergenceTracker.tick(this.tick, routingDecisions);
                for (const result of convResults) {
                    this.postMessage({ type: 'CONVERGENCE_UPDATE', result });
                    this.postMessage({
                        type: 'EVENT',
                        event: {
                            type: 'convergence',
                            tick: this.tick,
                            wallTime: this.getWallTime(),
                            details: `${result.algorithmId} converged in ${result.convergenceLatencyTxns} txns`,
                            convergenceResult: result,
                        }
                    });
                }
            }

            // Compute tick metrics
            const trueSRsPercent: Record<string, number> = {};
            for (const pgId of pgIds) {
                trueSRsPercent[pgId] = this.srState.getTrueSR(pgId) * 100;
            }
            const tickMetrics = this.metrics.getTickMetrics(this.tick, trueSRsPercent, estimatedSRs);

            // Batch metrics for performance
            const speed = this.config.speedTPS;
            const shouldSample = speed > 5000 ? (this.tick % 10 === 0) : true;
            if (shouldSample) {
                batchMetrics.push(tickMetrics);
            }

            // Flush batch periodically or if too large
            const now = performance.now();
            if (now - lastFlush >= FLUSH_INTERVAL || batchMetrics.length >= 500) {
                if (batchMetrics.length > 0) {
                    this.postMessage({ type: 'TICK_BATCH', metrics: batchMetrics });
                    batchMetrics = [];
                }
                lastFlush = now;
                // Yield to allow message processing
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            this.tick++;

            // Throttle to configured speed
            if (speed <= 1000) {
                await new Promise(resolve => setTimeout(resolve, Math.max(1, 1000 / speed)));
            } else if (speed <= 5000) {
                if (this.tick % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, Math.max(1, 10000 / speed)));
                }
            }
            // At >5000 tps, no sleep — run as fast as possible, just yield periodically
        }

        // Flush remaining
        if (batchMetrics.length > 0) {
            this.postMessage({ type: 'TICK_BATCH', metrics: batchMetrics });
        }
    }
}

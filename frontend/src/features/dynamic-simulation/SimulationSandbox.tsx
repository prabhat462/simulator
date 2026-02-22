/**
 * SimulationSandbox — root layout component for the Dynamic SR Simulation Sandbox.
 * Assembles all panels, charts, and controls into a cohesive dashboard.
 * Features: collapsible panels, sidebar toggles, step mode, calculated SR display.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PGConfig, AlgorithmConfig, SimConfig, PG_COLOURS } from './types';
import { useSimulation } from './hooks/useSimulation';
import { useChartData } from './hooks/useChartData';
import { useConvergence } from './hooks/useConvergence';
import { useMetricsStore } from './hooks/useMetricsStore';
import PGConfigPanel from './panels/PGConfigPanel';
import AlgorithmPanel from './panels/AlgorithmPanel';
import ControlBar from './panels/ControlBar';
import SRManipulationPanel from './panels/SRManipulationPanel';
import ConvergencePanel from './panels/ConvergencePanel';
import EventTimeline from './panels/EventTimeline';
import CalculatedSRPanel from './panels/CalculatedSRPanel';
import StepDetailPanel from './panels/StepDetailPanel';
import RoutingShareChart from './charts/RoutingShareChart';
import TrueVsEstimatedSRChart from './charts/TrueVsEstimatedSRChart';
import CumulativeRegretChart from './charts/CumulativeRegretChart';
import RollingAchievedSRChart from './charts/RollingAchievedSRChart';
import { SCENARIOS } from './scenarios/scenario_loader';
import InsightPanel from './components/InsightPanel';
import CollapsibleSection from './components/CollapsibleSection';
import type { Scenario } from './types';
import './SimulationSandbox.css';

export default function SimulationSandbox() {
    const navigate = useNavigate();

    // ─── Configuration State ───────────────────────────────────
    const [pgs, setPGs] = useState<PGConfig[]>([
        { pgId: 'pg_a', name: 'PG-A', initialSR: 0.90, colour: PG_COLOURS[0], noiseStd: 0.02 },
        { pgId: 'pg_b', name: 'PG-B', initialSR: 0.75, colour: PG_COLOURS[1], noiseStd: 0.02 },
        { pgId: 'pg_c', name: 'PG-C', initialSR: 0.60, colour: PG_COLOURS[2], noiseStd: 0.02 },
    ]);
    const [algorithms, setAlgorithms] = useState<AlgorithmConfig[]>([]);
    const [speed, setSpeed] = useState(100);
    const [warmUpTicks] = useState(100);

    // ─── Sidebar Toggles ───────────────────────────────────────
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

    // ─── Simulation Hook ───────────────────────────────────────
    const {
        state: simState,
        metricsBuffer,
        subscribeToMetrics,
        startSimulation,
        pauseSimulation,
        resumeSimulation,
        stepOne,
        resetSimulation,
        setSpeed: setWorkerSpeed,
    } = useSimulation();

    // ─── Metrics Store (for Statistician Dashboard) ─────────────
    const { recordMetrics, saveRun } = useMetricsStore();

    // ─── Chart Data ────────────────────────────────────────────
    const {
        routingShareData,
        regretData,
        rollingData,
        srEstimateData,
        resetChartData,
    } = useChartData(subscribeToMetrics);

    // ─── Convergence ───────────────────────────────────────────
    const { eventInfos, activeEvent, generateNarrative } = useConvergence(
        simState.srChangeEvents,
        simState.convergenceResults
    );

    // ─── Current SR state (from latest metrics) ────────────────
    const currentSRs = useMemo((): Record<string, number> => {
        if (!simState.latestMetrics) {
            const srs: Record<string, number> = {};
            for (const pg of pgs) { srs[pg.pgId] = pg.initialSR; }
            return srs;
        }
        const srs: Record<string, number> = {};
        for (const [pgId, srPct] of Object.entries(simState.latestMetrics.trueSRs)) {
            srs[pgId] = srPct / 100;
        }
        return srs;
    }, [simState.latestMetrics, pgs]);

    // ─── Handlers ──────────────────────────────────────────────
    const isConfigured = pgs.length >= 2 && algorithms.length >= 1;
    const isIdle = simState.status === 'idle';

    const handleStart = useCallback(() => {
        if (!isConfigured) return;
        resetChartData();
        const config: SimConfig = {
            pgs,
            algorithms,
            speedTPS: speed,
            warmUpTicks,
            randomSeed: Date.now(),
            noiseMode: 'low',
            convergenceThreshold: 0.10,
            stabilityWindow: 20,
            trafficProfile: {
                modeDistribution: 'random',
                merchantDistribution: 'random',
            },
        };
        startSimulation(config);
    }, [pgs, algorithms, speed, warmUpTicks, isConfigured, startSimulation, resetChartData]);

    const handlePause = useCallback(() => pauseSimulation(), [pauseSimulation]);

    const handleResume = useCallback(() => {
        resumeSimulation({});
    }, [resumeSimulation]);

    const handleApplyAndResume = useCallback((stagedChanges: Record<string, number>) => {
        resumeSimulation(stagedChanges);
    }, [resumeSimulation]);

    const handleStepOne = useCallback(() => {
        stepOne({});
    }, [stepOne]);

    const handleReset = useCallback(() => {
        resetSimulation();
        resetChartData();
    }, [resetSimulation, resetChartData]);

    const handleSpeedChange = useCallback((newSpeed: number) => {
        setSpeed(newSpeed);
        setWorkerSpeed(newSpeed);
    }, [setWorkerSpeed]);

    const handleLoadScenario = useCallback((scenario: Scenario) => {
        if (!isIdle) handleReset();
        setPGs(scenario.pgs);
        setAlgorithms([]);
        setSpeed(scenario.defaultSpeed);
    }, [isIdle, handleReset]);

    // Finish & Save → persist run to localStorage without clearing results
    const handleFinish = useCallback(() => {
        // Record any current metrics buffer
        if (metricsBuffer.current.length > 0) {
            recordMetrics(metricsBuffer.current);
        }
        saveRun(
            pgs,
            algorithms,
            simState.srChangeEvents,
            simState.convergenceResults,
            simState.tick,
        );
        // Note: Do NOT reset simulation or navigate away
        // Results remain visible for analysis in the sandbox
    }, [pgs, algorithms, simState, metricsBuffer, recordMetrics, saveRun]);

    // Navigate to Statistician Dashboard
    const handleViewAnalysis = useCallback(() => {
        navigate('/sandbox/analysis');
    }, [navigate]);

    return (
        <div className="sandbox-container">
            {/* ═══ Compact Header Row: title + scenario + controls + metrics ═══ */}
            <div className="sandbox-compact-header">
                <div className="compact-title">
                    <span className="compact-title-icon">🧪</span>
                    <span className="compact-title-text">Dynamic SR Sandbox</span>
                </div>

                <div className="compact-scenario">
                    <select
                        onChange={e => {
                            const s = SCENARIOS.find(s => s.scenarioId === e.target.value);
                            if (s) handleLoadScenario(s);
                        }}
                        value=""
                        disabled={!isIdle}
                    >
                        <option value="" disabled>Scenario...</option>
                        {SCENARIOS.map(s => (
                            <option key={s.scenarioId} value={s.scenarioId}>
                                {s.name} ({s.difficulty})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Inline Controls */}
                <ControlBar
                    status={simState.status}
                    tick={simState.tick}
                    warmUpTicks={warmUpTicks}
                    speed={speed}
                    onStart={handleStart}
                    onPause={handlePause}
                    onResume={handleResume}
                    onReset={handleReset}
                    onStepOne={handleStepOne}
                    onSpeedChange={handleSpeedChange}
                    canStart={isConfigured}
                    onFinish={handleFinish}
                    onViewAnalysis={handleViewAnalysis}
                />

                {/* Inline Overall SR pills */}
                {simState.latestMetrics && (
                    <div className="compact-metrics-pills">
                        {Object.entries(simState.latestMetrics.rollingAchievedSR).map(([algoId, sr]) => {
                            const algo = algorithms.find(a => a.instanceId === algoId);
                            if (!algo) return null;
                            return (
                                <div key={algoId} className="metric-pill">
                                    <span className="pill-value">{sr.toFixed(1)}%</span>
                                    <span className="pill-label">{algo.displayName}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Slim Timeline */}
            <EventTimeline events={simState.events} currentTick={simState.tick} />

            {/* Main Layout: sidebar + content + sidebar */}
            <div className="sandbox-body">
                {/* Left Sidebar Toggle */}
                <button
                    className={`sidebar-toggle toggle-left ${leftSidebarOpen ? 'open' : 'closed'}`}
                    onClick={() => setLeftSidebarOpen(o => !o)}
                    title={leftSidebarOpen ? 'Hide config panel' : 'Show config panel'}
                >
                    {leftSidebarOpen ? '◀' : '▶'}
                </button>

                {/* Left Sidebar: Config + Analysis */}
                {leftSidebarOpen && (
                    <div className="sandbox-sidebar-left">
                        <CollapsibleSection title="Payment Gateways" icon="🏦" badge={`${pgs.length}/10`}>
                            <div className="pg-list-scrollable">
                                <PGConfigPanel pgs={pgs} onChange={setPGs} disabled={!isIdle} />
                            </div>
                        </CollapsibleSection>
                        <CollapsibleSection title="Algorithms" icon="🧮" badge={`${algorithms.length}/3`}>
                            <AlgorithmPanel algorithms={algorithms} onChange={setAlgorithms} disabled={!isIdle} />
                        </CollapsibleSection>

                        {/* Analysis Log moved to left sidebar */}
                        <CollapsibleSection title="Analysis Log" icon="🧠" defaultCollapsed={false}>
                            <InsightPanel
                                latestMetrics={simState.latestMetrics}
                                srChangeEvents={simState.srChangeEvents}
                                convergenceResults={simState.convergenceResults}
                                algorithms={algorithms}
                                pgs={pgs}
                                tick={simState.tick}
                            />
                        </CollapsibleSection>

                        {/* Convergence Analysis moved to left sidebar */}
                        <CollapsibleSection title="Convergence Analysis" icon="📐" defaultCollapsed={false}>
                            <ConvergencePanel
                                eventInfos={eventInfos}
                                activeEvent={activeEvent}
                                algorithms={algorithms}
                                generateNarrative={generateNarrative}
                                tick={simState.tick}
                            />
                        </CollapsibleSection>
                    </div>
                )}

                {/* Center: Charts + Insights + Convergence */}
                <div className="sandbox-center">
                    {simState.status === 'idle' && !simState.latestMetrics ? (
                        <div className="sandbox-placeholder">
                            <div className="placeholder-icon">🧪</div>
                            <h2>Dynamic SR Simulation Sandbox</h2>
                            <p className="placeholder-desc">
                                Watch how routing algorithms adapt in real-time as gateway success rates change.
                            </p>

                            <div className="setup-checklist">
                                <div className="setup-steps-title">Setup Checklist</div>
                                <div className={`setup-step ${pgs.length >= 2 ? 'done' : 'pending'}`}>
                                    <span className="step-icon">{pgs.length >= 2 ? '✅' : '1️⃣'}</span>
                                    <span>Payment Gateways: <strong>{pgs.length}</strong> configured {pgs.length < 2 && <em>(need ≥ 2)</em>}</span>
                                </div>
                                <div className={`setup-step ${algorithms.length >= 1 ? 'done' : 'pending'}`}>
                                    <span className="step-icon">{algorithms.length >= 1 ? '✅' : '2️⃣'}</span>
                                    <span>Algorithms: <strong>{algorithms.length}</strong> selected {algorithms.length < 1 && <em>(need ≥ 1)</em>}</span>
                                </div>
                                <div className={`setup-step ${isConfigured ? 'done' : 'pending'}`}>
                                    <span className="step-icon">{isConfigured ? '✅' : '3️⃣'}</span>
                                    <span>{isConfigured ? 'Ready! Click ▶ Start' : 'Complete above steps to start'}</span>
                                </div>
                            </div>

                            <div className="placeholder-feature-pills">
                                <span className="feature-pill">📊 Live Charts</span>
                                <span className="feature-pill">🎛️ SR Manipulation</span>
                                <span className="feature-pill">🔬 Step-by-Step Mode</span>
                                <span className="feature-pill">📐 Convergence Analysis</span>
                                <span className="feature-pill">📈 Statistician Dashboard</span>
                            </div>

                            <div className="keyboard-hints">
                                <span><kbd>Space</kbd> Start/Pause</span>
                                <span><kbd>↑↓</kbd> Speed</span>
                                <span><kbd>N</kbd> Step</span>
                                <span><kbd>R</kbd> Reset</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="sandbox-charts-grid">
                                <RoutingShareChart
                                    data={routingShareData}
                                    pgs={pgs}
                                    algorithms={algorithms}
                                    srChangeEvents={simState.srChangeEvents}
                                    latestMetrics={simState.latestMetrics}
                                />
                                <TrueVsEstimatedSRChart
                                    data={srEstimateData}
                                    pgs={pgs}
                                    algorithms={algorithms}
                                    srChangeEvents={simState.srChangeEvents}
                                    latestMetrics={simState.latestMetrics}
                                />
                                <CumulativeRegretChart
                                    data={regretData}
                                    algorithms={algorithms}
                                    srChangeEvents={simState.srChangeEvents}
                                />
                                <RollingAchievedSRChart
                                    data={rollingData}
                                    algorithms={algorithms}
                                    srChangeEvents={simState.srChangeEvents}
                                />
                            </div>

                            {/* Step Detail Panel — only when step detail is available */}
                            <CollapsibleSection title="Step Detail" icon="🔬" defaultCollapsed={!simState.latestStepDetail}>
                                <StepDetailPanel
                                    detail={simState.latestStepDetail}
                                    algorithms={algorithms}
                                    pgs={pgs}
                                />
                            </CollapsibleSection>
                        </>
                    )}
                </div>

                {/* Right Sidebar Toggle */}
                <button
                    className={`sidebar-toggle toggle-right ${rightSidebarOpen ? 'open' : 'closed'}`}
                    onClick={() => setRightSidebarOpen(o => !o)}
                    title={rightSidebarOpen ? 'Hide analysis panel' : 'Show analysis panel'}
                >
                    {rightSidebarOpen ? '▶' : '◀'}
                </button>

                {/* Right Sidebar: SR Manipulation + Algorithm Estimates */}
                {rightSidebarOpen && (
                    <div className="sandbox-sidebar-right">
                        <CollapsibleSection title="SR Manipulation" icon="🎛️">
                            <SRManipulationPanel
                                pgs={pgs}
                                currentSRs={currentSRs}
                                status={simState.status}
                                onApplyAndResume={handleApplyAndResume}
                            />
                        </CollapsibleSection>
                        <CollapsibleSection title="Algorithm Estimates" icon="📊">
                            <CalculatedSRPanel
                                latestMetrics={simState.latestMetrics}
                                algorithms={algorithms}
                                pgs={pgs}
                            />
                        </CollapsibleSection>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * ControlBar — simulation controls: Start/Pause/Resume/Reset/Step, speed, tick counter.
 */

import React, { useEffect } from 'react';
import { SimulationStatus } from '../types';

interface Props {
    status: SimulationStatus;
    tick: number;
    warmUpTicks: number;
    speed: number;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onReset: () => void;
    onStepOne: () => void;
    onSpeedChange: (speed: number) => void;
    canStart: boolean;
    onFinish?: () => void;
    onViewAnalysis?: () => void;
}

function formatNumber(n: number): string {
    return n.toLocaleString();
}

function speedLabel(speed: number): string {
    if (speed <= 100) return `Slow (${speed}/s)`;
    if (speed <= 1000) return `Normal (${speed}/s)`;
    if (speed <= 5000) return `Fast (${formatNumber(speed)}/s)`;
    return `Ultra (${formatNumber(speed)}/s)`;
}

export default function ControlBar({
    status, tick, warmUpTicks, speed,
    onStart, onPause, onResume, onReset, onStepOne, onSpeedChange, canStart, onFinish, onViewAnalysis
}: Props) {

    const isWarmUp = tick < warmUpTicks && status === 'running';

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (status === 'running') onPause();
                    else if (status === 'paused') onResume();
                    else if (status === 'idle' && canStart) onStart();
                    break;
                case 'r':
                case 'R':
                    if (status !== 'idle') onReset();
                    break;
                case 'n':
                case 'N':
                    if (status === 'paused') onStepOne();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    onSpeedChange(Math.min(10000, speed * 2));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    onSpeedChange(Math.max(10, speed / 2));
                    break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [status, speed, onPause, onResume, onStart, onReset, onStepOne, onSpeedChange, canStart]);

    // Log scale for speed slider: 10 → 10000
    const logMin = Math.log10(10);
    const logMax = Math.log10(10000);
    const logValue = Math.log10(speed);
    const sliderPercent = ((logValue - logMin) / (logMax - logMin)) * 100;

    return (
        <div className="sandbox-control-bar">
            <div className="control-buttons">
                {status === 'idle' && (
                    <button className="btn-control btn-start" onClick={onStart} disabled={!canStart}>
                        ▶ Start
                    </button>
                )}
                {status === 'running' && (
                    <button className="btn-control btn-pause" onClick={onPause}>
                        ⏸ Pause
                    </button>
                )}
                {status === 'paused' && (
                    <>
                        <button className="btn-control btn-resume" onClick={onResume}>
                            ▶ Resume
                        </button>
                        <button className="btn-control btn-step" onClick={onStepOne} title="Step one transaction (N)">
                            ⏭ Step
                        </button>
                    </>
                )}
                {status !== 'idle' && (
                    <>
                        <button className="btn-control btn-reset" onClick={onReset} title="Clear results and run a new simulation">
                            🔄 Rerun New Simulation
                        </button>
                        {onFinish && (
                            <button className="btn-control btn-finish" onClick={onFinish} title="Save results to analysis dashboard (results remain visible)">
                                ✅ Save Results
                            </button>
                        )}
                        {onViewAnalysis && status !== 'running' && (
                            <button className="btn-control btn-analysis" onClick={onViewAnalysis} title="View detailed analysis in Statistician Dashboard">
                                📊 View Analysis
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="control-speed">
                <label>Speed:</label>
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={sliderPercent}
                    onChange={e => {
                        const pct = Number(e.target.value);
                        const logVal = logMin + (pct / 100) * (logMax - logMin);
                        onSpeedChange(Math.round(Math.pow(10, logVal)));
                    }}
                    className="speed-slider"
                />
                <span className="speed-label">{speedLabel(speed)}</span>
            </div>

            <div className="control-info">
                <div className="control-tick">
                    <span className="tick-label">T:</span>
                    <span className="tick-value">{formatNumber(tick)}</span>
                </div>
                {isWarmUp && (
                    <div className="warm-up-indicator">
                        <div className="warm-up-bar">
                            <div
                                className="warm-up-progress"
                                style={{ width: `${Math.min(100, (tick / warmUpTicks) * 100)}%` }}
                            />
                        </div>
                        <span className="warm-up-text">Warm-up: {tick}/{warmUpTicks}</span>
                    </div>
                )}
                {!isWarmUp && status === 'running' && (
                    <span className="warm-up-done">✅ Warm-up complete</span>
                )}
            </div>
        </div>
    );
}

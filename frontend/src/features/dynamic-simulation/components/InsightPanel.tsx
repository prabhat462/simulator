/**
 * InsightPanel — persistent, append-only insight history log.
 * Shows insights generated during simulation as a scrollable history.
 * Newest entries appear at the top with tick number badges.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlgorithmConfig, ConvergenceResult, PGConfig, SRChangeEvent, TickMetrics } from '../types';

interface InsightEntry {
    id: number;
    tick: number;
    type: 'info' | 'warning' | 'success';
    text: string;
}

interface InsightPanelProps {
    latestMetrics: TickMetrics | null;
    srChangeEvents: SRChangeEvent[];
    convergenceResults: ConvergenceResult[];
    algorithms: AlgorithmConfig[];
    pgs: PGConfig[];
    tick: number;
}

const MAX_HISTORY = 200;
const ICON_MAP = { warning: '⚠️', success: '✅', info: 'ℹ️' };

let nextId = 0;

export default function InsightPanel({
    latestMetrics,
    srChangeEvents,
    convergenceResults,
    algorithms,
    pgs,
    tick
}: InsightPanelProps) {
    const [history, setHistory] = useState<InsightEntry[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);
    const lastAnalyzedTickRef = useRef(0);
    const seenEventsRef = useRef(new Set<string>());

    // Generate insights and append to history
    const analyzeAndAppend = useCallback(() => {
        if (!latestMetrics || tick <= lastAnalyzedTickRef.current) return;

        // Only analyze every 50 ticks to avoid spam
        if (tick - lastAnalyzedTickRef.current < 50 && tick > 50) return;
        lastAnalyzedTickRef.current = tick;

        const newEntries: InsightEntry[] = [];

        // 1. Analyze recent SR Changes
        for (const event of srChangeEvents) {
            const key = `sr_${event.eventId}`;
            if (seenEventsRef.current.has(key)) continue;
            seenEventsRef.current.add(key);

            const pgName = pgs.find(p => p.pgId === event.pgId)?.name || event.pgId;
            const direction = event.newSR < event.oldSR ? 'dropped' : 'improved';
            newEntries.push({
                id: nextId++,
                tick: event.tick,
                type: event.newSR < event.oldSR ? 'warning' : 'success',
                text: `${pgName} SR ${direction} from ${(event.oldSR * 100).toFixed(0)}% to ${(event.newSR * 100).toFixed(0)}%.`
            });
        }

        // 2. Algorithm reactions to latest SR changes
        const recentEvent = srChangeEvents
            .filter(e => tick - e.tick < 200 && tick - e.tick > 30)
            .sort((a, b) => b.tick - a.tick)[0];

        if (recentEvent && recentEvent.newSR < recentEvent.oldSR) {
            const pgName = pgs.find(p => p.pgId === recentEvent.pgId)?.name || recentEvent.pgId;
            algorithms.forEach(algo => {
                const key = `react_${recentEvent.eventId}_${algo.instanceId}`;
                if (seenEventsRef.current.has(key)) return;

                const currentShare = latestMetrics.routingShares[algo.instanceId]?.[recentEvent.pgId] || 0;
                if (currentShare < 10) {
                    seenEventsRef.current.add(key);
                    newEntries.push({
                        id: nextId++,
                        tick,
                        type: 'success',
                        text: `${algo.displayName} shifted away from ${pgName} (current share: ${currentShare.toFixed(1)}%).`
                    });
                } else if (currentShare > 50 && tick - recentEvent.tick > 100) {
                    seenEventsRef.current.add(key);
                    newEntries.push({
                        id: nextId++,
                        tick,
                        type: 'warning',
                        text: `${algo.displayName} still routing ${currentShare.toFixed(1)}% to ${pgName} — possible blindness.`
                    });
                }
            });
        }

        // 3. Convergence notifications
        for (const res of convergenceResults) {
            const key = `conv_${res.eventId}_${res.algorithmId}`;
            if (seenEventsRef.current.has(key) || res.phase !== 'converged') continue;
            seenEventsRef.current.add(key);

            const algoName = algorithms.find(a => a.instanceId === res.algorithmId)?.displayName || res.algorithmId;
            newEntries.push({
                id: nextId++,
                tick: res.convergenceTick || tick,
                type: 'success',
                text: `${algoName} converged in ${res.convergenceLatencyTxns} txns.`
            });
        }

        // 4. Comparative analysis (every 200 ticks)
        if (algorithms.length > 1 && tick % 200 === 0 && tick > 100) {
            const sorted = [...algorithms].sort((a, b) =>
                (latestMetrics.cumulativeRegret[a.instanceId] || 0) - (latestMetrics.cumulativeRegret[b.instanceId] || 0)
            );
            const best = sorted[0];
            const worst = sorted[sorted.length - 1];
            const bestRegret = latestMetrics.cumulativeRegret[best.instanceId] || 0;
            const worstRegret = latestMetrics.cumulativeRegret[worst.instanceId] || 0;

            if (worstRegret > bestRegret * 1.5 && worstRegret > 5) {
                newEntries.push({
                    id: nextId++,
                    tick,
                    type: 'info',
                    text: `${best.displayName} leads with regret ${bestRegret.toFixed(1)} vs ${worst.displayName} at ${worstRegret.toFixed(1)}.`
                });
            }
        }

        if (newEntries.length > 0) {
            setHistory(prev => [...newEntries, ...prev].slice(0, MAX_HISTORY));
        }
    }, [latestMetrics, srChangeEvents, convergenceResults, algorithms, pgs, tick]);

    useEffect(() => {
        analyzeAndAppend();
    }, [analyzeAndAppend]);

    // Auto-scroll to top when new entries arrive
    useEffect(() => {
        if (autoScroll && listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [history, autoScroll]);

    const clearHistory = useCallback(() => {
        setHistory([]);
        seenEventsRef.current.clear();
        lastAnalyzedTickRef.current = 0;
    }, []);

    return (
        <div className="insight-panel">
            <div className="insight-header-row">
                <h3>🧠 Analysis Log</h3>
                <div className="insight-controls">
                    <label className="auto-scroll-toggle" title="Auto-scroll to newest">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={e => setAutoScroll(e.target.checked)}
                        />
                        Auto
                    </label>
                    <button className="insight-clear-btn" onClick={clearHistory} title="Clear history">
                        🗑
                    </button>
                </div>
            </div>
            <span className="insight-count">{history.length} entries</span>
            <div className="insight-list" ref={listRef}>
                {history.length === 0 ? (
                    <div className="insight-item info">
                        <span className="insight-icon">ℹ️</span>
                        <p>Start simulation to see analysis insights here.</p>
                    </div>
                ) : (
                    history.map(entry => (
                        <div key={entry.id} className={`insight-item ${entry.type}`}>
                            <span className="insight-tick-badge">T{entry.tick}</span>
                            <span className="insight-icon">{ICON_MAP[entry.type]}</span>
                            <p>{entry.text}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

/**
 * useChartData — manages chart data buffers via refs for performance.
 * Subscribes to the metrics stream and accumulates data for all 4 charts.
 * Includes downsampling at high tick rates and throttled state flushing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TickMetrics } from '../types';

export interface ChartDataPoint {
    tick: number;
    [key: string]: number;
}

const MAX_CHART_POINTS = 800;
const FLUSH_INTERVAL_MS = 100; // Max 10fps state updates (was rAF ~30fps)

export function useChartData(subscribeToMetrics: (listener: (m: TickMetrics[]) => void) => () => void) {
    const [routingShareData, setRoutingShareData] = useState<ChartDataPoint[]>([]);
    const [regretData, setRegretData] = useState<ChartDataPoint[]>([]);
    const [rollingData, setRollingData] = useState<ChartDataPoint[]>([]);
    const [srEstimateData, setSREstimateData] = useState<ChartDataPoint[]>([]);

    const routingRef = useRef<ChartDataPoint[]>([]);
    const regretRef = useRef<ChartDataPoint[]>([]);
    const rollingRef = useRef<ChartDataPoint[]>([]);
    const srRef = useRef<ChartDataPoint[]>([]);
    const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dirtyRef = useRef(false);
    const tickCountRef = useRef(0);

    // Throttled flush using setInterval instead of rAF
    useEffect(() => {
        flushTimerRef.current = setInterval(() => {
            if (dirtyRef.current) {
                setRoutingShareData([...routingRef.current]);
                setRegretData([...regretRef.current]);
                setRollingData([...rollingRef.current]);
                setSREstimateData([...srRef.current]);
                dirtyRef.current = false;
            }
        }, FLUSH_INTERVAL_MS);

        return () => {
            if (flushTimerRef.current) clearInterval(flushTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const unsub = subscribeToMetrics((batch: TickMetrics[]) => {
            for (const m of batch) {
                tickCountRef.current++;

                // Downsample: at high rates, only keep every 3rd point for charts
                if (tickCountRef.current > 1000 && tickCountRef.current % 3 !== 0) continue;
                if (tickCountRef.current > 5000 && tickCountRef.current % 5 !== 0) continue;

                // Routing share data
                const routingPoint: ChartDataPoint = { tick: m.tick };
                for (const [algoId, shares] of Object.entries(m.routingShares)) {
                    for (const [pgId, share] of Object.entries(shares)) {
                        routingPoint[`${algoId}_${pgId}`] = Math.round(share * 10) / 10;
                    }
                }
                routingRef.current.push(routingPoint);

                // Cumulative regret data
                const regretPoint: ChartDataPoint = { tick: m.tick };
                for (const [algoId, regret] of Object.entries(m.cumulativeRegret)) {
                    regretPoint[algoId] = Math.round(regret * 100) / 100;
                }
                regretRef.current.push(regretPoint);

                // Rolling achieved SR data
                const rollingPoint: ChartDataPoint = { tick: m.tick, optimalSR: m.optimalSR };
                for (const [algoId, sr] of Object.entries(m.rollingAchievedSR)) {
                    rollingPoint[algoId] = Math.round(sr * 10) / 10;
                }
                rollingRef.current.push(rollingPoint);

                // True SR vs Estimated SR data
                const srPoint: ChartDataPoint = { tick: m.tick };
                for (const [pgId, trueSR] of Object.entries(m.trueSRs)) {
                    srPoint[`true_${pgId}`] = trueSR;
                }
                for (const [algoId, estimates] of Object.entries(m.estimatedSRs)) {
                    for (const [pgId, estSR] of Object.entries(estimates)) {
                        srPoint[`est_${algoId}_${pgId}`] = Math.round(estSR * 10) / 10;
                    }
                }
                srRef.current.push(srPoint);
            }

            // Trim all buffers
            if (routingRef.current.length > MAX_CHART_POINTS) {
                routingRef.current = routingRef.current.slice(-MAX_CHART_POINTS);
                regretRef.current = regretRef.current.slice(-MAX_CHART_POINTS);
                rollingRef.current = rollingRef.current.slice(-MAX_CHART_POINTS);
                srRef.current = srRef.current.slice(-MAX_CHART_POINTS);
            }

            dirtyRef.current = true;
        });

        return () => { unsub(); };
    }, [subscribeToMetrics]);

    const resetChartData = useCallback(() => {
        routingRef.current = [];
        regretRef.current = [];
        rollingRef.current = [];
        srRef.current = [];
        tickCountRef.current = 0;
        dirtyRef.current = false;
        setRoutingShareData([]);
        setRegretData([]);
        setRollingData([]);
        setSREstimateData([]);
    }, []);

    return {
        routingShareData,
        regretData,
        rollingData,
        srEstimateData,
        resetChartData,
    };
}

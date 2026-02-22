/**
 * RoutingShareChart — line chart showing routing share per PG per algorithm.
 */

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PGConfig, AlgorithmConfig, SRChangeEvent, TickMetrics } from '../types';
import { ChartDataPoint } from '../hooks/useChartData';
import FullscreenSROverlay from '../components/FullscreenSROverlay';

interface Props {
    data: ChartDataPoint[];
    pgs: PGConfig[];
    algorithms: AlgorithmConfig[];
    srChangeEvents: SRChangeEvent[];
    latestMetrics?: TickMetrics | null;
}

const STROKE_DASHARRAY: Record<string, string> = {
    solid: '0',
    dashed: '8 4',
    dotted: '2 4',
};

export default function RoutingShareChart({ data, pgs, algorithms, srChangeEvents, latestMetrics }: Props) {
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    return (
        <div className={`sandbox-chart ${isFullScreen ? 'fullscreen' : ''}`}>
            {isFullScreen && <FullscreenSROverlay latestMetrics={latestMetrics ?? null} algorithms={algorithms} pgs={pgs} />}
            <div className="chart-header-row">
                <h4>Routing Share (%)</h4>
                <button onClick={() => setIsFullScreen(!isFullScreen)} className="chart-fullscreen-btn">
                    {isFullScreen ? '↙️ Minimize' : '↗️ Full Screen'}
                </button>
            </div>
            <div style={{ height: isFullScreen ? 'calc(100vh - 100px)' : '250px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis
                            dataKey="tick"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v: number) => v > 999 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip
                            labelFormatter={(v: number) => `Tick: ${v.toLocaleString()}`}
                            contentStyle={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 8, fontSize: 12 }}
                        />
                        {/* SR change event markers */}
                        {srChangeEvents.map((ev, i) => (
                            <ReferenceLine key={i} x={ev.tick} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
                        ))}
                        {/* Lines for each algo × PG combination */}
                        {algorithms.map(algo =>
                            pgs.map(pg => (
                                <Line
                                    key={`${algo.instanceId}_${pg.pgId}`}
                                    dataKey={`${algo.instanceId}_${pg.pgId}`}
                                    stroke={pg.colour}
                                    strokeWidth={1.5}
                                    strokeDasharray={STROKE_DASHARRAY[algo.lineStyle]}
                                    dot={false}
                                    name={`${algo.displayName} → ${pg.name}`}
                                    isAnimationActive={false}
                                />
                            ))
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

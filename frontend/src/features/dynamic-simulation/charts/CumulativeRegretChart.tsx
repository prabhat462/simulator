/**
 * CumulativeRegretChart — shows cumulative regret for each algorithm over time.
 */

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlgorithmConfig, SRChangeEvent } from '../types';
import { ChartDataPoint } from '../hooks/useChartData';

interface Props {
    data: ChartDataPoint[];
    algorithms: AlgorithmConfig[];
    srChangeEvents: SRChangeEvent[];
}

const ALGO_COLOURS = ['#6366f1', '#f43f5e', '#10b981'];
const STROKE_DASHARRAY: Record<string, string> = {
    solid: '0',
    dashed: '8 4',
    dotted: '2 4',
};

export default function CumulativeRegretChart({ data, algorithms, srChangeEvents }: Props) {
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    return (
        <div className={`sandbox-chart ${isFullScreen ? 'fullscreen' : ''}`}>
            <div className="chart-header-row">
                <h4>Cumulative Regret</h4>
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
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                            labelFormatter={(v: number) => `Tick: ${v.toLocaleString()}`}
                            contentStyle={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 8, fontSize: 12 }}
                        />
                        {srChangeEvents.map((ev, i) => (
                            <ReferenceLine key={i} x={ev.tick} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
                        ))}
                        {algorithms.map((algo, i) => (
                            <Line
                                key={algo.instanceId}
                                dataKey={algo.instanceId}
                                stroke={ALGO_COLOURS[i % ALGO_COLOURS.length]}
                                strokeWidth={1.5}
                                strokeDasharray={STROKE_DASHARRAY[algo.lineStyle]}
                                dot={false}
                                name={`${algo.displayName} regret`}
                                isAnimationActive={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

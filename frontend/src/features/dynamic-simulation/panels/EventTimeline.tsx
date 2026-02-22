/**
 * EventTimeline — horizontal strip showing all simulation events.
 */

import React from 'react';
import { SimulationEvent } from '../types';

interface Props {
    events: SimulationEvent[];
    currentTick: number;
}

export default function EventTimeline({ events, currentTick }: Props) {
    if (events.length === 0) return null;

    const maxTick = Math.max(currentTick, 1);

    const eventColors: Record<string, string> = {
        start: '#3b82f6',
        pause: '#8b5cf6',
        resume: '#3b82f6',
        sr_change: '#ef4444',
        convergence: '#10b981',
        reset: '#6b7280',
        auto_event: '#f59e0b',
    };

    const eventIcons: Record<string, string> = {
        start: '▶',
        pause: '⏸',
        resume: '▶',
        sr_change: '⚡',
        convergence: '✅',
        reset: '⏹',
        auto_event: '🔄',
    };

    return (
        <div className="sandbox-panel event-timeline">
            <div className="timeline-track">
                {events.map((event, i) => {
                    const leftPct = Math.min(95, (event.tick / maxTick) * 100);
                    return (
                        <div
                            key={i}
                            className={`timeline-event event-${event.type}`}
                            style={{
                                left: `${leftPct}%`,
                                borderColor: eventColors[event.type] || '#6b7280',
                            }}
                            title={`T=${event.tick.toLocaleString()} — ${event.details || event.type}`}
                        >
                            <span className="timeline-icon" style={{ color: eventColors[event.type] }}>
                                {eventIcons[event.type]}
                            </span>
                            <span className="timeline-label">
                                T={event.tick > 999 ? `${(event.tick / 1000).toFixed(1)}k` : event.tick}
                            </span>
                        </div>
                    );
                })}
                {/* Current position marker */}
                <div
                    className="timeline-cursor"
                    style={{ left: `${Math.min(98, (currentTick / maxTick) * 100)}%` }}
                />
            </div>
        </div>
    );
}

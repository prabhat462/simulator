/**
 * PGConfigPanel — configure 2–10 payment gateways with names and initial SR.
 */

import React from 'react';
import { PGConfig, PG_COLOURS } from '../types';

interface Props {
    pgs: PGConfig[];
    onChange: (pgs: PGConfig[]) => void;
    disabled: boolean;
}

export default function PGConfigPanel({ pgs, onChange, disabled }: Props) {

    const addPG = () => {
        if (pgs.length >= 10) return;
        const idx = pgs.length;
        const letter = String.fromCharCode(65 + idx);
        onChange([...pgs, {
            pgId: `pg_${letter.toLowerCase()}`,
            name: `PG-${letter}`,
            initialSR: 0.80 - idx * 0.05,
            colour: PG_COLOURS[idx % PG_COLOURS.length],
            noiseStd: 0.02,
        }]);
    };

    const removePG = (index: number) => {
        if (pgs.length <= 2) return;
        onChange(pgs.filter((_, i) => i !== index));
    };

    const updatePG = (index: number, updates: Partial<PGConfig>) => {
        const newPGs = [...pgs];
        newPGs[index] = { ...newPGs[index], ...updates };
        onChange(newPGs);
    };

    const getSRColor = (sr: number): string => {
        if (sr >= 0.80) return '#10b981';
        if (sr >= 0.50) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="sandbox-panel pg-config-panel">
            <div className="panel-header">
                <h3>Payment Gateways</h3>
                <button
                    className="btn-add-pg"
                    onClick={addPG}
                    disabled={disabled || pgs.length >= 10}
                    title={pgs.length >= 10 ? 'Max 10 gateways' : 'Add gateway'}
                >
                    + Add PG
                </button>
            </div>

            <div className="pg-list">
                {pgs.map((pg, idx) => (
                    <div key={pg.pgId} className="pg-card">
                        <div className="pg-card-header">
                            <span
                                className="pg-colour-dot"
                                style={{ backgroundColor: pg.colour }}
                            />
                            <input
                                className="pg-name-input"
                                value={pg.name}
                                onChange={e => updatePG(idx, { name: e.target.value.slice(0, 20) })}
                                disabled={disabled}
                                maxLength={20}
                            />
                            <button
                                className="btn-remove-pg"
                                onClick={() => removePG(idx)}
                                disabled={disabled || pgs.length <= 2}
                                title="Remove"
                            >
                                🗑
                            </button>
                        </div>

                        <div className="pg-sr-row">
                            <label>Initial SR</label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={Math.round(pg.initialSR * 100)}
                                onChange={e => updatePG(idx, { initialSR: Number(e.target.value) / 100 })}
                                disabled={disabled}
                                className="sr-slider"
                                style={{
                                    accentColor: pg.colour,
                                }}
                            />
                            <span
                                className="sr-value"
                                style={{ color: getSRColor(pg.initialSR) }}
                            >
                                {Math.round(pg.initialSR * 100)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pg-footer">
                <span className="pg-count">{pgs.length}/10 gateways</span>
            </div>
        </div>
    );
}

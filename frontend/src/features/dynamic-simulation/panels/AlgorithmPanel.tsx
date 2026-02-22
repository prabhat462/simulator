/**
 * AlgorithmPanel — select up to 3 algorithms with configurable hyperparameters.
 */

import React from 'react';
import { AlgorithmConfig, ALGORITHM_LINE_STYLES } from '../types';
import { SlidingWindowUCB } from '../algorithms/sw_ucb';
import { ThompsonSampling } from '../algorithms/thompson';
import { DiscountedUCB } from '../algorithms/d_ucb';
import { EpsilonGreedy } from '../algorithms/epsilon_greedy';
import { RoundRobin } from '../algorithms/round_robin';
import { HybridEnsemble } from '../algorithms/hybrid_ensemble';
import { AdvancedSlidingWindowUCB } from '../algorithms/advanced_sw_ucb';
import type { BaseAlgorithm } from '../algorithms/base';

interface AlgoDef {
    id: string;
    factory: () => BaseAlgorithm;
}

const AVAILABLE_ALGORITHMS: AlgoDef[] = [
    { id: 'sw_ucb', factory: () => new SlidingWindowUCB() },
    { id: 'advanced_sw_ucb', factory: () => new AdvancedSlidingWindowUCB() },
    { id: 'thompson', factory: () => new ThompsonSampling() },
    { id: 'd_ucb', factory: () => new DiscountedUCB() },
    { id: 'epsilon_greedy', factory: () => new EpsilonGreedy() },
    { id: 'round_robin', factory: () => new RoundRobin() },
    { id: 'hybrid_ensemble', factory: () => new HybridEnsemble() },
];

function getAlgoInstance(id: string): BaseAlgorithm {
    return AVAILABLE_ALGORITHMS.find(a => a.id === id)!.factory();
}

interface Props {
    algorithms: AlgorithmConfig[];
    onChange: (algos: AlgorithmConfig[]) => void;
    disabled: boolean;
}

let instanceCounter = 0;

export default function AlgorithmPanel({ algorithms, onChange, disabled }: Props) {

    const toggleAlgorithm = (algoId: string) => {
        const existing = algorithms.find(a => a.algorithmId === algoId);
        if (existing) {
            onChange(algorithms.filter(a => a.instanceId !== existing.instanceId));
        } else {
            if (algorithms.length >= 3) return;
            const instance = getAlgoInstance(algoId);
            const meta = instance.metadata();
            const schema = instance.getHyperparameterSchema();
            const defaults: Record<string, number> = {};
            for (const [key, spec] of Object.entries(schema)) {
                defaults[key] = spec.default;
            }
            instanceCounter++;
            onChange([...algorithms, {
                algorithmId: algoId,
                instanceId: `${algoId}_${instanceCounter}`,
                displayName: meta.shortName,
                hyperparameters: defaults,
                lineStyle: ALGORITHM_LINE_STYLES[algorithms.length] ?? 'solid',
            }]);
        }
    };

    const updateHyperparam = (instanceId: string, key: string, value: number) => {
        onChange(algorithms.map(a =>
            a.instanceId === instanceId
                ? { ...a, hyperparameters: { ...a.hyperparameters, [key]: value } }
                : a
        ));
    };

    const LINE_STYLE_LABELS: Record<string, string> = {
        solid: '━━━', dashed: '╌╌╌', dotted: '···',
    };

    return (
        <div className="sandbox-panel algorithm-panel">
            <div className="panel-header">
                <h3>Algorithms</h3>
                <span className="algo-count">{algorithms.length}/3</span>
            </div>

            <div className="algo-list">
                {AVAILABLE_ALGORITHMS.map(algoDef => {
                    const instance = algoDef.factory();
                    const meta = instance.metadata();
                    const schema = instance.getHyperparameterSchema();
                    const selected = algorithms.find(a => a.algorithmId === algoDef.id);
                    const isSelected = !!selected;

                    return (
                        <div key={algoDef.id} className={`algo-card ${isSelected ? 'selected' : ''}`}>
                            <div className="algo-card-header">
                                <label className="algo-toggle">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleAlgorithm(algoDef.id)}
                                        disabled={disabled || (!isSelected && algorithms.length >= 3)}
                                    />
                                    <span className="algo-name">{meta.name}</span>
                                </label>
                                {isSelected && (
                                    <span className="algo-line-style" title={`Line: ${selected!.lineStyle}`}>
                                        {LINE_STYLE_LABELS[selected!.lineStyle]}
                                    </span>
                                )}
                            </div>

                            {isSelected && Object.keys(schema).length > 0 && (
                                <div className="algo-params">
                                    {Object.entries(schema).map(([key, spec]) => (
                                        <div key={key} className="param-row">
                                            <label title={spec.description}>{key.replace(/_/g, ' ')}</label>
                                            <input
                                                type="range"
                                                min={spec.min}
                                                max={spec.max}
                                                step={spec.step ?? (spec.type === 'integer' ? 1 : 0.01)}
                                                value={selected!.hyperparameters[key] ?? spec.default}
                                                onChange={e => updateHyperparam(selected!.instanceId, key, Number(e.target.value))}
                                                disabled={disabled}
                                            />
                                            <span className="param-value">
                                                {selected!.hyperparameters[key] ?? spec.default}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="algo-meta">
                                {meta.paper && (
                                    <a href={meta.paperUrl} target="_blank" rel="noopener noreferrer" className="algo-paper">
                                        📄 {meta.paper}
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

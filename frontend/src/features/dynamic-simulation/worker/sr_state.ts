/**
 * SRState — manages ground truth SR for each PG.
 * SR changes are staged during pause and applied atomically at resume.
 */

import { SRChangeEvent } from '../types';

let eventCounter = 0;

export class SRState {
    currentSR: Record<string, number> = {};
    stagedChanges: Record<string, number> = {};
    changeHistory: SRChangeEvent[] = [];

    initialize(pgSRs: Record<string, number>): void {
        this.currentSR = { ...pgSRs };
        this.stagedChanges = {};
        this.changeHistory = [];
        eventCounter = 0;
    }

    stageChanges(changes: Record<string, number>): void {
        this.stagedChanges = { ...changes };
    }

    applyStagedChanges(tick: number): SRChangeEvent[] {
        const events: SRChangeEvent[] = [];
        for (const [pgId, newSR] of Object.entries(this.stagedChanges)) {
            const oldSR = this.currentSR[pgId];
            if (oldSR !== undefined && Math.abs(oldSR - newSR) > 0.001) {
                this.currentSR[pgId] = newSR;
                const event: SRChangeEvent = {
                    eventId: `sr_event_${++eventCounter}`,
                    tick,
                    pgId,
                    oldSR,
                    newSR,
                    deltaPP: Math.round((newSR - oldSR) * 100),
                    triggeredBy: 'user',
                };
                events.push(event);
                this.changeHistory.push(event);
            }
        }
        this.stagedChanges = {};
        return events;
    }

    /** Apply auto-scenario events */
    applyAutoEvent(tick: number, changes: Record<string, number>): SRChangeEvent[] {
        const events: SRChangeEvent[] = [];
        for (const [pgId, newSR] of Object.entries(changes)) {
            const oldSR = this.currentSR[pgId];
            if (oldSR !== undefined) {
                this.currentSR[pgId] = newSR;
                const event: SRChangeEvent = {
                    eventId: `sr_event_${++eventCounter}`,
                    tick,
                    pgId,
                    oldSR,
                    newSR,
                    deltaPP: Math.round((newSR - oldSR) * 100),
                    triggeredBy: 'auto_scenario',
                };
                events.push(event);
                this.changeHistory.push(event);
            }
        }
        return events;
    }

    getOptimalSR(): number {
        const values = Object.values(this.currentSR);
        return values.length > 0 ? Math.max(...values) : 0;
    }

    getTrueSR(pgId: string): number {
        return this.currentSR[pgId] ?? 0;
    }
}

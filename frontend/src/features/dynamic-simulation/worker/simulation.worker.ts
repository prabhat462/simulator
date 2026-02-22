/**
 * Simulation Web Worker — entry point.
 * Handles messages from the main thread and delegates to SimulationLoop.
 */

import { WorkerCommand } from '../types';
import { SimulationLoop } from './simulation_loop';

const loop = new SimulationLoop((msg) => {
    self.postMessage(msg);
});

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
    const cmd = e.data;

    switch (cmd.type) {
        case 'START':
            loop.start(cmd.config);
            break;

        case 'PAUSE':
            loop.pause();
            break;

        case 'RESUME':
            loop.resume(cmd.stagedChanges);
            break;

        case 'RESET':
            loop.reset();
            break;

        case 'SET_SPEED':
            loop.setSpeed(cmd.tps);
            break;

        case 'STEP_ONE':
            loop.stepOne(cmd.stagedChanges);
            break;
    }
};

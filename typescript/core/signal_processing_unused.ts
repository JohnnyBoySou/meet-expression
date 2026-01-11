/**
 * Signal processing utilities for face expression analysis
 * Implements rolling baseline and temporal derivative calculations
 */

/**
 * Circular buffer implementation with max length
 */
function createCircularBuffer(maxSize: number) {
  const buffer: number[] = [];

  return {
    append(value: number): void {
      if (buffer.length >= maxSize) {
        buffer.shift();
      }
      buffer.push(value);
    },
    get length(): number {
      return buffer.length;
    },
    get values(): readonly number[] {
      return buffer;
    },
    clear(): void {
      buffer.length = 0;
    },
  };
}

export interface RollingBaseline {
  update(value: number): void;
  getDeviation(currentValue: number): number;
  isReady(): boolean;
  getReady(): boolean;
}

/**
 * Creates a rolling baseline calculator
 * Calculates rolling average of the last N frames to define individual 'Zero' baseline
 */
export function createRollingBaseline(windowSize: number = 150): RollingBaseline {
  const buffer = createCircularBuffer(windowSize);
  let ready = false;

  return {
    update(value: number): void {
      buffer.append(value);
      if (buffer.length >= windowSize) {
        ready = true;
      }
    },
    getDeviation(currentValue: number): number {
      const values = buffer.values;
      if (values.length === 0) return 0.0;

      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      return currentValue - avg;
    },
    isReady(): boolean {
      return buffer.length > (windowSize * 0.3);
    },
    getReady(): boolean {
      return ready;
    },
  };
}

export interface TemporalDerivative {
  process(value: number, timestamp: number): [number, number];
}

/**
 * Creates a temporal derivative calculator
 * Calculates Velocity and Acceleration based on a short buffer
 * Essential for detecting microexpression 'Onset' (attack)
 */
export function createTemporalDerivative(bufferSize: number = 5): TemporalDerivative {
  const history = createCircularBuffer(bufferSize);
  const timestamps = createCircularBuffer(bufferSize);

  return {
    process(value: number, timestamp: number): [number, number] {
      history.append(value);
      timestamps.append(timestamp);

      const values = history.values;
      const times = timestamps.values;

      if (values.length < 3) {
        return [0.0, 0.0]; // Not enough data for acceleration
      }

      // Get the 3 most recent points
      const y3 = values[values.length - 1]!; // Current
      const y2 = values[values.length - 2]!; // Previous
      const y1 = values[values.length - 3]!; // Two before

      const t3 = times[times.length - 1]!;
      const t2 = times[times.length - 2]!;
      const t1 = times[times.length - 3]!;

      // Avoid division by zero
      const dt1 = Math.max(t2 - t1, 0.001);
      const dt2 = Math.max(t3 - t2, 0.001);

      // Velocity (First Derivative)
      const v1 = (y2 - y1) / dt1;
      const v2 = (y3 - y2) / dt2;

      // Acceleration (Second Derivative)
      // How fast did the velocity change?
      const accel = (v2 - v1) / dt2;

      return [v2, accel];
    },
  };
}

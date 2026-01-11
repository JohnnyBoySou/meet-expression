/**
 * Time Series Analyzer
 * Stores 4 seconds of history to differentiate:
 * - Noise (< 40ms)
 * - Microexpression (40ms - 500ms)
 * - Macroexpression (> 500ms)
 */

import type { ActionUnits } from "../types/index";

/**
 * Circular buffer implementation with max length
 */
function createLimitedArray<T>(maxSize: number) {
  const buffer: T[] = [];

  return {
    append(value: T): void {
      if (buffer.length >= maxSize) {
        buffer.shift();
      }
      buffer.push(value);
    },
    get length(): number {
      return buffer.length;
    },
    get values(): readonly T[] {
      return buffer;
    },
    toArray(): T[] {
      return [...buffer];
    },
  };
}

export type ExpressionClassification = "MICRO" | "MACRO" | "ANALISANDO..." | null;

export interface TimeSeriesAnalyzer {
  update(currentAus: ActionUnits): void;
  getClassification(auName: string, threshold?: number): ExpressionClassification;
  getBuffer(auName: string): readonly number[] | null;
  clear(): void;
}

/**
 * Creates a time series analyzer
 */
export function createTimeSeriesAnalyzer(
  bufferDuration: number = 4.0,
  fps: number = 30
): TimeSeriesAnalyzer {
  const maxlen = Math.floor(bufferDuration * fps); // Ex: 120 frames
  // Buffer for each AU: {'AU4': LimitedArray<number>, 'AU12': LimitedArray<number>}
  const buffers = new Map<string, ReturnType<typeof createLimitedArray<number>>>();

  /**
   * Receives the current frame's AU dictionary and adds to history
   */
  function update(currentAus: ActionUnits): void {
    for (const [au, value] of Object.entries(currentAus)) {
      if (!buffers.has(au)) {
        buffers.set(au, createLimitedArray<number>(maxlen));
      }
      buffers.get(au)!.append(value);
    }
  }

  /**
   * Analyzes the history for a specific AU
   * Returns:
   * - null (Nothing relevant)
   * - "MICRO" (Fast/involuntary expression)
   * - "MACRO" (Sustained/conscious expression)
   */
  function getClassification(
    auName: string,
    threshold: number = 0.35
  ): ExpressionClassification {
    const buffer = buffers.get(auName);
    if (!buffer || buffer.length < 10) {
      return null;
    }

    // Convert to array for analysis
    const data = buffer.toArray();

    // 1. Check if there was any relevant peak in the last 4s
    const peak = Math.max(...data);
    if (peak < threshold) {
      return null;
    }

    // 2. Calculate "Pulse Width" (Duration)
    // How many frames stayed above 60% of max peak?
    // We use 60% to measure width at half height (approximate FWHM)
    const cutLevel = peak * 0.6;
    const framesActive = data.filter((val) => val > cutLevel).length;

    const durationMs = (framesActive / fps) * 1000.0;

    // 3. Temporal Classification
    if (durationMs < 40) {
      return null; // Too fast noise (glitch)
    } else if (40 <= durationMs && durationMs < 500) {
      // If peak already passed (last value is low), confirm it was Micro
      if (data[data.length - 1]! < cutLevel) {
        return "MICRO";
      }
      // If still high, might be becoming Macro... wait.
      return "ANALISANDO...";
    } else {
      // > 500ms
      return "MACRO";
    }
  }

  /**
   * Get current buffer for a specific AU
   */
  function getBuffer(auName: string): readonly number[] | null {
    const buffer = buffers.get(auName);
    return buffer ? buffer.values : null;
  }

  /**
   * Clear all buffers
   */
  function clear(): void {
    buffers.clear();
  }

  return {
    update,
    getClassification,
    getBuffer,
    clear,
  };
}

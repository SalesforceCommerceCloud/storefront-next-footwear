/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface FitFeedback {
    totalResponses: number;
    runsSmallPercent: number;
    trueToSizePercent: number;
    runsLargePercent: number;
}

/**
 * Parses a product's `c_fitFeedback` custom attribute (a JSON-stringified
 * `FitFeedback`). Returns `null` when the attribute is missing, empty, or
 * malformed, or when the percentages don't sum to a sane total — callers
 * must not render the indicator in that case (no shipped static fallback;
 * real cross-brand normalization is out of scope, see WI notes).
 */
export function parseFitFeedback(rawFitFeedback: unknown): FitFeedback | null {
    if (typeof rawFitFeedback !== 'string' || rawFitFeedback.length === 0) return null;

    try {
        const parsed = JSON.parse(rawFitFeedback);
        if (!isFitFeedback(parsed)) return null;
        if (parsed.totalResponses <= 0) return null;

        const sum = parsed.runsSmallPercent + parsed.trueToSizePercent + parsed.runsLargePercent;
        if (sum < 99 || sum > 101) return null;

        return parsed;
    } catch {
        return null;
    }
}

function isFitFeedback(value: unknown): value is FitFeedback {
    if (typeof value !== 'object' || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.totalResponses === 'number' &&
        typeof entry.runsSmallPercent === 'number' &&
        typeof entry.trueToSizePercent === 'number' &&
        typeof entry.runsLargePercent === 'number'
    );
}

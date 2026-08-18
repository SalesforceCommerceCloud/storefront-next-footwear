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
import { describe, it, expect } from 'vitest';
import { parseFitFeedback } from './fit-feedback-data';

describe('parseFitFeedback', () => {
    it('parses valid feedback JSON', () => {
        const raw = JSON.stringify({
            totalResponses: 120,
            runsSmallPercent: 20,
            trueToSizePercent: 65,
            runsLargePercent: 15,
        });
        expect(parseFitFeedback(raw)).toEqual({
            totalResponses: 120,
            runsSmallPercent: 20,
            trueToSizePercent: 65,
            runsLargePercent: 15,
        });
    });

    it('tolerates a rounding-error sum between 99 and 101', () => {
        const raw = JSON.stringify({
            totalResponses: 50,
            runsSmallPercent: 33,
            trueToSizePercent: 33,
            runsLargePercent: 34.5,
        });
        expect(parseFitFeedback(raw)).not.toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(parseFitFeedback(undefined)).toBeNull();
    });

    it('returns null for an empty string', () => {
        expect(parseFitFeedback('')).toBeNull();
    });

    it('returns null for a non-string input', () => {
        expect(parseFitFeedback(42)).toBeNull();
    });

    it('returns null for malformed JSON', () => {
        expect(parseFitFeedback('{not valid json')).toBeNull();
    });

    it('returns null when a required attribute is missing', () => {
        const raw = JSON.stringify({ totalResponses: 10, runsSmallPercent: 20, trueToSizePercent: 80 });
        expect(parseFitFeedback(raw)).toBeNull();
    });

    it('returns null when a field has the wrong type', () => {
        const raw = JSON.stringify({
            totalResponses: '10',
            runsSmallPercent: 20,
            trueToSizePercent: 65,
            runsLargePercent: 15,
        });
        expect(parseFitFeedback(raw)).toBeNull();
    });

    it('returns null when totalResponses is zero', () => {
        const raw = JSON.stringify({
            totalResponses: 0,
            runsSmallPercent: 20,
            trueToSizePercent: 65,
            runsLargePercent: 15,
        });
        expect(parseFitFeedback(raw)).toBeNull();
    });

    it('returns null when totalResponses is negative', () => {
        const raw = JSON.stringify({
            totalResponses: -5,
            runsSmallPercent: 20,
            trueToSizePercent: 65,
            runsLargePercent: 15,
        });
        expect(parseFitFeedback(raw)).toBeNull();
    });

    it('returns null when percentages sum below the 99 tolerance floor', () => {
        const raw = JSON.stringify({
            totalResponses: 10,
            runsSmallPercent: 20,
            trueToSizePercent: 50,
            runsLargePercent: 20,
        });
        expect(parseFitFeedback(raw)).toBeNull();
    });

    it('returns null when percentages sum above the 101 tolerance ceiling', () => {
        const raw = JSON.stringify({
            totalResponses: 10,
            runsSmallPercent: 40,
            trueToSizePercent: 40,
            runsLargePercent: 40,
        });
        expect(parseFitFeedback(raw)).toBeNull();
    });
});

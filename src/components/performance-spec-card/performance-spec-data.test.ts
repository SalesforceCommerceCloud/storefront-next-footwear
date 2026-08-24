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
import { parsePerformanceSpec } from './performance-spec-data';

describe('parsePerformanceSpec', () => {
    it('parses a product with all five attributes present', () => {
        const product = {
            c_cushioning: 'moderate',
            c_heelDrop: 8,
            c_weight: 255,
            c_supportType: 'stability',
            c_terrain: 'road',
        };
        expect(parsePerformanceSpec(product)).toEqual({
            cushioning: 'moderate',
            heelToeDrop: 8,
            weight: 255,
            supportType: 'stability',
            terrain: 'road',
        });
    });

    it('parses partial data — only cushioning present', () => {
        const product = { c_cushioning: 'light' };
        expect(parsePerformanceSpec(product)).toEqual({ cushioning: 'light' });
    });

    it('parses partial data — only heel drop and terrain present', () => {
        const product = { c_heelDrop: 4, c_terrain: 'trail' };
        expect(parsePerformanceSpec(product)).toEqual({ heelToeDrop: 4, terrain: 'trail' });
    });

    it('parses customProperties values, including single-value arrays', () => {
        const product = {
            customProperties: [
                { id: 'c_cushioning', value: ['maximum'] },
                { id: 'c_heelDrop', value: 6 },
                { id: 'c_weight', value: [280] },
                { id: 'c_supportType', value: 'neutral' },
                { id: 'c_terrain', value: ['trail'] },
            ],
        };
        expect(parsePerformanceSpec(product)).toEqual({
            cushioning: 'maximum',
            heelToeDrop: 6,
            weight: 280,
            supportType: 'neutral',
            terrain: 'trail',
        });
    });

    it('prefers defined flat attributes over customProperties values', () => {
        const product = {
            c_terrain: 'road',
            customProperties: [{ id: 'c_terrain', value: 'trail' }],
        };
        expect(parsePerformanceSpec(product)).toEqual({ terrain: 'road' });
    });

    it('drops an individual field with an invalid enum value but keeps the rest', () => {
        const product = { c_cushioning: 'squishy', c_terrain: 'road' };
        expect(parsePerformanceSpec(product)).toEqual({ terrain: 'road' });
    });

    it('drops a non-numeric heelDrop but keeps other valid fields', () => {
        const product = { c_heelDrop: '8mm', c_supportType: 'neutral' };
        expect(parsePerformanceSpec(product)).toEqual({ supportType: 'neutral' });
    });

    it('drops an out-of-range heelDrop', () => {
        const product = { c_heelDrop: 500 };
        expect(parsePerformanceSpec(product)).toBeNull();
    });

    it('drops a negative heelDrop', () => {
        const product = { c_heelDrop: -2 };
        expect(parsePerformanceSpec(product)).toBeNull();
    });

    it('drops a non-positive weight', () => {
        const product = { c_weight: 0 };
        expect(parsePerformanceSpec(product)).toBeNull();
    });

    it('drops an out-of-range weight', () => {
        const product = { c_weight: 5000 };
        expect(parsePerformanceSpec(product)).toBeNull();
    });

    it('returns null when no recognized attributes are present', () => {
        expect(parsePerformanceSpec({})).toBeNull();
    });

    it('returns null when all attributes are invalid', () => {
        const product = {
            c_cushioning: 'extra-plush',
            c_heelDrop: 'unknown',
            c_weight: -10,
            c_supportType: 'extreme',
            c_terrain: 'moon',
        };
        expect(parsePerformanceSpec(product)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(parsePerformanceSpec(undefined)).toBeNull();
    });

    it('returns null for null input', () => {
        expect(parsePerformanceSpec(null)).toBeNull();
    });

    it('returns null for a non-object input', () => {
        expect(parsePerformanceSpec('shoe')).toBeNull();
    });

    it('accepts a heelDrop of zero', () => {
        const product = { c_heelDrop: 0 };
        expect(parsePerformanceSpec(product)).toEqual({ heelToeDrop: 0 });
    });
});

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
import { parseSizeChart, deriveGenderFromCategory, DEFAULT_SIZE_CHARTS } from './size-chart-data';

describe('parseSizeChart', () => {
    it('parses a valid JSON-stringified size chart', () => {
        const raw = JSON.stringify([{ us: '9', uk: '8', eu: '43', cm: '27' }]);
        expect(parseSizeChart(raw, 'mens')).toEqual([{ us: '9', uk: '8', eu: '43', cm: '27' }]);
    });

    it('parses entries that include the optional jp field', () => {
        const raw = JSON.stringify([{ us: '9', uk: '8', eu: '43', cm: '27', jp: '27' }]);
        expect(parseSizeChart(raw, 'mens')).toEqual([{ us: '9', uk: '8', eu: '43', cm: '27', jp: '27' }]);
    });

    it('falls back to the static default when raw value is undefined', () => {
        expect(parseSizeChart(undefined, 'mens')).toBe(DEFAULT_SIZE_CHARTS.mens);
    });

    it('falls back to the static default when raw value is an empty string', () => {
        expect(parseSizeChart('', 'womens')).toBe(DEFAULT_SIZE_CHARTS.womens);
    });

    it('falls back to the static default on malformed JSON', () => {
        expect(parseSizeChart('{not valid json', 'kids')).toBe(DEFAULT_SIZE_CHARTS.kids);
    });

    it('falls back to the static default when parsed value is not an array', () => {
        expect(parseSizeChart(JSON.stringify({ us: '9' }), 'mens')).toBe(DEFAULT_SIZE_CHARTS.mens);
    });

    it('falls back to the static default when an entry is missing a required attribute', () => {
        const raw = JSON.stringify([{ us: '9', uk: '8', eu: '43' }]);
        expect(parseSizeChart(raw, 'mens')).toBe(DEFAULT_SIZE_CHARTS.mens);
    });

    it('falls back to the static default when an entry has the wrong shape', () => {
        const raw = JSON.stringify([{ us: 9, uk: '8', eu: '43', cm: '27' }]);
        expect(parseSizeChart(raw, 'mens')).toBe(DEFAULT_SIZE_CHARTS.mens);
    });

    it('falls back to the static default when the raw value is a non-string type', () => {
        expect(parseSizeChart(42, 'mens')).toBe(DEFAULT_SIZE_CHARTS.mens);
    });
});

describe('deriveGenderFromCategory', () => {
    it('returns mens for an undefined category', () => {
        expect(deriveGenderFromCategory(undefined)).toBe('mens');
    });

    it.each([
        'kids-shoes',
        'junior-footwear',
        'youth-athletic',
        'KIDS-SHOES',
    ])('returns kids for category %s', (categoryId) => {
        expect(deriveGenderFromCategory(categoryId)).toBe('kids');
    });

    it.each(['womens-running', 'womans-boots', 'WOMENS-SHOES'])('returns womens for category %s', (categoryId) => {
        expect(deriveGenderFromCategory(categoryId)).toBe('womens');
    });

    it('returns mens for a category matching neither kids nor womens patterns', () => {
        expect(deriveGenderFromCategory('mens-running')).toBe('mens');
    });

    it('checks womens before mens since womens contains mens as a substring', () => {
        expect(deriveGenderFromCategory('womens-running')).toBe('womens');
    });
});

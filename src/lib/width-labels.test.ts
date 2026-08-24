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
import { describe, expect, test } from 'vitest';
import type { TFunction } from 'i18next';
import { resolveWidthLabel } from './width-labels';

// Stand-in for i18next: resolve every key to its English `defaultValue`, matching how the
// footwear-only keys behave for any locale without a footwear overrides file.
const t = ((_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key) as TFunction<'product'>;

describe('resolveWidthLabel', () => {
    test('maps bare US width codes to spelled-out labels', () => {
        expect(resolveWidthLabel(t, 'B')).toBe('Narrow');
        expect(resolveWidthLabel(t, 'D')).toBe('Standard');
        expect(resolveWidthLabel(t, '2E')).toBe('Wide');
        expect(resolveWidthLabel(t, '4E')).toBe('Extra Wide');
        expect(resolveWidthLabel(t, '6E')).toBe('Extra Extra Wide');
    });

    test('is case-insensitive and trims surrounding whitespace', () => {
        expect(resolveWidthLabel(t, 'd')).toBe('Standard');
        expect(resolveWidthLabel(t, ' D ')).toBe('Standard');
        expect(resolveWidthLabel(t, '2e')).toBe('Wide');
    });

    test('leaves an already spelled-out width name untouched', () => {
        expect(resolveWidthLabel(t, 'Wide')).toBe('Wide');
        expect(resolveWidthLabel(t, 'Medium')).toBe('Medium');
    });

    test('passes an unknown code through unchanged', () => {
        expect(resolveWidthLabel(t, 'XL')).toBe('XL');
    });

    test('returns empty/undefined inputs unchanged so callers keep their own fallback', () => {
        expect(resolveWidthLabel(t, undefined)).toBeUndefined();
        expect(resolveWidthLabel(t, '')).toBe('');
    });
});

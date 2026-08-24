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

/**
 * Footwear overlay of useProductImages: covers the added thumbnail angle-labeling behavior only.
 * Image resolution/filtering itself is exercised by the canonical hook's own test suite.
 *
 * The angle is surfaced only via `thumbnailLabel` (the thumbnail button's accessible name) and is
 * derived exclusively from the merchant's own alt text with boundary-safe matching. The `alt` text
 * itself is always left untouched — no inferred or positional angle is ever written into it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useProductImages, detectAngle } from './use-product-images';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { mockConfig } from '@/test-utils/config';
import type { ShopperProducts } from '@/scapi';

// Drives the hook's active catalog language. `t` echoes the `defaultValue` (as i18next does with no
// footwear override loaded), so the English-label expectations below still hold; only `i18n.language`
// is made controllable, which is what the hook forwards into `detectAngle`.
const langRef = vi.hoisted(() => ({ current: 'en' }));

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
            i18n: { language: langRef.current },
        }),
    };
});

beforeEach(() => {
    langRef.current = 'en';
});

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ConfigProvider, { config: mockConfig, children } as never);

const createMockImage = (link: string, alt?: string): ShopperProducts.schemas['Image'] => ({
    link,
    disBaseLink: link,
    alt,
});

const createMockProduct = (images: ShopperProducts.schemas['Image'][]): ShopperProducts.schemas['Product'] =>
    ({
        id: 'test-shoe',
        name: 'Test Shoe',
        imageGroups: [{ viewType: 'large', images }],
    }) as ShopperProducts.schemas['Product'];

describe('useProductImages (footwear)', () => {
    it('leaves the merchant alt untouched — never folds an inferred angle into it', () => {
        const product = createMockProduct([
            createMockImage('https://example.com/1.jpg', 'Trail runner, heel view'),
            createMockImage('https://example.com/2.jpg', 'Trail runner, front view'),
            createMockImage('https://example.com/3.jpg', 'Trail runner'),
        ]);

        const { result } = renderHook(() => useProductImages({ product }), { wrapper });

        expect(result.current.galleryImages.map((image) => image.alt)).toEqual([
            'Trail runner, heel view',
            'Trail runner, front view',
            'Trail runner',
        ]);
    });

    it('exposes a localized view label as the thumbnail name when the merchant alt names an angle', () => {
        const product = createMockProduct([
            createMockImage('https://example.com/1.jpg', 'Trail runner, front angle'),
            createMockImage('https://example.com/2.jpg', 'Trail runner, side profile'),
            createMockImage('https://example.com/3.jpg', 'Trail runner, heel view'),
            createMockImage('https://example.com/4.jpg', 'Trail runner, outsole close-up'),
        ]);

        const { result } = renderHook(() => useProductImages({ product }), { wrapper });

        // "heel" maps to the Back view; "outsole" to the Sole view — the merchant word is the source.
        expect(result.current.galleryImages.map((image) => image.thumbnailLabel)).toEqual([
            'Front view',
            'Side view',
            'Back view',
            'Sole view',
        ]);
    });

    it('does not infer an angle from keywords embedded in unrelated words', () => {
        const product = createMockProduct([
            createMockImage('https://example.com/1.jpg', 'Inside cushioning detail'),
            createMockImage('https://example.com/2.jpg', 'Feedback technology closeup'),
            createMockImage('https://example.com/3.jpg', 'Runner on treadmill'),
        ]);

        const { result } = renderHook(() => useProductImages({ product }), { wrapper });

        // "Inside"/"Feedback"/"treadmill" must not be read as side/back/sole. With no reliable angle,
        // no thumbnail label is exposed and the alt is preserved verbatim.
        expect(result.current.galleryImages.map((image) => image.thumbnailLabel)).toEqual([
            undefined,
            undefined,
            undefined,
        ]);
        expect(result.current.galleryImages.map((image) => image.alt)).toEqual([
            'Inside cushioning detail',
            'Feedback technology closeup',
            'Runner on treadmill',
        ]);
    });

    it('exposes no angle and falls back to the product name when the merchant supplies no alt', () => {
        const product = createMockProduct([
            createMockImage('https://example.com/1.jpg'),
            createMockImage('https://example.com/2.jpg'),
        ]);

        const { result } = renderHook(() => useProductImages({ product }), { wrapper });

        expect(result.current.galleryImages[0]).toMatchObject({ alt: 'Test Shoe' });
        expect(result.current.galleryImages[0].thumbnailLabel).toBeUndefined();
        expect(result.current.galleryImages[1].thumbnailLabel).toBeUndefined();
    });

    it('never reorders the images themselves while labeling', () => {
        const product = createMockProduct([
            createMockImage('https://example.com/1.jpg', 'Sole tread'),
            createMockImage('https://example.com/2.jpg', 'Front'),
        ]);

        const { result } = renderHook(() => useProductImages({ product }), { wrapper });

        expect(result.current.galleryImages.map((image) => image.src)).toEqual([
            'https://example.com/1.jpg',
            'https://example.com/2.jpg',
        ]);
    });

    it('labels localized alt copy by forwarding the active catalog language into detection', () => {
        // The reported gap: under the English vocabulary an Italian catalog's "Vista laterale" alt
        // exposed no label. With the catalog language wired through, the hook detects the Italian
        // angle and surfaces a label, while alt copy naming no angle ("Dettaglio tessuto") still
        // exposes none. This exercises the hook's `i18n.language -> detectAngle` wiring end to end,
        // not just the vocabulary the standalone `detectAngle` tests cover.
        langRef.current = 'it-IT';
        const product = createMockProduct([
            createMockImage('https://example.com/1.jpg', 'Vista laterale'),
            createMockImage('https://example.com/2.jpg', 'Dettaglio tessuto'),
        ]);

        const { result } = renderHook(() => useProductImages({ product }), { wrapper });

        expect(result.current.galleryImages[0].thumbnailLabel).toBeDefined();
        expect(result.current.galleryImages[1].thumbnailLabel).toBeUndefined();
        // The alt itself is still left exactly as the merchant authored it.
        expect(result.current.galleryImages.map((image) => image.alt)).toEqual(['Vista laterale', 'Dettaglio tessuto']);
    });
});

describe('detectAngle (per-language vocabulary)', () => {
    it('detects angles from English alt copy by default', () => {
        expect(detectAngle('Trail runner, front angle')).toBe('front');
        expect(detectAngle('Trail runner, side profile')).toBe('side');
        expect(detectAngle('Trail runner, heel view')).toBe('back');
        expect(detectAngle('Trail runner, outsole close-up')).toBe('sole');
    });

    it('detects angles from Italian alt copy when the catalog language is Italian', () => {
        expect(detectAngle('Vista frontale', 'it')).toBe('front');
        expect(detectAngle('Vista laterale', 'it')).toBe('side');
        expect(detectAngle('Vista posteriore', 'it')).toBe('back');
        expect(detectAngle('Vista della suola', 'it')).toBe('sole');
    });

    it('surfaces no angle for localized alt copy under the English vocabulary (the reported gap)', () => {
        // Before the fix, detection was English-only, so an Italian catalog's "Vista laterale" alt
        // exposed no thumbnail label. Passing the catalog language is what closes that gap.
        expect(detectAngle('Vista laterale')).toBeUndefined();
    });

    it('falls back to the English vocabulary for a language without its own keywords', () => {
        expect(detectAngle('side profile', 'de')).toBe('side');
    });

    it('preserves boundary-safe matching per language', () => {
        // English substrings that must not trigger a match.
        expect(detectAngle('Inside cushioning detail')).toBeUndefined();
        expect(detectAngle('Runner on treadmill')).toBeUndefined();
        // Italian: "profilo" (side) matches, but only as a whole word.
        expect(detectAngle('profilo laterale', 'it')).toBe('side');
    });

    it('does not match a keyword abutting a precomposed (single-code-point) accent', () => {
        // JavaScript `\b` is ASCII-only, so `\bside\b` would match "side" inside a word carrying an
        // accented neighbour and fabricate a "Side view". A precomposed accent is a single letter
        // (e-acute is U+00E9, e-grave U+00E8), which `\p{L}` in the boundary already blocks, whether it
        // precedes the keyword ("re[side]") or follows it ("[front]e"). Strings are built from code
        // points so the source stays pure ASCII and the literals are guaranteed precomposed (NFC).
        const eAcute = String.fromCodePoint(0x00e9);
        const eGrave = String.fromCodePoint(0x00e8);
        expect(detectAngle(`r${eAcute}side dans la collection`)).toBeUndefined();
        expect(detectAngle(`vue front${eAcute}e du mod${eGrave}le`)).toBeUndefined();
    });

    it('does not match a keyword abutting a decomposed (combining-mark) accent', () => {
        // The same accents decomposed: a base letter followed by a standalone combining mark
        // (U+0301, Unicode category `\p{M}`), not a letter. A letters-only boundary would let "side"
        // match inside "reside"-with-accent and fabricate a "Side view" — the exact regression this
        // guards. `detectAngle` normalizes to NFC (folding "e" + U+0301 into U+00E9) and the boundary
        // class also excludes `\p{M}` for any mark NFC cannot fold. Built from a code point so the
        // source is pure ASCII and no formatter or NFC-normalizing tool can fold these strings back
        // into precomposed form and silently drop the coverage.
        const acute = String.fromCodePoint(0x0301);
        // Leading case: the mark sits between "re" and the keyword "side".
        expect(detectAngle(`re${acute}side dans la collection`)).toBeUndefined();
        // Trailing case: a mark directly follows the keyword. "t" + U+0301 has no precomposed form, so
        // it survives NFC and only the `\p{M}` boundary class rejects it.
        expect(detectAngle(`front${acute} lacing detail`)).toBeUndefined();
    });

    it('returns undefined for absent alt regardless of language', () => {
        expect(detectAngle(undefined, 'it')).toBeUndefined();
        expect(detectAngle('')).toBeUndefined();
    });
});

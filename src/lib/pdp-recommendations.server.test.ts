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
import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { ShopperProducts, ShopperSearch } from '@/scapi';
import { createTestContext } from '@/lib/test-utils';
import { fetchCarouselProducts } from '@/components/product-carousel/loaders';
import {
    getActivityCategoryId,
    fetchActivityCandidatePool,
    deriveActivityMatched,
    derivePerformanceMatched,
} from './pdp-recommendations.server';

vi.mock('@/components/product-carousel/loaders', () => ({
    fetchCarouselProducts: vi.fn(),
}));

const mockFetchCarouselProducts = vi.mocked(fetchCarouselProducts);

function buildProduct(overrides: Partial<ShopperProducts.schemas['Product']> = {}): ShopperProducts.schemas['Product'] {
    return {
        id: 'current-product',
        primaryCategory: {
            id: 'trail-running',
            parentCategoryTree: [{ id: 'activity' }, { id: 'running' }, { id: 'trail-running' }],
        },
        ...overrides,
    } as ShopperProducts.schemas['Product'];
}

function buildHit(overrides: Record<string, unknown> = {}): ShopperSearch.schemas['ProductSearchHit'] {
    return { productId: 'other-product', ...overrides } as ShopperSearch.schemas['ProductSearchHit'];
}

describe('getActivityCategoryId', () => {
    test('returns the activity category directly under the "activity" parent', () => {
        const product = buildProduct({
            primaryCategory: {
                id: 'trail-running',
                parentCategoryTree: [{ id: 'activity' }, { id: 'running' }, { id: 'trail-running' }],
            },
        });
        expect(getActivityCategoryId(product)).toBe('running');
    });

    test("returns the product's own category id when 'activity' is its direct parent", () => {
        const product = buildProduct({
            primaryCategory: { id: 'running', parentCategoryTree: [{ id: 'activity' }, { id: 'running' }] },
        });
        expect(getActivityCategoryId(product)).toBe('running');
    });

    test('returns undefined for products outside the activity tree', () => {
        const product = buildProduct({
            primaryCategory: { id: 'accessories', parentCategoryTree: [{ id: 'accessories' }] },
        });
        expect(getActivityCategoryId(product)).toBeUndefined();
    });

    test('returns undefined when the product has no primary category', () => {
        const product = buildProduct({ primaryCategory: undefined });
        expect(getActivityCategoryId(product)).toBeUndefined();
    });
});

describe('fetchActivityCandidatePool', () => {
    beforeEach(() => {
        mockFetchCarouselProducts.mockReset();
    });

    test('scopes the search to the activity category and forwards the active currency', async () => {
        const product = buildProduct();
        mockFetchCarouselProducts.mockResolvedValue({
            hits: [buildHit({ productId: 'sibling-1' })],
        } as ShopperSearch.schemas['ProductSearchResult']);

        const hits = await fetchActivityCandidatePool(createTestContext({ currency: 'EUR' }), product);

        expect(mockFetchCarouselProducts).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ categoryId: 'running', currency: 'EUR' })
        );
        expect(hits).toHaveLength(1);
    });

    test('returns an empty pool without searching when the product has no activity category', async () => {
        const product = buildProduct({ primaryCategory: undefined });
        const hits = await fetchActivityCandidatePool(createTestContext(), product);

        expect(hits).toEqual([]);
        expect(mockFetchCarouselProducts).not.toHaveBeenCalled();
    });

    test('returns an empty pool when the search fails', async () => {
        mockFetchCarouselProducts.mockRejectedValue(new Error('SCAPI down'));

        const hits = await fetchActivityCandidatePool(createTestContext(), buildProduct());

        expect(hits).toEqual([]);
    });
});

describe('deriveActivityMatched', () => {
    test('excludes the current product from the pool', () => {
        const result = deriveActivityMatched(
            [buildHit({ productId: 'current-product' }), buildHit({ productId: 'sibling-1' })],
            buildProduct()
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('sibling-1');
    });

    test('returns empty when the pool holds no other products', () => {
        const result = deriveActivityMatched([buildHit({ productId: 'current-product' })], buildProduct());
        expect(result).toEqual({});
    });

    test('returns empty for an empty pool', () => {
        expect(deriveActivityMatched([], buildProduct())).toEqual({});
    });

    test('excludes the current shoe on a variant PDP by matching the master sku', () => {
        // Variant PDP: product.id is the selected variant sku, but the category search hit for the
        // same shoe carries the master sku in productId. Master-id matching keeps it out of the rail.
        const product = buildProduct({
            id: 'variant-abc',
            master: { masterId: 'master-123' },
        } as Partial<ShopperProducts.schemas['Product']>);
        const result = deriveActivityMatched(
            [buildHit({ productId: 'master-123' }), buildHit({ productId: 'sibling-1' })],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('sibling-1');
    });

    test('excludes a hit whose represented product maps back to the current variant', () => {
        const product = buildProduct({ id: 'variant-abc' });
        const result = deriveActivityMatched(
            [
                buildHit({ productId: 'master-123', representedProduct: { id: 'variant-abc' } }),
                buildHit({ productId: 'sibling-1' }),
            ],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('sibling-1');
    });

    test('excludes a hit whose representedProducts array contains the current variant', () => {
        const product = buildProduct({ id: 'variant-abc' });
        const result = deriveActivityMatched(
            [
                buildHit({
                    productId: 'master-123',
                    representedProducts: [{ id: 'variant-xyz' }, { id: 'variant-abc' }],
                }),
                buildHit({ productId: 'sibling-1' }),
            ],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('sibling-1');
    });

    test('excludes a variation-group hit when the current variant appears only in its variants[]', () => {
        // Variation-group catalogs: the hit's own productId is the variation-group sku and the viewed
        // variant surfaces only under variants[].productId, so a productId/represented check alone would
        // let the current shoe back into the rail.
        const product = buildProduct({ id: 'variant-abc' });
        const result = deriveActivityMatched(
            [
                buildHit({
                    productId: 'variation-group-123',
                    variants: [{ productId: 'variant-xyz' }, { productId: 'variant-abc' }],
                }),
                buildHit({ productId: 'sibling-1' }),
            ],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('sibling-1');
    });

    test('excludes a hit that lists the current variation group in its variationGroups[]', () => {
        // On a variation-group PDP product.id is the group sku; a master hit that lists that group
        // among its variationGroups is the same shoe and must not appear.
        const product = buildProduct({ id: 'vg-current' });
        const result = deriveActivityMatched(
            [
                buildHit({ productId: 'master-123', variationGroups: [{ productId: 'vg-current' }] }),
                buildHit({ productId: 'sibling-1' }),
            ],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('sibling-1');
    });
});

describe('derivePerformanceMatched', () => {
    test('keeps only hits sharing a performance-spec value with the current product', () => {
        const product = buildProduct({ c_terrain: ['trail'] } as Partial<ShopperProducts.schemas['Product']>);
        const result = derivePerformanceMatched(
            [
                buildHit({ productId: 'matches-terrain', c_terrain: ['trail'] }),
                buildHit({ productId: 'no-overlap', c_terrain: ['road'] }),
                buildHit({ productId: 'current-product', c_terrain: ['trail'] }),
            ],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('matches-terrain');
    });

    test('returns empty when the product has no performance-spec attributes', () => {
        const result = derivePerformanceMatched([buildHit({ c_terrain: ['trail'] })], buildProduct());
        expect(result).toEqual({});
    });

    test('returns empty when no pool hit matches a performance spec', () => {
        const product = buildProduct({ c_terrain: ['trail'] } as Partial<ShopperProducts.schemas['Product']>);
        const result = derivePerformanceMatched([buildHit({ productId: 'no-overlap', c_terrain: ['road'] })], product);
        expect(result).toEqual({});
    });

    test('matches performance specs carried in the customProperties array shape', () => {
        // Raw Shopper Search hits expose custom attributes as flat c_* keys, but the product-content
        // adapter shape carries them as customProperties: [{ id, value }]. The read tolerates both, so
        // a hit whose specs arrive in the array form still matches rather than emptying the rail.
        const product = buildProduct({
            customProperties: [{ id: 'c_terrain', value: ['trail'] }],
        } as Partial<ShopperProducts.schemas['Product']>);
        const result = derivePerformanceMatched(
            [
                buildHit({ productId: 'array-shape', customProperties: [{ id: 'c_terrain', value: 'trail' }] }),
                buildHit({ productId: 'no-overlap', customProperties: [{ id: 'c_terrain', value: 'road' }] }),
            ],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('array-shape');
    });

    test("excludes the current shoe's master hit on a variant PDP even when it shares a spec", () => {
        const product = buildProduct({
            id: 'variant-abc',
            master: { masterId: 'master-123' },
            c_terrain: ['trail'],
        } as Partial<ShopperProducts.schemas['Product']>);
        const result = derivePerformanceMatched(
            [
                buildHit({ productId: 'master-123', c_terrain: ['trail'] }),
                buildHit({ productId: 'sibling-1', c_terrain: ['trail'] }),
            ],
            product
        );

        expect(result.recs).toHaveLength(1);
        expect(result.recs?.[0].productId).toBe('sibling-1');
    });
});

describe('shared candidate pool', () => {
    beforeEach(() => {
        mockFetchCarouselProducts.mockReset();
    });

    test('derives both rails from a single SCAPI search', async () => {
        const product = buildProduct({ c_terrain: ['trail'] } as Partial<ShopperProducts.schemas['Product']>);
        mockFetchCarouselProducts.mockResolvedValue({
            hits: [
                buildHit({ productId: 'sibling-1', c_terrain: ['trail'] }),
                buildHit({ productId: 'sibling-2', c_terrain: ['road'] }),
            ],
        } as unknown as ShopperSearch.schemas['ProductSearchResult']);

        const pool = await fetchActivityCandidatePool(createTestContext(), product);
        const activityMatched = deriveActivityMatched(pool, product);
        const performanceMatched = derivePerformanceMatched(pool, product);

        expect(mockFetchCarouselProducts).toHaveBeenCalledTimes(1);
        expect(activityMatched.recs).toHaveLength(2);
        expect(performanceMatched.recs).toHaveLength(1);
        expect(performanceMatched.recs?.[0].productId).toBe('sibling-1');
    });
});

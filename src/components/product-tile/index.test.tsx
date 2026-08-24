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
import type React from 'react';
import { vi, test, describe, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ProductTile } from './index';
import type { ShopperSearch } from '@/scapi';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { masterProduct } from '@/components/__mocks__/master-variant-product';

// Mock only the network boundary, matching the canonical product-tile test's approach.
vi.mock('@/hooks/use-scapi-fetcher', () => ({
    useScapiFetcher: () => ({
        load: vi.fn().mockResolvedValue(undefined),
        data: masterProduct,
        state: 'idle',
        success: true,
    }),
}));

vi.mock('@/providers/wishlist', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/providers/wishlist')>();
    return { ...actual, useWishlistLoader: () => vi.fn() };
});

// @sfdc-extension-block-start SFDC_EXT_RATINGS_REVIEWS
vi.mock('@/extensions/ratings-reviews/providers/product-reviews-context', () => ({
    ProductReviewsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useProductReviews: () => ({
        reviewsSummary: null,
        reviewsSummaryLoading: false,
        reviews: [],
        reviewsLoading: false,
        loadReviewsIfNeeded: () => {},
        aiSummary: '',
        addReviewOptimistic: () => {},
        removeReviewOptimistic: () => {},
        expandReviews: () => {},
        registerExpand: () => {},
        registerOnExpanded: () => {},
        triggerOnExpanded: () => {},
    }),
}));
// @sfdc-extension-block-end SFDC_EXT_RATINGS_REVIEWS

const baseProduct: ShopperSearch.schemas['ProductSearchHit'] = {
    productId: 'trail-001',
    productName: 'Trailblazer',
    price: 89.99,
    imageGroups: [
        {
            viewType: 'medium',
            images: [
                {
                    alt: 'Trailblazer',
                    link: 'https://example.com/trailblazer.jpg',
                    disBaseLink: 'https://example.com/trailblazer.jpg',
                },
            ],
        },
    ],
};

const renderTile = (props: Partial<React.ComponentProps<typeof ProductTile>> = {}) => {
    const router = createMemoryRouter(
        [
            {
                path: '/test',
                element: (
                    <AllProvidersWrapper>
                        <ProductTile product={baseProduct} {...props} />
                    </AllProvidersWrapper>
                ),
            },
            { path: '*', element: <div>Navigated</div> },
        ],
        { initialEntries: ['/test'] }
    );
    return render(<RouterProvider router={router} />);
};

describe('Footwear ProductTile — colorway count badge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders the colour count badge when the product has colour variation values', () => {
        const product: ShopperSearch.schemas['ProductSearchHit'] = {
            ...baseProduct,
            variationAttributes: [
                {
                    id: 'color',
                    name: 'Colour',
                    values: [
                        { value: 'BLK', name: 'Black' },
                        { value: 'RED', name: 'Red' },
                    ],
                },
            ],
        };
        renderTile({ product });
        expect(screen.getByText(/2\s*Colou?r/i)).toBeInTheDocument();
    });

    test('does not render the colour count badge when the product has no colour variation values', () => {
        renderTile({ product: baseProduct });
        expect(screen.queryByText(/Colou?r/i)).not.toBeInTheDocument();
    });
});

describe('Footwear ProductTile — product link accessibility', () => {
    test('exposes the visible title link to assistive technology', () => {
        renderTile();
        expect(screen.getAllByRole('link', { name: 'Trailblazer' })).toHaveLength(2);
        expect(screen.getByRole('heading', { name: 'Trailblazer' })).toBeInTheDocument();
    });
});

describe('Footwear ProductTile — Available in Wide badge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders "Available in Wide" when a width value is a wide code', () => {
        const product: ShopperSearch.schemas['ProductSearchHit'] = {
            ...baseProduct,
            variationAttributes: [
                {
                    id: 'width',
                    name: 'Width',
                    values: [
                        { value: 'M', name: 'Medium' },
                        { value: 'W', name: 'Wide', orderable: true },
                    ],
                },
            ],
        };
        renderTile({ product });
        expect(screen.getByText('Available in Wide')).toBeInTheDocument();
    });

    test('does not render "Available in Wide" when no width value is a wide code', () => {
        const product: ShopperSearch.schemas['ProductSearchHit'] = {
            ...baseProduct,
            variationAttributes: [
                {
                    id: 'width',
                    name: 'Width',
                    values: [{ value: 'M', name: 'Medium' }],
                },
            ],
        };
        renderTile({ product });
        expect(screen.queryByText('Available in Wide')).not.toBeInTheDocument();
    });

    test('does not render "Available in Wide" when the only wide value is not orderable', () => {
        const product: ShopperSearch.schemas['ProductSearchHit'] = {
            ...baseProduct,
            variationAttributes: [
                {
                    id: 'width',
                    name: 'Width',
                    values: [{ value: 'W', name: 'Wide', orderable: false }],
                },
            ],
        };
        renderTile({ product });
        expect(screen.queryByText('Available in Wide')).not.toBeInTheDocument();
    });

    // Synthesized-attribute path: hits without top-level `variationAttributes` derive widths from
    // `variants[]`, which keep the per-variant `orderable` the attribute synthesis drops. Read it
    // off the variants so a wide width that is sold out on every variant does not show the badge.
    test('renders "Available in Wide" when a wide variant is orderable and the hit has no variationAttributes', () => {
        const product: ShopperSearch.schemas['ProductSearchHit'] = {
            ...baseProduct,
            variants: [
                { productId: 'trail-001-m', orderable: true, variationValues: { width: 'M' } },
                { productId: 'trail-001-w', orderable: true, variationValues: { width: 'W' } },
            ],
        };
        renderTile({ product });
        expect(screen.getByText('Available in Wide')).toBeInTheDocument();
    });

    test('does not render "Available in Wide" when every wide variant is not orderable (synthesized path)', () => {
        const product: ShopperSearch.schemas['ProductSearchHit'] = {
            ...baseProduct,
            variants: [
                { productId: 'trail-001-m', orderable: true, variationValues: { width: 'M' } },
                { productId: 'trail-001-w', orderable: false, variationValues: { width: 'W' } },
                { productId: 'trail-001-ew', orderable: false, variationValues: { width: 'EW' } },
            ],
        };
        renderTile({ product });
        expect(screen.queryByText('Available in Wide')).not.toBeInTheDocument();
    });
});

describe('Footwear ProductTile — performance badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders terrain, cushioning, and support badges parsed from c_* attributes', () => {
        const product = {
            ...baseProduct,
            c_terrain: 'trail',
            c_cushioning: 'maximum',
            c_supportType: 'stability',
        } as unknown as ShopperSearch.schemas['ProductSearchHit'];
        renderTile({ product });
        expect(screen.getByText('Terrain: Trail')).toBeInTheDocument();
        expect(screen.getByText('Cushioning: Maximum')).toBeInTheDocument();
        expect(screen.getByText('Support: Stability')).toBeInTheDocument();
    });

    test('renders no performance badges when the product has no c_* performance attributes', () => {
        renderTile({ product: baseProduct });
        expect(screen.queryByText('Trail')).not.toBeInTheDocument();
        expect(screen.queryByText('Maximum')).not.toBeInTheDocument();
        expect(screen.queryByText('Stability')).not.toBeInTheDocument();
    });
});

describe('Footwear ProductTile — "Starting at" price prefix', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders the "Starting at" prefix for a master product with multiple variants', () => {
        const product: ShopperSearch.schemas['ProductSearchHit'] = {
            ...baseProduct,
            hitType: 'master',
            productType: { master: true },
            representedProduct: { id: 'trail-001-blk' },
            variants: [
                { productId: 'trail-001-blk', price: 89.99, variationValues: { color: 'BLK' } },
                { productId: 'trail-001-red', price: 99.99, variationValues: { color: 'RED' } },
            ],
        };
        renderTile({ product });
        expect(screen.getByText('Starting at')).toBeInTheDocument();
    });

    test('does not render the "Starting at" prefix for a single-price product', () => {
        renderTile({ product: baseProduct });
        expect(screen.queryByText('Starting at')).not.toBeInTheDocument();
    });
});

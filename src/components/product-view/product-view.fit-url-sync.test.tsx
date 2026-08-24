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
// The footwear PDP overlay treats size and width as URL state and colorway as local state: 'color'
// is the only controlled attribute, so size/width selections fall through to navigate() while a
// colorway change is handled by the parent without navigating. This split is what lets a refresh,
// a shared link, or the browser back button restore the exact fit, while switching colors keeps the
// gallery and availability in sync without a page navigation. These tests lock that contract.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, test, vi } from 'vitest';
import type { ShopperProducts } from '@/scapi';
import ProductView from '@/components/product-view';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { masterProduct } from '@/components/__mocks__/master-variant-product';

vi.mock('@/components/image-gallery', () => ({
    default: () => <div data-testid="image-gallery" />,
}));

// The overlay runs its own per-SKU availability fetch. These tests care only about navigation, so
// stub a benign in-stock response for whichever variant is selected.
vi.mock('@/hooks/use-scapi-fetcher', () => ({
    useScapiFetcher: (_client: string, _method: string, options: { params: { path: { id: string } } }) => ({
        data: { id: options.params.path.id, inventory: { ats: 25, id: 'site', orderable: true, stockLevel: 25 } },
        errors: undefined,
        load: vi.fn(),
        state: 'idle',
        success: true,
    }),
}));

// Two colorways, and a full 2x2 size/width grid for BLUE so both sizes and both widths are orderable
// at the initial selection (color=BLUE, size=038, width=D). RED carries a single orderable variant so
// it renders as a selectable second colorway to click.
const product = {
    ...masterProduct,
    imageGroups: ['small', 'large'].flatMap((viewType) =>
        ['BLUE', 'RED'].map((color) => ({
            viewType,
            variationAttributes: [{ id: 'color', values: [{ value: color }] }],
            images: [{ alt: `${color} ${viewType}`, link: `https://example.com/${color}-${viewType}.jpg` }],
        }))
    ),
    variationAttributes: [
        {
            id: 'color',
            name: 'Color',
            values: [
                { name: 'Blue', value: 'BLUE' },
                { name: 'Red', value: 'RED' },
            ],
        },
        {
            id: 'size',
            name: 'Size',
            values: [
                { name: '38', value: '038' },
                { name: '40', value: '040' },
            ],
        },
        // Bare US width codes; the overlay maps D -> "Standard" and 2E -> "Wide" for display.
        { id: 'width', name: 'Width', values: [{ value: 'D' }, { value: '2E' }] },
    ],
    variants: [
        {
            productId: 'blue-38-d',
            orderable: true,
            price: 129,
            variationValues: { color: 'BLUE', size: '038', width: 'D' },
        },
        {
            productId: 'blue-40-d',
            orderable: true,
            price: 129,
            variationValues: { color: 'BLUE', size: '040', width: 'D' },
        },
        {
            productId: 'blue-38-2e',
            orderable: true,
            price: 129,
            variationValues: { color: 'BLUE', size: '038', width: '2E' },
        },
        {
            productId: 'blue-40-2e',
            orderable: true,
            price: 129,
            variationValues: { color: 'BLUE', size: '040', width: '2E' },
        },
        {
            productId: 'red-38-d',
            orderable: true,
            price: 129,
            variationValues: { color: 'RED', size: '038', width: 'D' },
        },
    ],
} as ShopperProducts.schemas['Product'];

const INITIAL_SEARCH = '?color=BLUE&size=038&width=D';

const renderOverlay = () => {
    const router = createMemoryRouter(
        [
            {
                path: '/:siteId/:localeId/product/:productId',
                element: (
                    <AllProvidersWrapper>
                        <ProductView product={product} />
                    </AllProvidersWrapper>
                ),
            },
        ],
        { initialEntries: [`/global/en-GB/product/test-product${INITIAL_SEARCH}`] }
    );
    return { router, ...render(<RouterProvider router={router} />) };
};

describe('Footwear PDP fit selection URL sync', () => {
    test('selecting a size updates the URL (so refresh/shared links restore the fit)', async () => {
        const user = userEvent.setup();
        const { router } = renderOverlay();

        await user.click(await screen.findByRole('radio', { name: /size 40, available/i }));

        await waitFor(() => {
            const params = new URLSearchParams(router.state.location.search);
            expect(params.get('size')).toBe('040');
            // The locally selected colorway rides along on the navigation.
            expect(params.get('color')).toBe('BLUE');
        });
    });

    test('selecting a width updates the URL (so refresh/shared links restore the fit)', async () => {
        const user = userEvent.setup();
        const { router } = renderOverlay();

        await user.click(await screen.findByRole('radio', { name: /^wide$/i }));

        await waitFor(() => {
            const params = new URLSearchParams(router.state.location.search);
            expect(params.get('width')).toBe('2E');
            expect(params.get('color')).toBe('BLUE');
        });
    });

    test('selecting a colorway stays local and does not change the URL', async () => {
        const user = userEvent.setup();
        const { router } = renderOverlay();
        const searchBefore = router.state.location.search;

        const colorways = within(screen.getByTestId('colorway-strip-list'));
        expect(colorways.getByRole('radio', { name: /^blue$/i })).toBeChecked();

        await user.click(colorways.getByRole('radio', { name: /^red$/i }));

        // The selection flips in place...
        await waitFor(() => {
            expect(colorways.getByRole('radio', { name: /^red$/i })).toBeChecked();
        });
        // ...without navigating: the URL is untouched.
        expect(router.state.location.search).toBe(searchBefore);
    });
});

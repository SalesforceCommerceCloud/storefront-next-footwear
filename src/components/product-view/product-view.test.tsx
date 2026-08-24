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
// The footwear PDP resolves the selected colorway/size/width SKU client-side and fetches its
// authoritative availability itself (no navigation, so the loader never re-fetches the SKU and the
// route product stays the master). A 200 for that fetch can legitimately omit the site inventory or
// the requested store when the SKU has no record there. These tests lock the rule that such gaps are
// treated as "unavailable for this SKU" and never silently borrow the master product's availability,
// which would re-enable delivery, pickup, or Add to Cart for a SKU with no inventory.
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ShopperProducts } from '@/scapi';
import ProductView from '@/components/product-view';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { masterProduct } from '@/components/__mocks__/master-variant-product';
import StoreLocatorProvider from '@/extensions/store-locator/providers/store-locator';

const SELECTED_STORE_INVENTORY_ID = 'store-a-inventory';

// Controls what the selected-SKU availability fetch returns. `null` omits the field entirely, the way
// SCAPI drops `inventory` / `inventories` when the SKU has no record at the site or requested store.
let variantSiteInventory: ShopperProducts.schemas['Inventory'] | null;
let variantStoreInventories: ShopperProducts.schemas['Inventory'][] | null;

vi.mock('@/components/image-gallery', () => ({
    default: () => <div data-testid="image-gallery" />,
}));

vi.mock('@/hooks/use-scapi-fetcher', () => ({
    useScapiFetcher: (_client: string, _method: string, options: { params: { path: { id: string } } }) => {
        const variantId = options.params.path.id;
        const data: Record<string, unknown> = { id: variantId };
        if (variantSiteInventory !== null) data.inventory = variantSiteInventory;
        if (variantStoreInventories !== null) data.inventories = variantStoreInventories;
        return {
            data,
            errors: undefined,
            load: vi.fn(),
            state: 'idle',
            success: true,
        };
    },
}));

const blueImageGroups = ['small', 'large'].map((viewType) => ({
    viewType,
    variationAttributes: [{ id: 'color', values: [{ value: 'BLUE' }] }],
    images: [{ alt: `Blue ${viewType}`, link: `https://example.com/blue-${viewType}.jpg` }],
}));

// Master with orderable site inventory (inherited from the mock) plus a store record that is in stock
// at the selected store. Both are the "wrong SKU" signals the overlay must not borrow -- the buggy
// fallback would use them to keep delivery/pickup available for a SKU that has no record.
const product = {
    ...masterProduct,
    variationAttributes: (masterProduct.variationAttributes ?? []).map((attribute) =>
        attribute.id === 'color'
            ? { ...attribute, values: [...(attribute.values ?? []), { name: 'Blue', value: 'BLUE' }] }
            : attribute
    ),
    imageGroups: [...(masterProduct.imageGroups ?? []), ...blueImageGroups],
    inventories: [
        {
            ats: 50,
            id: SELECTED_STORE_INVENTORY_ID,
            orderable: true,
            stockLevel: 50,
        },
    ],
    variants: [
        ...(masterProduct.variants ?? []),
        {
            productId: 'blue-variant',
            orderable: true,
            price: 299.99,
            variationValues: { color: 'BLUE', size: '038', width: 'S' },
        },
    ],
} as ShopperProducts.schemas['Product'];

const renderOverlay = (withSelectedStore: boolean) => {
    const overlay = <ProductView product={product} />;
    const router = createMemoryRouter(
        [
            {
                path: '/:siteId/:localeId/product/:productId',
                element: (
                    <AllProvidersWrapper>
                        {withSelectedStore ? (
                            <StoreLocatorProvider
                                selectedStoreInfo={{ id: 'store-a', inventoryId: SELECTED_STORE_INVENTORY_ID }}>
                                {overlay}
                            </StoreLocatorProvider>
                        ) : (
                            overlay
                        )}
                    </AllProvidersWrapper>
                ),
            },
        ],
        { initialEntries: ['/global/en-GB/product/test-product?color=BLUE&size=038&width=S'] }
    );
    return render(<RouterProvider router={router} />);
};

describe('Footwear PDP selected-variant inventory fallback', () => {
    beforeEach(() => {
        // Default: SKU is fully in stock at the site (store record left to each test).
        variantSiteInventory = { ats: 50, id: 'blue-site-inventory', orderable: true, stockLevel: 50 };
        variantStoreInventories = null;
    });

    test('blocks purchase when the SKU fetch omits site inventory (does not borrow the master)', async () => {
        // SCAPI returned no site inventory record for this SKU -- treat as out of stock, do not fall
        // back to the master's orderable site inventory.
        variantSiteInventory = null;

        renderOverlay(false);

        await waitFor(() => {
            expect(screen.getByTestId('add-to-cart')).toBeDisabled();
            expect(screen.getByText('Out of stock')).toBeInTheDocument();
        });
        // Delivery options only render for an in-stock item; a borrowed master would have kept them.
        expect(screen.queryByText(/Deliver to/i)).not.toBeInTheDocument();
    });

    test('disables pickup when the SKU fetch omits the selected store (does not borrow the master store)', async () => {
        // Site inventory present (delivery works), but the SKU has no record at the selected store.
        variantStoreInventories = null;

        renderOverlay(true);

        await waitFor(() => {
            // Delivery stays available for the in-stock site inventory.
            expect(screen.getByTestId('add-to-cart')).toBeEnabled();
            expect(screen.getByText(/Deliver to/i)).toBeInTheDocument();
            // Pickup at the selected store is unavailable -- the master's in-stock store record is not borrowed.
            expect(screen.getByText(/Pickup unavailable at/i)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Free pickup in/i)).not.toBeInTheDocument();
    });

    test('keeps pickup available when the SKU fetch reports the selected store in stock', async () => {
        // Regression guard: the fix must not over-broaden. When the SKU's own fetch returns an
        // orderable record for the selected store, pickup stays available.
        variantStoreInventories = [{ ats: 12, id: SELECTED_STORE_INVENTORY_ID, orderable: true, stockLevel: 12 }];

        renderOverlay(true);

        await waitFor(() => {
            expect(screen.getByTestId('add-to-cart')).toBeEnabled();
            expect(screen.getByText(/Free pickup in/i)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Pickup unavailable at/i)).not.toBeInTheDocument();
    });
});

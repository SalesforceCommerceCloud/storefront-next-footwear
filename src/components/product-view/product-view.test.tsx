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
// @sfdc-extension-block-start SFDC_EXT_BOPIS
import StoreLocatorProvider from '@/extensions/store-locator/providers/store-locator';
// @sfdc-extension-block-end SFDC_EXT_BOPIS

const SELECTED_STORE_INVENTORY_ID = 'store-a-inventory';

// Controls what the selected-SKU availability fetch returns. `null` omits the field entirely, the way
// SCAPI drops `inventory` / `inventories` when the SKU has no record at the site or requested store.
let variantSiteInventory: ShopperProducts.schemas['Inventory'] | null;
let variantStoreInventories: ShopperProducts.schemas['Inventory'][] | null;
// @sfdc-extension-block-start SFDC_EXT_BOPIS
// @sfdc-extension-line SFDC_EXT_SHIPPING_DELIVERY
const capturedProductInfoProps: { last: Record<string, unknown> | null } = { last: null };
// @sfdc-extension-block-end SFDC_EXT_BOPIS

vi.mock('@/components/image-gallery', () => ({
    default: () => <div data-testid="image-gallery" />,
}));

// @sfdc-extension-block-start SFDC_EXT_BOPIS
// @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
vi.mock('@/components/product-view/product-info', async () => {
    const actual = await vi.importActual<typeof import('@/components/product-view/product-info')>(
        '@/components/product-view/product-info'
    );
    return {
        ...actual,
        default: (props: React.ComponentProps<typeof actual.default>) => {
            capturedProductInfoProps.last = props;
            const ProductInfo = actual.default;
            return <ProductInfo {...props} />;
        },
    };
});
// @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY
// @sfdc-extension-block-end SFDC_EXT_BOPIS

// @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
vi.mock('@/extensions/shipping-delivery/components/target/delivery-estimate-summary-target', () => ({
    default: () => <div data-testid="delivery-estimate" />,
}));
// @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY

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

const renderOverlay = () => {
    const overlay = <ProductView product={product} />;
    const router = createMemoryRouter(
        [
            {
                path: '/:siteId/:localeId/product/:productId',
                element: <AllProvidersWrapper>{overlay}</AllProvidersWrapper>,
            },
        ],
        { initialEntries: ['/global/en-GB/product/test-product?color=BLUE&size=038&width=S'] }
    );
    return render(<RouterProvider router={router} />);
};

describe('Footwear PDP selected-variant inventory fallback', () => {
    beforeEach(() => {
        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        // @sfdc-extension-line SFDC_EXT_SHIPPING_DELIVERY
        capturedProductInfoProps.last = null;
        // @sfdc-extension-block-end SFDC_EXT_BOPIS
        // Default: SKU is fully in stock at the site (store record left to each test).
        variantSiteInventory = { ats: 50, id: 'blue-site-inventory', orderable: true, stockLevel: 50 };
        variantStoreInventories = null;
    });

    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    // @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
    test('mounts the delivery estimate once', async () => {
        renderOverlay();

        await waitFor(() => {
            expect(screen.getAllByTestId('delivery-estimate')).toHaveLength(1);
        });
        expect(capturedProductInfoProps.last).toEqual(
            expect.objectContaining({ enableDeliveryEstimatePresentation: true })
        );
    });
    // @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY
    // @sfdc-extension-block-end SFDC_EXT_BOPIS

    test('blocks purchase when the SKU fetch omits site inventory (does not borrow the master)', async () => {
        // SCAPI returned no site inventory record for this SKU -- treat as out of stock, do not fall
        // back to the master's orderable site inventory.
        variantSiteInventory = null;

        renderOverlay();

        await waitFor(() => {
            expect(screen.getByTestId('add-to-cart')).toBeDisabled();
            expect(screen.getByText('Out of stock')).toBeInTheDocument();
        });
        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        // The shared picker stays visible, but the selected SKU's unavailable site inventory disables delivery.
        expect(screen.getByRole('radio', { name: 'Delivery' })).toBeDisabled();
        // @sfdc-extension-block-end SFDC_EXT_BOPIS
    });

    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    test('disables pickup when the SKU fetch omits the selected store (does not borrow the master store)', async () => {
        // Site inventory present (delivery works), but the SKU has no record at the selected store.
        variantStoreInventories = null;

        const overlay = <ProductView product={product} />;
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <StoreLocatorProvider
                                selectedStoreInfo={{ id: 'store-a', inventoryId: SELECTED_STORE_INVENTORY_ID }}>
                                {overlay}
                            </StoreLocatorProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=BLUE&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await waitFor(() => {
            // Delivery stays available for the in-stock site inventory.
            expect(screen.getByTestId('add-to-cart')).toBeEnabled();
            expect(screen.getByRole('radio', { name: 'Delivery' })).toBeEnabled();
            // Pickup at the selected store is unavailable -- the master's in-stock store record is not borrowed.
            expect(screen.getByRole('radio', { name: 'Pickup unavailable at' })).toBeDisabled();
        });
        expect(screen.queryByRole('radio', { name: 'Free pickup in' })).not.toBeInTheDocument();
    });

    test('keeps pickup available when the SKU fetch reports the selected store in stock', async () => {
        // Regression guard: the fix must not over-broaden. When the SKU's own fetch returns an
        // orderable record for the selected store, pickup stays available.
        variantStoreInventories = [{ ats: 12, id: SELECTED_STORE_INVENTORY_ID, orderable: true, stockLevel: 12 }];

        const overlay = <ProductView product={product} />;
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <StoreLocatorProvider
                                selectedStoreInfo={{ id: 'store-a', inventoryId: SELECTED_STORE_INVENTORY_ID }}>
                                {overlay}
                            </StoreLocatorProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=BLUE&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await waitFor(() => {
            expect(screen.getByTestId('add-to-cart')).toBeEnabled();
            expect(screen.getByRole('radio', { name: 'Free pickup in' })).toBeEnabled();
        });
        expect(screen.queryByRole('radio', { name: 'Pickup unavailable at' })).not.toBeInTheDocument();
    });
    // @sfdc-extension-block-end SFDC_EXT_BOPIS
});

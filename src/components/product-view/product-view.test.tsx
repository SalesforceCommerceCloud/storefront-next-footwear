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
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ShopperProducts } from '@/scapi';
import ProductView from '@/components/product-view';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { masterProduct } from '@/components/__mocks__/master-variant-product';
// @sfdc-extension-block-start SFDC_EXT_BOPIS
import StoreLocatorProvider from '@/extensions/store-locator/providers/store-locator';
import { PickupInventoryProvider } from '@/extensions/bopis/context/pickup-inventory';
import type { PdpPickupInventory } from '@/extensions/bopis/lib/pdp-pickup-inventory.server';
// @sfdc-extension-block-end SFDC_EXT_BOPIS

const SELECTED_STORE_INVENTORY_ID = 'store-a-inventory';

// Controls what the selected-SKU availability fetch returns. `null` omits the field entirely, the way
// SCAPI drops `inventory` / `inventories` when the SKU has no record at the site or requested store.
let variantSiteInventory: ShopperProducts.schemas['Inventory'] | null;
let variantStoreInventories: ShopperProducts.schemas['Inventory'][] | null;
let fetchSuccess = true;
const loadVariant = vi.fn();
// @sfdc-extension-block-start SFDC_EXT_BOPIS
// @sfdc-extension-line SFDC_EXT_SHIPPING_DELIVERY
const capturedProductInfoProps: { last: Record<string, unknown> | null } = { last: null };
// @sfdc-extension-block-end SFDC_EXT_BOPIS
const capturedProductZoomGalleryProps: { last: Record<string, unknown> | null } = { last: null };

vi.mock('@/components/product-zoom-gallery', () => ({
    default: (props: Record<string, unknown>) => {
        capturedProductZoomGalleryProps.last = props;
        return <div data-testid="image-gallery" />;
    },
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

// The inline stepper is opt-in (`addToCartQuantityMode: 'inline'`). Capture the `loading` prop the PDP
// hands it so the "Adding to Cart..." label can be asserted without the cart controller.
const inlineAddToCart = vi.hoisted(() => ({ enabled: false, lastLoading: null as boolean | null }));
vi.mock('@/lib/product/add-to-cart-quantity-mode', () => ({
    usesInlineAddToCartQuantity: () => inlineAddToCart.enabled,
}));
vi.mock('@/components/inline-add-to-cart/connected', () => ({
    default: ({ loading }: { loading?: boolean }) => {
        inlineAddToCart.lastLoading = loading ?? false;
        return <div data-testid="inline-add-to-cart-stub" />;
    },
}));

vi.mock('@/hooks/use-scapi-fetcher', () => ({
    useScapiFetcher: (_client: string, _method: string, options: { params: { path: { id: string } } }) => {
        const variantId = options.params.path.id;
        const data: Record<string, unknown> = { id: variantId };
        if (variantSiteInventory !== null) data.inventory = variantSiteInventory;
        if (variantStoreInventories !== null) data.inventories = variantStoreInventories;
        return {
            data: fetchSuccess ? data : undefined,
            errors: undefined,
            load: loadVariant,
            state: 'idle',
            success: fetchSuccess,
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
            productId: 'charcoal-variant',
            orderable: true,
            price: 299.99,
            variationValues: { color: 'CHARCWL', size: '038', width: 'S' },
        },
        {
            productId: 'blue-variant',
            orderable: true,
            price: 299.99,
            variationValues: { color: 'BLUE', size: '038', width: 'S' },
        },
    ],
} as ShopperProducts.schemas['Product'];

const renderOverlay = (search = '?color=BLUE&size=038&width=S') => {
    const overlay = <ProductView product={product} />;
    const router = createMemoryRouter(
        [
            {
                path: '/:siteId/:localeId/product/:productId',
                element: <AllProvidersWrapper>{overlay}</AllProvidersWrapper>,
            },
        ],
        { initialEntries: [`/global/en-GB/product/test-product${search}`] }
    );
    return render(<RouterProvider router={router} />);
};

describe('Footwear PDP selected-variant inventory fallback', () => {
    beforeEach(() => {
        capturedProductZoomGalleryProps.last = null;
        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        // @sfdc-extension-line SFDC_EXT_SHIPPING_DELIVERY
        capturedProductInfoProps.last = null;
        // @sfdc-extension-block-end SFDC_EXT_BOPIS
        // Default: SKU is fully in stock at the site (store record left to each test).
        variantSiteInventory = { ats: 50, id: 'blue-site-inventory', orderable: true, stockLevel: 50 };
        variantStoreInventories = null;
        inlineAddToCart.enabled = false;
        inlineAddToCart.lastLoading = null;
        fetchSuccess = true;
        loadVariant.mockClear();
    });

    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    // @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
    test('mounts the delivery estimate once', async () => {
        renderOverlay();

        await waitFor(() => {
            expect(screen.getAllByTestId('delivery-estimate')).toHaveLength(1);
        });
        expect(capturedProductInfoProps.last).toEqual(
            expect.objectContaining({ enableDeliveryEstimatePresentation: true, showQuantityPicker: true })
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

    // W-24459266: with no size/color chosen there is no variant to hydrate, so the inline button must not be loading.
    test('does not show the inline add-to-cart as busy before a variant is selected', async () => {
        inlineAddToCart.enabled = true;

        renderOverlay('');

        await screen.findByTestId('inline-add-to-cart-stub');
        expect(inlineAddToCart.lastLoading).toBe(false);
    });

    test('uses the PDP-only zoom gallery for the controlled-colorway PDP', () => {
        renderOverlay();

        expect(capturedProductZoomGalleryProps.last).toEqual(
            expect.objectContaining({ showNavigationArrows: true, navigationArrowSize: 'lg' })
        );
    });

    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    test('hydrates a changed SKU before initial store resolution and keeps it after the old seed arrives', async () => {
        fetchSuccess = false;
        let release!: (result: PdpPickupInventory) => void;
        const inventory = new Promise<PdpPickupInventory>((resolve) => {
            release = resolve;
        });
        const selection = new Promise<
            import('@/extensions/store-locator/providers/store-locator').SelectedStoreResolution
        >(() => {});
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <StoreLocatorProvider selectedStoreResolution={selection}>
                                <PickupInventoryProvider promise={inventory}>
                                    <ProductView product={product} />
                                </PickupInventoryProvider>
                            </StoreLocatorProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);
        expect(loadVariant).not.toHaveBeenCalled();
        await userEvent.setup().click(screen.getByRole('radio', { name: 'Blue' }));
        expect(loadVariant).toHaveBeenCalledTimes(1);
        fetchSuccess = true;
        await act(async () => {
            await router.revalidate();
        });
        expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        await act(async () => {
            release({
                status: 'resolved',
                products: [{ id: 'old-A', inventory: { id: 'site-A', ats: 0, orderable: false } }],
            });
            await inventory;
        });
        expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked();
    });
    test('returning to the initial SKU uses interaction inventory instead of its late seed', async () => {
        fetchSuccess = false;
        let release!: (result: PdpPickupInventory) => void;
        const inventory = new Promise<PdpPickupInventory>((resolve) => {
            release = resolve;
        });
        const selection = new Promise<
            import('@/extensions/store-locator/providers/store-locator').SelectedStoreResolution
        >(() => {});
        const initial = product.variants?.find(
            (variant) =>
                variant.variationValues?.color === 'CHARCWL' &&
                variant.variationValues.size === '038' &&
                variant.variationValues.width === 'S'
        );
        expect(initial).toBeDefined();
        if (!initial) throw new Error('Missing initial SKU fixture');
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <StoreLocatorProvider selectedStoreResolution={selection}>
                                <PickupInventoryProvider promise={inventory}>
                                    <ProductView product={product} />
                                </PickupInventoryProvider>
                            </StoreLocatorProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole('radio', { name: 'Blue' }));
        expect(loadVariant).toHaveBeenCalledTimes(1);
        fetchSuccess = true;
        await act(async () => {
            await router.revalidate();
        });
        expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        fetchSuccess = false;
        await user.click(screen.getByRole('radio', { name: 'Charcoal' }));
        expect(loadVariant).toHaveBeenCalledTimes(2);
        fetchSuccess = true;
        await act(async () => {
            await router.revalidate();
        });
        expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        await act(async () => {
            release({
                status: 'resolved',
                products: [{ id: initial.productId, inventory: { id: 'old-site-A', ats: 0, orderable: false } }],
            });
            await inventory;
        });
        expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        expect(screen.getByRole('radio', { name: 'Charcoal' })).toBeChecked();
    });
    test('initial server-selected SKU permits delivery purchase while store inventory is held, without a mount load', async () => {
        fetchSuccess = false;
        const inventory = new Promise<PdpPickupInventory>(() => {});
        const seededProduct = {
            ...product,
            variants: product.variants?.map((variant) =>
                variant.productId === 'blue-variant' ? { ...variant, inventory: variantSiteInventory } : variant
            ),
        };
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <StoreLocatorProvider selectedStoreResolution={new Promise(() => {})}>
                                <PickupInventoryProvider promise={inventory}>
                                    <ProductView product={seededProduct} />
                                </PickupInventoryProvider>
                            </StoreLocatorProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=BLUE&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);
        await userEvent.setup().click(screen.getByRole('radio', { name: 'Delivery' }));
        expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        expect(screen.getByRole('radio', { name: /Pickup/i })).toBeDisabled();
        expect(loadVariant).not.toHaveBeenCalled();
    });
    test.each([
        true,
        false,
    ])('local exact-SKU store inventory permits pickup purchase only with its own record (%s)', async (hasSkuStore) => {
        variantStoreInventories = hasSkuStore
            ? [{ id: SELECTED_STORE_INVENTORY_ID, ats: 7, stockLevel: 7, orderable: true }]
            : null;
        const selection = Promise.resolve({
            selectedStoreInfo: { id: 'store-a', inventoryId: SELECTED_STORE_INVENTORY_ID },
            error: null,
        });
        const inventory = Promise.resolve<PdpPickupInventory>({
            status: 'resolved',
            storeId: 'store-a',
            inventoryId: SELECTED_STORE_INVENTORY_ID,
            products: [],
        });
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <StoreLocatorProvider selectedStoreResolution={selection}>
                                <PickupInventoryProvider promise={inventory}>
                                    <ProductView
                                        product={{ ...product, inventories: hasSkuStore ? [] : product.inventories }}
                                    />
                                </PickupInventoryProvider>
                            </StoreLocatorProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=BLUE&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);
        await act(async () => {
            await inventory;
        });
        const pickup = screen.getByRole('radio', { name: /Pickup/i });
        if (hasSkuStore) {
            await userEvent.setup().click(pickup);
            expect(pickup).toBeChecked();
            expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        } else {
            expect(pickup).toBeDisabled();
            await userEvent.setup().click(pickup);
            expect(pickup).not.toBeChecked();
        }
    });
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

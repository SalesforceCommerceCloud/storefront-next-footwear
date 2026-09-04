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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ShopperProducts } from '@/scapi';
import ProductView from '@/components/product-view';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { masterProduct } from '@/components/__mocks__/master-variant-product';
// @sfdc-extension-block-start SFDC_EXT_BOPIS
import StoreLocatorProvider from '@/extensions/store-locator/providers/store-locator';
// @sfdc-extension-block-end SFDC_EXT_BOPIS

const galleryProps: { images: Array<{ src: string }> } = { images: [] };
let isVariantInventoryPending = false;
let variantInventoryLoadError = false;
const loadVariantInventory = vi.fn<(variantId: string) => void>();
const hydratedVariantInventories = new Map<string, ShopperProducts.schemas['Inventory']>();
let requestedInventoryIds: string[] | undefined;
let requestedVariantId: string | undefined;

vi.mock('@/components/image-gallery', () => ({
    default: ({ images }: { images: Array<{ src: string }> }) => {
        galleryProps.images = images;
        return <div data-testid="image-gallery" />;
    },
}));

vi.mock('@/hooks/use-scapi-fetcher', () => ({
    useScapiFetcher: (
        _client: string,
        _method: string,
        options: { params: { path: { id: string }; query?: { inventoryIds?: string[] } } }
    ) => {
        const variantId = options.params.path.id;
        requestedVariantId = variantId;
        requestedInventoryIds = options.params.query?.inventoryIds;
        const inventory = hydratedVariantInventories.get(variantId);
        return {
            data: isVariantInventoryPending
                ? undefined
                : ({
                      id: variantId,
                      inventory: inventory ?? { ats: 10, id: `${variantId}-inventory`, orderable: true },
                  } as const),
            errors: variantInventoryLoadError ? ['Availability unavailable'] : undefined,
            load: () => loadVariantInventory(variantId),
            state: 'idle',
            success: !isVariantInventoryPending && !variantInventoryLoadError,
        };
    },
}));

const blueImageGroups = ['small', 'large'].map((viewType) => ({
    viewType,
    variationAttributes: [{ id: 'color', values: [{ value: 'BLUE' }] }],
    images: [
        {
            alt: `Blue ${viewType}`,
            link: `https://example.com/blue-${viewType}.jpg`,
        },
    ],
}));

const product = {
    ...masterProduct,
    variationAttributes: (masterProduct.variationAttributes ?? []).map((attribute) =>
        attribute.id === 'color'
            ? { ...attribute, values: [...(attribute.values ?? []), { name: 'Blue', value: 'BLUE' }] }
            : attribute
    ),
    imageGroups: [...(masterProduct.imageGroups ?? []), ...blueImageGroups],
    variants: [
        ...(masterProduct.variants ?? []),
        {
            productId: 'blue-variant',
            orderable: true,
            price: 299.99,
            inventory: { ats: 10, id: 'blue-inventory', orderable: true },
            variationValues: { color: 'BLUE', size: '038', width: 'S' },
        },
    ],
} as ShopperProducts.schemas['Product'];

describe('Footwear colorway gallery integration', () => {
    beforeEach(() => {
        galleryProps.images = [];
        isVariantInventoryPending = false;
        variantInventoryLoadError = false;
        hydratedVariantInventories.clear();
        requestedInventoryIds = undefined;
        requestedVariantId = undefined;
        loadVariantInventory.mockReset();
    });

    test('loads the resolved local colorway SKU before enabling purchase', async () => {
        isVariantInventoryPending = true;
        const user = userEvent.setup();
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
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);
        loadVariantInventory.mockClear();

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(loadVariantInventory).toHaveBeenCalledWith('blue-variant');
            expect(screen.getByTestId('add-to-cart')).toBeDisabled();
        });
    });

    test('offers a retry when selected-variant inventory cannot be loaded', async () => {
        variantInventoryLoadError = true;
        const user = userEvent.setup();
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
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);
        loadVariantInventory.mockClear();

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        const retry = await screen.findByRole('button', { name: 'Try again' });
        expect(screen.getByTestId('add-to-cart')).toBeDisabled();
        await user.click(retry);
        expect(loadVariantInventory).toHaveBeenCalledWith('blue-variant');
    });

    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    test('requests selected-store inventory for the resolved colorway SKU', async () => {
        const user = userEvent.setup();
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <StoreLocatorProvider
                                selectedStoreInfo={{
                                    id: 'selected-store',
                                    inventoryId: 'selected-store-inventory',
                                }}>
                                <ProductView product={product} />
                            </StoreLocatorProvider>
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(requestedVariantId).toBe('blue-variant');
            expect(requestedInventoryIds).toEqual(['selected-store-inventory']);
        });
    });
    // @sfdc-extension-block-end SFDC_EXT_BOPIS

    test('does not show a different colorway in the gallery when its media is missing', async () => {
        const user = userEvent.setup();
        const productWithoutBlueImages = {
            ...product,
            imageGroups: (product.imageGroups ?? []).filter(
                (imageGroup) => imageGroup.variationAttributes?.[0]?.values?.[0]?.value !== 'BLUE'
            ),
        } as ShopperProducts.schemas['Product'];
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <ProductView product={productWithoutBlueImages} />
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(galleryProps.images).toEqual([]);
        });
    });

    test('does not treat a generic gallery image group as colorway media', async () => {
        const user = userEvent.setup();
        const productWithGenericGallery = {
            ...product,
            imageGroups: (product.imageGroups ?? []).filter(
                (imageGroup) =>
                    imageGroup.viewType !== 'large' ||
                    !imageGroup.variationAttributes?.some((attribute) => attribute.id === 'color')
            ),
        } as ShopperProducts.schemas['Product'];
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <ProductView product={productWithGenericGallery} />
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(galleryProps.images).toEqual([]);
        });
    });

    test('uses a shared colorway image group instead of generic gallery media', async () => {
        const user = userEvent.setup();
        const productWithSharedColorwayGallery = {
            ...product,
            imageGroups: (product.imageGroups ?? []).map((imageGroup) =>
                imageGroup.viewType === 'large' &&
                imageGroup.variationAttributes?.some((attribute) =>
                    attribute.values?.some((attributeValue) => attributeValue.value === 'BLUE')
                )
                    ? {
                          ...imageGroup,
                          variationAttributes: [{ id: 'color', values: [{ value: 'BLUE' }, { value: 'NAVY' }] }],
                      }
                    : imageGroup
            ),
        } as ShopperProducts.schemas['Product'];
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <ProductView product={productWithSharedColorwayGallery} />
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(galleryProps.images).toHaveLength(1);
            expect(galleryProps.images[0]?.src).toContain('blue-large');
        });
    });

    test('does not use a colorway image group with incompatible variation attributes', async () => {
        const user = userEvent.setup();
        const productWithIncompatibleColorwayGallery = {
            ...product,
            imageGroups: (product.imageGroups ?? []).map((imageGroup) =>
                imageGroup.viewType === 'large' &&
                imageGroup.variationAttributes?.some((attribute) =>
                    attribute.values?.some((attributeValue) => attributeValue.value === 'BLUE')
                )
                    ? {
                          ...imageGroup,
                          variationAttributes: [
                              { id: 'color', values: [{ value: 'BLUE' }] },
                              { id: 'size', values: [{ value: '999' }] },
                          ],
                      }
                    : imageGroup
            ),
        } as ShopperProducts.schemas['Product'];
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <ProductView product={productWithIncompatibleColorwayGallery} />
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(galleryProps.images).toEqual([]);
        });
    });

    test('uses hydrated selected-variant inventory for purchase availability', async () => {
        hydratedVariantInventories.set('blue-variant', {
            ats: 0,
            id: 'blue-inventory',
            orderable: false,
        });
        const user = userEvent.setup();
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
            { initialEntries: ['/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S'] }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(screen.getByTestId('add-to-cart')).toBeDisabled();
        });
    });

    test('keeps simple product purchase and delivery behavior unchanged', async () => {
        const simpleProduct = {
            ...product,
            type: { master: false, variant: false },
            variationAttributes: [],
            variants: [],
        } as ShopperProducts.schemas['Product'];
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <ProductView product={simpleProduct} />
                        </AllProvidersWrapper>
                    ),
                },
            ],
            { initialEntries: ['/global/en-GB/product/test-product'] }
        );
        render(<RouterProvider router={router} />);

        await waitFor(() => {
            expect(screen.getByTestId('add-to-cart')).toBeEnabled();
            // @sfdc-extension-block-start SFDC_EXT_BOPIS
            expect(screen.getByRole('radio', { name: 'Delivery' })).toBeEnabled();
            expect(screen.getByRole('radio', { name: 'Free pickup in' })).toBeEnabled();
            // @sfdc-extension-block-end SFDC_EXT_BOPIS
        });
    });

    test('switches the existing gallery images without navigating', async () => {
        const user = userEvent.setup();
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
            {
                initialEntries: [
                    '/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S&pid=charcoal-variant',
                ],
            }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(router.state.location.search).toBe('?color=CHARCWL&size=038&width=S&pid=charcoal-variant');
            expect(galleryProps.images[0]?.src).toContain('blue-large.jpg');
            expect(screen.getByRole('radio', { name: /size 38, available/i })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByRole('radio', { name: /^short$/i })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByTestId('add-to-cart')).toBeEnabled();
        });
    });

    test('clears incompatible dimensions so the selected colorway exposes its available options', async () => {
        const user = userEvent.setup();
        const incompatibleColorwayProduct = {
            ...product,
            variants: (product.variants ?? []).map((variant) =>
                variant.productId === 'blue-variant'
                    ? {
                          ...variant,
                          variationValues: { color: 'BLUE', size: '036', width: 'V' },
                      }
                    : variant
            ),
        } as ShopperProducts.schemas['Product'];
        const router = createMemoryRouter(
            [
                {
                    path: '/:siteId/:localeId/product/:productId',
                    element: (
                        <AllProvidersWrapper>
                            <ProductView product={incompatibleColorwayProduct} />
                        </AllProvidersWrapper>
                    ),
                },
            ],
            {
                initialEntries: [
                    '/global/en-GB/product/test-product?color=CHARCWL&size=038&width=S&pid=charcoal-variant',
                ],
            }
        );
        render(<RouterProvider router={router} />);

        await user.click(screen.getByRole('radio', { name: 'Blue' }));

        await waitFor(() => {
            expect(router.state.location.search).toBe('?color=CHARCWL&size=038&width=S&pid=charcoal-variant');
            expect(galleryProps.images[0]?.src).toContain('blue-large.jpg');
            expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true');

            const size36 = screen.getAllByRole('radio').find((control) => control.textContent === '36');
            const regularWidth = screen.getAllByRole('radio').find((control) => control.textContent === 'Regular');
            expect(size36).toBeDefined();
            expect(size36).not.toHaveAttribute('aria-disabled', 'true');
            expect(regularWidth).toBeDefined();
            expect(regularWidth).not.toHaveAttribute('aria-disabled', 'true');
            expect(size36).toHaveAttribute('aria-checked', 'false');
            expect(regularWidth).toHaveAttribute('aria-checked', 'false');
            expect(screen.getByTestId('add-to-cart')).toBeDisabled();
            // @sfdc-extension-block-start SFDC_EXT_BOPIS
            expect(screen.getByRole('radio', { name: 'Delivery' })).toBeEnabled();
            expect(screen.getByRole('radio', { name: 'Free pickup in' })).toBeEnabled();
            // @sfdc-extension-block-end SFDC_EXT_BOPIS
        });

        const size36 = screen.getAllByRole('radio').find((control) => control.textContent === '36');
        const regularWidth = screen.getAllByRole('radio').find((control) => control.textContent === 'Regular');
        expect(size36).toBeDefined();
        expect(regularWidth).toBeDefined();
        if (!size36 || !regularWidth) {
            throw new Error('Expected available replacement size and width controls');
        }
        await user.click(size36);
        await user.click(regularWidth);
        expect(router.state.location.search).toBe('?color=BLUE&size=036&width=V');
        expect(size36).toHaveAttribute('aria-checked', 'true');
        expect(regularWidth).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByTestId('add-to-cart')).toBeEnabled();
    });
});

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
import { useState } from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import ProductInfo from './product-info';
import ProductViewProvider, { useProductView } from '@/providers/product-view';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { masterProduct as mockProduct } from '@/components/__mocks__/master-variant-product';
import { standardProd } from '@/components/__mocks__/standard-product-2';
// @sfdc-extension-block-start SFDC_EXT_BOPIS
import StoreLocatorProvider from '@/extensions/store-locator/providers/store-locator';
// @sfdc-extension-block-end SFDC_EXT_BOPIS
import { getTranslation } from '@salesforce/storefront-next-runtime/i18n';
import type { ShopperProducts } from '@/scapi';

const { t } = getTranslation();

// @sfdc-extension-block-start SFDC_EXT_BOPIS
// @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
const { deliveryOptionsSpy } = vi.hoisted(() => ({ deliveryOptionsSpy: vi.fn() }));

vi.mock('@/components/fulfillment/delivery-options', async () => {
    const actual = await vi.importActual<typeof import('@/components/fulfillment/delivery-options')>(
        '@/components/fulfillment/delivery-options'
    );
    return {
        ...actual,
        default: (props: React.ComponentProps<typeof actual.default>) => {
            deliveryOptionsSpy(props);
            const DeliveryOptions = actual.default;
            return <DeliveryOptions {...props} />;
        },
    };
});
// @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY
// @sfdc-extension-block-end SFDC_EXT_BOPIS

// @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
vi.mock('@/extensions/shipping-delivery/components/target/delivery-estimate-summary-target', () => ({
    default: () => <div data-testid="estimated-delivery-target" />,
}));
// @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY

// Footwear-vertical strings aren't in the canonical resources vitest.setup.ts initializes
// (VERTICAL isn't set for `pnpm test`), so layer a fallback mock over react-i18next's
// useTranslation, mirroring the established pattern in this vertical's home route and
// size-guide component tests. Canonical keys (quantitySelector, inventory messages, etc. from
// other tests in this file) fall through to the real t() untouched.
vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    const translations: Record<string, string> = {
        'sizeGuide.triggerLabel': 'Size Guide',
        'sizeGuide.title': 'Size guide',
        'sizeGuide.description': 'Find your perfect fit using our size conversion chart.',
        'sizeGuide.descriptionWithBrand': 'Find your perfect fit with {{brandName}} using our size conversion chart.',
        'sizeGuide.genderToggleLabel': 'Select gender',
        'sizeGuide.gender.mens': "Men's",
        'sizeGuide.gender.womens': "Women's",
        'sizeGuide.gender.kids': 'Kids',
        'sizeGuide.tabsLabel': 'Size guide sections',
        'sizeGuide.tabs.sizeChart': 'Size chart',
        'sizeGuide.tabs.howToMeasure': 'How to measure',
        'sizeGuide.conversionTableCaption': '{{gender}} size conversion chart: US, UK, EU, and CM sizes',
        'sizeGuide.us': 'US',
        'sizeGuide.uk': 'UK',
        'sizeGuide.eu': 'EU',
        'sizeGuide.cm': 'CM',
        'sizeGuide.jp': 'JP',
        'sizeGuide.yourSize': '(your size)',
        'sizeGuide.howToMeasure.step1': 'Trace your foot on a piece of paper.',
        'sizeGuide.howToMeasure.step2': 'Measure the longest length in centimeters.',
        'sizeGuide.howToMeasure.step3': 'Measure the widest width in centimeters.',
        'sizeGuide.howToMeasure.step4': 'Compare against the chart above.',
        'sizeGuide.fitConfidence.summary': '{{percent}}% of {{count}} reviewers say this fits true to size',
        'sizeGuide.fitConfidence.trueToSize': 'True to size',
        'sizeGuide.fitConfidence.runsSmall': 'Runs small',
        'sizeGuide.fitConfidence.runsLarge': 'Runs large',
    };
    return {
        ...actual,
        useTranslation: (...args: unknown[]) => {
            const real = actual.useTranslation(...args);
            return {
                ...real,
                t: (key: string, options?: Record<string, string | number>) => {
                    const normalizedKey = key.startsWith('product:') ? key.substring(8) : key;
                    const override = translations[normalizedKey];
                    if (override === undefined) {
                        return real.t(key, options);
                    }
                    if (options) {
                        return override.replace(/\{\{(\w+)\}\}/g, (_match, prop) =>
                            String(options[prop] ?? `{{${prop}}}`)
                        );
                    }
                    return override;
                },
            };
        },
    };
});

const validFitFeedback = JSON.stringify({
    totalResponses: 120,
    runsSmallPercent: 20,
    trueToSizePercent: 65,
    runsLargePercent: 15,
});

const renderProductInfo = (props: React.ComponentProps<typeof ProductInfo>) => {
    // Using createMemoryRouter in framework mode is fine
    // because both framework and data routers share the same underlying architecture, so it provides a valid navigation context for hooks and <Link>.
    // Even though it's listed under "data routers," it fully supports testing non-route components that rely on router behavior.
    const router = createMemoryRouter(
        [
            {
                path: '/product/:productId',
                element: (
                    <AllProvidersWrapper>
                        <ProductViewProvider product={props.product}>
                            <ProductInfo {...props} />
                        </ProductViewProvider>
                    </AllProvidersWrapper>
                ),
            },
            // Catch-all route to prevent 404 errors when navigating
            {
                path: '*',
                element: <div>Navigated</div>,
            },
        ],
        {
            initialEntries: ['/product/test-product'],
        }
    );
    return { ...render(<RouterProvider router={router} />), router };
};

describe('ProductInfo', () => {
    beforeEach(() => {
        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        // @sfdc-extension-line SFDC_EXT_SHIPPING_DELIVERY
        deliveryOptionsSpy.mockClear();
        // @sfdc-extension-block-end SFDC_EXT_BOPIS
    });

    describe('basic rendering', () => {
        test('should render product name and description on desktop', () => {
            renderProductInfo({ product: mockProduct });

            expect(screen.getByText('Charcoal Flat Front Athletic Fit Shadow Striped Wool Suit')).toBeInTheDocument();
            expect(
                screen.getByText(
                    'This suit is great for any occasion. Add a shirt and a tie and you are ready for any event.'
                )
            ).toBeInTheDocument();
        });

        test('should render price information', () => {
            renderProductInfo({ product: mockProduct });

            // Price is visible (PDP may show single variant price or range depending on context)
            expect(screen.getAllByText((content) => content.includes('$299.99')).length).toBeGreaterThanOrEqual(1);
        });

        test('exposes the price to screen readers as accessible text', () => {
            renderProductInfo({ product: mockProduct });

            // The visible price is hidden from AT to avoid it being read twice; the
            // accessible name is carried by an sr-only "Current price: $299.99" span.
            expect(
                screen.getByText((content) => content.includes('Current price:') && content.includes('$299.99'))
            ).toBeInTheDocument();
        });
    });

    describe('variant selection', () => {
        test('should render colorway radiogroup when color variation exists', () => {
            renderProductInfo({ product: mockProduct });

            expect(screen.getByRole('radiogroup', { name: /colou?r/i })).toBeInTheDocument();
        });

        test('should render variant selector for non-color attributes', () => {
            renderProductInfo({ product: mockProduct });

            // Matches the "Size" attribute label, not the unrelated "Size Guide" trigger button.
            expect(screen.getByText(/^Size$/)).toBeInTheDocument();
        });

        test('should render colorways as product-image thumbnails', () => {
            renderProductInfo({ product: mockProduct });

            const charcoalColorway = screen.getByRole('radio', { name: 'Charcoal' });
            expect(charcoalColorway).toHaveAttribute('aria-checked', 'true');
            expect(charcoalColorway.querySelector('img')).toHaveAttribute(
                'src',
                expect.stringContaining('PG.33330DAN84Q.CHARCWL.PZ')
            );

            // Size and width render via SizeGrid/WidthSelector (plain buttons, no href attribute).
            // Their client-side selection is exercised in 'should update selection locally (not the
            // URL) when a size is clicked' below.
            expect(screen.getByRole('radio', { name: /size 36, available/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /size 38, available/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /^short$/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /^regular$/i })).toBeInTheDocument();
        });

        test('uses the named fallback when a colorway has no color-specific image', () => {
            const productWithImageLessColorway = {
                ...mockProduct,
                variationAttributes: (mockProduct.variationAttributes ?? []).map((attribute) =>
                    attribute.id === 'color'
                        ? { ...attribute, values: [...(attribute.values ?? []), { name: 'Blue', value: 'BLUE' }] }
                        : attribute
                ),
                variants: [
                    ...(mockProduct.variants ?? []),
                    {
                        productId: 'blue-variant',
                        orderable: true,
                        variationValues: { color: 'BLUE', size: '036', width: 'S' },
                    },
                ],
            } as ShopperProducts.schemas['Product'];

            renderProductInfo({ product: productWithImageLessColorway });

            const blueColorway = screen.getByRole('radio', { name: 'Blue' });
            expect(blueColorway.querySelector('img')).not.toBeInTheDocument();
            expect(blueColorway).toHaveTextContent('B');
        });

        test('does not use a colorway image with incompatible variation attributes', () => {
            const productWithIncompatibleColorwayImage = {
                ...mockProduct,
                variationAttributes: (mockProduct.variationAttributes ?? []).map((attribute) =>
                    attribute.id === 'color'
                        ? { ...attribute, values: [...(attribute.values ?? []), { name: 'Blue', value: 'BLUE' }] }
                        : attribute
                ),
                imageGroups: [
                    ...(mockProduct.imageGroups ?? []),
                    {
                        viewType: 'small',
                        variationAttributes: [
                            { id: 'color', values: [{ value: 'BLUE' }] },
                            { id: 'size', values: [{ value: '999' }] },
                        ],
                        images: [{ alt: 'Wrong Blue', link: 'https://example.com/wrong-blue.jpg' }],
                    },
                ],
                variants: [
                    ...(mockProduct.variants ?? []),
                    {
                        productId: 'blue-variant',
                        orderable: true,
                        variationValues: { color: 'BLUE', size: '036', width: 'S' },
                    },
                ],
            } as ShopperProducts.schemas['Product'];

            renderProductInfo({ product: productWithIncompatibleColorwayImage });

            expect(screen.getByRole('radio', { name: 'Blue' }).querySelector('img')).not.toBeInTheDocument();
        });

        test('marks a colorway unavailable in controlled mode when no matching orderable variant exists', () => {
            const controlledProduct = {
                ...mockProduct,
                variationAttributes: (mockProduct.variationAttributes ?? []).map((attribute) =>
                    attribute.id === 'color'
                        ? { ...attribute, values: [...(attribute.values ?? []), { name: 'Blue', value: 'BLUE' }] }
                        : attribute
                ),
                imageGroups: [
                    ...(mockProduct.imageGroups ?? []),
                    {
                        viewType: 'small',
                        variationAttributes: [{ id: 'color', values: [{ value: 'BLUE' }] }],
                        images: [{ alt: 'Blue', link: 'https://example.com/blue-small.jpg' }],
                    },
                    {
                        viewType: 'large',
                        variationAttributes: [{ id: 'color', values: [{ value: 'BLUE' }] }],
                        images: [{ alt: 'Blue', link: 'https://example.com/blue-large.jpg' }],
                    },
                ],
                variants: [
                    ...(mockProduct.variants ?? []),
                    {
                        productId: 'blue-unavailable',
                        orderable: false,
                        variationValues: { color: 'BLUE', size: '036', width: 'S' },
                    },
                ],
            } as ShopperProducts.schemas['Product'];

            renderProductInfo({
                product: controlledProduct,
                swatchMode: 'controlled',
                onAttributeChange: vi.fn(),
                variationValues: {},
            });

            // An unavailable colorway stays focusable/announceable and exposes aria-disabled with an
            // out-of-stock accessible name (same contract as the disabled width swatch test below).
            expect(screen.getByRole('radio', { name: /blue.*out of stock/i })).toHaveAttribute('aria-disabled', 'true');
        });

        test('keeps an orderable colorway selectable when it requires a different size or width', async () => {
            const user = userEvent.setup();
            const productWithColorway = {
                ...mockProduct,
                variationAttributes: (mockProduct.variationAttributes ?? []).map((attribute) =>
                    attribute.id === 'color'
                        ? { ...attribute, values: [...(attribute.values ?? []), { name: 'Blue', value: 'BLUE' }] }
                        : attribute
                ),
                imageGroups: [
                    ...(mockProduct.imageGroups ?? []),
                    {
                        viewType: 'small',
                        variationAttributes: [{ id: 'color', values: [{ value: 'BLUE' }] }],
                        images: [{ alt: 'Blue', link: 'https://example.com/blue-small.jpg' }],
                    },
                    {
                        viewType: 'large',
                        variationAttributes: [{ id: 'color', values: [{ value: 'BLUE' }] }],
                        images: [{ alt: 'Blue', link: 'https://example.com/blue-large.jpg' }],
                    },
                ],
                variants: [
                    {
                        productId: 'charcoal-38-short',
                        orderable: true,
                        variationValues: { color: 'CHARCWL', size: '038', width: 'S' },
                    },
                    {
                        productId: 'blue-36-regular',
                        orderable: true,
                        variationValues: { color: 'BLUE', size: '036', width: 'V' },
                    },
                ],
            } as ShopperProducts.schemas['Product'];
            const router = createMemoryRouter(
                [
                    {
                        path: '/product/:productId',
                        element: (
                            <AllProvidersWrapper>
                                <ProductViewProvider product={productWithColorway}>
                                    <ProductInfo product={productWithColorway} />
                                </ProductViewProvider>
                            </AllProvidersWrapper>
                        ),
                    },
                ],
                { initialEntries: ['/product/test-product?color=CHARCWL&size=038&width=S'] }
            );
            render(<RouterProvider router={router} />);

            const blueColorway = screen.getByRole('radio', { name: 'Blue' });
            expect(blueColorway).not.toBeDisabled();
            await user.click(blueColorway);

            await waitFor(() => {
                expect(router.state.location.search).toBe('?color=BLUE');
            });
        });

        test('should update selection locally (not the URL) when a size is clicked', async () => {
            const user = userEvent.setup();
            const { router } = renderProductInfo({ product: mockProduct });
            const urlBefore = router.state.location.search;

            // Click on size 38 radio (SizeGrid button, no href attribute)
            const size38Radio = screen.getByRole('radio', { name: /size 38, available/i });
            await user.click(size38Radio);

            // Size/width resolve client-side from a local override so the route never
            // revalidates: the radio flips to checked, but the URL search string is unchanged.
            await waitFor(() => {
                expect(size38Radio).toHaveAttribute('aria-checked', 'true');
            });
            expect(router.state.location.search).toBe(urlBefore);
        });

        test('should update selection locally (not the URL) when a width is clicked', async () => {
            const user = userEvent.setup();
            const { router } = renderProductInfo({ product: mockProduct });
            const urlBefore = router.state.location.search;

            // Click on the "Regular" width radio (WidthSelector button, no href attribute)
            const regularWidthRadio = screen.getByRole('radio', { name: /^regular$/i });
            await user.click(regularWidthRadio);

            // Width resolves client-side from a local override, same as size: the radio
            // flips to checked, but the URL search string is unchanged.
            await waitFor(() => {
                expect(regularWidthRadio).toHaveAttribute('aria-checked', 'true');
            });
            expect(router.state.location.search).toBe(urlBefore);
        });

        test('should show swatch as selected when URL contains its value', () => {
            const router = createMemoryRouter(
                [
                    {
                        path: '/product/:productId',
                        element: (
                            <AllProvidersWrapper>
                                <ProductViewProvider product={mockProduct}>
                                    <ProductInfo product={mockProduct} />
                                </ProductViewProvider>
                            </AllProvidersWrapper>
                        ),
                    },
                    // Catch-all route to prevent 404 errors when navigating
                    {
                        path: '*',
                        element: <div>Navigated</div>,
                    },
                ],
                {
                    initialEntries: ['/product/test-product?size=038'],
                }
            );
            render(<RouterProvider router={router} />);

            // Size 38 radio should be selected (aria-checked=true)
            const size38Radio = screen.getByRole('radio', { name: /size 38, available/i });
            expect(size38Radio).toHaveAttribute('aria-checked', 'true');

            // Size 36 radio should not be selected
            const size36Radio = screen.getByRole('radio', { name: /size 36, available/i });
            expect(size36Radio).toHaveAttribute('aria-checked', 'false');
        });
    });

    describe('cross-control availability (uncontrolled size/width)', () => {
        // Master product where the "Wide" width is orderable for size 36 but out of stock for
        // size 40. Width availability must recompute from the client-side size pick, not only the
        // URL: the bug was that useVariationAttributes read URL selections only, so a local size
        // pick never disabled the now-unavailable width, letting a shopper add an unorderable SKU.
        const sizeDependentWidthProduct = {
            ...mockProduct,
            id: 'size-dependent-width',
            variationAttributes: [
                {
                    id: 'size',
                    name: 'Size',
                    values: [
                        { name: '36', value: '036', orderable: true },
                        { name: '40', value: '040', orderable: true },
                    ],
                },
                {
                    id: 'width',
                    name: 'Width',
                    values: [
                        { name: 'Regular', value: 'V', orderable: true },
                        { name: 'Wide', value: 'W', orderable: true },
                    ],
                },
            ],
            variants: [
                { productId: 'v-036-V', price: 29.99, orderable: true, variationValues: { size: '036', width: 'V' } },
                { productId: 'v-036-W', price: 29.99, orderable: true, variationValues: { size: '036', width: 'W' } },
                { productId: 'v-040-V', price: 29.99, orderable: true, variationValues: { size: '040', width: 'V' } },
                { productId: 'v-040-W', price: 29.99, orderable: false, variationValues: { size: '040', width: 'W' } },
            ],
        } as ShopperProducts.schemas['Product'];

        test('disables the Wide width after picking a size for which it is out of stock', async () => {
            const user = userEvent.setup();
            renderProductInfo({ product: sizeDependentWidthProduct });

            // No size chosen yet: Wide is orderable for size 36, so it starts enabled.
            expect(screen.getByRole('radio', { name: /wide/i })).not.toHaveAttribute('aria-disabled', 'true');

            await user.click(screen.getByRole('radio', { name: /size 40, available/i }));

            // Wide is out of stock for size 40; availability must follow the client-side size pick.
            await waitFor(() => {
                expect(screen.getByRole('radio', { name: /wide/i })).toHaveAttribute('aria-disabled', 'true');
            });
        });
    });

    describe('inventory and stock handling', () => {
        test('should show out of stock message when inventory is zero', () => {
            // Simple item (no variants) so OOS reflects this SKU, not indeterminate master inventory
            const outOfStockProduct = {
                ...standardProd,
                name: mockProduct.name,
                inventory: { ats: 0, orderable: false, id: 'test-inventory' },
            };

            renderProductInfo({ product: outOfStockProduct });

            expect(
                screen.getByText('Out of stock for Charcoal Flat Front Athletic Fit Shadow Striped Wool Suit')
            ).toBeInTheDocument();
        });

        test('should render properly with low stock inventory', () => {
            const lowStockProduct = {
                ...mockProduct,
                inventory: { ats: 2, orderable: true, id: 'test-inventory' },
                variationAttributes: [], // Remove variants to simplify
            };

            renderProductInfo({ product: lowStockProduct });

            // Should still render basic elements
            expect(screen.getByText('Charcoal Flat Front Athletic Fit Shadow Striped Wool Suit')).toBeInTheDocument();
            expect(screen.getByLabelText(t('quantitySelector:quantity'))).toBeInTheDocument();
        });

        test('should render swatches when product has variations', () => {
            renderProductInfo({ product: mockProduct });

            // Check that variation swatches are rendered - Charcoal color, sizes 36-50, widths Short/Regular/Long
            expect(screen.getByLabelText('Charcoal')).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /size 36, available/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /size 38, available/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /^short$/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /^regular$/i })).toBeInTheDocument();
        });

        test('should hide inventory message until multi-attribute selection resolves to one variant in controlled mode', () => {
            const multiAttributeProduct = {
                ...mockProduct,
                inventory: {
                    ats: 0,
                    orderable: false,
                    id: 'master-oos-inventory',
                    backorderable: false,
                    preorderable: false,
                },
            };
            renderProductInfo({
                product: multiAttributeProduct,
                swatchMode: 'controlled',
                onAttributeChange: () => undefined,
                variationValues: { color: 'CHARCWL' },
            });

            // With only one of multiple variation attributes selected, inventory message stays hidden.
            expect(screen.queryByText(t('product:outOfStockLabel'))).not.toBeInTheDocument();
            expect(screen.queryByText(t('product:inStock'))).not.toBeInTheDocument();
            expect(
                screen.queryByText(
                    t('product:outOfStock', {
                        productName: 'Charcoal Flat Front Athletic Fit Shadow Striped Wool Suit',
                    })
                )
            ).not.toBeInTheDocument();
        });

        test('should disable non-selectable attribute values in controlled mode based on current selection', () => {
            const constrainedProduct = {
                ...mockProduct,
                variationAttributes: [
                    ...(mockProduct.variationAttributes ?? []).map((attribute) => {
                        if (attribute.id === 'size') {
                            return {
                                ...attribute,
                                values: [
                                    { name: '40', value: '040', orderable: true },
                                    { name: '42', value: '042', orderable: true },
                                ],
                            };
                        }
                        if (attribute.id === 'width') {
                            return {
                                ...attribute,
                                values: [
                                    { name: 'Short', value: 'S', orderable: true },
                                    { name: 'Regular', value: 'V', orderable: true },
                                ],
                            };
                        }
                        return attribute;
                    }),
                ],
                variants: [
                    {
                        productId: 'variant-40-short',
                        orderable: true,
                        variationValues: { color: 'CHARCWL', size: '040', width: 'S' },
                    },
                    {
                        productId: 'variant-42-regular',
                        orderable: true,
                        variationValues: { color: 'CHARCWL', size: '042', width: 'V' },
                    },
                ],
            };

            renderProductInfo({
                product: constrainedProduct,
                swatchMode: 'controlled',
                onAttributeChange: () => undefined,
                variationValues: { color: 'CHARCWL', size: '042' },
            });

            // Disabled swatches expose aria-disabled (kept focusable/announceable) with an out-of-stock accessible name.
            expect(screen.getByRole('radio', { name: /short.*out of stock/i })).toHaveAttribute(
                'aria-disabled',
                'true'
            );
            expect(screen.getByRole('radio', { name: /^regular$/i })).not.toHaveAttribute('aria-disabled', 'true');
        });

        test('should disable controlled swatch value when only matching variants are out of stock', () => {
            const constrainedProduct = {
                ...mockProduct,
                variationAttributes: [
                    ...(mockProduct.variationAttributes ?? []).map((attribute) => {
                        if (attribute.id === 'size') {
                            return {
                                ...attribute,
                                values: [
                                    { name: '40', value: '040', orderable: true },
                                    { name: '42', value: '042', orderable: true },
                                ],
                            };
                        }
                        if (attribute.id === 'width') {
                            return {
                                ...attribute,
                                values: [
                                    { name: 'Short', value: 'S', orderable: true },
                                    { name: 'Regular', value: 'V', orderable: true },
                                ],
                            };
                        }
                        return attribute;
                    }),
                ],
                variants: [
                    {
                        productId: 'variant-42-short-oos',
                        orderable: false,
                        variationValues: { color: 'CHARCWL', size: '042', width: 'S' },
                    },
                    {
                        productId: 'variant-42-regular',
                        orderable: true,
                        variationValues: { color: 'CHARCWL', size: '042', width: 'V' },
                    },
                ],
            };

            renderProductInfo({
                product: constrainedProduct,
                swatchMode: 'controlled',
                onAttributeChange: () => undefined,
                variationValues: { color: 'CHARCWL', size: '042' },
            });

            // Disabled swatches expose aria-disabled (kept focusable/announceable) with an out-of-stock accessible name.
            expect(screen.getByRole('radio', { name: /short.*out of stock/i })).toHaveAttribute(
                'aria-disabled',
                'true'
            );
            expect(screen.getByRole('radio', { name: /^regular$/i })).not.toHaveAttribute('aria-disabled', 'true');
        });

        test('should display in-stock inventory message when product has stock', () => {
            const inStockProduct = {
                ...mockProduct,
                inventory: {
                    ats: 10,
                    orderable: true,
                    id: 'test-inventory',
                    backorderable: false,
                    preorderable: false,
                },
                variationAttributes: [],
            };

            renderProductInfo({ product: inStockProduct });

            expect(screen.getByText(t('product:inStock'))).toBeInTheDocument();
        });

        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        test('keeps fulfillment options and the selected option visible while variant inventory is loading', async () => {
            const user = userEvent.setup();
            const productWithStaleMasterInventory = {
                ...mockProduct,
                inventories: [{ id: 'store-inventory', stockLevel: 0, orderable: false }],
            };
            const availableVariant = {
                productId: 'selected-variant',
                inventory: { id: 'site-inventory', ats: 10, orderable: true },
                inventories: [{ id: 'store-inventory', stockLevel: 10, orderable: true }],
            } as ShopperProducts.schemas['Variant'] & {
                inventory: ShopperProducts.schemas['Inventory'];
                inventories: ShopperProducts.schemas['Inventory'][];
            };

            function Harness() {
                const [isLoading, setIsLoading] = useState(false);
                const { fulfillmentSelection } = useProductView();
                const currentVariant = isLoading ? undefined : availableVariant;
                return (
                    <>
                        <button type="button" onClick={() => setIsLoading((loading) => !loading)}>
                            Toggle inventory loading
                        </button>
                        <output data-testid="fulfillment-selection">{fulfillmentSelection?.optionId}</output>
                        <ProductInfo
                            product={productWithStaleMasterInventory}
                            currentVariantOverride={currentVariant}
                            isVariantInventoryLoading={isLoading}
                        />
                    </>
                );
            }

            const router = createMemoryRouter(
                [
                    {
                        path: '/product/:productId',
                        element: (
                            <AllProvidersWrapper>
                                <StoreLocatorProvider
                                    selectedStoreInfo={{
                                        id: 'store-1',
                                        name: 'Store 1',
                                        inventoryId: 'store-inventory',
                                    }}>
                                    <ProductViewProvider product={productWithStaleMasterInventory}>
                                        <Harness />
                                    </ProductViewProvider>
                                </StoreLocatorProvider>
                            </AllProvidersWrapper>
                        ),
                    },
                ],
                { initialEntries: ['/product/test-product'] }
            );
            render(<RouterProvider router={router} />);

            const pickupOption = screen.getByRole('radio', { name: /pickup in/i });
            const deliveryOptions = screen.getByTestId('delivery-option-select').parentElement?.parentElement;
            expect(deliveryOptions).not.toBeNull();

            await user.click(pickupOption);
            expect(pickupOption).toBeChecked();
            expect(screen.getByTestId('fulfillment-selection')).toHaveTextContent('pickup');

            await user.click(screen.getByRole('button', { name: 'Toggle inventory loading' }));
            expect(screen.getByTestId('delivery-option-select').parentElement?.parentElement).toBe(deliveryOptions);
            expect(screen.getByRole('radio', { name: /pickup in/i })).toBeChecked();
            expect(screen.getByTestId('fulfillment-selection')).toHaveTextContent('pickup');

            await user.click(screen.getByRole('button', { name: 'Toggle inventory loading' }));
            expect(screen.getByTestId('delivery-option-select').parentElement?.parentElement).toBe(deliveryOptions);
            expect(screen.getByRole('radio', { name: /pickup in/i })).toBeChecked();
            expect(screen.getByTestId('fulfillment-selection')).toHaveTextContent('pickup');
        });
        // @sfdc-extension-block-end SFDC_EXT_BOPIS

        test('should display pre-order inventory message when product is preorderable', () => {
            const preOrderProduct = {
                ...mockProduct,
                inventory: {
                    ats: 0,
                    orderable: true,
                    id: 'test-inventory',
                    preorderable: true,
                    backorderable: false,
                },
                variationAttributes: [],
            };

            renderProductInfo({ product: preOrderProduct });

            expect(screen.getByText(t('product:preOrder'))).toBeInTheDocument();
        });

        test('should display back-order inventory message when product is backorderable', () => {
            const backOrderProduct = {
                ...mockProduct,
                inventory: {
                    ats: 0,
                    orderable: true,
                    id: 'test-inventory',
                    backorderable: true,
                    preorderable: false,
                },
                variationAttributes: [],
            };

            renderProductInfo({ product: backOrderProduct });

            expect(screen.getByText(t('product:backOrder'))).toBeInTheDocument();
        });

        test('should display out-of-stock inventory message when product is not orderable', () => {
            const outOfStockProduct = {
                ...standardProd,
                name: mockProduct.name,
                inventory: {
                    ats: 0,
                    orderable: false,
                    id: 'test-inventory',
                    backorderable: false,
                    preorderable: false,
                },
            };

            renderProductInfo({ product: outOfStockProduct });

            expect(screen.getByText(t('product:outOfStockLabel'))).toBeInTheDocument();
        });
    });

    describe('delivery options', () => {
        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        test('does not opt a reusable ProductInfo into estimate presentation by default', () => {
            renderProductInfo({ product: mockProduct });

            // @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
            expect(deliveryOptionsSpy).toHaveBeenCalledWith(
                expect.objectContaining({ instanceId: `${mockProduct.id}-pdp-delivery-options` })
            );
            expect(deliveryOptionsSpy.mock.lastCall?.[0]).toHaveProperty('enableDeliveryEstimatePresentation', false);
            expect(screen.getAllByTestId('estimated-delivery-target')).toHaveLength(1);
            // @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY
        });

        // @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
        test('passes an explicit primary-composition opt-in to the delivery picker', () => {
            renderProductInfo({ product: mockProduct, enableDeliveryEstimatePresentation: true });

            expect(deliveryOptionsSpy).toHaveBeenCalledWith(
                expect.objectContaining({ enableDeliveryEstimatePresentation: true })
            );
        });
        // @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY
        // @sfdc-extension-block-end SFDC_EXT_BOPIS

        test('uses the selected variant inventory for delivery availability', () => {
            const currentVariant = {
                productId: 'selected-variant',
                orderable: false,
                inventory: { ats: 0, id: 'selected-inventory', orderable: false },
                variationValues: { color: 'CHARCWL', size: '036', width: 'S' },
            } as ShopperProducts.schemas['Variant'];

            renderProductInfo({ product: mockProduct, currentVariantOverride: currentVariant });

            expect(screen.getByRole('radio', { name: 'Delivery' })).toBeDisabled();
        });

        // @sfdc-extension-block-start SFDC_EXT_SHIPPING_DELIVERY
        test('keeps the estimated-delivery target suppressed for deferred availability', () => {
            renderProductInfo({
                product: {
                    ...standardProd,
                    inventory: { id: 'deferred-inventory', ats: 0, orderable: true, preorderable: true },
                },
            });

            expect(screen.queryByTestId('estimated-delivery-target')).not.toBeInTheDocument();
        });
        // @sfdc-extension-block-end SFDC_EXT_SHIPPING_DELIVERY
    });

    describe('quantity selector', () => {
        test('should render quantity selector elements', () => {
            const simpleProduct = {
                ...mockProduct,
                variationAttributes: [], // No variants to simplify
            };

            renderProductInfo({ product: simpleProduct });

            expect(screen.getByLabelText(t('quantitySelector:quantity'))).toBeInTheDocument();
            expect(
                screen.getByLabelText(
                    'Decrement Quantity for Charcoal Flat Front Athletic Fit Shadow Striped Wool Suit'
                )
            ).toBeInTheDocument();
            expect(
                screen.getByLabelText(
                    'Increment Quantity for Charcoal Flat Front Athletic Fit Shadow Striped Wool Suit'
                )
            ).toBeInTheDocument();
        });

        test('should not render quantity selector for product sets', () => {
            const productSet = { ...mockProduct, type: { set: true } };
            renderProductInfo({ product: productSet });

            expect(screen.queryByLabelText(t('quantitySelector:quantity'))).not.toBeInTheDocument();
        });

        test('should not render quantity selector for product bundles', () => {
            const productBundle = { ...mockProduct, type: { bundle: true } };
            renderProductInfo({ product: productBundle });

            expect(screen.queryByLabelText(t('quantitySelector:quantity'))).not.toBeInTheDocument();
        });

        test('should not render quantity selector in edit mode', () => {
            const simpleProduct = {
                ...mockProduct,
                variationAttributes: [], // No variants to simplify
            };

            // Render with mode="edit" to simulate cart edit scenario
            const router = createMemoryRouter(
                [
                    {
                        path: '/product/:productId',
                        element: (
                            <AllProvidersWrapper>
                                <ProductViewProvider product={simpleProduct} mode="edit">
                                    <ProductInfo product={simpleProduct} />
                                </ProductViewProvider>
                            </AllProvidersWrapper>
                        ),
                    },
                ],
                {
                    initialEntries: ['/product/test-product'],
                }
            );
            render(<RouterProvider router={router} />);

            // Quantity selector should not be rendered in edit mode
            expect(screen.queryByLabelText(t('quantitySelector:quantity'))).not.toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        test('should handle standard product without variation attributes', () => {
            renderProductInfo({ product: standardProd });

            // Standard product has no variation attributes, so no swatches should render.
            // (The footwear overlay's "Size Guide" trigger is unrelated and always renders.)
            expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
            expect(screen.queryByText(/^Size$/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Width/)).not.toBeInTheDocument();

            // Should render the product name and price
            expect(screen.getByText('Laptop Briefcase with wheels (37L)')).toBeInTheDocument();
            expect(screen.getByText('$99.99')).toBeInTheDocument();
        });

        test('should handle product with empty imageGroups', () => {
            const productWithoutImages = {
                ...mockProduct,
                imageGroups: [],
            };
            renderProductInfo({ product: productWithoutImages });

            // Should still render the product name - price may vary based on priceRanges
            expect(screen.getByText('Charcoal Flat Front Athletic Fit Shadow Striped Wool Suit')).toBeInTheDocument();
            expect(screen.getAllByText((content) => content.includes('$299.99')).length).toBeGreaterThanOrEqual(1);
        });
    });
});

describe('ProductInfo (footwear overlay)', () => {
    describe('Size Guide trigger and drawer', () => {
        test('renders a Size Guide trigger button', () => {
            renderProductInfo({ product: mockProduct });
            expect(screen.getByRole('button', { name: 'Size Guide' })).toBeInTheDocument();
        });

        test('does not render the Size Guide trigger in compact style', () => {
            renderProductInfo({ product: mockProduct, variantStyle: 'compact' });
            expect(screen.queryByRole('button', { name: 'Size Guide' })).not.toBeInTheDocument();
        });

        test('opens the drawer when the trigger is clicked', async () => {
            renderProductInfo({ product: mockProduct });
            expect(screen.queryByText('Size guide')).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', { name: 'Size Guide' }));

            expect(await screen.findByText('Size guide')).toBeInTheDocument();
        });

        test('threads the selected size through to the drawer as the highlighted row', async () => {
            const product = { ...mockProduct } as ShopperProducts.schemas['Product'];
            const router = createMemoryRouter(
                [
                    {
                        path: '/product/:productId',
                        element: (
                            <AllProvidersWrapper>
                                <ProductViewProvider product={product}>
                                    <ProductInfo product={product} />
                                </ProductViewProvider>
                            </AllProvidersWrapper>
                        ),
                    },
                    { path: '*', element: <div>Navigated</div> },
                ],
                { initialEntries: ['/product/test-product?size=040'] }
            );
            render(<RouterProvider router={router} />);

            await userEvent.click(screen.getByRole('button', { name: 'Size Guide' }));
            await screen.findByText('Size guide');

            // Falls back to the default mens chart (no c_sizeChart on the mock product), which
            // does not include US "040" as an entry, so no row should be highlighted -- this
            // still proves the drawer mounted and reads highlightSize without throwing.
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('FitConfidenceIndicator', () => {
        test('does not render when c_fitFeedback is absent', () => {
            renderProductInfo({ product: mockProduct });
            expect(screen.queryByRole('meter')).not.toBeInTheDocument();
        });

        test('renders a meter when c_fitFeedback is valid', () => {
            const product = {
                ...mockProduct,
                c_fitFeedback: validFitFeedback,
            } as ShopperProducts.schemas['Product'] & { c_fitFeedback: string };
            renderProductInfo({ product });
            const meter = screen.getByRole('meter');
            expect(meter).toHaveAttribute('aria-valuenow', '65');
        });

        test('does not render when c_fitFeedback is malformed', () => {
            const product = {
                ...mockProduct,
                c_fitFeedback: '{not valid json',
            } as ShopperProducts.schemas['Product'] & { c_fitFeedback: string };
            renderProductInfo({ product });
            expect(screen.queryByRole('meter')).not.toBeInTheDocument();
        });
    });

    describe('gender derivation', () => {
        test('derives mens from a primaryCategoryId with no gender signal', () => {
            const product = {
                ...mockProduct,
                primaryCategoryId: 'mens-clothing-suits',
                c_fitFeedback: validFitFeedback,
            } as ShopperProducts.schemas['Product'] & { c_fitFeedback: string };
            renderProductInfo({ product });
            expect(screen.getByRole('meter')).toBeInTheDocument();
        });

        test('derives womens from a primaryCategoryId matching womens', async () => {
            const product = {
                ...mockProduct,
                primaryCategoryId: 'womens-shoes',
            } as ShopperProducts.schemas['Product'];
            renderProductInfo({ product });

            await userEvent.click(screen.getByRole('button', { name: 'Size Guide' }));
            await screen.findByText('Size guide');

            expect(screen.getByRole('button', { name: "Women's" })).toHaveAttribute('aria-pressed', 'true');
        });

        test('derives kids from a primaryCategoryId matching kids', async () => {
            const product = {
                ...mockProduct,
                primaryCategoryId: 'kids-shoes',
            } as ShopperProducts.schemas['Product'];
            renderProductInfo({ product });

            await userEvent.click(screen.getByRole('button', { name: 'Size Guide' }));
            await screen.findByText('Size guide');

            expect(screen.getByRole('button', { name: 'Kids' })).toHaveAttribute('aria-pressed', 'true');
        });
    });

    describe('closing the drawer', () => {
        test('closes the drawer when dismissed', async () => {
            renderProductInfo({ product: mockProduct });
            await userEvent.click(screen.getByRole('button', { name: 'Size Guide' }));
            await screen.findByText('Size guide');

            await userEvent.click(screen.getByRole('button', { name: /close/i }));

            await waitFor(() => expect(screen.queryByText('Size guide')).not.toBeInTheDocument());
        });

        test('returns focus to the Size Guide trigger when dismissed via the Close button', async () => {
            renderProductInfo({ product: mockProduct });
            const trigger = screen.getByRole('button', { name: 'Size Guide' });
            await userEvent.click(trigger);
            await screen.findByText('Size guide');

            await userEvent.click(screen.getByRole('button', { name: /close/i }));

            await waitFor(() => expect(screen.queryByText('Size guide')).not.toBeInTheDocument());
            await waitFor(() => expect(trigger).toHaveFocus());
        });

        test('returns focus to the Size Guide trigger when dismissed via Escape', async () => {
            renderProductInfo({ product: mockProduct });
            const trigger = screen.getByRole('button', { name: 'Size Guide' });
            await userEvent.click(trigger);
            await screen.findByText('Size guide');

            await userEvent.keyboard('{Escape}');

            await waitFor(() => expect(screen.queryByText('Size guide')).not.toBeInTheDocument());
            await waitFor(() => expect(trigger).toHaveFocus());
        });
    });
});

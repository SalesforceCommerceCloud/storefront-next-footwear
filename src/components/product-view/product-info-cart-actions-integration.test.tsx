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

// Regression coverage for the footwear size/width Add-to-Cart bug: ProductInfo's local
// size/width picks used to feed only its own display logic, while ProductCartActions read
// currentVariant from a URL-only source in ProductViewProvider. A shopper could pick a size and
// width, see the display update, yet Add to Cart stayed disabled (or added the wrong variant).
// This composes both consumers under one ProductViewProvider -- the way the real PDP does --
// so a regression in the shared selectionsOverride plumbing fails here even though it wouldn't
// fail in either component's isolated test file.
//
// It uses the REAL useProductActions/handleAddToCart (no stubbed handler) and observes what the
// handler actually submits to the cart-item-add action route, so it proves Add to Cart targets the
// resolved SKU -- not merely that the button became clickable.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import ProductInfo from './product-info';
import ProductCartActions from '@/components/product-cart-actions';
import ProductViewProvider from '@/providers/product-view';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import { masterProduct as mockProduct } from '@/components/__mocks__/master-variant-product';
import { getTranslation } from '@salesforce/storefront-next-runtime/i18n';

const { t } = getTranslation();

// Footwear resolves size/width entirely client-side, so the shared provider hydrates the selected
// SKU's authoritative inventory (via useProductActions) before enabling Add to Cart. A unit render
// has no resource route to answer that fetch, so stub useScapiFetcher: the getProduct hydration
// call resolves synchronously to an orderable SKU (keyed by the requested id) so the button can
// enable, and every other call stays idle -- matching an un-fired fetcher for unrelated consumers.
vi.mock('@/hooks/use-scapi-fetcher', () => {
    const cache = new Map<string, unknown>();
    return {
        useScapiFetcher: (client: string, method: string, options?: { params?: { path?: { id?: string } } }) => {
            if (client === 'shopperProducts' && method === 'getProduct') {
                const id = options?.params?.path?.id ?? 'unknown';
                if (!cache.has(id)) {
                    cache.set(id, {
                        load: () => Promise.resolve(),
                        state: 'idle',
                        success: true,
                        data: { id, inventory: { orderable: true, ats: 50, stockLevel: 50 } },
                        errors: undefined,
                    });
                }
                return cache.get(id);
            }
            return { load: () => Promise.resolve(), state: 'idle', success: false, data: undefined, errors: undefined };
        },
    };
});

// Captures the productItem the real handleAddToCart submits to the cart-item-add action route.
const capturedProductItems: Array<{ productId?: string; quantity?: number }> = [];

const renderProductViewWithCartActions = () => {
    const router = createMemoryRouter(
        [
            {
                path: '/product/:productId',
                element: (
                    <AllProvidersWrapper>
                        <ProductViewProvider product={mockProduct}>
                            <ProductInfo product={mockProduct} />
                            <ProductCartActions product={mockProduct} />
                        </ProductViewProvider>
                    </AllProvidersWrapper>
                ),
            },
            {
                // The real handleAddToCart submits here; capture the payload instead of hitting SCAPI.
                path: '/action/cart-item-add',
                action: async ({ request }) => {
                    const formData = await request.formData();
                    const raw = formData.get('productItem');
                    if (typeof raw === 'string') {
                        capturedProductItems.push(JSON.parse(raw));
                    }
                    return { success: true };
                },
            },
        ],
        { initialEntries: ['/product/test-product'] }
    );
    return { ...render(<RouterProvider router={router} />), router };
};

describe('ProductInfo + ProductCartActions integration (shared ProductViewProvider)', () => {
    beforeEach(() => {
        capturedProductItems.length = 0;
    });

    test('Add to Cart is disabled and prompts for selection before size/width are picked', () => {
        renderProductViewWithCartActions();

        expect(screen.getByText(t('product:selectAllOptions'))).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
    });

    test('Add to Cart enables and submits the matching variant SKU after picking size then width', async () => {
        const user = userEvent.setup();
        renderProductViewWithCartActions();

        const addToCartButton = screen.getByRole('button', { name: /add to cart/i });
        expect(addToCartButton).toBeDisabled();

        // Size 40 alone matches 3 variants (widths S/V/L), so this also proves width is required
        // to resolve a unique variant. Size 40 + Short width resolves to the unique variant
        // 640188017041M in the mock data.
        await user.click(screen.getByRole('radio', { name: /size 40, available/i }));
        await user.click(screen.getByRole('radio', { name: /^short$/i }));

        await waitFor(() => {
            expect(addToCartButton).toBeEnabled();
        });
        expect(screen.queryByText(t('product:selectAllOptions'))).not.toBeInTheDocument();

        await user.click(addToCartButton);

        // The real handler must submit the SKU the shared provider resolved from size+width -- proves
        // Add to Cart targets the right variant, not just that the button unlocked. The sole color
        // auto-selects but doesn't narrow the tuple; Size 40 + Short = 640188017041M.
        await waitFor(() => {
            expect(capturedProductItems).toHaveLength(1);
        });
        expect(capturedProductItems[0]?.productId).toBe('640188017041M');
    });

    test('does not resolve a variant (Add to Cart stays disabled) when only size is picked', async () => {
        const user = userEvent.setup();
        renderProductViewWithCartActions();

        // Size 40 matches 3 variants (widths S/V/L) until a width is also picked.
        await user.click(screen.getByRole('radio', { name: /size 40, available/i }));

        expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
        expect(screen.getByText(t('product:selectAllOptions'))).toBeInTheDocument();
    });
});

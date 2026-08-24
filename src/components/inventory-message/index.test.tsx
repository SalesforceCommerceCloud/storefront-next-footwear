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
 * Footwear overlay of InventoryMessage: covers the added width-aware low-stock behavior and the
 * per-width transient-safety gate. The shared status/orderable/SR-cue logic is exercised by the
 * canonical component's own test suite.
 *
 * The gate: when a selected width/size resolves to a SKU whose own inventory has not been fetched
 * yet (currentVariant.inventory absent AND currentVariant.productId !== product.id), the component
 * reports UNKNOWN and leaves the live region empty instead of labeling the previously loaded SKU's
 * stock with the newly selected width. It self-heals once the PDP loader revalidates for the
 * selected variant and delivers matching inventory.
 */

import { render, screen } from '@testing-library/react';
import type { ShopperProducts } from '@/scapi';
import InventoryMessage from './index';

type VariantWithInventory = ShopperProducts.schemas['Variant'] & {
    inventory?: ShopperProducts.schemas['Inventory'];
};

// A master with two widths (D → Standard, 2E → Wide). The width-aware low-stock message reads
// `variationAttributes.width.values[].name` for its raw label, then spells out bare US width codes
// via lib/width-labels (D → "Standard", 2E → "Wide") so the message matches the width selector.
const makeMaster = (
    loadedSku: string,
    loadedInventory: ShopperProducts.schemas['Inventory'] | undefined
): ShopperProducts.schemas['Product'] =>
    ({
        id: loadedSku,
        name: 'Trail Runner',
        inventory: loadedInventory,
        variants: [
            { productId: 'shoe-D', orderable: true, variationValues: { width: 'D' } },
            { productId: 'shoe-2E', orderable: true, variationValues: { width: '2E' } },
        ],
        variationAttributes: [
            {
                id: 'width',
                name: 'Width',
                values: [
                    { value: 'D', name: 'D' },
                    { value: '2E', name: '2E' },
                ],
            },
        ],
    }) as ShopperProducts.schemas['Product'];

const lowStock = (ats: number): ShopperProducts.schemas['Inventory'] =>
    ({
        id: `inv-${ats}`,
        ats,
        orderable: true,
        backorderable: false,
        preorderable: false,
    }) as ShopperProducts.schemas['Inventory'];

describe('InventoryMessage (footwear) — per-width transient safety', () => {
    it('names the selected width in the low-stock message when the selected SKU inventory is loaded', () => {
        const product = makeMaster('shoe-D', lowStock(2));
        const variant = {
            productId: 'shoe-D',
            orderable: true,
            variationValues: { width: 'D' },
            inventory: lowStock(2),
        } as VariantWithInventory;

        render(<InventoryMessage product={product} currentVariant={variant} lowStockThreshold={5} />);

        expect(screen.getByText('Few items left in width Standard')).toBeInTheDocument();
    });

    it('leaves the live region empty (UNKNOWN) while a newly selected width awaits its own inventory', () => {
        // Still loaded for shoe-D (low stock), but the shopper just picked width 2E. The 2E SKU differs
        // from the loaded SKU and its inventory has not arrived — the stale shoe-D stock must NOT be
        // relabeled "in width Wide".
        const product = makeMaster('shoe-D', lowStock(2));
        const selectedWidth2E = {
            productId: 'shoe-2E',
            orderable: true,
            variationValues: { width: '2E' },
        } as VariantWithInventory;

        render(<InventoryMessage product={product} currentVariant={selectedWidth2E} lowStockThreshold={5} />);

        const region = screen.getByRole('status');
        expect(region).not.toHaveAttribute('aria-hidden');
        expect(region).toBeEmptyDOMElement();
        // The critical negative: the previously loaded SKU's stock is never announced against width 2E.
        expect(screen.queryByText('Few items left in width Wide')).not.toBeInTheDocument();
        expect(screen.queryByText('Few items left in width Standard')).not.toBeInTheDocument();
    });

    it('transitions low-stock(D) -> empty(2E pending) -> correct message once 2E inventory arrives', () => {
        // State 1: width D is the loaded SKU and low on stock.
        const productD = makeMaster('shoe-D', lowStock(2));
        const variantD = {
            productId: 'shoe-D',
            orderable: true,
            variationValues: { width: 'D' },
            inventory: lowStock(2),
        } as VariantWithInventory;

        const { rerender } = render(
            <InventoryMessage product={productD} currentVariant={variantD} lowStockThreshold={5} />
        );
        expect(screen.getByText('Few items left in width Standard')).toBeInTheDocument();

        // State 2: shopper selects width 2E; its SKU differs from the loaded SKU and has no inventory
        // yet. The region goes empty rather than mislabeling shoe-D's stock as width 2E.
        const selectedWidth2E = {
            productId: 'shoe-2E',
            orderable: true,
            variationValues: { width: '2E' },
        } as VariantWithInventory;
        rerender(<InventoryMessage product={productD} currentVariant={selectedWidth2E} lowStockThreshold={5} />);

        expect(screen.getByRole('status')).toBeEmptyDOMElement();
        expect(screen.queryByText(/width (Standard|Wide)/)).not.toBeInTheDocument();

        // State 3: the pid-synced loader revalidated — product.id is now shoe-2E and its own low-stock
        // inventory is present. The correct per-width message is announced.
        const product2E = makeMaster('shoe-2E', lowStock(1));
        const variant2E = {
            productId: 'shoe-2E',
            orderable: true,
            variationValues: { width: '2E' },
            inventory: lowStock(1),
        } as VariantWithInventory;
        rerender(<InventoryMessage product={product2E} currentVariant={variant2E} lowStockThreshold={5} />);

        expect(screen.getByText('1 item left in width Wide')).toBeInTheDocument();
    });

    it('still reports out-of-stock for a definitively non-orderable selected width even before its inventory loads', () => {
        // orderable === false is a reliable per-variant flag; the SKU-mismatch gate must not suppress it.
        const product = makeMaster('shoe-D', lowStock(2));
        const nonOrderableWidth2E = {
            productId: 'shoe-2E',
            orderable: false,
            variationValues: { width: '2E' },
        } as VariantWithInventory;

        render(<InventoryMessage product={product} currentVariant={nonOrderableWidth2E} lowStockThreshold={5} />);

        expect(screen.getByText('Out of stock')).toBeInTheDocument();
    });
});

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

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import type { ReactElement } from 'react';
import type { ShopperProducts } from '@/scapi';
import InventoryMessage from '../index';

type VariantWithInventory = ShopperProducts.schemas['Variant'] & {
    inventory?: ShopperProducts.schemas['Inventory'];
};

/**
 * The `width` variation attribute shared by the width-aware low-stock stories below. Values use
 * the standard shoe-width codes (`B` narrow, `D` medium, `2E` wide) as both the `value` and the
 * display `name`, matching the component's own JSDoc examples ("Few items left in width D").
 */
const WIDTH_ATTRIBUTE: ShopperProducts.schemas['VariationAttribute'] = {
    id: 'width',
    name: 'Width',
    values: [
        { value: 'B', name: 'B' },
        { value: 'D', name: 'D' },
        { value: '2E', name: '2E' },
    ],
};

const createMockProduct = (
    inventory?: Partial<ShopperProducts.schemas['Inventory']>,
    withWidths = false
): ShopperProducts.schemas['Product'] => ({
    id: 'footwear-trail-runner-123',
    name: 'Trail Runner',
    ...(inventory ? { inventory: inventory as ShopperProducts.schemas['Inventory'] } : {}),
    ...(withWidths ? { variationAttributes: [WIDTH_ATTRIBUTE] } : {}),
});

const createMockVariant = (
    width: string,
    inventory: Partial<ShopperProducts.schemas['Inventory']>
): VariantWithInventory => ({
    productId: `footwear-trail-runner-123-${width}`,
    variationValues: { width },
    inventory: inventory as ShopperProducts.schemas['Inventory'],
});

/**
 * Footwear overlay of the canonical Inventory Message component. Identical props to canonical,
 * plus a width-aware low-stock message ("Few items left in width D" / "1 item left in width D")
 * derived internally from `product.variationAttributes` + `currentVariant.variationValues.width`
 * — the qualifier never turns into an exact stock count.
 */
const meta: Meta<typeof InventoryMessage> = {
    title: 'Footwear/Product/Inventory Message',
    component: InventoryMessage,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: `
Footwear overlay of the canonical Inventory Message component. Displays inventory status for
products on the Product Detail Page (PDP), with an additional width-qualified low-stock message
for shoe widths.

**Features:**
- **In Stock**: Green message
- **Low Stock**: Warning message, bucketed ("Few items left" / "1 item left"); on footwear PDPs
  with a width selected, names the width ("Few items left in width D" / "1 item left in width D")
- **Pre-Order**: Blue message for pre-orderable items
- **Back Order**: Orange message for back-orderable items
- **Out of Stock**: Red message when the product is unavailable
- **Unknown**: Hidden by default (\`showUnknownStatus\`), used while awaiting variant selection

Stock levels are always bucketed, never surfaced as exact counts — the width qualifier only
names which width the bucketed message refers to.
                `,
            },
        },
    },
    decorators: [
        (Story: React.ComponentType): ReactElement => (
            <div className="p-8">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        product: {
            description: 'Product data containing inventory information',
            control: false,
        },
        currentVariant: {
            description: 'Current variant if product has variations',
            control: false,
        },
        className: {
            description: 'Additional CSS classes to apply',
            control: 'text',
        },
        lowStockThreshold: {
            description: 'Stock level at or below which the item is considered "low stock"',
            control: 'number',
        },
        showUnknownStatus: {
            description: 'Whether to show unknown inventory status messages',
            control: 'boolean',
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * In stock: green bucketed message, no exact count.
 */
export const InStock: Story = {
    args: {
        product: createMockProduct({
            orderable: true,
            ats: 25,
            backorderable: false,
            preorderable: false,
        }),
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('In stock')).toBeInTheDocument();
    },
};

/**
 * Low stock with no width selected — generic bucketed message, same as canonical.
 */
export const LowStock: Story = {
    args: {
        product: createMockProduct({
            orderable: true,
            ats: 3,
            backorderable: false,
            preorderable: false,
        }),
        lowStockThreshold: 5,
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Few items left')).toBeInTheDocument();
    },
};

/**
 * Low stock with a selected width — names the width without exposing the exact count.
 */
export const LowStockWithWidth: Story = {
    args: {
        product: createMockProduct(undefined, true),
        currentVariant: createMockVariant('D', {
            orderable: true,
            ats: 3,
            backorderable: false,
            preorderable: false,
        }),
        lowStockThreshold: 5,
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Few items left in width D')).toBeInTheDocument();
        await expect(canvas.queryByText(/^Few items left$/)).not.toBeInTheDocument();
    },
};

/**
 * Low stock with a selected width and exactly one unit left — singular copy ("1 item left in
 * width D"), still no exact count beyond the singular/plural distinction.
 */
export const LowStockWithWidthOneLeft: Story = {
    args: {
        product: createMockProduct(undefined, true),
        currentVariant: createMockVariant('D', {
            orderable: true,
            ats: 1,
            backorderable: false,
            preorderable: false,
        }),
        lowStockThreshold: 5,
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('1 item left in width D')).toBeInTheDocument();
    },
};

/**
 * Pre-order: blue message for pre-orderable items.
 */
export const PreOrder: Story = {
    args: {
        product: createMockProduct({
            orderable: true,
            preorderable: true,
            backorderable: false,
            ats: 0,
        }),
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Available for pre-order')).toBeInTheDocument();
    },
};

/**
 * Back order: orange message for back-orderable items.
 */
export const BackOrder: Story = {
    args: {
        product: createMockProduct({
            orderable: true,
            preorderable: false,
            backorderable: true,
            ats: 0,
        }),
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Available for back order')).toBeInTheDocument();
    },
};

/**
 * Out of stock: red message when the product is not orderable.
 */
export const OutOfStock: Story = {
    args: {
        product: createMockProduct({
            orderable: false,
            preorderable: false,
            backorderable: false,
            ats: 0,
        }),
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Out of stock')).toBeInTheDocument();
    },
};

/**
 * Unknown status, hidden (default): the live region stays in the a11y tree but renders empty
 * while awaiting inventory data (e.g. a master product before a variant is chosen).
 */
export const UnknownHidden: Story = {
    args: {
        product: createMockProduct(),
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const region = canvas.getByRole('status');
        await expect(region).toBeEmptyDOMElement();
        await expect(canvas.queryByText('Inventory unavailable')).not.toBeInTheDocument();
    },
};

/**
 * Unknown status, shown via `showUnknownStatus`: used for surfaces that want an explicit
 * "inventory unavailable" message instead of hiding it.
 */
export const UnknownVisible: Story = {
    args: {
        product: createMockProduct(),
        showUnknownStatus: true,
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        await expect(canvas.getByText('Inventory unavailable')).toBeInTheDocument();
    },
};

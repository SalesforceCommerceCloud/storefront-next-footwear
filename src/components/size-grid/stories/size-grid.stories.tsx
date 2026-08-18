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
import { expect, within, userEvent } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { SizeGrid, type SizeOption } from '../size-grid';

const STANDARD_SIZES: SizeOption[] = [
    { value: '080', label: '8', available: true },
    { value: '085', label: '8.5', available: true, half: true },
    { value: '090', label: '9', available: true },
    { value: '095', label: '9.5', available: true, half: true },
    { value: '100', label: '10', available: true },
    { value: '105', label: '10.5', available: false, half: true },
    { value: '110', label: '11', available: false },
];

const meta: Meta<typeof SizeGrid> = {
    title: 'Footwear/Product/Size Grid',
    component: SizeGrid,
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Grid layout for selecting a shoe size. Always shows every size option (never a dropdown), rendering half sizes in italics and disabling sizes unavailable for the current color/width.',
            },
        },
    },
    tags: ['autodocs', 'interaction'],
    argTypes: {
        selectedSize: { control: 'text' },
        label: { control: 'text' },
        onSizeChange: { table: { disable: true } },
    },
};

export default meta;
type Story = StoryObj<typeof SizeGrid>;

export const Default: Story = {
    args: {
        label: 'Size',
        availableSizes: STANDARD_SIZES,
        selectedSize: '090',
        onSizeChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const group = await canvas.findByRole('radiogroup');
        await expect(group).toBeInTheDocument();

        const nine = await canvas.findByRole('radio', { name: /size 9, available/i });
        await expect(nine).toHaveAttribute('aria-checked', 'true');

        const halfTen = await canvas.findByRole('radio', { name: /size 10\.5, not available/i });
        await expect(halfTen).toHaveAttribute('aria-disabled', 'true');
    },
};

export const KeyboardNavigation: Story = {
    args: {
        label: 'Size',
        availableSizes: STANDARD_SIZES,
        selectedSize: '090',
        onSizeChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const nine = await canvas.findByRole('radio', { name: /size 9, available/i });
        nine.focus();
        await expect(nine).toHaveFocus();

        await userEvent.keyboard('{ArrowRight}');
        const nineHalf = await canvas.findByRole('radio', { name: /size 9\.5, available/i });
        await expect(nineHalf).toHaveFocus();
    },
};

export const NarrowViewport: Story = {
    args: {
        label: 'Size',
        availableSizes: STANDARD_SIZES,
        selectedSize: '090',
        onSizeChange: () => {},
    },
    decorators: [
        (Story) => (
            <div style={{ width: 320, overflow: 'hidden' }}>
                <Story />
            </div>
        ),
    ],
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const group = await canvas.findByRole('radiogroup');
        await expect(group.scrollWidth).toBeLessThanOrEqual(320);
    },
};

export const AllUnavailable: Story = {
    args: {
        label: 'Size',
        availableSizes: STANDARD_SIZES.map((option) => ({ ...option, available: false })),
        selectedSize: '',
        onSizeChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const eight = await canvas.findByRole('radio', { name: /size 8, not available/i });
        await expect(eight).toHaveAttribute('aria-disabled', 'true');
    },
};

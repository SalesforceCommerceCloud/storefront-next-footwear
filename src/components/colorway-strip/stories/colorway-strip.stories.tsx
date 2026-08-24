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
import { expect, userEvent, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { ColorwayStrip, type ColorwayOption } from '../index';

const colorways: ColorwayOption[] = [
    {
        colorwayId: 'university-blue',
        colorwayName: 'University Blue / White / Black',
        thumbnailImage: '/images/footwear/product-blue.jpg',
        available: true,
    },
    {
        colorwayId: 'triple-black',
        colorwayName: 'Triple Black',
        thumbnailImage: '/images/footwear/product-black.jpg',
        available: true,
    },
    {
        colorwayId: 'crimson-red',
        colorwayName: 'Crimson Red',
        thumbnailImage: '/images/footwear/product-red.jpg',
        available: false,
    },
];

const meta: Meta<typeof ColorwayStrip> = {
    title: 'Footwear/Product/Colorway Strip',
    component: ColorwayStrip,
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'PDP-only product-image color selector. The PDP owns selection so its existing gallery and variant availability update together.',
            },
        },
    },
    tags: ['autodocs', 'interaction'],
    argTypes: {
        onColorwayChange: { table: { disable: true } },
    },
};

export default meta;
type Story = StoryObj<typeof ColorwayStrip>;

export const Default: Story = {
    args: {
        colorways,
        selectedColorwayId: 'university-blue',
        onColorwayChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const group = await canvas.findByRole('radiogroup', { name: /colou?r/i });
        await expect(group).toBeInTheDocument();
        await expect(canvas.getByRole('radio', { name: 'University Blue / White / Black' })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        await expect(canvas.getByRole('radio', { name: 'Crimson Red (out of stock)' })).toHaveAttribute(
            'aria-disabled',
            'true'
        );
    },
};

export const KeyboardNavigation: Story = {
    args: {
        colorways,
        selectedColorwayId: 'university-blue',
        onColorwayChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const blue = await canvas.findByRole('radio', { name: 'University Blue / White / Black' });
        blue.focus();
        await userEvent.keyboard('{ArrowRight}');
        await expect(canvas.getByRole('radio', { name: 'Triple Black' })).toHaveFocus();
    },
};

export const Overflow: Story = {
    args: {
        colorways: Array.from({ length: 9 }, (_, index) => ({
            colorwayId: `color-${index + 1}`,
            colorwayName: `Colorway ${index + 1}`,
            thumbnailImage: `/images/footwear/product-${index + 1}.jpg`,
            available: true,
        })),
        selectedColorwayId: 'color-1',
        onColorwayChange: () => {},
    },
    decorators: [
        (Story) => (
            <div style={{ width: 320 }}>
                <Story />
            </div>
        ),
    ],
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const group = await canvas.findByRole('radiogroup');
        await expect(canvas.getAllByRole('radio')).toHaveLength(9);
        await expect(group.scrollWidth).toBeGreaterThan(group.clientWidth);
    },
};

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
import { WidthSelector, type WidthOption } from '../width-selector';

const STANDARD_WIDTHS: WidthOption[] = [
    { code: 'N', label: 'Narrow', available: true },
    { code: 'M', label: 'Medium', available: true },
    { code: 'W', label: 'Wide', available: true },
    { code: 'EW', label: 'Extra Wide', available: false, tooltip: 'Not available in this size. Try a half size up.' },
];

const meta: Meta<typeof WidthSelector> = {
    title: 'Footwear/Product/Width Selector',
    component: WidthSelector,
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Horizontal button group for selecting a shoe width. Always shows every width option (never a dropdown), disabling widths unavailable for the current size with an educational tooltip.',
            },
        },
    },
    tags: ['autodocs', 'interaction'],
    argTypes: {
        selectedWidth: { control: 'text' },
        displayMode: { control: 'radio', options: ['codes', 'labels', 'both'] },
        label: { control: 'text' },
        onWidthChange: { table: { disable: true } },
    },
};

export default meta;
type Story = StoryObj<typeof WidthSelector>;

export const Default: Story = {
    args: {
        label: 'Width',
        availableWidths: STANDARD_WIDTHS,
        selectedWidth: 'M',
        displayMode: 'both',
        onWidthChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const group = await canvas.findByRole('radiogroup');
        await expect(group).toBeInTheDocument();

        const medium = await canvas.findByRole('radio', { name: /medium/i });
        await expect(medium).toHaveAttribute('aria-checked', 'true');

        const extraWide = await canvas.findByRole('radio', { name: /extra wide.*out of stock/i });
        await expect(extraWide).toHaveAttribute('aria-disabled', 'true');
    },
};

export const CodesOnly: Story = {
    args: {
        label: 'Width',
        availableWidths: STANDARD_WIDTHS,
        selectedWidth: 'M',
        displayMode: 'codes',
        onWidthChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const narrow = await canvas.findByRole('radio', { name: /^n$/i });
        await expect(narrow).toBeInTheDocument();
    },
};

export const KeyboardNavigation: Story = {
    args: {
        label: 'Width',
        availableWidths: STANDARD_WIDTHS,
        selectedWidth: 'M',
        displayMode: 'labels',
        onWidthChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const medium = await canvas.findByRole('radio', { name: /medium/i });
        medium.focus();
        await expect(medium).toHaveFocus();

        await userEvent.keyboard('{ArrowRight}');
        const wide = await canvas.findByRole('radio', { name: /^wide$/i });
        await expect(wide).toHaveFocus();
    },
};

export const AllUnavailable: Story = {
    args: {
        label: 'Width',
        availableWidths: STANDARD_WIDTHS.map((option) => ({ ...option, available: false })),
        selectedWidth: '',
        displayMode: 'labels',
        onWidthChange: () => {},
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const narrow = await canvas.findByRole('radio', { name: /narrow/i });
        await expect(narrow).toHaveAttribute('aria-disabled', 'true');
    },
};

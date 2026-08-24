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
import RefineCushioning from '..';
import { action } from 'storybook/actions';
import type { ComponentType } from 'react';
import { expect, within, userEvent } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import type { FilterValue } from '@/components/category-refinements/types';

const ALL_CUSHIONING_VALUES: FilterValue[] = [
    { value: 'light', label: 'Light', hitCount: 14 },
    { value: 'moderate', label: 'Moderate', hitCount: 22 },
    { value: 'maximum', label: 'Maximum', hitCount: 9 },
];
const MAX_VALUES = ALL_CUSHIONING_VALUES.length;

type SyntheticArgs = {
    valueCount: number;
    selectedValues: string;
};

const meta: Meta<typeof RefineCushioning> = {
    title: 'Footwear/Category Refinements/Refine Cushioning',
    component: RefineCushioning,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Cushioning (`c_cushioning`) filter inside the footwear PLP side-panel filters. Renders a flex-wrap pill list of outline buttons, one per value, with hit count. Multi-select supported.',
            },
        },
    },
};

export default meta;

/**
 * All three cushioning levels with "Moderate" pre-selected. `valueCount` slices the
 * canonical list (1-3). `selectedValues` is a comma-separated list of `value` fields
 * to render selected (multi-select supported).
 */
export const FullyFeatured: StoryObj<ComponentType<Partial<SyntheticArgs>>> = {
    args: {
        valueCount: 3,
        selectedValues: 'moderate',
    },
    argTypes: {
        valueCount: {
            description: `Synthetic: number of cushioning pills to render (1-${MAX_VALUES}).`,
            control: { type: 'number', min: 1, max: MAX_VALUES, step: 1 },
            table: { category: 'Synthetic (data shape)' },
        },
        selectedValues: {
            description:
                'Synthetic: comma-separated list of values to render selected (e.g. `light,maximum`). Empty string = no selection.',
            control: 'text',
            table: { category: 'Synthetic (data shape)' },
        },
    },
    render: (args) => {
        const synthetic: SyntheticArgs = {
            valueCount: args.valueCount ?? 3,
            selectedValues: args.selectedValues ?? '',
        };
        const clamped = Math.max(1, Math.min(synthetic.valueCount, MAX_VALUES));
        const values = ALL_CUSHIONING_VALUES.slice(0, clamped);
        const selectedSet = new Set(
            synthetic.selectedValues
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        );
        const isFilterSelected = (attributeId: string, value: string) =>
            attributeId === 'c_cushioning' && selectedSet.has(value);
        return (
            <RefineCushioning
                values={values}
                attributeId="c_cushioning"
                isFilterSelected={isFilterSelected}
                toggleFilter={action('cushioning-toggle-filter')}
            />
        );
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const buttons = canvas.getAllByRole('button');
        await expect(buttons.length).toBeGreaterThan(0);
        const lightButton = buttons.find((btn) => btn.textContent?.includes('Light'));
        if (lightButton) await userEvent.click(lightButton);
    },
};

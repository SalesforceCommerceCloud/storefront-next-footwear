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
import RefineSupport from '..';
import { action } from 'storybook/actions';
import type { ComponentType } from 'react';
import { expect, within, userEvent } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import type { FilterValue } from '@/components/category-refinements/types';

const ALL_SUPPORT_VALUES: FilterValue[] = [
    { value: 'neutral', label: 'Neutral', hitCount: 27 },
    { value: 'stability', label: 'Stability', hitCount: 15 },
    { value: 'motion_control', label: 'Motion Control', hitCount: 7 },
];
const MAX_VALUES = ALL_SUPPORT_VALUES.length;

type SyntheticArgs = {
    valueCount: number;
    selectedValues: string;
};

const meta: Meta<typeof RefineSupport> = {
    title: 'Footwear/Category Refinements/Refine Support',
    component: RefineSupport,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Support type (`c_supportType`) filter inside the footwear PLP side-panel filters. Renders a flex-wrap pill list of outline buttons, one per value, with hit count. Multi-select supported.',
            },
        },
    },
};

export default meta;

/**
 * All three support types with "Stability" pre-selected. `valueCount` slices the
 * canonical list (1-3). `selectedValues` is a comma-separated list of `value` fields
 * to render selected (multi-select supported).
 */
export const FullyFeatured: StoryObj<ComponentType<Partial<SyntheticArgs>>> = {
    args: {
        valueCount: 3,
        selectedValues: 'stability',
    },
    argTypes: {
        valueCount: {
            description: `Synthetic: number of support pills to render (1-${MAX_VALUES}).`,
            control: { type: 'number', min: 1, max: MAX_VALUES, step: 1 },
            table: { category: 'Synthetic (data shape)' },
        },
        selectedValues: {
            description:
                'Synthetic: comma-separated list of values to render selected (e.g. `neutral,stability`). Empty string = no selection.',
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
        const values = ALL_SUPPORT_VALUES.slice(0, clamped);
        const selectedSet = new Set(
            synthetic.selectedValues
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        );
        const isFilterSelected = (attributeId: string, value: string) =>
            attributeId === 'c_supportType' && selectedSet.has(value);
        return (
            <RefineSupport
                values={values}
                attributeId="c_supportType"
                isFilterSelected={isFilterSelected}
                toggleFilter={action('support-toggle-filter')}
            />
        );
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const buttons = canvas.getAllByRole('button');
        await expect(buttons.length).toBeGreaterThan(0);
        const neutralButton = buttons.find((btn) => btn.textContent?.includes('Neutral'));
        if (neutralButton) await userEvent.click(neutralButton);
    },
};

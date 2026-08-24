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
import RefineTerrain from '..';
import { action } from 'storybook/actions';
import type { ComponentType } from 'react';
import { expect, within, userEvent } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import type { FilterValue } from '@/components/category-refinements/types';

const ALL_TERRAIN_VALUES: FilterValue[] = [
    { value: 'road', label: 'Road', hitCount: 31 },
    { value: 'trail', label: 'Trail', hitCount: 18 },
    { value: 'track', label: 'Track', hitCount: 6 },
    { value: 'treadmill', label: 'Treadmill', hitCount: 12 },
    { value: 'multi', label: 'Multi-Surface', hitCount: 9 },
];
const MAX_VALUES = ALL_TERRAIN_VALUES.length;

type SyntheticArgs = {
    valueCount: number;
    selectedValues: string;
};

const meta: Meta<typeof RefineTerrain> = {
    title: 'Footwear/Category Refinements/Refine Terrain',
    component: RefineTerrain,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Terrain (`c_terrain`) filter inside the footwear PLP side-panel filters. Renders a flex-wrap pill list of outline buttons, one per value, with hit count. Multi-select supported.',
            },
        },
    },
};

export default meta;

/**
 * All five terrain values with "Trail" pre-selected. `valueCount` slices the
 * canonical list (1-5). `selectedValues` is a comma-separated list of `value` fields
 * to render selected (multi-select supported).
 */
export const FullyFeatured: StoryObj<ComponentType<Partial<SyntheticArgs>>> = {
    args: {
        valueCount: 5,
        selectedValues: 'trail',
    },
    argTypes: {
        valueCount: {
            description: `Synthetic: number of terrain pills to render (1-${MAX_VALUES}).`,
            control: { type: 'number', min: 1, max: MAX_VALUES, step: 1 },
            table: { category: 'Synthetic (data shape)' },
        },
        selectedValues: {
            description:
                'Synthetic: comma-separated list of values to render selected (e.g. `road,trail`). Empty string = no selection.',
            control: 'text',
            table: { category: 'Synthetic (data shape)' },
        },
    },
    render: (args) => {
        const synthetic: SyntheticArgs = {
            valueCount: args.valueCount ?? 5,
            selectedValues: args.selectedValues ?? '',
        };
        const clamped = Math.max(1, Math.min(synthetic.valueCount, MAX_VALUES));
        const values = ALL_TERRAIN_VALUES.slice(0, clamped);
        const selectedSet = new Set(
            synthetic.selectedValues
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        );
        const isFilterSelected = (attributeId: string, value: string) =>
            attributeId === 'c_terrain' && selectedSet.has(value);
        return (
            <RefineTerrain
                values={values}
                attributeId="c_terrain"
                isFilterSelected={isFilterSelected}
                toggleFilter={action('terrain-toggle-filter')}
            />
        );
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const buttons = canvas.getAllByRole('button');
        await expect(buttons.length).toBeGreaterThan(0);
        const roadButton = buttons.find((btn) => btn.textContent?.includes('Road'));
        if (roadButton) await userEvent.click(roadButton);
    },
};

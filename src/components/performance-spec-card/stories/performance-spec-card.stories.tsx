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
import { PerformanceSpecCard } from '../performance-spec-card';
import type { PerformanceSpec } from '../performance-spec-data';

const FULL_SPEC: PerformanceSpec = {
    cushioning: 'moderate',
    heelToeDrop: 8,
    weight: 255,
    supportType: 'stability',
    terrain: 'road',
};

const meta: Meta<typeof PerformanceSpecCard> = {
    title: 'Footwear/Product/Performance Spec Card',
    component: PerformanceSpecCard,
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'PDP performance spec bar showing cushioning, heel-to-toe drop, weight, support, and terrain as a definition list. Desktop shows the bar inline; mobile collapses behind a "View Specs" accordion trigger. Renders nothing when no specs resolve.',
            },
        },
    },
    tags: ['autodocs', 'interaction'],
    argTypes: {
        displayMode: { control: 'radio', options: ['technical', 'experiential'] },
        specs: { table: { disable: true } },
    },
};

export default meta;
type Story = StoryObj<typeof PerformanceSpecCard>;

export const Technical: Story = {
    args: {
        specs: FULL_SPEC,
        displayMode: 'technical',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const dropTerm = await canvas.findByText(/heel-to-toe drop/i);
        await expect(dropTerm).toBeInTheDocument();

        const dropValue = await canvas.findByText('8 mm');
        await expect(dropValue).toBeInTheDocument();

        const weightValue = await canvas.findByText('255 g');
        await expect(weightValue).toBeInTheDocument();

        const support = await canvas.findByText('Stability');
        await expect(support).toBeInTheDocument();
    },
};

export const Experiential: Story = {
    args: {
        specs: FULL_SPEC,
        displayMode: 'experiential',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const cushioningCopy = await canvas.findByText(/balanced cushioning for everyday miles/i);
        await expect(cushioningCopy).toBeInTheDocument();

        const supportCopy = await canvas.findByText(/gentle guidance to counter overpronation/i);
        await expect(supportCopy).toBeInTheDocument();
    },
};

export const PartialSpecs: Story = {
    args: {
        specs: { cushioning: 'light' },
        displayMode: 'technical',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const cushioningTerm = await canvas.findByText(/cushioning/i);
        await expect(cushioningTerm).toBeInTheDocument();

        const dropTerm = canvas.queryByText(/heel-to-toe drop/i);
        await expect(dropTerm).not.toBeInTheDocument();
    },
};

export const NoSpecs: Story = {
    args: {
        specs: null,
        displayMode: 'technical',
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        // canvasElement is #storybook-root, whose only child is the global StoryShell
        // wrapper decorator — that div is always present, so scope to the spec list itself.
        await expect(canvasElement.querySelector('dl')).not.toBeInTheDocument();
    },
};

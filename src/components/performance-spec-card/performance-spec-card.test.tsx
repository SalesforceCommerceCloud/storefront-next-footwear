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
import { describe, test, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformanceSpecCard } from './performance-spec-card';
import type { PerformanceSpec } from './performance-spec-data';

afterEach(() => {
    cleanup();
});

const FULL_SPEC: PerformanceSpec = {
    cushioning: 'moderate',
    heelToeDrop: 8,
    weight: 255,
    supportType: 'stability',
    terrain: 'road',
};

describe('PerformanceSpecCard', () => {
    test('renders nothing when specs is null', () => {
        const { container } = render(<PerformanceSpecCard specs={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing when specs is undefined', () => {
        const { container } = render(<PerformanceSpecCard specs={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing when specs is an empty object', () => {
        const { container } = render(<PerformanceSpecCard specs={{}} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('renders raw values with units in technical mode', () => {
        render(<PerformanceSpecCard specs={FULL_SPEC} displayMode="technical" />);
        expect(screen.getAllByText('8 mm').length).toBeGreaterThan(0);
        expect(screen.getAllByText('255 g').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Stability').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Road').length).toBeGreaterThan(0);
    });

    test('renders descriptive static copy in experiential mode', () => {
        render(<PerformanceSpecCard specs={FULL_SPEC} displayMode="experiential" />);
        expect(screen.getAllByText(/balanced cushioning for everyday miles/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/gentle guidance to counter overpronation/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/built for pavement and paved paths/i).length).toBeGreaterThan(0);
    });

    test('defaults to technical display mode', () => {
        render(<PerformanceSpecCard specs={FULL_SPEC} />);
        expect(screen.getAllByText('255 g').length).toBeGreaterThan(0);
    });

    test('renders only the fields present in a partial spec', () => {
        render(<PerformanceSpecCard specs={{ cushioning: 'light' }} />);
        expect(screen.getAllByText(/cushioning/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/heel-to-toe drop/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/support/i)).not.toBeInTheDocument();
    });

    test('cushioning dot-scale carries a visible text equivalent alongside the dots', () => {
        render(<PerformanceSpecCard specs={{ cushioning: 'maximum' }} displayMode="technical" />);
        // The dot glyphs are aria-hidden; the enum label text is the accessible equivalent.
        expect(screen.getAllByText('Maximum').length).toBeGreaterThan(0);
    });

    test('support dot-scale carries a visible text equivalent alongside the dots', () => {
        render(<PerformanceSpecCard specs={{ supportType: 'motion_control' }} displayMode="technical" />);
        expect(screen.getAllByText('Motion control').length).toBeGreaterThan(0);
    });

    test('renders spec content in a <dl> definition list', () => {
        render(<PerformanceSpecCard specs={FULL_SPEC} />);
        const lists = document.querySelectorAll('dl');
        expect(lists.length).toBeGreaterThan(0);
    });

    test('mobile accordion trigger reveals the same spec content on click', async () => {
        const user = userEvent.setup();
        render(<PerformanceSpecCard specs={FULL_SPEC} displayMode="technical" />);

        const trigger = screen.getByRole('button', { name: /view specs/i });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await user.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    test('accepts a heel-to-toe drop of zero without suppressing the row', () => {
        render(<PerformanceSpecCard specs={{ heelToeDrop: 0 }} />);
        expect(screen.getAllByText('0 mm').length).toBeGreaterThan(0);
    });
});

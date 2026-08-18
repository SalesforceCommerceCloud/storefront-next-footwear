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
import { describe, test, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidthSelector, type WidthOption } from './width-selector';

afterEach(() => {
    cleanup();
});

const WIDTHS: WidthOption[] = [
    { code: 'N', label: 'Narrow', available: true },
    { code: 'M', label: 'Medium', available: true },
    { code: 'W', label: 'Wide', available: true },
    { code: 'EW', label: 'Extra Wide', available: false, tooltip: 'Not available in this size.' },
];

describe('WidthSelector', () => {
    test('renders a radio for every width option', () => {
        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );

        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(4);
    });

    test('renders nothing when there are no width options', () => {
        const { container } = render(
            <WidthSelector
                label="Width"
                availableWidths={[]}
                selectedWidth=""
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('marks the selected width with aria-checked', () => {
        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );

        expect(screen.getByRole('radio', { name: /medium/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: /narrow/i })).toHaveAttribute('aria-checked', 'false');
    });

    test('marks unavailable widths as aria-disabled and appends an out-of-stock accessible name', () => {
        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );

        const extraWide = screen.getByRole('radio', { name: /extra wide.*out of stock/i });
        expect(extraWide).toHaveAttribute('aria-disabled', 'true');
        expect(extraWide).toHaveAttribute('tabindex', '-1');
    });

    test('links the group to its label via aria-labelledby', () => {
        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );

        const radioGroup = screen.getByRole('radiogroup');
        const labelledById = radioGroup.getAttribute('aria-labelledby');
        expect(labelledById).toBeTruthy();
        expect(document.getElementById(labelledById ?? '')).toHaveTextContent('Width');
    });

    test('calls onWidthChange when an available width is clicked', async () => {
        const user = userEvent.setup();
        const onWidthChange = vi.fn();

        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={onWidthChange}
            />
        );

        await user.click(screen.getByRole('radio', { name: /wide$/i }));
        expect(onWidthChange).toHaveBeenCalledWith('W');
    });

    test('does not call onWidthChange when an unavailable width is clicked', async () => {
        const user = userEvent.setup();
        const onWidthChange = vi.fn();

        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={onWidthChange}
            />
        );

        await user.click(screen.getByRole('radio', { name: /extra wide/i }));
        expect(onWidthChange).not.toHaveBeenCalled();
    });

    test('arrow-right navigates focus to the next available width and reports the change', async () => {
        const user = userEvent.setup();
        const onWidthChange = vi.fn();

        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={onWidthChange}
            />
        );

        screen.getByRole('radio', { name: /medium/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /wide$/i })).toHaveFocus();
        expect(onWidthChange).toHaveBeenCalledWith('W');
    });

    test('arrow navigation skips an unavailable width and lands on the next available one', async () => {
        const user = userEvent.setup();
        const onWidthChange = vi.fn();

        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={onWidthChange}
            />
        );

        screen.getByRole('radio', { name: /wide$/i }).focus();
        await user.keyboard('{ArrowRight}');

        // Extra Wide is unavailable — arrow-right wraps past it to the next available width
        expect(screen.getByRole('radio', { name: /narrow/i })).toHaveFocus();
        expect(onWidthChange).toHaveBeenCalledWith('N');
    });

    test('arrow navigation never focuses an unavailable width', async () => {
        const user = userEvent.setup();

        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );

        screen.getByRole('radio', { name: /wide$/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /extra wide/i })).not.toHaveFocus();
    });

    test('arrow navigation wraps from the last option back to the first', async () => {
        const user = userEvent.setup();

        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );

        screen.getByRole('radio', { name: /extra wide/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /narrow/i })).toHaveFocus();
    });

    test('arrow-left navigates backwards, skipping an unavailable width', async () => {
        const user = userEvent.setup();
        const onWidthChange = vi.fn();

        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={onWidthChange}
            />
        );

        // Narrow is first, so arrow-left wraps backwards past unavailable Extra Wide to Wide
        screen.getByRole('radio', { name: /narrow/i }).focus();
        await user.keyboard('{ArrowLeft}');

        expect(screen.getByRole('radio', { name: /wide$/i })).toHaveFocus();
        expect(onWidthChange).toHaveBeenCalledWith('W');
    });

    test('arrow navigation skips multiple consecutive unavailable widths', async () => {
        const user = userEvent.setup();
        const onWidthChange = vi.fn();
        const widthsWithConsecutiveGaps: WidthOption[] = [
            { code: 'N', label: 'Narrow', available: true },
            { code: 'M', label: 'Medium', available: false },
            { code: 'W', label: 'Wide', available: false },
            { code: 'EW', label: 'Extra Wide', available: true },
        ];

        render(
            <WidthSelector
                label="Width"
                availableWidths={widthsWithConsecutiveGaps}
                selectedWidth="N"
                displayMode="labels"
                onWidthChange={onWidthChange}
            />
        );

        screen.getByRole('radio', { name: /narrow/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /extra wide/i })).toHaveFocus();
        expect(onWidthChange).toHaveBeenCalledWith('EW');
    });

    test('arrow navigation does nothing when every width is unavailable', async () => {
        const user = userEvent.setup();
        const onWidthChange = vi.fn();
        const allUnavailable: WidthOption[] = [
            { code: 'N', label: 'Narrow', available: false },
            { code: 'M', label: 'Medium', available: false },
        ];

        render(
            <WidthSelector
                label="Width"
                availableWidths={allUnavailable}
                selectedWidth="N"
                displayMode="labels"
                onWidthChange={onWidthChange}
            />
        );

        const narrow = screen.getByRole('radio', { name: /narrow/i });
        narrow.focus();
        await user.keyboard('{ArrowRight}');

        expect(narrow).toHaveFocus();
        expect(onWidthChange).not.toHaveBeenCalled();
    });

    test('renders codes-only and labels-only display modes', () => {
        const { rerender } = render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="codes"
                onWidthChange={() => {}}
            />
        );
        expect(screen.getByText('N')).toBeInTheDocument();

        rerender(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="labels"
                onWidthChange={() => {}}
            />
        );
        expect(screen.getByText('Narrow')).toBeInTheDocument();
    });

    test('meets the 44px minimum touch target regardless of display mode', () => {
        render(
            <WidthSelector
                label="Width"
                availableWidths={WIDTHS}
                selectedWidth="M"
                displayMode="codes"
                onWidthChange={() => {}}
            />
        );

        const narrow = screen.getByRole('radio', { name: /^n$/i });
        expect(narrow.className).toContain('min-w-11');
        expect(narrow.className).toContain('min-h-11');
    });
});

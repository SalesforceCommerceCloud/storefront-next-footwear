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
import { SizeGrid, type SizeOption } from './size-grid';

afterEach(() => {
    cleanup();
});

const SIZES: SizeOption[] = [
    { value: '090', label: '9', available: true },
    { value: '095', label: '9.5', available: true, half: true },
    { value: '100', label: '10', available: true },
    { value: '105', label: '10.5', available: false, half: true },
];

describe('SizeGrid', () => {
    test('renders a radio for every size option', () => {
        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(4);
    });

    test('renders nothing when there are no size options', () => {
        const { container } = render(
            <SizeGrid label="Size" availableSizes={[]} selectedSize="" onSizeChange={() => {}} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('marks the selected size with aria-checked', () => {
        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        expect(screen.getByRole('radio', { name: /size 9\.5, available/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: /size 9, available/i })).toHaveAttribute('aria-checked', 'false');
    });

    test('announces per-option availability via the accessible name', () => {
        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        const halfTen = screen.getByRole('radio', { name: /size 10\.5, not available/i });
        expect(halfTen).toHaveAttribute('aria-disabled', 'true');
        expect(halfTen).toHaveAttribute('tabindex', '-1');
    });

    test('links the group to its label via aria-labelledby', () => {
        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        const radioGroup = screen.getByRole('radiogroup');
        const labelledById = radioGroup.getAttribute('aria-labelledby');
        expect(labelledById).toBeTruthy();
        expect(document.getElementById(labelledById ?? '')).toHaveTextContent('Size');
    });

    test('calls onSizeChange when an available size is clicked', async () => {
        const user = userEvent.setup();
        const onSizeChange = vi.fn();

        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={onSizeChange} />);

        await user.click(screen.getByRole('radio', { name: /size 10, available/i }));
        expect(onSizeChange).toHaveBeenCalledWith('100');
    });

    test('does not call onSizeChange when an unavailable size is clicked', async () => {
        const user = userEvent.setup();
        const onSizeChange = vi.fn();

        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={onSizeChange} />);

        await user.click(screen.getByRole('radio', { name: /size 10\.5, not available/i }));
        expect(onSizeChange).not.toHaveBeenCalled();
    });

    test('arrow-right navigates focus to the next available size and reports the change', async () => {
        const user = userEvent.setup();
        const onSizeChange = vi.fn();

        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={onSizeChange} />);

        screen.getByRole('radio', { name: /size 9\.5, available/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /size 10, available/i })).toHaveFocus();
        expect(onSizeChange).toHaveBeenCalledWith('100');
    });

    test('arrow navigation skips an unavailable size and lands on the next available one', async () => {
        const user = userEvent.setup();
        const onSizeChange = vi.fn();

        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={onSizeChange} />);

        screen.getByRole('radio', { name: /size 10, available/i }).focus();
        await user.keyboard('{ArrowRight}');

        // 10.5 is unavailable — arrow-right wraps past it to the next available size
        expect(screen.getByRole('radio', { name: /size 9, available/i })).toHaveFocus();
        expect(onSizeChange).toHaveBeenCalledWith('090');
    });

    test('arrow navigation never focuses an unavailable size', async () => {
        const user = userEvent.setup();

        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        screen.getByRole('radio', { name: /size 10, available/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /size 10\.5, not available/i })).not.toHaveFocus();
    });

    test('arrow navigation wraps from the last option back to the first', async () => {
        const user = userEvent.setup();

        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        screen.getByRole('radio', { name: /size 10\.5, not available/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /size 9, available/i })).toHaveFocus();
    });

    test('arrow-left navigates backwards, skipping an unavailable size', async () => {
        const user = userEvent.setup();
        const onSizeChange = vi.fn();

        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={onSizeChange} />);

        // 9 is first, so arrow-left wraps backwards past unavailable 10.5 to 10
        screen.getByRole('radio', { name: /size 9, available/i }).focus();
        await user.keyboard('{ArrowLeft}');

        expect(screen.getByRole('radio', { name: /size 10, available/i })).toHaveFocus();
        expect(onSizeChange).toHaveBeenCalledWith('100');
    });

    test('arrow navigation skips multiple consecutive unavailable sizes', async () => {
        const user = userEvent.setup();
        const onSizeChange = vi.fn();
        const sizesWithConsecutiveGaps: SizeOption[] = [
            { value: '090', label: '9', available: true },
            { value: '095', label: '9.5', available: false, half: true },
            { value: '100', label: '10', available: false },
            { value: '105', label: '10.5', available: true, half: true },
        ];

        render(
            <SizeGrid
                label="Size"
                availableSizes={sizesWithConsecutiveGaps}
                selectedSize="090"
                onSizeChange={onSizeChange}
            />
        );

        screen.getByRole('radio', { name: /size 9, available/i }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /size 10\.5, available/i })).toHaveFocus();
        expect(onSizeChange).toHaveBeenCalledWith('105');
    });

    test('arrow navigation does nothing when every size is unavailable', async () => {
        const user = userEvent.setup();
        const onSizeChange = vi.fn();
        const allUnavailable: SizeOption[] = [
            { value: '090', label: '9', available: false },
            { value: '095', label: '9.5', available: false, half: true },
        ];

        render(
            <SizeGrid label="Size" availableSizes={allUnavailable} selectedSize="090" onSizeChange={onSizeChange} />
        );

        const nine = screen.getByRole('radio', { name: /size 9, not available/i });
        nine.focus();
        await user.keyboard('{ArrowRight}');

        expect(nine).toHaveFocus();
        expect(onSizeChange).not.toHaveBeenCalled();
    });

    test('applies italic styling to half sizes so they read as visually distinct', () => {
        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        const half = screen.getByRole('radio', { name: /size 9\.5, available/i });
        const whole = screen.getByRole('radio', { name: /size 9, available/i });
        expect(half.className).toContain('italic');
        expect(whole.className).not.toContain('italic');
    });

    test('meets the 44px minimum touch target', () => {
        render(<SizeGrid label="Size" availableSizes={SIZES} selectedSize="095" onSizeChange={() => {}} />);

        const nine = screen.getByRole('radio', { name: /size 9, available/i });
        expect(nine.className).toContain('min-w-11');
        expect(nine.className).toContain('min-h-11');
    });

    test('supports a custom accessible-name builder for translated announcements', () => {
        render(
            <SizeGrid
                label="Size"
                availableSizes={SIZES}
                selectedSize="095"
                onSizeChange={() => {}}
                getAccessibleName={(option) =>
                    `Talla ${option.label}, ${option.available ? 'disponible' : 'no disponible'}`
                }
            />
        );

        expect(screen.getByRole('radio', { name: /talla 9, disponible/i })).toBeInTheDocument();
    });
});

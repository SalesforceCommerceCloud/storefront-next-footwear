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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ColorwayStrip, type ColorwayOption } from './index';

vi.mock('@/components/dynamic-image', () => ({
    DynamicImage: ({ src, alt, loading, ...props }: { src: string; alt: string; loading: 'lazy' | 'eager' }) => (
        <img src={src} alt={alt} loading={loading} {...props} />
    ),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { count?: number; defaultValue?: string }) => {
            if (key === 'colorway.count') {
                return `${options?.count} ${options?.count === 1 ? 'color' : 'colors'}`;
            }
            return options?.defaultValue ?? key;
        },
    }),
}));

const colorways: ColorwayOption[] = [
    {
        colorwayId: 'blue',
        colorwayName: 'University Blue / White / Black',
        thumbnailImage: '/blue.jpg',
        available: true,
    },
    {
        colorwayId: 'black',
        colorwayName: 'Triple Black',
        thumbnailImage: '/black.jpg',
        available: true,
    },
    {
        colorwayId: 'red',
        colorwayName: 'Crimson Red',
        thumbnailImage: '/red.jpg',
        available: false,
    },
];

describe('ColorwayStrip', () => {
    test('renders product-image thumbnails with accessible radiogroup semantics', () => {
        render(<ColorwayStrip colorways={colorways} selectedColorwayId="blue" onColorwayChange={vi.fn()} />);

        expect(screen.getByRole('radiogroup', { name: 'Color' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'University Blue / White / Black' })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(document.querySelector('img')).toHaveAttribute('src', '/blue.jpg');
        expect(document.querySelector('img')).toHaveAttribute('loading', 'lazy');
        // Unavailable colorways stay in the accessibility tree (aria-disabled, not the native
        // disabled attribute that would hide them from assistive tech) and name their state, matching
        // the sibling size and width selectors.
        const unavailable = screen.getByRole('radio', { name: 'Crimson Red (out of stock)' });
        expect(unavailable).toHaveAttribute('aria-disabled', 'true');
        expect(unavailable).not.toBeDisabled();
    });

    test('does not select an unavailable colorway on click', async () => {
        const user = userEvent.setup();
        const onColorwayChange = vi.fn();
        render(<ColorwayStrip colorways={colorways} selectedColorwayId="blue" onColorwayChange={onColorwayChange} />);

        await user.click(screen.getByRole('radio', { name: 'Crimson Red (out of stock)' }));
        expect(onColorwayChange).not.toHaveBeenCalled();
    });

    test('selects an available colorway and skips unavailable colorways during arrow-key navigation', async () => {
        const user = userEvent.setup();
        const onColorwayChange = vi.fn();
        render(<ColorwayStrip colorways={colorways} selectedColorwayId="blue" onColorwayChange={onColorwayChange} />);

        await user.click(screen.getByRole('radio', { name: 'Triple Black' }));
        expect(onColorwayChange).toHaveBeenLastCalledWith('black');

        await user.keyboard('{ArrowLeft}');
        expect(onColorwayChange).toHaveBeenLastCalledWith('blue');

        await user.keyboard('{ArrowLeft}');
        expect(onColorwayChange).toHaveBeenLastCalledWith('black');
    });

    test('keeps excess colorways in the horizontal strip rather than truncating them', () => {
        const manyColorways = Array.from({ length: 9 }, (_, index) => ({
            colorwayId: `color-${index}`,
            colorwayName: `Color ${index + 1}`,
            thumbnailImage: `/color-${index}.jpg`,
            available: true,
        }));
        render(
            <ColorwayStrip
                colorways={manyColorways}
                selectedColorwayId="color-0"
                onColorwayChange={vi.fn()}
                maxVisible={8}
            />
        );

        expect(screen.getAllByRole('radio')).toHaveLength(9);
        const strip = screen.getByTestId('colorway-strip-list');
        expect(strip).toHaveAttribute('data-max-visible', '8');
        expect(strip.getAttribute('style')).toContain('--colorway-mobile-visible: 4');
        expect(strip.getAttribute('style')).toContain('--colorway-desktop-visible: 8');
    });

    test('reserves grid width for the actual colorway count, not the maxVisible default', () => {
        render(<ColorwayStrip colorways={colorways} selectedColorwayId="blue" onColorwayChange={vi.fn()} />);

        // 3 colorways with the default maxVisible=8 previously reserved 8 slots' worth of width,
        // stretching the swatches apart with large gaps instead of sitting close together.
        const strip = screen.getByTestId('colorway-strip-list');
        expect(strip.getAttribute('style')).toContain('--colorway-mobile-visible: 3');
        expect(strip.getAttribute('style')).toContain('--colorway-desktop-visible: 3');
    });

    test('uses a singular color count for one colorway', () => {
        render(<ColorwayStrip colorways={[colorways[0]]} selectedColorwayId="blue" onColorwayChange={vi.fn()} />);

        expect(screen.getByText('1 color')).toBeInTheDocument();
    });

    test('renders a named fallback when a colorway has no product image', () => {
        render(
            <ColorwayStrip
                colorways={[{ ...colorways[0], thumbnailImage: undefined }]}
                selectedColorwayId="blue"
                onColorwayChange={vi.fn()}
            />
        );

        expect(screen.getByRole('radio', { name: 'University Blue / White / Black' })).toHaveTextContent('U');
        expect(document.querySelector('img')).not.toBeInTheDocument();
    });
});

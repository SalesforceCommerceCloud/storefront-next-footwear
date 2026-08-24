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
import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DynamicImage } from '@/components/dynamic-image';
import { cn } from '@/lib/utils';

export type ColorwayOption = {
    colorwayId: string;
    colorwayName: string;
    thumbnailImage?: string;
    available: boolean;
};

interface ColorwayStripProps {
    colorways: ColorwayOption[];
    selectedColorwayId: string;
    onColorwayChange: (colorwayId: string) => void;
    maxVisible?: number;
}

const colorwayStripVisibleCount = (maxVisible: number) => ({
    mobile: Math.min(maxVisible, 4),
    desktop: maxVisible,
});

/**
 * Footwear PDP color selector. Product thumbnails expose the complete colorway before selection;
 * the parent owns variation selection so the gallery and availability stay in sync.
 */
export function ColorwayStrip({ colorways, selectedColorwayId, onColorwayChange, maxVisible = 8 }: ColorwayStripProps) {
    const { t } = useTranslation('product');
    // Appended to the accessible name of unavailable colorways so screen-reader users hear the
    // out-of-stock state, matching the sibling size and width selectors.
    const outOfStockSuffix = t('outOfStockSuffix', { defaultValue: '(out of stock)' });
    const visibleCount = colorwayStripVisibleCount(maxVisible);
    const labelId = useId();
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const selectedIndex = colorways.findIndex(({ colorwayId }) => colorwayId === selectedColorwayId);
    const firstAvailableIndex = colorways.findIndex(({ available }) => available);
    const focusableIndex =
        selectedIndex !== -1 && colorways[selectedIndex]?.available
            ? selectedIndex
            : firstAvailableIndex !== -1
              ? firstAvailableIndex
              : 0;

    useEffect(() => {
        optionRefs.current = optionRefs.current.slice(0, colorways.length);
    }, [colorways.length]);

    if (colorways.length === 0) {
        return null;
    }

    const selectAtIndex = (startIndex: number, direction: 1 | -1) => {
        for (let offset = 1; offset <= colorways.length; offset += 1) {
            const index = (startIndex + direction * offset + colorways.length) % colorways.length;
            const colorway = colorways[index];
            if (!colorway?.available) {
                continue;
            }
            onColorwayChange(colorway.colorwayId);
            optionRefs.current[index]?.focus();
            return;
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (
            event.key !== 'ArrowLeft' &&
            event.key !== 'ArrowUp' &&
            event.key !== 'ArrowRight' &&
            event.key !== 'ArrowDown'
        ) {
            return;
        }
        event.preventDefault();
        selectAtIndex(index, event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
    };

    return (
        <div className="space-y-3" data-slot="colorway-strip">
            <div className="flex items-center justify-between gap-2">
                <p id={labelId} className="text-base font-semibold leading-6 text-card-foreground">
                    {t('colorway.label', { defaultValue: 'Color' })}
                </p>
                <span className="text-sm text-secondary-foreground">
                    {t('colorway.count', { count: colorways.length, defaultValue: `${colorways.length} colors` })}
                </span>
            </div>
            <div
                aria-labelledby={labelId}
                className="grid w-[calc(var(--colorway-mobile-visible)*4rem+(var(--colorway-mobile-visible)-1)*0.5rem+0.5rem)] max-w-full grid-flow-col auto-cols-16 grid-rows-1 gap-2 overflow-x-auto p-1 [scrollbar-width:thin] md:w-[calc(var(--colorway-desktop-visible)*4rem+(var(--colorway-desktop-visible)-1)*0.5rem+0.5rem)]"
                role="radiogroup"
                style={
                    {
                        '--colorway-mobile-visible': String(visibleCount.mobile),
                        '--colorway-desktop-visible': String(visibleCount.desktop),
                    } as CSSProperties
                }
                data-max-visible={maxVisible}
                data-testid="colorway-strip-list"
                data-slot="colorway-strip-list">
                {colorways.map((colorway, index) => {
                    const selected = colorway.colorwayId === selectedColorwayId;
                    return (
                        <button
                            key={colorway.colorwayId}
                            ref={(element) => {
                                optionRefs.current[index] = element;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={
                                colorway.available
                                    ? colorway.colorwayName
                                    : `${colorway.colorwayName} ${outOfStockSuffix}`
                            }
                            aria-disabled={!colorway.available || undefined}
                            tabIndex={index === focusableIndex ? 0 : -1}
                            className={cn(
                                'size-16 shrink-0 overflow-hidden border-2 bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                selected ? 'border-primary' : 'border-transparent hover:border-border',
                                !colorway.available && 'cursor-not-allowed opacity-50'
                            )}
                            onClick={() => {
                                if (!colorway.available) return;
                                onColorwayChange(colorway.colorwayId);
                            }}
                            onKeyDown={(event) => handleKeyDown(event, index)}>
                            {colorway.thumbnailImage ? (
                                <DynamicImage
                                    src={colorway.thumbnailImage}
                                    alt=""
                                    widths={[64]}
                                    className="size-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="flex size-full items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
                                    {colorway.colorwayName.slice(0, 1)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

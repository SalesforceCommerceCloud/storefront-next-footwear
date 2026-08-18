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
import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { sizeCellVariants } from './size-grid-variants';

const DIRECTIONS = {
    FORWARD: 1,
    BACKWARD: -1,
} as const;

export interface SizeOption {
    /** Machine value sent to variant resolution / cart, e.g. "090", "095" */
    value: string;
    /** Human-readable label, e.g. "9", "9.5" */
    label: string;
    /** Whether this size is orderable for the currently selected color/width */
    available: boolean;
    /** Whether this is a half size, rendered visually distinct from whole sizes */
    half?: boolean;
}

export interface SizeGridProps {
    /** All size options for the current product, decorated with availability */
    availableSizes: SizeOption[];
    /** Currently selected size value */
    selectedSize: string;
    /** Called with the new size value when the shopper picks a size */
    onSizeChange: (value: string) => void;
    /** Label rendered above the grid, associated via aria-labelledby */
    label?: string;
    /**
     * Builds the accessible name announced per option, e.g. "Size 9.5, available". Defaults to
     * an English sentence; callers should pass a translated builder for other locales.
     */
    getAccessibleName?: (option: SizeOption) => string;
    /** Additional CSS classes for the outer container */
    className?: string;
}

const defaultGetAccessibleName = (option: SizeOption) =>
    `Size ${option.label}, ${option.available ? 'available' : 'not available'}`;

/**
 * Grid layout for selecting a shoe size, rendered above the width selector. Unlike a dropdown,
 * every size is always visible so shoppers can compare fit options at a glance; half sizes are
 * rendered in italics to read as visually distinct from whole sizes, and unavailable sizes are
 * shown disabled with a diagonal strikethrough rather than hidden.
 *
 * Implements the WAI-ARIA radiogroup pattern with roving tabindex and wrap-around arrow-key
 * navigation, matching the keyboard model of `SwatchGroup` / `WidthSelector`. The grid wraps via
 * CSS flex-wrap rather than a fixed column count, so it never overflows horizontally down to a
 * 320px viewport.
 */
export const SizeGrid: React.FC<SizeGridProps> = ({
    availableSizes,
    selectedSize,
    onSizeChange,
    label,
    getAccessibleName = defaultGetAccessibleName,
    className,
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const labelId = `size-grid-label-${React.useId()}`;
    const userInteractedRef = useRef(false);

    const selectedIndex = availableSizes.findIndex((option) => option.value === selectedSize);
    const firstEnabledIndex = availableSizes.findIndex((option) => option.available);
    const focusableIndex =
        selectedIndex !== -1 && availableSizes[selectedIndex]?.available
            ? selectedIndex
            : firstEnabledIndex !== -1
              ? firstEnabledIndex
              : 0;

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const move = (direction: typeof DIRECTIONS.FORWARD | typeof DIRECTIONS.BACKWARD) => {
                let currentIndex = 0;
                if (typeof document !== 'undefined' && wrapperRef.current) {
                    const focusedElement = document.activeElement;
                    const elementIndex = Array.from(wrapperRef.current.children).findIndex(
                        (child) => child === focusedElement
                    );
                    if (elementIndex !== -1) currentIndex = elementIndex;
                }

                const length = availableSizes.length;
                let index = currentIndex;
                for (let steps = 0; steps < length; steps++) {
                    index = (index + direction + length) % length;
                    if (availableSizes[index]?.available) break;
                }

                const option = availableSizes[index];
                if (!option?.available) return;
                onSizeChange(option.value);
                (wrapperRef.current?.children[index] as HTMLElement | undefined)?.focus();
            };

            switch (e.key) {
                case 'ArrowUp':
                case 'ArrowLeft':
                    e.preventDefault();
                    userInteractedRef.current = true;
                    move(DIRECTIONS.BACKWARD);
                    break;
                case 'ArrowDown':
                case 'ArrowRight':
                    e.preventDefault();
                    userInteractedRef.current = true;
                    move(DIRECTIONS.FORWARD);
                    break;
                default:
                    break;
            }
        },
        [availableSizes, onSizeChange]
    );

    const prevSelectedRef = useRef(selectedSize);
    useEffect(() => {
        if (selectedSize !== prevSelectedRef.current && userInteractedRef.current && wrapperRef.current) {
            const el = wrapperRef.current.children[focusableIndex] as HTMLElement | undefined;
            if (el && el !== document.activeElement) {
                requestAnimationFrame(() => el.focus());
            }
            userInteractedRef.current = false;
        }
        prevSelectedRef.current = selectedSize;
    }, [selectedSize, focusableIndex]);

    if (availableSizes.length === 0) return null;

    return (
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- radiogroup composite widget: arrow-key roving handled at group level per ARIA APG
        <div
            className={cn('space-y-2', className)}
            onKeyDown={onKeyDown}
            onClick={(e) => {
                if (e.detail === 0) userInteractedRef.current = true;
            }}>
            {label && (
                <div id={labelId} className="text-base font-semibold leading-6 text-card-foreground">
                    {label}
                </div>
            )}
            <div
                ref={wrapperRef}
                role="radiogroup"
                aria-labelledby={label ? labelId : undefined}
                className="flex flex-wrap gap-2 focus:outline-none">
                {availableSizes.map((option, index) => {
                    const selected = option.value === selectedSize;
                    const isFocusable = index === focusableIndex;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-disabled={!option.available || undefined}
                            aria-label={getAccessibleName(option)}
                            tabIndex={isFocusable ? 0 : -1}
                            onClick={() => {
                                if (!option.available) return;
                                onSizeChange(option.value);
                            }}
                            className={cn(
                                sizeCellVariants({
                                    selected,
                                    disabled: !option.available,
                                    half: option.half,
                                })
                            )}>
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

SizeGrid.displayName = 'SizeGrid';

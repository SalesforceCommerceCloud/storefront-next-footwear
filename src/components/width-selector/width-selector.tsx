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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { widthOptionVariants } from './width-selector-variants';

const DIRECTIONS = {
    FORWARD: 1,
    BACKWARD: -1,
} as const;

export interface WidthOption {
    /** Machine code sent to variant resolution / cart, e.g. "D", "EW" */
    code: string;
    /** Human-readable label, e.g. "Medium", "Extra Wide" */
    label: string;
    /** Whether this width is orderable for the currently selected size */
    available: boolean;
    /** Educational copy shown in a tooltip when the width is unavailable */
    tooltip?: string;
}

export interface WidthSelectorProps {
    /** All width options for the current product, decorated with availability for the selected size */
    availableWidths: WidthOption[];
    /** Currently selected width code */
    selectedWidth: string;
    /** Called with the new width code when the shopper picks a width */
    onWidthChange: (code: string) => void;
    /** How each option's text is rendered: machine code, human label, or both */
    displayMode: 'codes' | 'labels' | 'both';
    /** Label rendered above the group, associated via aria-labelledby */
    label?: string;
    /** Translated out-of-stock suffix appended to the accessible name of disabled widths */
    outOfStockSuffix?: string;
    /** Additional CSS classes for the outer container */
    className?: string;
}

const getOptionText = (option: WidthOption, displayMode: WidthSelectorProps['displayMode']) => {
    if (displayMode === 'codes') return option.code;
    if (displayMode === 'labels') return option.label;
    return `${option.code} · ${option.label}`;
};

/**
 * Horizontal button group for selecting a shoe width, rendered below the size selector.
 * Unlike color/size swatches this is not a dropdown: every width is always visible so shoppers
 * can compare fit options at a glance, with unavailable widths shown disabled with an educational
 * tooltip rather than hidden.
 *
 * Implements the WAI-ARIA radiogroup pattern with roving tabindex and wrap-around arrow-key
 * navigation, matching the keyboard model of `SwatchGroup`.
 */
export const WidthSelector: React.FC<WidthSelectorProps> = ({
    availableWidths,
    selectedWidth,
    onWidthChange,
    displayMode,
    label,
    outOfStockSuffix = '(out of stock)',
    className,
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const labelId = `width-selector-label-${React.useId()}`;
    const userInteractedRef = useRef(false);

    const selectedIndex = availableWidths.findIndex((option) => option.code === selectedWidth);
    const firstEnabledIndex = availableWidths.findIndex((option) => option.available);
    const focusableIndex =
        selectedIndex !== -1 && availableWidths[selectedIndex]?.available
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

                const length = availableWidths.length;
                let index = currentIndex;
                for (let steps = 0; steps < length; steps++) {
                    index = (index + direction + length) % length;
                    if (availableWidths[index]?.available) break;
                }

                const option = availableWidths[index];
                if (!option?.available) return;
                onWidthChange(option.code);
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
        [availableWidths, onWidthChange]
    );

    const prevSelectedRef = useRef(selectedWidth);
    useEffect(() => {
        if (selectedWidth !== prevSelectedRef.current && userInteractedRef.current && wrapperRef.current) {
            const el = wrapperRef.current.children[focusableIndex] as HTMLElement | undefined;
            if (el && el !== document.activeElement) {
                requestAnimationFrame(() => el.focus());
            }
            userInteractedRef.current = false;
        }
        prevSelectedRef.current = selectedWidth;
    }, [selectedWidth, focusableIndex]);

    if (availableWidths.length === 0) return null;

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
                {availableWidths.map((option, index) => {
                    const selected = option.code === selectedWidth;
                    const isFocusable = index === focusableIndex;
                    const text = getOptionText(option, displayMode);

                    const button = (
                        <button
                            key={option.code}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-disabled={!option.available || undefined}
                            aria-label={!option.available ? `${text} ${outOfStockSuffix}` : text}
                            tabIndex={isFocusable ? 0 : -1}
                            onClick={() => {
                                if (!option.available) return;
                                onWidthChange(option.code);
                            }}
                            className={cn(widthOptionVariants({ selected, disabled: !option.available }))}>
                            {text}
                        </button>
                    );

                    if (!option.available && option.tooltip) {
                        return (
                            <Tooltip key={option.code}>
                                <TooltipTrigger asChild>{button}</TooltipTrigger>
                                <TooltipContent side="top" sideOffset={8}>
                                    {option.tooltip}
                                </TooltipContent>
                            </Tooltip>
                        );
                    }

                    return button;
                })}
            </div>
        </div>
    );
};

WidthSelector.displayName = 'WidthSelector';

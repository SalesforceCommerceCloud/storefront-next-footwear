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
import type { ReactElement, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { SizeGuideContent } from './size-guide-content';
import type { SizeChartEntry, SizeGuideGender } from './size-chart-data';

export interface SizeGuideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    /** Conversion rows for the product's own gender — parsed `c_sizeChart` or the shipped fallback */
    sizeChart: SizeChartEntry[];
    gender: SizeGuideGender;
    brandName?: string;
    brandSizeNotes?: string;
    /** The shopper's currently-selected US size on the PDP, if any (soft-dependent on PDP size selection state) */
    highlightSize?: string;
    /**
     * The "Size Guide" trigger button; focus returns here when the drawer closes. The trigger is
     * rendered outside this component's own tree (in the PDP's product-info overlay), so Radix has
     * no internal reference to it and would otherwise drop focus to `<body>` on close.
     */
    triggerRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Desktop: fixed 400px side drawer. Mobile: ~80vh bottom sheet, full width. Overrides every
 * side-specific class SheetContent sets for `side="right"` so the same component reads as a
 * bottom sheet under the `md` breakpoint without a JS media-query hook.
 */
const RESPONSIVE_SHEET_CLASSES = cn(
    'max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[80vh] max-md:w-full max-md:rounded-t-lg max-md:border-t max-md:border-l-0',
    'max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:slide-in-from-bottom',
    'md:inset-y-0 md:right-0 md:top-0 md:bottom-auto md:h-full md:w-[400px] md:max-w-[400px]',
    'md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right',
    'flex flex-col p-0'
);

/**
 * Size guide drawer for the footwear PDP: gender toggle, US/UK/EU/CM (+JP) conversion table,
 * and a "How to Measure" tab. Opened from a "Size Guide" trigger mounted by the footwear
 * product-info overlay. Conversion content itself lives in <SizeGuideContent>, shared with the
 * standalone `/size-guide` route.
 */
export function SizeGuideDrawer({
    isOpen,
    onClose,
    sizeChart,
    gender,
    brandName,
    brandSizeNotes,
    highlightSize,
    triggerRef,
}: SizeGuideDrawerProps): ReactElement {
    const { t } = useTranslation('product');

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                className={RESPONSIVE_SHEET_CLASSES}
                onCloseAutoFocus={(event) => {
                    // Radix's default focus-restore relies on an internally-tracked trigger ref,
                    // populated only by a mounted `SheetTrigger`. This drawer's trigger is a plain
                    // externally-rendered button, so restore focus to it manually -- otherwise focus
                    // drops to `<body>` on close (Close button, Escape, or overlay click).
                    if (triggerRef?.current) {
                        event.preventDefault();
                        triggerRef.current.focus();
                    }
                }}>
                <SheetHeader>
                    <SheetTitle>{t('sizeGuide.title', { defaultValue: 'Size Guide' })}</SheetTitle>
                    <SheetDescription>
                        {brandName
                            ? t('sizeGuide.descriptionWithBrand', {
                                  brandName,
                                  defaultValue: 'Find your {{brandName}} size across US, UK, EU, and CM measurements.',
                              })
                            : t('sizeGuide.description', {
                                  defaultValue: 'Find your size across US, UK, EU, and CM measurements.',
                              })}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <SizeGuideContent
                        sizeChart={sizeChart}
                        gender={gender}
                        brandSizeNotes={brandSizeNotes}
                        highlightSize={highlightSize}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}

SizeGuideDrawer.displayName = 'SizeGuideDrawer';

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
import { cva } from 'class-variance-authority';

// Individual size cell variants. Min sizes enforce the 44px touch target (WCAG 2.5.5). Half
// sizes get an italic style plus a decimal-shaped indicator dot so they read as visually
// distinct from whole sizes without relying on color alone.
const sizeCellVariants = cva(
    'min-w-11 min-h-11 px-2 flex items-center justify-center border rounded-md text-sm font-medium leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    {
        variants: {
            selected: {
                true: 'border-primary bg-primary text-primary-foreground',
                false: 'border-border bg-background text-foreground hover:border-border-subtle',
            },
            disabled: {
                // Diagonal strikethrough conveys unavailability without dimming text below 4.5:1
                // contrast, matching the swatch-group / width-selector pattern for OOS options.
                true: 'cursor-not-allowed relative before:content-[""] before:absolute before:top-1/2 before:left-1/2 before:h-[26px] before:w-[1px] before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-45 before:bg-current before:opacity-60',
                false: 'cursor-pointer',
            },
            half: {
                true: 'italic',
                false: '',
            },
        },
        compoundVariants: [
            {
                selected: true,
                disabled: true,
                class: 'border-primary bg-primary text-primary-foreground opacity-60',
            },
        ],
        defaultVariants: {
            selected: false,
            disabled: false,
            half: false,
        },
    }
);

export { sizeCellVariants };

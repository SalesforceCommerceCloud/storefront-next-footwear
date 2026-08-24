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
import { describe, expect, test, vi } from 'vitest';
import FindYourShoePage from './_app.find-your-shoe';
import type { ShoeFinderConfig } from '@/components/shoe-finder/types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    }),
}));

describe('FindYourShoePage', () => {
    test('renders the documented coming-soon placeholder', () => {
        render(<FindYourShoePage />);

        expect(screen.getByRole('heading', { name: 'Find Your Shoe' })).toBeInTheDocument();
        expect(screen.getByText(/personalized shoe finder is coming soon/i)).toBeInTheDocument();
    });

    test('keeps the Phase 2 extension contract type-safe', () => {
        const config: ShoeFinderConfig = {
            steps: [
                {
                    id: 'activity',
                    question: 'How do you move?',
                    type: 'single',
                    options: [{ value: 'running', label: 'Running' }],
                },
            ],
            resultMapping: [{ categoryId: 'running', refinements: { activity: 'running' } }],
        };

        expect(config.steps).toHaveLength(1);
    });
});

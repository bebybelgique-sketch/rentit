// src/components/landing/__tests__/CategoriesSection.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoriesSection from '../CategoriesSection';

describe('CategoriesSection', () => {
  it('renders the categories section', () => {
    render(
      <MemoryRouter>
        <CategoriesSection />
      </MemoryRouter>
    );

    // Example: Check for the presence of category links or titles
    // Replace with actual content from the component
    expect(screen.getByText(/Électroportatif/i)).toBeInTheDocument();
    expect(screen.getByText(/Outillage manuel/i)).toBeInTheDocument();
  });
});
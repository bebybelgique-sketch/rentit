// src/components/landing/__tests__/HeroSection.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeroSection from '../HeroSection';

describe('HeroSection', () => {
  it('renders the hero section with French text', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    // Example: Check for a common French phrase or title in the HeroSection
    // Replace 'Trouvez' with an actual French string from the component
    expect(screen.getByText(/Les outils de votre voisin/i)).toBeInTheDocument();
    expect(screen.getByText(/à portée de main/i)).toBeInTheDocument();
  });
});
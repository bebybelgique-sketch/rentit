// src/components/common/__tests__/ItemCardSkeleton.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ItemCardSkeleton from '../ItemCardSkeleton';

describe('ItemCardSkeleton', () => {
  it('renders the skeleton elements', () => {
    render(<ItemCardSkeleton />);

    // Assuming the skeleton renders a div with class 'skeleton' for the image and content placeholders
    const imageSkeleton = screen.getByTestId('skeleton-img'); // Or however the skeleton identifies its parts
    const titleSkeleton = screen.getByTestId('skeleton-title');
    const priceSkeleton = screen.getByTestId('skeleton-price');

    expect(imageSkeleton).toBeInTheDocument();
    expect(titleSkeleton).toBeInTheDocument();
    expect(priceSkeleton).toBeInTheDocument();
  });
});
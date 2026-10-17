import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotFoundRoute } from './not-found';

describe('NotFoundRoute', () => {
  it('renders a route back to the org chart', () => {
    render(
      <MemoryRouter>
        <NotFoundRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: /org chart/i })).toHaveAttribute('href', '/hierarchy');
  });
});

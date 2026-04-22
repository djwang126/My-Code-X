import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LabeledLiteralField } from './LabeledLiteralField';

afterEach(() => {
  cleanup();
});

describe('LabeledLiteralField', () => {
  it('hides empty structured values', () => {
    const { rerender } = render(<LabeledLiteralField label="Raw" value={[]} />);
    expect(screen.queryByText('Raw')).toBeNull();

    rerender(<LabeledLiteralField label="Raw" value={{}} />);
    expect(screen.queryByText('Raw')).toBeNull();

    rerender(<LabeledLiteralField label="Raw" value="" />);
    expect(screen.queryByText('Raw')).toBeNull();
  });

  it('renders structured literal content without lazy-loading controls', () => {
    render(<LabeledLiteralField label="Output" value="full content" />);

    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('full content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});

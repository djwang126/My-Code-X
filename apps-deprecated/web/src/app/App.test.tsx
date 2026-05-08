import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from '.';

describe('App', () => {
  it('wires the loading chat shell through the app boundary', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'My code X' })).toBeInTheDocument();
    expect(screen.getByText('Loading session…')).toBeInTheDocument();
    expect(screen.getByText('Thread: New session')).toBeInTheDocument();
    expect(screen.getByText('Select a workspace to start chatting')).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'chat transcript' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'chat composer' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'chat input' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});

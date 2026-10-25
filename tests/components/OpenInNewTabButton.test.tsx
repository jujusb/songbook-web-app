import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithProviders, screen } from '../setup/test-utils';
import { OpenInNewTabButton, EmbedFrame } from '@/components/OpenInNewTabButton';

describe('OpenInNewTabButton', () => {
  afterEach(() => cleanup());

  it('opens in a new tab safely', () => {
    renderWithProviders(<OpenInNewTabButton href="https://example.com/x" />);
    const link = screen.getByTestId('open-in-new-tab');
    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('icon variant has an accessible label', () => {
    renderWithProviders(<OpenInNewTabButton href="https://example.com" variant="icon" />);
    expect(screen.getByTestId('open-in-new-tab')).toHaveAttribute('aria-label');
  });

  it('EmbedFrame always renders the button next to the iframe', () => {
    const { container } = renderWithProviders(
      <EmbedFrame href="https://example.com/page" variant="icon">
        <iframe src="about:blank" title="t" />
      </EmbedFrame>,
    );
    expect(container.querySelector('iframe')).not.toBeNull();
    expect(screen.getByTestId('open-in-new-tab')).toHaveAttribute('href', 'https://example.com/page');
  });
});

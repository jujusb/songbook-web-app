import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MarkdownView } from '@/components/MarkdownView';

describe('MarkdownView', () => {
  afterEach(() => cleanup());
  it('does not render raw html or images', () => {
    const { container } = render(<MarkdownView text={'<script>x</script> <b>hi</b>\n\n![a](https://x.com/a.png)'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
  it('opens links in a new tab and drops javascript: urls', () => {
    const { container } = render(<MarkdownView text={'[ok](https://example.com) [bad](javascript:alert(1))'} />);
    const links = [...container.querySelectorAll('a')];
    const ok = links.find((a) => a.getAttribute('href') === 'https://example.com')!;
    expect(ok.getAttribute('target')).toBe('_blank');
    expect(ok.getAttribute('rel')).toBe('noopener noreferrer');
    expect(links.some((a) => (a.getAttribute('href') ?? '').startsWith('javascript:'))).toBe(false);
  });
});

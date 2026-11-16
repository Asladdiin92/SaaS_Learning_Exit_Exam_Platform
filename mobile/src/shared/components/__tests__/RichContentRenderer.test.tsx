import React from 'react';

// 1. Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    ScrollView: (props: any) => React.createElement('ScrollView', props, props.children),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
    StyleSheet: { create: (s: any) => s },
  };
});

import {
  RichContentRenderer,
  convertLatexToUnicode,
  parseMarkdownBlocks,
} from '../RichContentRenderer';

describe('RichContentRenderer & LaTeX Parser', () => {
  describe('convertLatexToUnicode', () => {
    it('converts single character and group subscripts to Unicode', () => {
      expect(convertLatexToUnicode('R_i')).toBe('Rᵢ');
      expect(convertLatexToUnicode('L_{i+1}')).toBe('Lᵢ₊₁');
      expect(convertLatexToUnicode('K_{16}')).toBe('K₁₆');
      expect(convertLatexToUnicode('Key_{SID=02}')).toBe('Key(SID=02)');
    });

    it('converts single character and group superscripts to Unicode', () => {
      expect(convertLatexToUnicode('2^{56}')).toBe('2⁵⁶');
      expect(convertLatexToUnicode('x^2 + y^3')).toBe('x² + y³');
      expect(convertLatexToUnicode('O(n^k)')).toBe('O(nᵏ)');
    });

    it('converts mathematical symbols and greek letters to Unicode', () => {
      expect(convertLatexToUnicode('\\oplus')).toBe('⊕');
      expect(convertLatexToUnicode('\\times')).toBe('×');
      expect(convertLatexToUnicode('\\phi(n)')).toBe('φ(n)');
      expect(convertLatexToUnicode('\\gcd(a, b)')).toBe('gcd(a, b)');
      expect(convertLatexToUnicode('\\le')).toBe('≤');
      expect(convertLatexToUnicode('\\ge')).toBe('≥');
      expect(convertLatexToUnicode('\\ne')).toBe('≠');
      expect(convertLatexToUnicode('\\pi')).toBe('π');
    });

    it('faithfully transforms the Feistel cipher equation', () => {
      const feistel = 'L_{i+1} = R_i \\oplus F(R_i, K_{i+1})';
      expect(convertLatexToUnicode(feistel)).toBe('Lᵢ₊₁ = Rᵢ ⊕ F(Rᵢ, Kᵢ₊₁)');
    });
  });

  describe('parseMarkdownBlocks', () => {
    it('parses markdown headings into levels 1, 2, and 3', () => {
      const raw = '# Chapter 1: Architecture\n## Subtopic\n### Minor Point';
      const blocks = parseMarkdownBlocks(raw);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Chapter 1: Architecture' });
      expect(blocks[1]).toEqual({ type: 'heading', level: 2, text: 'Subtopic' });
      expect(blocks[2]).toEqual({ type: 'heading', level: 3, text: 'Minor Point' });
    });

    it('parses fenced code blocks with language normalizer', () => {
      const raw = '```cpp\n#include <iostream>\nint main() { return 0; }\n```';
      const blocks = parseMarkdownBlocks(raw);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'code',
        language: 'cpp',
        code: '#include <iostream>\nint main() { return 0; }',
      });
    });

    it('parses markdown tables with headers and row values', () => {
      const raw = `
| Algorithm | Key Size | Block Size |
| :--- | :--- | :--- |
| DES | 56-bit | 64-bit |
| AES | 128-bit | 128-bit |
`.trim();
      const blocks = parseMarkdownBlocks(raw);

      expect(blocks).toHaveLength(1);
      if (blocks[0].type === 'table') {
        expect(blocks[0].headers).toEqual(['Algorithm', 'Key Size', 'Block Size']);
        expect(blocks[0].rows).toHaveLength(2);
        expect(blocks[0].rows[0]).toEqual(['DES', '56-bit', '64-bit']);
        expect(blocks[0].rows[1]).toEqual(['AES', '128-bit', '128-bit']);
      } else {
        fail('Expected table block');
      }
    });

    it('parses bullet lists and numbered lists', () => {
      const raw = '- First Item\n* Second Item\n1. Numbered Item';
      const blocks = parseMarkdownBlocks(raw);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toEqual({ type: 'list-item', ordered: false, bulletIndex: 0, text: 'First Item' });
      expect(blocks[1]).toEqual({ type: 'list-item', ordered: false, bulletIndex: 0, text: 'Second Item' });
      expect(blocks[2]).toEqual({ type: 'list-item', ordered: true, bulletIndex: 1, text: 'Numbered Item' });
    });
  });

  describe('Component Rendering', () => {
    it('instantiates RichContentRenderer element tree without runtime exceptions', () => {
      const content = `
# Symmetric Cryptography & Feistel Networks
Feistel encryption round: $L_{i+1} = R_i \\oplus F(R_i, K_{i+1})$.

| Spec | Value |
| :--- | :--- |
| DES Rounds | 16 |
| Total Keyspace | $2^{56}$ |

\`\`\`sql
SELECT * FROM local_exam_packages WHERE exam_id = 'ITEC4133-FULL-80';
\`\`\`
`.trim();

      const element = React.createElement(RichContentRenderer, {
        content,
        themeMode: 'dark',
        fontScale: 1,
      });

      expect(React.isValidElement(element)).toBe(true);
      expect(element.props.themeMode).toBe('dark');
      expect(element.props.content).toContain('Feistel');
    });
  });
});

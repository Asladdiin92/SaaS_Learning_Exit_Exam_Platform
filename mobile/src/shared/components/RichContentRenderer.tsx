import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// LaTeX Math to Clean Unicode Symbol Converter
// ─────────────────────────────────────────────────────────────────────────────
const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
};

export function convertLatexToUnicode(latex: string): string {
  let s = latex.trim();
  if (s.startsWith('$') && s.endsWith('$')) {
    s = s.slice(1, -1);
  }

  // 1. Common Math & Greek Symbols
  s = s.replace(/\\oplus\b/g, '⊕');
  s = s.replace(/\\times\b/g, '×');
  s = s.replace(/\\div\b/g, '÷');
  s = s.replace(/\\(?:rightarrow|to)\b/g, '→');
  s = s.replace(/\\Rightarrow\b/g, '⇒');
  s = s.replace(/\\(?:le|leq)\b/g, '≤');
  s = s.replace(/\\(?:ge|geq)\b/g, '≥');
  s = s.replace(/\\(?:ne|neq)\b/g, '≠');
  s = s.replace(/\\in\b/g, '∈');
  s = s.replace(/\\phi\b/g, 'φ');
  s = s.replace(/\\pi\b/g, 'π');
  s = s.replace(/\\sigma\b/g, 'σ');
  s = s.replace(/\\Delta\b/g, 'Δ');
  s = s.replace(/\\lambda\b/g, 'λ');
  s = s.replace(/\\gcd\b/g, 'gcd');
  s = s.replace(/\\approx\b/g, '≈');
  s = s.replace(/\\infty\b/g, '∞');
  s = s.replace(/\\cdot\b/g, '·');

  // 2. Subscripts with braces: _{...}
  s = s.replace(/_\{([^}]+)\}/g, (_match, inner) => {
    let allMapped = true;
    let mapped = '';
    for (const ch of inner) {
      if (SUBSCRIPT_MAP[ch.toLowerCase()]) {
        mapped += SUBSCRIPT_MAP[ch.toLowerCase()];
      } else {
        allMapped = false;
        break;
      }
    }
    return allMapped ? mapped : `(${inner})`;
  });

  // 3. Single-character subscript: _x
  s = s.replace(/_([0-9a-zA-Z+-])/g, (_match, ch) => {
    return SUBSCRIPT_MAP[ch.toLowerCase()] || ch;
  });

  // 4. Superscripts with braces: ^{...}
  s = s.replace(/\^\{([^}]+)\}/g, (_match, inner) => {
    let allMapped = true;
    let mapped = '';
    for (const ch of inner) {
      if (SUPERSCRIPT_MAP[ch]) {
        mapped += SUPERSCRIPT_MAP[ch];
      } else {
        allMapped = false;
        break;
      }
    }
    return allMapped ? mapped : `^(${inner})`;
  });

  // 5. Single-character superscript: ^x
  s = s.replace(/\^([0-9a-zA-Z+-=()])/g, (_match, ch) => {
    return SUPERSCRIPT_MAP[ch] || _match;
  });

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Badge Normalizer
// ─────────────────────────────────────────────────────────────────────────────
function normalizeLanguageBadge(rawLang?: string): string {
  if (!rawLang) return 'CODE';
  const l = rawLang.trim().toLowerCase();
  switch (l) {
    case 'cpp':
    case 'c++':
      return 'C++';
    case 'java':
      return 'Java';
    case 'csharp':
    case 'c#':
    case 'cs':
      return 'C#';
    case 'php':
      return 'PHP';
    case 'javascript':
    case 'js':
      return 'JS';
    case 'typescript':
    case 'ts':
      return 'TS';
    case 'sql':
      return 'SQL';
    case 'python':
    case 'py':
      return 'Python';
    case 'html':
      return 'HTML';
    case 'json':
      return 'JSON';
    case 'bash':
    case 'sh':
      return 'Bash';
    default:
      return l.toUpperCase();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Formatter (Bold, Inline Code, LaTeX Math)
// ─────────────────────────────────────────────────────────────────────────────
export function renderInlineContent(
  text: string,
  fontScale: number = 1,
  isDark: boolean = true,
  baseTextStyle?: TextStyle
): React.ReactNode {
  // Matches $...$ (math), **...** (bold), and `...` (code)
  const tokenRegex = /(\$[^\$]+?\$|\*\*[^*]+?\*\*|`[^`]+?`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // 1. LaTeX Math Block ($...$)
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const converted = convertLatexToUnicode(part);
      return (
        <Text
          key={index}
          style={[
            styles.inlineMath,
            {
              fontSize: 14.5 * fontScale,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
            },
          ]}
        >
          {converted}
        </Text>
      );
    }

    // 2. Bold (**text**)
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <Text
          key={index}
          style={[
            baseTextStyle,
            {
              fontWeight: '700',
              color: isDark ? '#E2E8F0' : '#0F172A',
            },
          ]}
        >
          {boldText}
        </Text>
      );
    }

    // 3. Inline Code (`code`)
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeText = part.slice(1, -1);
      return (
        <Text
          key={index}
          style={[
            styles.inlineCode,
            {
              fontSize: 13 * fontScale,
              color: isDark ? '#38BDF8' : '#0284C7',
              backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
            },
          ]}
        >
          {codeText}
        </Text>
      );
    }

    // 4. Plain Text
    return (
      <Text
        key={index}
        style={[
          styles.plainText,
          baseTextStyle,
          {
            fontSize: 15 * fontScale,
            lineHeight: 22 * fontScale,
            color: isDark ? '#CBD5E1' : '#334155',
          },
        ]}
      >
        {part}
      </Text>
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsed Block Representation
// ─────────────────────────────────────────────────────────────────────────────
export type ParsedBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list-item'; ordered: boolean; bulletIndex: number; text: string }
  | { type: 'paragraph'; text: string };

export function parseMarkdownBlocks(raw: string): ParsedBlock[] {
  const lines = raw.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced Code Block (```lang)
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // consume closing ```
      }
      blocks.push({
        type: 'code',
        language,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Markdown Table (| Col 1 | Col 2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        const bodyRows: string[][] = [];
        // Check if row 1 is a separator (| :--- | :--- |)
        const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(tableLines[1]);
        const startRow = isSeparator ? 2 : 1;

        for (let r = startRow; r < tableLines.length; r++) {
          const cells = tableLines[r]
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          bodyRows.push(cells);
        }

        blocks.push({
          type: 'table',
          headers: headerRow,
          rows: bodyRows,
        });
        continue;
      }
    }

    // 3. Headings (#, ##, ###)
    if (trimmed.startsWith('#')) {
      if (trimmed.startsWith('### ')) {
        blocks.push({ type: 'heading', level: 3, text: trimmed.slice(4).trim() });
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        blocks.push({ type: 'heading', level: 2, text: trimmed.slice(3).trim() });
        i++;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        blocks.push({ type: 'heading', level: 1, text: trimmed.slice(2).trim() });
        i++;
        continue;
      }
    }

    // 4. Bullet & Numbered Lists (- , * , 1. )
    const bulletMatch = trimmed.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const isOrdered = /^\d+\./.test(bulletMatch[1]);
      const bulletIndex = isOrdered ? parseInt(bulletMatch[1], 10) : 0;
      blocks.push({
        type: 'list-item',
        ordered: isOrdered,
        bulletIndex,
        text: bulletMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 5. Standard Paragraph
    blocks.push({
      type: 'paragraph',
      text: line,
    });
    i++;
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal RichContentRenderer Component
// ─────────────────────────────────────────────────────────────────────────────
export interface RichContentRendererProps {
  content: string;
  fontScale?: number;
  themeMode?: 'dark' | 'light' | 'system';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const RichContentRenderer: React.FC<RichContentRendererProps> = ({
  content,
  fontScale = 1,
  themeMode = 'dark',
  style,
  testID = 'rich-content-renderer',
}) => {
  const isDark = themeMode !== 'light';
  const blocks = parseMarkdownBlocks(content || '');

  return (
    <View testID={testID} style={[styles.rootContainer, style]}>
      {blocks.map((block, idx) => {
        // A. Heading Block
        if (block.type === 'heading') {
          const fontSize =
            block.level === 1
              ? 20 * fontScale
              : block.level === 2
              ? 17 * fontScale
              : 15 * fontScale;

          const borderLeftWidth = block.level === 1 ? 4 : block.level === 2 ? 3 : 2.5;

          return (
            <View
              key={idx}
              style={[
                styles.headingContainer,
                {
                  borderLeftWidth,
                  borderLeftColor: '#3B82F6',
                  marginTop: block.level === 1 ? 16 : 12,
                  marginBottom: 8,
                },
              ]}
            >
              <Text
                style={[
                  styles.headingText,
                  {
                    fontSize,
                    color: isDark ? '#F8FAFC' : '#0F172A',
                    lineHeight: fontSize * 1.35,
                  },
                ]}
              >
                {renderInlineContent(block.text, fontScale, isDark, {
                  fontSize,
                  fontWeight: '700',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                })}
              </Text>
            </View>
          );
        }

        // B. Fenced Code Block
        if (block.type === 'code') {
          const badgeText = normalizeLanguageBadge(block.language);
          return (
            <View key={idx} style={styles.codeCard}>
              <View style={styles.codeHeader}>
                <View style={styles.codeLanguageBadge}>
                  <Text style={styles.codeLanguageBadgeText}>{badgeText}</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.codeScrollContent}
              >
                <Text
                  style={[
                    styles.codeText,
                    {
                      fontSize: 13.5 * fontScale,
                      lineHeight: 20 * fontScale,
                    },
                  ]}
                >
                  {block.code}
                </Text>
              </ScrollView>
            </View>
          );
        }

        // C. Markdown Table
        if (block.type === 'table') {
          return (
            <View key={idx} style={styles.tableCardWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.tableCard}>
                  {/* Table Header Row */}
                  <View style={styles.tableHeaderRow}>
                    {block.headers.map((h, cIdx) => (
                      <View key={cIdx} style={styles.tableCell}>
                        <Text style={[styles.tableHeaderText, { fontSize: 13 * fontScale }]}>
                          {h}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Table Body Rows */}
                  {block.rows.map((row, rIdx) => {
                    const rowBg = rIdx % 2 === 0 ? '#0F172A' : '#131C31';
                    return (
                      <View
                        key={rIdx}
                        style={[
                          styles.tableBodyRow,
                          {
                            backgroundColor: rowBg,
                            borderTopWidth: 1,
                            borderTopColor: '#1E293B',
                          },
                        ]}
                      >
                        {row.map((cell, cIdx) => (
                          <View key={cIdx} style={styles.tableCell}>
                            <Text style={{ flexWrap: 'wrap' }}>
                              {renderInlineContent(cell, fontScale, isDark, {
                                fontSize: 13 * fontScale,
                              })}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          );
        }

        // D. Bullet / Numbered List Item
        if (block.type === 'list-item') {
          return (
            <View key={idx} style={styles.listItemContainer}>
              {block.ordered ? (
                <Text
                  style={[
                    styles.orderedNumberText,
                    { fontSize: 14 * fontScale, marginTop: 1 },
                  ]}
                >
                  {block.bulletIndex}.
                </Text>
              ) : (
                <View style={styles.bulletDot} />
              )}
              <View style={styles.listItemContent}>
                <Text style={{ flexWrap: 'wrap' }}>
                  {renderInlineContent(block.text, fontScale, isDark)}
                </Text>
              </View>
            </View>
          );
        }

        // E. Paragraph
        return (
          <View key={idx} style={styles.paragraphContainer}>
            <Text style={{ flexWrap: 'wrap' }}>
              {renderInlineContent(block.text, fontScale, isDark)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  rootContainer: {
    width: '100%',
  },
  headingContainer: {
    paddingLeft: 10,
    justifyContent: 'center',
  },
  headingText: {
    fontWeight: '700',
  },
  codeCard: {
    backgroundColor: '#090D16',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 10,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  codeLanguageBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  codeLanguageBadgeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#93C5FD',
    letterSpacing: 0.5,
  },
  codeScrollContent: {
    padding: 12,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#E2E8F0',
  },
  tableCardWrapper: {
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tableCard: {
    minWidth: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
  },
  tableBodyRow: {
    flexDirection: 'row',
  },
  tableCell: {
    padding: 10,
    minWidth: 110,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontWeight: '700',
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginTop: 7,
    marginRight: 10,
  },
  orderedNumberText: {
    color: '#3B82F6',
    fontWeight: '700',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  listItemContent: {
    flex: 1,
  },
  paragraphContainer: {
    marginVertical: 4,
  },
  plainText: {
    letterSpacing: 0.2,
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  inlineMath: {
    color: '#93C5FD',
    fontWeight: '600',
    paddingHorizontal: 3,
    borderRadius: 4,
    letterSpacing: 0.4,
  },
});

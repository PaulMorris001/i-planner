import { Fragment } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

interface CoachMessageTextProps {
  content: string;
  variant: 'user' | 'assistant';
}

// Splits a line into plain-text/**bold**/`code` runs and renders each as a
// nested <Text> — RN Text supports inline child Text with its own style, so
// this needs no markdown library, just a small regex split.
function renderInline(line: string, textColor: string, codeColor: string) {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((t) => t.length > 0);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <Text key={i} style={{ fontWeight: '800', color: textColor }}>
          {token.slice(2, -2)}
        </Text>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <Text key={i} style={[styles.inlineCode, { color: codeColor }]}>
          {token.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text key={i} style={{ color: textColor }}>
        {token}
      </Text>
    );
  });
}

// Chat bubbles render the coach's raw text directly (no markdown library),
// so without this the model's **bold**/## headings/`code`/- bullets would
// show their literal symbols. This turns the handful of markdown patterns
// the coach prompt is told it can use into real RN styling instead.
export function CoachMessageText({ content, variant }: CoachMessageTextProps) {
  const textColor = variant === 'user' ? Colors.white : Colors.textPrimary;
  const codeColor = variant === 'user' ? Colors.white : Colors.primaryLight;
  const lines = content.split('\n');

  return (
    <View>
      {lines.map((line, idx) => {
        if (line.trim() === '') {
          return <View key={idx} style={styles.blankLine} />;
        }

        const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          return (
            <Text key={idx} style={[styles.line, styles.heading, { fontSize: 16.5 - level, color: textColor }]}>
              {renderInline(headingMatch[2], textColor, codeColor)}
            </Text>
          );
        }

        const bulletMatch = line.match(/^[-*]\s+(.*)/);
        if (bulletMatch) {
          return (
            <View key={idx} style={styles.bulletRow}>
              <Text style={[styles.line, { color: textColor }]}>{'•'}</Text>
              <Text style={[styles.line, styles.bulletText]}>{renderInline(bulletMatch[1], textColor, codeColor)}</Text>
            </View>
          );
        }

        return (
          <Fragment key={idx}>
            <Text style={styles.line}>{renderInline(line, textColor, codeColor)}</Text>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  heading: {
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 1,
  },
  blankLine: {
    height: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 7,
  },
  bulletText: {
    flex: 1,
  },
  inlineCode: {
    fontFamily: 'Courier',
    fontSize: 13.5,
  },
});

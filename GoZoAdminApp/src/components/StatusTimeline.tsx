import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';

interface TimelineStep {
  status: string;
  active: boolean;
  time: string;
}

interface StatusTimelineProps {
  timeline?: TimelineStep[];
}

export default function StatusTimeline({ timeline }: StatusTimelineProps) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Status Timeline</Text>
      <View style={styles.timelineContainer}>
        {timeline.map((step, idx) => {
          const isLast = idx === timeline.length - 1;
          const nextActive = !isLast && timeline[idx + 1].active;
          const lineActive = step.active && nextActive;

          return (
            <View key={step.status} style={styles.stepRow}>
              <View style={styles.leftCol}>
                <View
                  style={[
                    styles.node,
                    step.active ? styles.nodeActive : styles.nodeInactive,
                  ]}
                />
                {!isLast && (
                  <View
                    style={[
                      styles.line,
                      lineActive ? styles.lineActive : styles.lineInactive,
                    ]}
                  />
                )}
              </View>
              <View style={styles.rightCol}>
                <Text
                  style={[
                    styles.stepStatus,
                    step.active ? styles.textActive : styles.textInactive,
                  ]}
                >
                  {step.status}
                </Text>
                {step.active && step.time ? (
                  <Text style={styles.stepTime}>{step.time}</Text>
                ) : (
                  <Text style={styles.stepPending}>Pending</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  timelineContainer: {
    paddingLeft: SPACING.xs,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 60,
  },
  leftCol: {
    alignItems: 'center',
    width: 24,
  },
  node: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    zIndex: 1,
  },
  nodeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  nodeInactive: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  line: {
    width: 2,
    flex: 1,
    position: 'absolute',
    top: 14,
    bottom: -6,
  },
  lineActive: {
    backgroundColor: COLORS.primary,
  },
  lineInactive: {
    backgroundColor: COLORS.border,
  },
  rightCol: {
    flex: 1,
    paddingLeft: SPACING.md,
    paddingBottom: SPACING.md,
  },
  stepStatus: {
    fontSize: 14,
    fontWeight: '700',
  },
  textActive: {
    color: COLORS.white,
  },
  textInactive: {
    color: COLORS.textSecondary,
  },
  stepTime: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  stepPending: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
});

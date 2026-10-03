import { useCallback, useMemo, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Server } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type { Theme } from "@/styles/theme";

const ThemedServer = withUnistyles(Server, (theme: Theme) => ({
  color: theme.colors.accent,
}));
const ThemedChevronDown = withUnistyles(ChevronDown, (theme: Theme) => ({
  color: theme.colors.foregroundMuted,
}));
const ThemedChevronRight = withUnistyles(ChevronRight, (theme: Theme) => ({
  color: theme.colors.foregroundMuted,
}));

/**
 * The divider that names the host a run of sidebar rows lives on.
 *
 * It is a filled band rather than a hairline because the host is the thing a user scans
 * for first: when the sidebar spans several machines, "which server is this on" has to be
 * answerable at a glance. When `onToggle` is given it collapses the section, so a host
 * whose work is all pinned can fold away without leaving the rail.
 */
export function SidebarHostSectionHeader({
  label,
  testID,
  serverId,
  collapsed,
  onToggleServer,
}: {
  label: string;
  testID?: string;
  serverId?: string;
  collapsed?: boolean;
  onToggleServer?: (serverId: string) => void;
}) {
  const canToggle = Boolean(serverId && onToggleServer);
  const handleToggle = useCallback(() => {
    if (serverId && onToggleServer) onToggleServer(serverId);
  }, [onToggleServer, serverId]);
  const accessibilityState = useMemo(() => ({ expanded: !collapsed }), [collapsed]);

  let collapseChevron: ReactNode = null;
  if (canToggle) {
    collapseChevron = collapsed ? (
      <ThemedChevronRight size={15} strokeWidth={2.4} />
    ) : (
      <ThemedChevronDown size={15} strokeWidth={2.4} />
    );
  }

  const content = (
    <>
      <ThemedServer size={15} strokeWidth={2.4} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {collapseChevron}
    </>
  );

  if (!canToggle) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={label}
      testID={testID}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: 34,
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[1],
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    userSelect: "none",
  },
  label: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    fontWeight: "700",
    letterSpacing: 0.2,
    minWidth: 0,
  },
}));

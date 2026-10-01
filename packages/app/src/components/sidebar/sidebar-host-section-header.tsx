import { Server } from "lucide-react-native";
import { Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type { Theme } from "@/styles/theme";

const ThemedServer = withUnistyles(Server, (theme: Theme) => ({
  color: theme.colors.accent,
}));

/**
 * The always-on divider that names the host a run of sidebar rows lives on.
 *
 * It is not a control: host sections are structural, so there is nothing to collapse and no menu
 * to hang off the label. The label comes from the host profile, so it matches the host switcher
 * and the row badges without a second source of truth.
 *
 * It is a filled band rather than a hairline because the host is the thing a user scans for first:
 * when the sidebar spans several machines, "which server is this on" has to be answerable at a
 * glance.
 */
export function SidebarHostSectionHeader({ label, testID }: { label: string; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <ThemedServer size={15} strokeWidth={2.4} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
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
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    fontWeight: "700",
    letterSpacing: 0.2,
    minWidth: 0,
    flexShrink: 1,
  },
}));

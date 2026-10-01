import { useCallback, useMemo, useState, type ComponentType } from "react";
import { Pressable, Text, View, type PressableStateCallbackType } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type {
  DaemonClient,
  FetchRecentProviderSessionEntry,
} from "@getpaseo/client/internal/daemon-client";
import { History } from "lucide-react-native";
import { getProviderIcon } from "@/components/provider-icons";
import { getSessionTitle } from "@/components/import-session-sheet-view-model";
import { useFetchQuery } from "@/data/query";
import { formatTimeAgo } from "@/utils/time";
import { buildHostAgentDetailRoute } from "@/utils/host-routes";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useHostFeature } from "@/runtime/host-features";
import { useImportSession } from "@/hooks/use-import-session";
import { resolveProvidersToFetch } from "@/components/import-session-sheet-view-model";

/** Prototype cap: a handful inline, the sheet still covers the long tail. */
const MAX_ROWS = 4;
const PER_PROVIDER_LIMIT = 5;

const ThemedHistory = withUnistyles(History, (theme) => ({
  color: theme.colors.foregroundMuted,
}));

const themedProviderIcons = new Map<string, ComponentType<{ size?: number }>>();

function getThemedProviderIcon(providerId: string, serverId: string) {
  const key = `${serverId}:${providerId}`;
  const cached = themedProviderIcons.get(key);
  if (cached) return cached;
  const Base = getProviderIcon(providerId, serverId);
  const Themed = withUnistyles(Base, (theme) => ({ color: theme.colors.foregroundMuted }));
  themedProviderIcons.set(key, Themed);
  return Themed;
}

type SessionsClient = Pick<DaemonClient, "fetchRecentProviderSessions" | "importAgent"> | null;

type SessionRowState = "open" | "resume" | "import";

function resolveRowState(entry: FetchRecentProviderSessionEntry): SessionRowState {
  if (!entry.importedAgentId) return "import";
  return entry.importedArchived ? "resume" : "open";
}

interface NewWorkspaceSessionsSlotProps {
  serverId: string;
  client: DaemonClient | null;
  isConnected: boolean;
  projectDirectory: string | null;
}

/**
 * Host sessions in the New workspace flow. Host-wide by default; the project
 * scope narrows to the selected project's directory. Imported rows are Open
 * (agent is active) or Resume (agent is archived), so the same list is the way
 * back to a session instead of re-importing it.
 */
export function NewWorkspaceSessionsSlot({
  serverId,
  client,
  isConnected,
  projectDirectory,
}: NewWorkspaceSessionsSlotProps) {
  const importSession = useImportSession({ serverId, cwd: projectDirectory ?? undefined });
  if (!isConnected || !client) {
    return null;
  }
  return (
    <>
      <NewWorkspaceSessionsSection
        serverId={serverId}
        client={client}
        projectDirectory={projectDirectory}
        onShowAll={importSession.open}
      />
      {importSession.sheet}
    </>
  );
}

function NewWorkspaceSessionsSection({
  serverId,
  client,
  projectDirectory,
  onShowAll,
}: {
  serverId: string;
  client: NonNullable<SessionsClient>;
  projectDirectory: string | null;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [scopeToProject, setScopeToProject] = useState(false);
  const supportsStates = useHostFeature(serverId, "importSessionStates");
  const scopedDirectory = scopeToProject ? projectDirectory : null;

  const { entries: snapshotEntries, supportsSnapshot } = useProvidersSnapshot(serverId, {
    cwd: scopedDirectory,
  });
  const providersToFetch = useMemo(
    () => (supportsSnapshot ? resolveProvidersToFetch(supportsSnapshot, snapshotEntries) : null),
    [supportsSnapshot, snapshotEntries],
  );

  const query = useFetchQuery({
    queryKey: [
      "new-workspace-recent-sessions",
      serverId,
      scopedDirectory,
      (providersToFetch ?? []).join(","),
      supportsStates,
    ],
    enabled: providersToFetch !== null && providersToFetch.length > 0,
    dataShape: "list",
    staleTimeMs: 15_000,
    queryFn: async () => {
      return await client.fetchRecentProviderSessions({
        providers: providersToFetch ?? undefined,
        limit: PER_PROVIDER_LIMIT,
        ...(scopedDirectory ? { cwd: scopedDirectory } : {}),
        ...(supportsStates ? { includeImported: true } : {}),
      });
    },
  });

  const entries = (query.data?.entries ?? []).slice(0, MAX_ROWS);

  const importMutation = useMutation({
    mutationFn: async (entry: FetchRecentProviderSessionEntry) => {
      if (!entry.cwd) {
        throw new Error("Session is missing a working directory");
      }
      return await client.importAgent({
        providerId: entry.providerId,
        providerHandleId: entry.providerHandleId,
        cwd: entry.cwd,
      });
    },
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({
        queryKey: ["new-workspace-recent-sessions", serverId],
        refetchType: "none",
      });
      router.push(buildHostAgentDetailRoute(serverId, agent.id) as Href);
    },
  });

  const handleToggleScope = useCallback(() => {
    setScopeToProject((current) => !current);
  }, []);

  const handleOpenAll = useCallback(() => onShowAll(), [onShowAll]);

  const handlePress = useCallback(
    (entry: FetchRecentProviderSessionEntry) => {
      if (resolveRowState(entry) === "open" && entry.importedAgentId) {
        router.push(
          buildHostAgentDetailRoute(
            serverId,
            entry.importedAgentId,
            entry.importedWorkspaceId,
          ) as Href,
        );
        return;
      }
      importMutation.mutate(entry);
    },
    [importMutation, router, serverId],
  );

  if (providersToFetch === null || providersToFetch.length === 0) {
    return null;
  }
  const hasRows = entries.length > 0;

  return (
    <View style={styles.container} testID="new-workspace-sessions">
      <View style={styles.header}>
        <ThemedHistory size={14} />
        <Text style={styles.headerText}>{t("newWorkspace.sessions.title")}</Text>
        {projectDirectory ? (
          <Pressable onPress={handleToggleScope} testID="new-workspace-sessions-scope">
            <Text style={styles.scopeToggle}>
              {scopeToProject
                ? t("newWorkspace.sessions.scopeAll")
                : t("newWorkspace.sessions.scopeProject")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {hasRows ? (
        <View style={styles.list}>
          {entries.map((entry) => (
            <SessionRow
              key={`${entry.providerId}:${entry.providerHandleId}`}
              serverId={serverId}
              entry={entry}
              busy={importMutation.isPending}
              onPress={handlePress}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty} testID="new-workspace-sessions-empty">
          {t("newWorkspace.sessions.empty")}
        </Text>
      )}
      <Pressable onPress={handleOpenAll} testID="new-workspace-sessions-show-all">
        <Text style={styles.showAll}>{t("importSession.actions.showAll")}</Text>
      </Pressable>
    </View>
  );
}

function SessionRow({
  serverId,
  entry,
  busy,
  onPress,
}: {
  serverId: string;
  entry: FetchRecentProviderSessionEntry;
  busy: boolean;
  onPress: (entry: FetchRecentProviderSessionEntry) => void;
}) {
  const { t } = useTranslation();
  const ProviderIcon = getThemedProviderIcon(entry.providerId, serverId);
  const state = resolveRowState(entry);
  const handlePress = useCallback(() => onPress(entry), [entry, onPress]);
  const pressableStyle = useCallback(
    ({ pressed, hovered = false }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.row,
      Boolean(hovered) && styles.rowHovered,
      pressed && styles.rowPressed,
    ],
    [],
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      style={pressableStyle}
      testID={`new-workspace-session-${entry.providerId}-${entry.providerHandleId}`}
    >
      <View style={styles.rowIcon}>
        <ProviderIcon size={14} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {getSessionTitle(entry)}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {entry.cwd} · {formatTimeAgo(new Date(entry.lastActivityAt))}
        </Text>
      </View>
      <View style={[styles.badge, state === "open" && styles.badgeOpen]}>
        <Text style={styles.badgeText}>{t(`newWorkspace.sessions.state.${state}`)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    marginBottom: theme.spacing[6],
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[1],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1.5],
  },
  headerText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  scopeToggle: {
    marginLeft: "auto",
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
  },
  list: {
    gap: theme.spacing[1],
  },
  empty: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  showAll: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[1.5],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface1,
  },
  rowHovered: {
    backgroundColor: theme.colors.surface2,
  },
  rowPressed: {
    backgroundColor: theme.colors.surface3,
  },
  rowIcon: {
    width: theme.iconSize.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
  },
  rowMeta: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
  },
  badgeOpen: {
    borderColor: theme.colors.borderAccent,
  },
  badgeText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
}));

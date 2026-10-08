import * as Clipboard from "expo-clipboard";
import { useCallback } from "react";
import { getDesktopHost } from "@/desktop/host";
import { useHostMutations, useHosts } from "@/runtime/host-runtime";

const TRANSFER_KIND = "paseo.hosts";
const TRANSFER_VERSION = 1;
const FILE_NAME = "paseo-hosts.json";
const FILE_FILTERS = [{ name: "Paseo hosts", extensions: ["json"] }];

interface TransferredHost {
  serverId?: string;
  label?: string;
  endpoint: string;
  useTls: boolean;
  password?: string;
}

export type HostExportOutcome =
  | { kind: "file"; count: number; path: string }
  | { kind: "clipboard"; count: number }
  | { kind: "cancelled" };

export type HostImportOutcome =
  | { kind: "imported"; imported: number; failed: number }
  | { kind: "cancelled" };

/**
 * Moves the host list between machines. On the desktop app it writes/reads a
 * real JSON file through native dialogs (AirDrop, iCloud Drive, a USB stick);
 * elsewhere it falls back to the clipboard. Only direct TCP connections carry
 * over, and passwords are included because a connection is useless without
 * them — treat an export like a credential.
 */
export function useHostTransfer() {
  const hosts = useHosts();
  const { upsertDirectConnection, probeAndUpsertDirectConnection } = useHostMutations();

  const buildPayload = useCallback((): { json: string; count: number } => {
    const transferred: TransferredHost[] = [];
    for (const host of hosts) {
      for (const connection of host.connections) {
        if (connection.type !== "directTcp") continue;
        transferred.push({
          serverId: host.serverId,
          label: host.label,
          endpoint: connection.endpoint,
          useTls: Boolean(connection.useTls),
          ...(host.password ? { password: host.password } : {}),
        });
      }
    }
    const json = JSON.stringify(
      { kind: TRANSFER_KIND, version: TRANSFER_VERSION, hosts: transferred },
      null,
      2,
    );
    return { json, count: transferred.length };
  }, [hosts]);

  const exportHosts = useCallback(async (): Promise<HostExportOutcome> => {
    const { json, count } = buildPayload();
    const files = getDesktopHost()?.files;
    if (files?.saveText) {
      const path = await files.saveText({
        title: "Export hosts",
        defaultFileName: FILE_NAME,
        content: json,
        filters: FILE_FILTERS,
      });
      return path ? { kind: "file", count, path } : { kind: "cancelled" };
    }
    await Clipboard.setStringAsync(json);
    return { kind: "clipboard", count };
  }, [buildPayload]);

  const applyPayload = useCallback(
    async (text: string): Promise<{ imported: number; failed: number }> => {
      const parsed = JSON.parse(text) as { kind?: string; hosts?: TransferredHost[] };
      if (parsed.kind !== TRANSFER_KIND || !Array.isArray(parsed.hosts)) {
        throw new Error("Not a Paseo hosts export");
      }
      let imported = 0;
      let failed = 0;
      for (const entry of parsed.hosts) {
        try {
          if (entry.serverId) {
            // The source machine knew the daemon's id, so add the host under its
            // real key now. Do not probe: an unreachable host (e.g. Tailscale is
            // off) must still be imported so it works once it is reachable.
            await upsertDirectConnection({
              serverId: entry.serverId,
              endpoint: entry.endpoint,
              useTls: entry.useTls,
              ...(entry.password ? { password: entry.password } : {}),
              ...(entry.label ? { label: entry.label } : {}),
            });
          } else {
            // Older exports have no serverId, so we must connect to learn it.
            await probeAndUpsertDirectConnection({
              endpoint: entry.endpoint,
              useTls: entry.useTls,
              ...(entry.password ? { password: entry.password } : {}),
              ...(entry.label ? { label: entry.label } : {}),
            });
          }
          imported += 1;
        } catch {
          failed += 1;
        }
      }
      return { imported, failed };
    },
    [probeAndUpsertDirectConnection, upsertDirectConnection],
  );

  const importHosts = useCallback(async (): Promise<HostImportOutcome> => {
    const files = getDesktopHost()?.files;
    let text: string | null = null;
    if (files?.openText) {
      const opened = await files.openText({ title: "Import hosts", filters: FILE_FILTERS });
      if (!opened) return { kind: "cancelled" };
      text = opened.content;
    } else {
      text = await Clipboard.getStringAsync();
    }
    const result = await applyPayload(text);
    return { kind: "imported", ...result };
  }, [applyPayload]);

  return { exportHosts, importHosts };
}

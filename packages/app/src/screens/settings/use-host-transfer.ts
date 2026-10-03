import * as Clipboard from "expo-clipboard";
import { useCallback } from "react";
import { useHostMutations, useHosts } from "@/runtime/host-runtime";

const TRANSFER_KIND = "paseo.hosts";
const TRANSFER_VERSION = 1;

interface TransferredHost {
  label?: string;
  endpoint: string;
  useTls: boolean;
  password?: string;
}

export interface HostImportResult {
  imported: number;
  failed: number;
}

/**
 * Moves the host list between machines as text: export copies a JSON document to
 * the clipboard, import reads it back and re-probes each direct connection,
 * upserting by serverId so re-importing is idempotent.
 *
 * Passwords are included because a connection is useless without them; treat an
 * export like a credential. Only direct TCP connections are transferred.
 */
export function useHostTransfer() {
  const hosts = useHosts();
  const { probeAndUpsertDirectConnection } = useHostMutations();

  const exportHosts = useCallback(async (): Promise<number> => {
    const transferred: TransferredHost[] = [];
    for (const host of hosts) {
      for (const connection of host.connections) {
        if (connection.type !== "directTcp") continue;
        transferred.push({
          label: host.label,
          endpoint: connection.endpoint,
          useTls: Boolean(connection.useTls),
          ...(connection.password ? { password: connection.password } : {}),
        });
      }
    }
    await Clipboard.setStringAsync(
      JSON.stringify(
        { kind: TRANSFER_KIND, version: TRANSFER_VERSION, hosts: transferred },
        null,
        2,
      ),
    );
    return transferred.length;
  }, [hosts]);

  const importHosts = useCallback(async (): Promise<HostImportResult> => {
    const text = await Clipboard.getStringAsync();
    const parsed = JSON.parse(text) as { kind?: string; hosts?: TransferredHost[] };
    if (parsed.kind !== TRANSFER_KIND || !Array.isArray(parsed.hosts)) {
      throw new Error("Not a Paseo hosts export");
    }
    let imported = 0;
    let failed = 0;
    for (const entry of parsed.hosts) {
      try {
        await probeAndUpsertDirectConnection({
          endpoint: entry.endpoint,
          useTls: entry.useTls,
          ...(entry.password ? { password: entry.password } : {}),
          ...(entry.label ? { label: entry.label } : {}),
        });
        imported += 1;
      } catch {
        failed += 1;
      }
    }
    return { imported, failed };
  }, [probeAndUpsertDirectConnection]);

  return { exportHosts, importHosts };
}

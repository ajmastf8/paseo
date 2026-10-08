#!/usr/bin/env node
// Wraps electron-builder for the macOS signing realities of a local build.
//
// A Developer ID build keeps the hardened runtime and only skips notarization
// when no Apple credentials are present: a signed-but-unnotarized app still
// launches locally.
//
// An ad-hoc build must not enable the hardened runtime. The runtime turns on
// library validation, and on macOS 27 an ad-hoc signed framework no longer
// passes it ("different Team IDs"), so the app aborts in dyld before any window
// opens.
import { spawnSync } from "node:child_process";

const MAC = process.platform === "darwin";
const args = ["--config", "electron-builder.yml"];

function hasDeveloperId() {
  if (!MAC) return false;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return true;
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === "false") return false;
  const probe = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8",
  });
  return probe.status === 0 && /Developer ID Application/.test(probe.stdout ?? "");
}

function hasNotarizeCredentials() {
  if (
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
  ) {
    return true;
  }
  return Boolean(
    process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER,
  );
}

if (MAC) {
  if (hasDeveloperId()) {
    if (!hasNotarizeCredentials()) args.push("-c.mac.notarize=false");
  } else {
    args.push("-c.mac.hardenedRuntime=false", "-c.mac.notarize=false");
  }
}

const result = spawnSync("electron-builder", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);

import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { createHash } from "node:crypto";
import fs from "fs";
import { NodeSSH } from "node-ssh";
import os from "os";
import path from "path";
import { SessionManager } from "../../src/session.js";

type ExecResponse = {
  code?: number;
  stdout?: string;
  stderr?: string;
};

function createExecMap(entries: Record<string, ExecResponse | Error>) {
  return new Map<string, ExecResponse | Error>(Object.entries(entries));
}

function knownHostFingerprint(keyBlob: string, encoding: "base64" | "hex" = "base64") {
  const digest = createHash("sha256").update(Buffer.from(keyBlob, "base64")).digest(encoding);
  return encoding === "base64" ? digest.replace(/=+$/, "") : digest;
}

describe("SessionManager", () => {
  let manager: SessionManager;
  let tempDir: string;
  let execResponses: Map<string, ExecResponse | Error>;
  let sftpResult: unknown;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-test-"));
    execResponses = new Map();
    sftpResult = { end: jest.fn() };

    jest.spyOn(NodeSSH.prototype, "connect").mockImplementation(async function (
      this: NodeSSH,
      config: unknown,
    ) {
      (this as NodeSSH & { __connectConfig?: unknown }).__connectConfig = config;
      return this;
    });

    jest.spyOn(NodeSSH.prototype, "requestSFTP").mockImplementation(async () => {
      if (sftpResult instanceof Error) {
        throw sftpResult;
      }

      return sftpResult as never;
    });

    jest.spyOn(NodeSSH.prototype, "execCommand").mockImplementation((async (_command: string) => {
      const response = execResponses.get(_command);
      if (response instanceof Error) {
        throw response;
      }

      return {
        code: response?.code ?? 0,
        stdout: response?.stdout ?? "",
        stderr: response?.stderr ?? "",
        signal: null,
      };
    }) as any);

    jest.spyOn(NodeSSH.prototype, "dispose").mockImplementation(() => undefined);

    manager = new SessionManager(2, 1000, 10000, {
      allowRootLogin: false,
      allowedCiphers: [],
      hostKeyPolicy: "strict",
      knownHostsPath: "/tmp/known_hosts",
    });
  });

  afterEach(async () => {
    delete process.env.KNOWN_HOSTS_PATH;
    delete process.env.SSH_AUTH_SOCK;
    delete process.env.SSH_DEFAULT_KEY_DIR;

    await manager.destroy();
    jest.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("opens and closes password-authenticated sessions", async () => {
    const result = await manager.openSession({
      host: "example.com",
      username: "demo",
      password: "secret",
      auth: "password",
    });
    const session = manager.getSession(result.sessionId);
    const connectConfig = (
      session?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;

    expect(result.sftpAvailable).toBe(true);
    expect(connectConfig).toEqual(
      expect.objectContaining({
        host: "example.com",
        username: "demo",
        password: "secret",
        hostHash: "sha256",
        hostVerifier: expect.any(Function),
      }),
    );

    await expect(manager.closeSession(result.sessionId)).resolves.toBe(true);
    expect(session?.ssh.dispose).toHaveBeenCalled();
  });

  test("verifies strict known_hosts fingerprints with OpenSSH-style entries", async () => {
    const keyBlob = Buffer.from("known-host-key").toString("base64");
    const otherKeyBlob = Buffer.from("other-key").toString("base64");
    const knownHostsPath = path.join(tempDir, "known_hosts");
    fs.writeFileSync(
      knownHostsPath,
      [
        "# comment",
        "",
        `example.com ssh-ed25519 ${keyBlob}`,
        `*.example.org ssh-ed25519 ${keyBlob}`,
        `@revoked revoked.example ssh-ed25519 ${keyBlob}`,
        `[other.example]:2222 ssh-ed25519 ${otherKeyBlob}`,
      ].join("\n"),
      "utf8",
    );

    const strictSession = await manager.openSession({
      host: "example.com",
      username: "demo",
      password: "secret",
      auth: "password",
      knownHostsPath,
    });
    const strictConfig = (
      manager.getSession(strictSession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;
    const strictVerifier = strictConfig?.hostVerifier as (fingerprint: string) => boolean;

    expect(strictVerifier(knownHostFingerprint(keyBlob))).toBe(true);
    expect(strictVerifier(`SHA256:${knownHostFingerprint(keyBlob)}`)).toBe(true);
    expect(strictVerifier(knownHostFingerprint(keyBlob, "hex"))).toBe(true);
    expect(strictVerifier(knownHostFingerprint(otherKeyBlob))).toBe(false);

    const wildcardSession = await manager.openSession({
      host: "api.example.org",
      username: "demo",
      password: "secret",
      auth: "password",
      knownHostsPath,
    });
    const wildcardConfig = (
      manager.getSession(wildcardSession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;
    expect(
      (wildcardConfig?.hostVerifier as (fingerprint: string) => boolean)(
        knownHostFingerprint(keyBlob),
      ),
    ).toBe(true);

    const revokedSession = await manager.openSession({
      host: "revoked.example",
      username: "demo",
      password: "secret",
      auth: "password",
      knownHostsPath,
    });
    const revokedConfig = (
      manager.getSession(revokedSession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;
    expect(
      (revokedConfig?.hostVerifier as (fingerprint: string) => boolean)(
        knownHostFingerprint(keyBlob),
      ),
    ).toBe(false);

    const emptyKnownHostsPath = path.join(tempDir, "empty_known_hosts");
    fs.writeFileSync(emptyKnownHostsPath, "", "utf8");
    const emptySession = await manager.openSession({
      host: "empty.example",
      username: "demo",
      password: "secret",
      auth: "password",
      knownHostsPath: emptyKnownHostsPath,
    });
    const emptyConfig = (
      manager.getSession(emptySession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;
    expect(
      (emptyConfig?.hostVerifier as (fingerprint: string) => boolean)(
        knownHostFingerprint(keyBlob),
      ),
    ).toBe(false);
  });

  test("supports fingerprint pinning and explain-mode root denial", async () => {
    const pinned = await manager.openSession({
      host: "pinned.example",
      username: "demo",
      password: "secret",
      auth: "password",
      expectedHostKeySha256: "SHA256:abc123",
    });
    const connectConfig = (
      manager.getSession(pinned.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;

    expect(connectConfig).toEqual(
      expect.objectContaining({
        hostHash: "sha256",
        hostVerifier: expect.any(Function),
      }),
    );
    expect((connectConfig?.hostVerifier as (fingerprint: string) => boolean)("abc123")).toBe(true);
    expect((connectConfig?.hostVerifier as (fingerprint: string) => boolean)("different")).toBe(
      false,
    );

    await expect(
      manager.openSession({
        host: "root.example",
        username: "root",
        password: "secret",
        auth: "password",
      }),
    ).rejects.toMatchObject({ code: "EPOLICY" });

    await expect(
      manager.openSession({
        host: "root.example",
        username: "root",
        password: "secret",
        auth: "password",
        policyMode: "explain",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        wouldConnect: false,
      }),
    );
  });

  test("supports key and agent authentication paths", async () => {
    const keyPath = path.join(tempDir, "id_ed25519");
    fs.writeFileSync(keyPath, "PRIVATE KEY");
    sftpResult = new Error("sftp disabled");

    const keySession = await manager.openSession({
      host: "example.com",
      username: "demo",
      auth: "key",
      privateKeyPath: keyPath,
      passphrase: "pass",
    });
    const keyConnectConfig = (
      manager.getSession(keySession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;

    expect(keySession.sftpAvailable).toBe(false);
    expect(keyConnectConfig).toEqual(
      expect.objectContaining({
        privateKey: "PRIVATE KEY",
        passphrase: "pass",
      }),
    );

    const emptyKeyDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-agent-"));
    process.env.SSH_DEFAULT_KEY_DIR = emptyKeyDir;
    process.env.SSH_AUTH_SOCK = "/tmp/agent.sock";
    const agentSession = await manager.openSession({
      host: "example.org",
      username: "demo",
    });
    const agentConnectConfig = (
      manager.getSession(agentSession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;

    expect(agentConnectConfig).toEqual(
      expect.objectContaining({
        agent: "/tmp/agent.sock",
      }),
    );

    fs.rmSync(emptyKeyDir, { recursive: true, force: true });
  });

  test("supports inline keys and auto-auth password fallback", async () => {
    const inlineKeySession = await manager.openSession({
      host: "inline.example",
      username: "demo",
      auth: "key",
      privateKey: "INLINE KEY",
      passphrase: "phrase",
    });
    const inlineConnectConfig = (
      manager.getSession(inlineKeySession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;

    expect(inlineConnectConfig).toEqual(
      expect.objectContaining({
        privateKey: "INLINE KEY",
        passphrase: "phrase",
      }),
    );

    const autoPasswordSession = await manager.openSession({
      host: "auto.example",
      username: "demo",
      password: "secret",
    });
    const autoPasswordConfig = (
      manager.getSession(autoPasswordSession.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;

    expect(autoPasswordConfig).toEqual(
      expect.objectContaining({
        password: "secret",
      }),
    );
  });

  test("discovers private keys from the default SSH directory", async () => {
    const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-discover-"));
    const keyPath = path.join(keyDir, "id_rsa");
    fs.writeFileSync(keyPath, "DISCOVERED KEY");
    process.env.SSH_DEFAULT_KEY_DIR = keyDir;

    const result = await manager.openSession({
      host: "discover.example",
      username: "demo",
      auth: "key",
    });
    const connectConfig = (
      manager.getSession(result.sessionId)?.ssh as NodeSSH & {
        __connectConfig?: Record<string, unknown>;
      }
    ).__connectConfig;

    expect(connectConfig).toEqual(
      expect.objectContaining({
        privateKey: "DISCOVERED KEY",
      }),
    );

    fs.rmSync(keyDir, { recursive: true, force: true });
  });

  test("detects and caches os info", async () => {
    execResponses = createExecMap({
      "uname -m": { code: 0, stdout: "x86_64\n" },
      "uname -s": { code: 0, stdout: "Linux\n" },
      "echo $SHELL": { code: 0, stdout: "/bin/bash\n" },
      "cat /etc/os-release": {
        code: 0,
        stdout: 'ID=ubuntu\nVERSION_ID="22.04"\n',
      },
      "command -v apt-get || which apt-get": {
        code: 0,
        stdout: "/usr/bin/apt-get\n",
      },
      "command -v systemctl || which systemctl": {
        code: 0,
        stdout: "/usr/bin/systemctl\n",
      },
      "command -v service || which service": { code: 1, stdout: "" },
    });

    const result = await manager.openSession({
      host: "example.com",
      username: "demo",
      password: "secret",
      auth: "password",
    });

    const before = (NodeSSH.prototype.execCommand as jest.Mock).mock.calls.length;
    const first = await manager.getOSInfo(result.sessionId);
    const afterFirst = (NodeSSH.prototype.execCommand as jest.Mock).mock.calls.length;
    const second = await manager.getOSInfo(result.sessionId);
    const afterSecond = (NodeSSH.prototype.execCommand as jest.Mock).mock.calls.length;

    expect(first.platform).toBe("linux");
    expect(second).toEqual(first);
    expect(afterFirst).toBeGreaterThan(before);
    expect(afterSecond).toBe(afterFirst);
  });

  test("evicts oldest sessions and expires stale ones", async () => {
    await manager.openSession({
      host: "one",
      username: "demo",
      password: "secret",
      auth: "password",
      ttlMs: 5,
    });
    const second = await manager.openSession({
      host: "two",
      username: "demo",
      password: "secret",
      auth: "password",
      ttlMs: 5,
    });
    const active = manager.getActiveSessions();

    expect(active).toHaveLength(2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(manager.getSession(second.sessionId)).toBeUndefined();
  });

  test("reconnects and checks session health", async () => {
    execResponses = createExecMap({
      "echo 1": { code: 1, stdout: "", stderr: "" },
    });

    const session = await manager.openSession({
      host: "example.com",
      username: "demo",
      password: "secret",
      auth: "password",
    });

    await expect(manager.getSessionWithReconnect(session.sessionId)).resolves.toBeUndefined();
    const reconnectedId = manager.getActiveSessions()[0]?.sessionId;

    expect(reconnectedId).toBeDefined();
    expect(reconnectedId).not.toBe(session.sessionId);
    await expect(manager.reconnectSession("missing")).resolves.toBeNull();

    execResponses = createExecMap({
      "echo 1": { code: 0, stdout: "1", stderr: "" },
    });
    await expect(manager.isSessionAlive(reconnectedId ?? "")).resolves.toBe(true);
  });

  test("returns null when reconnect has no stored connection params", async () => {
    const session = await manager.openSession({
      host: "example.com",
      username: "demo",
      password: "secret",
      auth: "password",
    });
    const current = manager.getSession(session.sessionId);
    if (current) {
      delete current.connectionParams;
    }

    await expect(manager.reconnectSession(session.sessionId)).resolves.toBeNull();
  });

  test("returns current sessions when healthy and handles missing session helpers", async () => {
    execResponses = createExecMap({
      "echo 1": { code: 0, stdout: "1", stderr: "" },
    });

    const session = await manager.openSession({
      host: "healthy.example",
      username: "demo",
      password: "secret",
      auth: "password",
    });

    await expect(manager.getSessionWithReconnect(session.sessionId)).resolves.toBe(
      manager.getSession(session.sessionId),
    );
    await expect(manager.closeSession("missing")).resolves.toBe(false);
    await expect(manager.isSessionAlive("missing")).resolves.toBe(false);
    await expect(manager.getOSInfo("missing")).rejects.toThrow(
      "Session missing not found or expired",
    );
  });

  test("translates authentication and connection refused errors", async () => {
    jest.spyOn(NodeSSH.prototype, "connect").mockImplementationOnce(async () => {
      throw new Error("authentication failed");
    });
    await expect(
      manager.openSession({
        host: "auth.example",
        username: "demo",
        password: "secret",
        auth: "password",
      }),
    ).rejects.toMatchObject({ code: "EAUTH" });

    jest.spyOn(NodeSSH.prototype, "connect").mockImplementationOnce(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      manager.openSession({
        host: "connrefused.example",
        username: "demo",
        password: "secret",
        auth: "password",
      }),
    ).rejects.toMatchObject({ code: "ECONN" });
  });

  test("swallows dispose errors while closing sessions", async () => {
    const session = await manager.openSession({
      host: "dispose.example",
      username: "demo",
      password: "secret",
      auth: "password",
    });
    const current = manager.getSession(session.sessionId);
    if (!current) {
      throw new Error("session not found");
    }

    current.ssh.dispose = jest.fn(() => {
      throw new Error("dispose failed");
    }) as any;

    await expect(manager.closeSession(session.sessionId)).resolves.toBe(true);
  });

  test("surfaces auth and connection errors", async () => {
    await expect(
      manager.openSession({
        host: "example.com",
        username: "demo",
        auth: "password",
      }),
    ).rejects.toMatchObject({ code: "EAUTH" });

    delete process.env.SSH_AUTH_SOCK;
    await expect(
      manager.openSession({
        host: "example.com",
        username: "demo",
        auth: "agent",
      }),
    ).rejects.toMatchObject({ code: "EAUTH" });

    jest.spyOn(NodeSSH.prototype, "connect").mockImplementationOnce(async () => {
      throw new Error("ETIMEDOUT");
    });
    await expect(
      manager.openSession({
        host: "example.com",
        username: "demo",
        password: "secret",
        auth: "password",
      }),
    ).rejects.toMatchObject({ code: "ETIMEOUT" });
  });
});

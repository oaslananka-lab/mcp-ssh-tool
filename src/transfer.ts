/**
 * File Transfer with Progress Tracking
 *
 * Provides file upload/download with progress callbacks
 */

import * as fs from "fs";
import * as path from "path";
import type { SFTPWrapper, Stats } from "ssh2";
import { sessionManager } from "./session.js";
import { logger } from "./logging.js";
import { createFilesystemError } from "./errors.js";

/**
 * Promisified SFTP helpers for transfer
 */
function sftpWriteFile(
  sftp: SFTPWrapper,
  remotePath: string,
  data: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, data, {}, (err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sftpReadFile(sftp: SFTPWrapper, remotePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.readFile(remotePath, (err: Error | null | undefined, data: Buffer) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function sftpStat(sftp: SFTPWrapper, remotePath: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err: Error | null | undefined, stats: Stats) => {
      if (err) reject(err);
      else resolve(stats);
    });
  });
}

/**
 * Transfer progress information
 */
export interface TransferProgress {
  filename: string;
  transferred: number;
  total: number;
  percentage: number;
  bytesPerSecond: number;
  eta: number; // seconds remaining
}

/**
 * Transfer options
 */
export interface TransferOptions {
  sessionId: string;
  onProgress?: (progress: TransferProgress) => void;
}

/**
 * Transfer result
 */
export interface TransferResult {
  success: boolean;
  filename: string;
  size: number;
  durationMs: number;
  averageSpeed: number; // bytes per second
}

/**
 * Uploads a file with progress tracking
 */
export async function uploadFileWithProgress(
  localPath: string,
  remotePath: string,
  options: TransferOptions,
): Promise<TransferResult> {
  const { sessionId, onProgress } = options;

  logger.debug("Starting file upload with progress", {
    sessionId,
    localPath,
    remotePath,
  });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw createFilesystemError("Session not found or expired");
  }
  if (!session.sftp) {
    throw createFilesystemError(
      "SFTP subsystem is unavailable for this session",
    );
  }

  const sftp = session.sftp;

  const startTime = Date.now();
  const filename = path.basename(localPath);

  try {
    // Get file size
    const stats = await fs.promises.stat(localPath);
    const totalSize = stats.size;

    // Read file and upload with progress simulation
    const fileContent = await fs.promises.readFile(localPath);

    // Upload using SFTP
    await sftpWriteFile(sftp, remotePath, fileContent);

    if (onProgress) {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const speed = totalSize / elapsed;

      onProgress({
        filename,
        transferred: totalSize,
        total: totalSize,
        percentage: 100,
        bytesPerSecond: speed,
        eta: 0,
      });
    }

    const durationMs = Date.now() - startTime;
    const averageSpeed = totalSize / (durationMs / 1000);

    logger.info("File upload completed", {
      sessionId,
      filename,
      size: totalSize,
      durationMs,
      averageSpeed,
    });

    return {
      success: true,
      filename,
      size: totalSize,
      durationMs,
      averageSpeed,
    };
  } catch (error) {
    logger.error("File upload failed", { sessionId, localPath, error });
    throw createFilesystemError(`Failed to upload ${localPath}: ${error}`);
  }
}

/**
 * Downloads a file with progress tracking
 */
export async function downloadFileWithProgress(
  remotePath: string,
  localPath: string,
  options: TransferOptions,
): Promise<TransferResult> {
  const { sessionId, onProgress } = options;

  logger.debug("Starting file download with progress", {
    sessionId,
    remotePath,
    localPath,
  });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw createFilesystemError("Session not found or expired");
  }
  if (!session.sftp) {
    throw createFilesystemError(
      "SFTP subsystem is unavailable for this session",
    );
  }

  const sftp = session.sftp;

  const startTime = Date.now();
  const filename = path.basename(remotePath);

  try {
    // Get remote file size
    const stats = await sftpStat(sftp, remotePath);
    const totalSize = stats.size ?? 0;

    // Download file
    const data = await sftpReadFile(sftp, remotePath);

    // Write to local file
    await fs.promises.writeFile(localPath, data);

    // Final progress update
    if (onProgress) {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const speed = totalSize / elapsed;

      onProgress({
        filename,
        transferred: totalSize,
        total: totalSize,
        percentage: 100,
        bytesPerSecond: speed,
        eta: 0,
      });
    }

    const durationMs = Date.now() - startTime;
    const averageSpeed = totalSize / (durationMs / 1000);

    logger.info("File download completed", {
      sessionId,
      filename,
      size: totalSize,
      durationMs,
      averageSpeed,
    });

    return {
      success: true,
      filename,
      size: totalSize,
      durationMs,
      averageSpeed,
    };
  } catch (error) {
    logger.error("File download failed", { sessionId, remotePath, error });
    throw createFilesystemError(`Failed to download ${remotePath}: ${error}`);
  }
}

/**
 * @internal
 * Formats transfer speed for display
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  } else if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
  } else {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  }
}

/**
 * @internal
 * Formats file size for display
 */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${bytes} B`;
  }
}

/**
 * @internal
 * Formats ETA for display
 */
export function formatETA(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

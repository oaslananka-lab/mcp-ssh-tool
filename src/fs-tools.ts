import { FileStatInfo, DirEntry, DirListResult } from './types.js';
import { createFilesystemError, wrapError } from './errors.js';
import { logger } from './logging.js';
import { sessionManager } from './session.js';
import { ErrorCode } from './types.js';
import { buildRemoteCommand } from './shell.js';

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

async function execFallback(sessionId: string, command: string): Promise<string> {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  const osInfo = await sessionManager.getOSInfo(sessionId);
  const shellCommand = buildRemoteCommand(command, osInfo);
  const result = await session.ssh.execCommand(shellCommand);

  if ((result.code || 0) !== 0) {
    throw new Error(result.stderr || result.stdout || `Remote command failed with code ${result.code}`);
  }

  return result.stdout || '';
}

function hasSftp(session: { sftp?: unknown } | undefined): boolean {
  return !!session?.sftp;
}

function getSftpOrThrow(session: { sftp?: any }) {
  if (!session.sftp) {
    throw createFilesystemError('SFTP subsystem is unavailable for this session');
  }

  return session.sftp;
}

/**
 * Reads a file from the remote system
 */
export async function readFile(
  sessionId: string,
  path: string,
  encoding: string = 'utf8'
): Promise<string> {
  logger.debug('Reading file', { sessionId, path, encoding });
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }
  
  try {
    if (!hasSftp(session)) {
      const data = await execFallback(sessionId, `cat ${shellQuote(path)}`);
      logger.debug('File read successfully via SSH fallback', { sessionId, path, size: data.length });
      return data;
    }

    const sftp = getSftpOrThrow(session);
    const data = await sftp.get(path);
    const result = Buffer.isBuffer(data) ? data.toString(encoding as any) : String(data);
    logger.debug('File read successfully', { sessionId, path, size: result.length });
    return result;
  } catch (error) {
    logger.error('Failed to read file', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to read file ${path}. Check if the file exists and is readable.`
    );
  }
}

/**
 * Writes data to a file on the remote system (atomic operation using temp file)
 */
export async function writeFile(
  sessionId: string,
  path: string,
  data: string,
  mode?: number
): Promise<boolean> {
  logger.debug('Writing file', { sessionId, path, size: data.length, mode });
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }
  
  try {
    if (!hasSftp(session)) {
      const tempPath = `${path}.tmp.${Date.now()}`;
      const chmodCommand = mode !== undefined
        ? `chmod ${mode.toString(8)} ${shellQuote(tempPath)}\n`
        : '';

      await execFallback(
        sessionId,
        `printf %s ${shellQuote(data)} > ${shellQuote(tempPath)}\n${chmodCommand}mv ${shellQuote(tempPath)} ${shellQuote(path)}`
      );

      logger.debug('File written successfully via SSH fallback', { sessionId, path });
      return true;
    }

    const sftp = getSftpOrThrow(session);

    // Use atomic write: write to temp file, then rename
    const tempPath = `${path}.tmp.${Date.now()}`;
    
    try {
      // Write to temporary file
      await sftp.put(Buffer.from(data, 'utf8'), tempPath);
      
      // Set permissions if specified
      if (mode !== undefined) {
        await sftp.chmod(tempPath, mode);
      }
      
      // Atomic rename
      await sftp.rename(tempPath, path);
      
      logger.debug('File written successfully', { sessionId, path });
      return true;
    } catch (writeError) {
      // Clean up temp file on failure
      try {
        await sftp.delete(tempPath);
        logger.debug('Cleaned up temp file after error', { tempPath });
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp file', { tempPath, cleanupError });
      }
      throw writeError;
    }
  } catch (error) {
    logger.error('Failed to write file', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to write file ${path}. Check directory permissions and disk space.`
    );
  }
}

/**
 * Gets file/directory statistics
 */
export async function statFile(
  sessionId: string,
  path: string
): Promise<FileStatInfo> {
  logger.debug('Getting file stats', { sessionId, path });
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }
  
  try {
    if (!hasSftp(session)) {
      const output = await execFallback(
        sessionId,
          `target=${shellQuote(path)}; if [ -L "$target" ]; then type=symlink; elif [ -d "$target" ]; then type=directory; elif [ -f "$target" ]; then type=file; else type=other; fi; size=$(stat -c '%s' "$target"); mtime=$(stat -c '%Y' "$target"); mode=$(stat -c '%a' "$target"); printf '%s\t%s\t%s\t%s' "$type" "$size" "$mtime" "$mode"`
      );

      const [type, size, mtime, mode] = output.trim().split('\t');
      return {
        size: Number(size),
        mtime: new Date(Number(mtime) * 1000),
        mode: parseInt(mode, 8),
        type: (type as FileStatInfo['type']) || 'other'
      };
    }

    const sftp = getSftpOrThrow(session);
    const stats = await sftp.stat(path);
    
    let type: FileStatInfo['type'] = 'other';
    if ((stats as any).isFile && (stats as any).isFile()) {
      type = 'file';
    } else if ((stats as any).isDirectory && (stats as any).isDirectory()) {
      type = 'directory';
    } else if ((stats as any).isSymbolicLink && (stats as any).isSymbolicLink()) {
      type = 'symlink';
    }
    
    const statInfo: FileStatInfo = {
      size: stats.size,
      mtime: new Date((stats as any).mtime ? (stats as any).mtime * 1000 : Date.now()),
      mode: stats.mode,
      type
    };
    
    logger.debug('File stats retrieved', { sessionId, path, type, size: stats.size });
    return statInfo;
  } catch (error) {
    logger.error('Failed to get file stats', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to get stats for ${path}. Check if the path exists.`
    );
  }
}

/**
 * Lists directory contents with pagination
 */
export async function listDirectory(
  sessionId: string,
  path: string,
  page?: number,
  limit: number = 100
): Promise<DirListResult> {
  logger.debug('Listing directory', { sessionId, path, page, limit });
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }
  
  try {
    if (!hasSftp(session)) {
      const output = await execFallback(
        sessionId,
        `dir=${shellQuote(path)}; for item in "$dir"/* "$dir"/.[!.]* "$dir"/..?*; do [ -e "$item" ] || continue; name=$(basename "$item"); if [ -L "$item" ]; then type=symlink; elif [ -d "$item" ]; then type=directory; elif [ -f "$item" ]; then type=file; else type=other; fi; size=$(stat -c '%s' "$item" 2>/dev/null || echo 0); mtime=$(stat -c '%Y' "$item" 2>/dev/null || echo 0); printf '%s\\t%s\\t%s\\t%s\\n' "$name" "$type" "$size" "$mtime"; done`
      );

      const entries: DirEntry[] = output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [name, typeName, size, mtime] = line.split('\t');
          return {
            name,
            type: (typeName as DirEntry['type']) || 'other',
            size: Number(size),
            mtime: new Date(Number(mtime) * 1000)
          };
        });

      if (page !== undefined) {
        const startIndex = page * limit;
        const endIndex = startIndex + limit;
        return {
          entries: entries.slice(startIndex, endIndex),
          nextToken: endIndex < entries.length ? String(page + 1) : undefined
        };
      }

      return { entries };
    }

    const sftp = getSftpOrThrow(session);
    const fileList = await sftp.list(path);
    
    // Convert to our DirEntry format
    const entries: DirEntry[] = fileList.map((item: any) => {
      let type: DirEntry['type'] = 'other';
      if (item.type === 'd') {
        type = 'directory';
      } else if (item.type === '-') {
        type = 'file';
      } else if (item.type === 'l') {
        type = 'symlink';
      }
      
      return {
        name: item.name,
        type,
        size: item.size,
        mtime: new Date(item.modifyTime),
        mode: item.rights ? parseInt(item.rights.toString(), 8) : undefined
      };
    });
    
    // Apply pagination if requested
    if (page !== undefined) {
      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const paginatedEntries = entries.slice(startIndex, endIndex);
      
      const hasMore = endIndex < entries.length;
      const nextToken = hasMore ? String(page + 1) : undefined;
      
      logger.debug('Directory listed with pagination', {
        sessionId,
        path,
        total: entries.length,
        page,
        returned: paginatedEntries.length,
        hasMore
      });
      
      return {
        entries: paginatedEntries,
        nextToken
      };
    }
    
    logger.debug('Directory listed', { sessionId, path, count: entries.length });
    return { entries };
  } catch (error) {
    logger.error('Failed to list directory', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to list directory ${path}. Check if the directory exists and is readable.`
    );
  }
}

/**
 * Creates directories recursively (mkdir -p equivalent)
 */
export async function makeDirectories(
  sessionId: string,
  path: string
): Promise<boolean> {
  logger.debug('Creating directories', { sessionId, path });
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }
  
  try {
    if (!hasSftp(session)) {
      await execFallback(sessionId, `mkdir -p ${shellQuote(path)}`);
      logger.debug('Directories created successfully via SSH fallback', { sessionId, path });
      return true;
    }

    const sftp = getSftpOrThrow(session);
    await sftp.mkdir(path, true); // recursive = true
    logger.debug('Directories created successfully', { sessionId, path });
    return true;
  } catch (error) {
    logger.error('Failed to create directories', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to create directories ${path}. Check parent directory permissions.`
    );
  }
}

/**
 * Removes files or directories recursively (rm -rf equivalent)
 */
export async function removeRecursive(
  sessionId: string,
  path: string
): Promise<boolean> {
  logger.debug('Removing path recursively', { sessionId, path });
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }
  
  try {
    if (!hasSftp(session)) {
      await execFallback(sessionId, `rm -rf ${shellQuote(path)}`);
      logger.debug('Path removed successfully via SSH fallback', { sessionId, path });
      return true;
    }

    const sftp = getSftpOrThrow(session);
    // Check if path exists and get its type
    const stats = await sftp.stat(path);
    
    if ((stats as any).isDirectory && (stats as any).isDirectory()) {
      // Remove directory recursively
      await sftp.rmdir(path, true); // recursive = true
    } else {
      // Remove file
      await sftp.delete(path);
    }
    
    logger.debug('Path removed successfully', { sessionId, path });
    return true;
  } catch (error) {
    logger.error('Failed to remove path', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to remove ${path}. Check if the path exists and you have write permissions.`
    );
  }
}

/**
 * Renames/moves a file or directory
 */
export async function renameFile(
  sessionId: string,
  from: string,
  to: string
): Promise<boolean> {
  logger.debug('Renaming file', { sessionId, from, to });
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }
  
  try {
    if (!hasSftp(session)) {
      await execFallback(sessionId, `mv ${shellQuote(from)} ${shellQuote(to)}`);
      logger.debug('File renamed successfully via SSH fallback', { sessionId, from, to });
      return true;
    }

    const sftp = getSftpOrThrow(session);
    await sftp.rename(from, to);
    logger.debug('File renamed successfully', { sessionId, from, to });
    return true;
  } catch (error) {
    logger.error('Failed to rename file', { sessionId, from, to, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to rename ${from} to ${to}. Check if the source exists and destination is writable.`
    );
  }
}

/**
 * Checks if a path exists on the remote system
 */
export async function pathExists(sessionId: string, path: string): Promise<boolean> {
  try {
    await statFile(sessionId, path);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the size of a file
 */
export async function getFileSize(sessionId: string, path: string): Promise<number> {
  const stats = await statFile(sessionId, path);
  return stats.size;
}

/**
 * Checks if a path is a directory
 */
export async function isDirectory(sessionId: string, path: string): Promise<boolean> {
  try {
    const stats = await statFile(sessionId, path);
    return stats.type === 'directory';
  } catch (error) {
    return false;
  }
}

/**
 * Checks if a path is a file
 */
export async function isFile(sessionId: string, path: string): Promise<boolean> {
  try {
    const stats = await statFile(sessionId, path);
    return stats.type === 'file';
  } catch (error) {
    return false;
  }
}

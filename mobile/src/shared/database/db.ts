import * as SQLite from 'expo-sqlite';
import { CREATE_13_TABLES_SCHEMA } from './schema';

export interface DatabaseAdapter {
  execute(sql: string, params?: any[]): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  transaction<T>(action: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  withTransaction<T>(action: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  init(): Promise<void>;
  reset?(): Promise<void>;
}

class SQLiteDatabaseAdapter implements DatabaseAdapter {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private isUsingMock = false;
  private mockTables: Record<string, any[]> = {};
  private transactionQueue: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.db = await SQLite.openDatabaseAsync('exit_exam_encrypted.db');
      await this.db.execAsync('PRAGMA foreign_keys = ON;');
      await this.db.execAsync('PRAGMA journal_mode = WAL;');
      await this.db.execAsync(CREATE_13_TABLES_SCHEMA);
      const resourceColumns = await this.db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(local_resources);'
      );
      if (!resourceColumns.some((column) => column.name === 'content_markdown')) {
        await this.db.execAsync(
          'ALTER TABLE local_resources ADD COLUMN content_markdown TEXT;'
        );
      }
      try {
        await this.db.execAsync('ALTER TABLE download_packages ADD COLUMN last_error TEXT;');
      } catch (_) {
        // Column already exists or table freshly created
      }
      try {
        await this.db.execAsync('ALTER TABLE local_progress_cache ADD COLUMN mastery_score REAL DEFAULT 0;');
      } catch (_) {
        // Column already exists or table freshly created
      }
      this.isInitialized = true;
      this.isUsingMock = false;
    } catch (error) {
      // Fallback for Node.js / Jest unit test environment where native driver is unavailable
      this.isUsingMock = true;
      this.initMockTables();
      this.isInitialized = true;
    }
  }

  private initMockTables(): void {
    const tableNames = [
      'local_themes',
      'local_courses',
      'local_outcomes',
      'local_resources',
      'download_packages',
      'local_exam_packages',
      'local_exam_attempts',
      'local_answer_events',
      'sync_operations',
      'sync_state',
      'local_bookmarks',
      'local_progress_cache',
      'device_profile',
    ];
    for (const name of tableNames) {
      if (!this.mockTables[name]) {
        this.mockTables[name] = [];
      }
    }
  }

  async reset(): Promise<void> {
    if (this.isUsingMock) {
      this.mockTables = {};
      this.initMockTables();
    } else if (this.db) {
      await this.db.execAsync('PRAGMA writable_schema = 1; DELETE FROM sqlite_master WHERE type IN ("table", "index"); PRAGMA writable_schema = 0; VACUUM;');
      await this.db.execAsync(CREATE_13_TABLES_SCHEMA);
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.db && !this.isUsingMock) {
      await this.db.runAsync(sql, params);
      return;
    }

    this.executeMock(sql, params);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.db && !this.isUsingMock) {
      return (await this.db.getAllAsync<T>(sql, params)) || [];
    }

    return this.queryMock<T>(sql, params);
  }

  async transaction<T>(action: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    return this.withTransaction(action);
  }

  async withTransaction<T>(action: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    if (!this.isInitialized) {
      await this.init();
    }

    // Serialize transactions so concurrent callers never collide on BEGIN TRANSACTION
    let releaseQueue: () => void = () => {};
    const previousQueue = this.transactionQueue;
    this.transactionQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    try {
      if (this.db && !this.isUsingMock) {
        // If already in an active transaction, execute directly without nested BEGIN/COMMIT
        const alreadyInTx = typeof this.db.isInTransactionSync === 'function' ? this.db.isInTransactionSync() : false;
        if (alreadyInTx) {
          return await action(this);
        }

        await this.db.execAsync('BEGIN TRANSACTION;');
        try {
          const result = await action(this);
          await this.db.execAsync('COMMIT;');
          return result;
        } catch (error) {
          try {
            await this.db.execAsync('ROLLBACK;');
          } catch (_) {
            // Suppress rollback errors if transaction was already aborted
          }
          throw error;
        }
      }

      // In-Memory Transaction with Snapshot Rollback for Jest / Node environment
      const snapshot = JSON.stringify(this.mockTables);
      try {
        const result = await action(this);
        return result;
      } catch (error) {
        this.mockTables = JSON.parse(snapshot);
        throw error;
      }
    } finally {
      releaseQueue();
    }
  }

  // --- In-Memory SQL Emulator for Jest / Node test environments ---
  private cleanSql(sql: string): string {
    return sql.trim().replace(/;+$/, '').trim();
  }

  private executeMock(sql: string, params: any[] = []): void {
    const trimmed = this.cleanSql(sql);

    // 1. INSERT OR REPLACE INTO / INSERT OR IGNORE INTO / INSERT INTO
    const insertMatch = trimmed.match(
      /INSERT\s+(?:OR\s+REPLACE\s+INTO|OR\s+IGNORE\s+INTO|INTO)\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i
    );
    if (insertMatch) {
      const tableName = insertMatch[1];
      const columns = insertMatch[2].split(',').map((c) => c.trim());
      const table = this.mockTables[tableName] || (this.mockTables[tableName] = []);

      const row: Record<string, any> = {};
      if (params.length > 0) {
        let paramIdx = 0;
        const valTokens = insertMatch[3].split(',').map((v) => v.trim());
        columns.forEach((col, idx) => {
          const valToken = valTokens[idx];
          if (valToken === '?') {
            row[col] = params[paramIdx++];
          } else if (valToken && valToken.toUpperCase() === 'NULL') {
            row[col] = null;
          } else if (valToken && valToken.toLowerCase().includes('datetime')) {
            row[col] = new Date().toISOString();
          } else if (valToken && (valToken.startsWith("'") || valToken.startsWith('"'))) {
            row[col] = valToken.slice(1, -1);
          } else if (valToken && !isNaN(Number(valToken))) {
            row[col] = Number(valToken);
          } else {
            row[col] = params[paramIdx++];
          }
        });
      } else {
        const rawVals = insertMatch[3].split(',').map((v) => {
          const trimmedVal = v.trim();
          if (trimmedVal.toUpperCase() === 'NULL') return null;
          const num = Number(trimmedVal);
          if (!isNaN(num) && !trimmedVal.startsWith("'") && !trimmedVal.startsWith('"')) {
            return num;
          }
          return trimmedVal.replace(/^['"]|['"]$/g, '');
        });
        columns.forEach((col, idx) => {
          row[col] = rawVals[idx];
        });
      }

      // Find primary key column (first column or id)
      const pkCol = columns[0];
      const existingIdx = table.findIndex((r) => r[pkCol] === row[pkCol]);
      if (existingIdx >= 0) {
        if (!trimmed.toUpperCase().includes('OR IGNORE')) {
          table[existingIdx] = { ...table[existingIdx], ...row };
        }
      } else {
        table.push(row);
      }
      return;
    }

    // 2. UPDATE table SET col1 = ?, col2 = 'val', ... WHERE ...
    const updateMatch = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (updateMatch) {
      const tableName = updateMatch[1];
      const setClause = updateMatch[2];
      const whereClause = updateMatch[3];
      const table = this.mockTables[tableName] || [];

      let paramIdx = 0;
      const setPairs = setClause.split(',').map((s) => s.trim());
      const updates: Array<{ col: string; val: any }> = [];

      for (const pair of setPairs) {
        const parts = pair.split('=');
        const col = parts[0].trim();
        const rawVal = parts[1]?.trim() || '';

        if (rawVal === '?') {
          updates.push({ col, val: params[paramIdx++] });
        } else if (rawVal.toUpperCase() === 'NULL') {
          updates.push({ col, val: null });
        } else if (rawVal.toLowerCase().includes('datetime')) {
          updates.push({ col, val: new Date().toISOString() });
        } else if (rawVal.startsWith("'") || rawVal.startsWith('"')) {
          updates.push({ col, val: rawVal.slice(1, -1) });
        } else if (!isNaN(Number(rawVal))) {
          updates.push({ col, val: Number(rawVal) });
        } else {
          updates.push({ col, val: params[paramIdx++] });
        }
      }

      const whereValues = params.slice(paramIdx);

      for (let i = 0; i < table.length; i++) {
        let matches = true;
        if (whereClause) {
          matches = this.evalWhere(table[i], whereClause, whereValues);
        }
        if (matches) {
          updates.forEach(({ col, val }) => {
            table[i][col] = val;
          });
        }
      }
      return;
    }

    // 3. DELETE FROM table WHERE col = ?
    const deleteMatch = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      const whereClause = deleteMatch[2];
      if (!whereClause) {
        this.mockTables[tableName] = [];
        return;
      }

      this.mockTables[tableName] = (this.mockTables[tableName] || []).filter(
        (r) => !this.evalWhere(r, whereClause, params)
      );
      return;
    }
  }

  private queryMock<T = any>(sql: string, params: any[] = []): T[] {
    const trimmed = this.cleanSql(sql);

    // 1. SELECT COUNT(*) FROM table ...
    const countMatch = trimmed.match(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)(?:\s+AS\s+([a-zA-Z0-9_]+))?\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i
    );
    if (countMatch) {
      const alias = countMatch[1] || 'count';
      const tableName = countMatch[2];
      const whereClause = countMatch[3];
      let rows = this.mockTables[tableName] || [];

      if (whereClause) {
        rows = rows.filter((r) => this.evalWhere(r, whereClause, params));
      }

      return [{ [alias]: rows.length }] as any;
    }

    // 2. SELECT MAX(col) AS alias FROM table ...
    const maxMatch = trimmed.match(
      /SELECT\s+MAX\s*\(\s*([a-zA-Z0-9_]+)\s*\)(?:\s+AS\s+([a-zA-Z0-9_]+))?\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i
    );
    if (maxMatch) {
      const col = maxMatch[1];
      const alias = maxMatch[2] || 'max';
      const tableName = maxMatch[3];
      const whereClause = maxMatch[4];
      let rows = this.mockTables[tableName] || [];

      if (whereClause) {
        rows = rows.filter((r) => this.evalWhere(r, whereClause, params));
      }

      let maxVal: number | null = null;
      for (const r of rows) {
        const val = Number(r[col]);
        if (!isNaN(val)) {
          if (maxVal === null || val > maxVal) {
            maxVal = val;
          }
        }
      }

      return [{ [alias]: maxVal }] as any;
    }

    // 2b. SELECT COALESCE(SUM(col), 0) AS alias FROM table ...
    const sumMatch = trimmed.match(
      /SELECT\s+(?:COALESCE\s*\(\s*)?SUM\s*\(\s*([a-zA-Z0-9_.]+)\s*\)(?:\s*,\s*0\s*\))?(?:\s+AS\s+([a-zA-Z0-9_]+))?\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i
    );
    if (sumMatch) {
      const rawCol = sumMatch[1];
      const col = rawCol.includes('.') ? rawCol.split('.').pop()! : rawCol;
      const alias = sumMatch[2] || 'total';
      const tableName = sumMatch[3];
      const whereClause = sumMatch[4];
      let rows = this.mockTables[tableName] || [];

      if (whereClause) {
        rows = rows.filter((r) => this.evalWhere(r, whereClause, params));
      }

      const total = rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
      return [{ [alias]: total }] as any;
    }

    // 3. Standard SELECT ... FROM table WHERE ... ORDER BY ...
    const selectMatch = trimmed.match(
      /SELECT\s+(?:DISTINCT\s+)?(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i
    );
    if (selectMatch) {
      const tableName = selectMatch[2];
      const whereClause = selectMatch[3];
      const orderByClause = selectMatch[4];
      const limitVal = selectMatch[5] ? parseInt(selectMatch[5], 10) : undefined;

      let rows = [...(this.mockTables[tableName] || [])];

      if (whereClause) {
        rows = rows.filter((r) => this.evalWhere(r, whereClause, params));
      }

      if (orderByClause) {
        const parts = orderByClause.split(',')[0].trim().split(/\s+/);
        const col = parts[0];
        const isDesc = parts[1]?.toUpperCase() === 'DESC';
        rows.sort((a, b) => {
          if (a[col] < b[col]) return isDesc ? 1 : -1;
          if (a[col] > b[col]) return isDesc ? -1 : 1;
          return 0;
        });
      }

      if (limitVal !== undefined) {
        rows = rows.slice(0, limitVal);
      }

      return rows as T[];
    }

    return (this.mockTables[trimmed] || []) as T[];
  }

  private evalWhere(row: Record<string, any>, whereClause: string, params: any[]): boolean {
    const cleanWhere = whereClause.trim();

    // 1. Multiple conditions separated by AND
    if (cleanWhere.includes(' AND ') || cleanWhere.includes(' and ')) {
      const parts = cleanWhere.split(/\s+AND\s+/i);
      let paramIdx = 0;
      for (const part of parts) {
        const paramCount = (part.match(/\?/g) || []).length;
        const subParams = params.slice(paramIdx, paramIdx + paramCount);
        paramIdx += paramCount;
        if (!this.evalWhere(row, part, subParams)) {
          return false;
        }
      }
      return true;
    }

    // 2. "col IN (...)"
    const inMatch = cleanWhere.match(/([a-zA-Z0-9_]+)\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const col = inMatch[1];
      const rawValues = inMatch[2]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
      return rawValues.includes(String(row[col]));
    }

    // 3. Single equality "col = ?" or "col = 'val'"
    if (cleanWhere.includes('=?') || cleanWhere.includes('= ?')) {
      const col = cleanWhere.split('=')[0].trim();
      return row[col] === params[0];
    }

    const eqValMatch = cleanWhere.match(/([a-zA-Z0-9_]+)\s*=\s*['"]?([^'"]+)['"]?/);
    if (eqValMatch) {
      const col = eqValMatch[1];
      const val = eqValMatch[2];
      return String(row[col]) === String(val);
    }

    // 4. Inequality "col != ?" or "col != 'val'"
    if (cleanWhere.includes('!=?') || cleanWhere.includes('!= ?')) {
      const col = cleanWhere.split('!=')[0].trim();
      return row[col] !== params[0];
    }

    const neqValMatch = cleanWhere.match(/([a-zA-Z0-9_]+)\s*!=\s*['"]?([^'"]+)['"]?/);
    if (neqValMatch) {
      const col = neqValMatch[1];
      const val = neqValMatch[2];
      return String(row[col]) !== String(val);
    }

    return true;
  }
}

export const database: DatabaseAdapter = new SQLiteDatabaseAdapter();

/**
 * In-memory Drizzle/MySQL harness for the NEXUS security test-suite.
 *
 * The production data-access layer (`server/db.ts`) resolves its Drizzle handle
 * through `getDb()`, which in a test process can be pointed at an injected
 * instance via `__setTestDatabase`. This module builds such an instance with
 * `drizzle-orm/mysql-proxy` and answers the handful of SQL shapes those helpers
 * emit (SELECT ... [inner|left] JOIN ... WHERE ... ORDER BY ... LIMIT,
 * INSERT ... VALUES ..., UPDATE ... SET ... WHERE ...).
 *
 * Scope and honesty notes:
 *  - This is a *fixture* engine, not MySQL. It evaluates the real SQL text that
 *    Drizzle generates against synthetic rows, so the tests exercise the actual
 *    WHERE clauses (owner/assignment scoping) written by `server/db.ts`.
 *  - It supports only the SQL shapes listed above. Any statement it cannot parse
 *    throws, so a future query added to `db.ts` fails loudly instead of silently
 *    returning empty results.
 *  - Column defaults are supplied by the caller (`defaults`) to mirror the
 *    Drizzle schema defaults for the tables under test.
 */
import { drizzle } from "drizzle-orm/mysql-proxy";

export type FixtureRow = Record<string, unknown>;
export type FixtureTables = Record<string, FixtureRow[]>;

export type InMemoryDatabaseOptions = {
  /** Column defaults applied to INSERTed rows, per table (mirrors drizzle/schema.ts). */
  defaults?: Record<string, FixtureRow>;
  /** Unique key columns per table, used for `on duplicate key update`. */
  uniqueKeys?: Record<string, string[]>;
};

export type QueryLogEntry = { method: string; sql: string; params: unknown[] };

/** Marker for the literal `default` keyword Drizzle emits for schema-defaulted columns. */
const DEFAULT_VALUE = Symbol("drizzle-default");

type ColumnRef = { table?: string; column: string };

type WhereNode =
  | { t: "and" | "or"; l: WhereNode; r: WhereNode }
  | { t: "cmp"; op: "=" | "!=" | "<>" | "<" | ">" | "<=" | ">="; col: ColumnRef; value: unknown }
  | { t: "in"; col: ColumnRef; values: unknown[]; negate: boolean }
  | { t: "null"; col: ColumnRef; negate: boolean }
  | { t: "true" | "false" };

const TOKEN_RE = /\s*(`?[A-Za-z_][A-Za-z0-9_]*`?(?:\s*\.\s*`?[A-Za-z_][A-Za-z0-9_]*`?)?|<=|>=|<>|!=|=|<|>|\?|\(|\)|,)/g;

function stripBackticks(sql: string): string {
  return sql.replace(/`/g, "").replace(/\s+/g, " ").trim();
}

/** Splits a comma separated list at paren depth 0. */
export function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseColumnRef(raw: string, fallbackTable?: string): ColumnRef {
  const cleaned = raw.replace(/\s+/g, "");
  const dotted = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(cleaned);
  if (dotted) return { table: dotted[1], column: dotted[2] };
  return { table: fallbackTable, column: cleaned };
}

class WhereParser {
  private tokens: string[] = [];
  private index = 0;
  private paramIndex: number;

  constructor(private sql: string, private params: unknown[], paramIndex = 0) {
    this.tokens = this.tokenize(sql);
    this.paramIndex = paramIndex;
  }

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let cursor = 0;
    TOKEN_RE.lastIndex = 0;
    while (cursor < input.length) {
      TOKEN_RE.lastIndex = cursor;
      const match = TOKEN_RE.exec(input);
      if (!match) throw new Error(`In-memory DB cannot tokenize: ${input.slice(cursor)}`);
      tokens.push(match[1].replace(/\s+/g, ""));
      cursor = TOKEN_RE.lastIndex;
    }
    return tokens;
  }

  get consumedParams(): number {
    return this.paramIndex;
  }

  private peek(): string | undefined {
    return this.tokens[this.index];
  }

  private next(): string {
    const token = this.tokens[this.index];
    if (token === undefined) throw new Error("Unexpected end of WHERE clause");
    this.index += 1;
    return token;
  }

  parse(): WhereNode {
    const node = this.parseOr();
    if (this.index !== this.tokens.length) {
      throw new Error(`Unparsed WHERE tokens: ${this.tokens.slice(this.index).join(" ")}`);
    }
    return node;
  }

  private parseOr(): WhereNode {
    let left = this.parseAnd();
    while (this.peek()?.toLowerCase() === "or") {
      this.next();
      const right = this.parseAnd();
      left = { t: "or", l: left, r: right };
    }
    return left;
  }

  private parseAnd(): WhereNode {
    let left = this.parsePrimary();
    while (this.peek()?.toLowerCase() === "and") {
      this.next();
      const right = this.parsePrimary();
      left = { t: "and", l: left, r: right };
    }
    return left;
  }

  private parsePrimary(): WhereNode {
    const token = this.peek();
    if (token === "(") {
      this.next();
      const node = this.parseOr();
      const closing = this.next();
      if (closing !== ")") throw new Error(`Expected ) but found ${closing}`);
      return node;
    }
    const word = token?.toLowerCase();
    if (word === "true") {
      this.next();
      return { t: "true" };
    }
    if (word === "false") {
      this.next();
      return { t: "false" };
    }

    const left = this.next();
    const operator = this.next();
    const lowered = operator.toLowerCase();

    if (lowered === "is") {
      const notToken = this.peek()?.toLowerCase();
      const negate = notToken === "not";
      if (negate) this.next();
      const nullToken = this.next().toLowerCase();
      if (nullToken !== "null") throw new Error(`Unsupported IS predicate: ${operator} ${nullToken}`);
      return { t: "null", col: parseColumnRef(left), negate };
    }

    if (lowered === "in" || lowered === "not") {
      const negate = lowered === "not";
      if (negate) {
        const inToken = this.next().toLowerCase();
        if (inToken !== "in") throw new Error(`Unsupported NOT predicate: ${inToken}`);
      }
      if (this.next() !== "(") throw new Error("Expected ( after IN");
      const values: unknown[] = [];
      let token = this.next();
      if (token === ")") return { t: "in", col: parseColumnRef(left), values, negate };
      for (;;) {
        if (token !== "?") throw new Error(`IN list must contain placeholders, found ${token}`);
        values.push(this.params[this.paramIndex++]);
        const separator = this.next();
        if (separator === ")") break;
        if (separator !== ",") throw new Error(`Expected , or ) in IN list, found ${separator}`);
        token = this.next();
      }
      return { t: "in", col: parseColumnRef(left), values, negate };
    }

    if (!["=", "!=", "<>", "<", ">", "<=", ">="].includes(lowered)) {
      throw new Error(`Unsupported operator: ${operator}`);
    }
    const valueToken = this.next();
    if (valueToken !== "?") throw new Error(`Only placeholder comparisons are supported, found ${valueToken}`);
    const value = this.params[this.paramIndex++];
    return { t: "cmp", op: lowered as "=", col: parseColumnRef(left), value };
  }
}

function columnValue(row: Record<string, unknown>, ref: ColumnRef): unknown {
  const qualified = ref.table ? `${ref.table}.${ref.column}` : undefined;
  if (qualified && qualified in row) return row[qualified];
  if (ref.column in row) return row[ref.column];
  throw new Error(`Unknown column in fixture row: ${ref.table ?? ""}.${ref.column}`);
}

function evaluate(node: WhereNode, row: Record<string, unknown>): boolean {
  switch (node.t) {
    case "true":
      return true;
    case "false":
      return false;
    case "and":
      return evaluate(node.l, row) && evaluate(node.r, row);
    case "or":
      return evaluate(node.l, row) || evaluate(node.r, row);
    case "null": {
      const value = columnValue(row, node.col);
      const isNull = value === null || value === undefined;
      return node.negate ? !isNull : isNull;
    }
    case "in": {
      const value = columnValue(row, node.col);
      const found = node.values.some((candidate) => candidate === value);
      return node.negate ? !found : found;
    }
    case "cmp": {
      const value = columnValue(row, node.col);
      switch (node.op) {
        case "=":
          return value === node.value;
        case "!=":
        case "<>":
          return value !== node.value;
        case "<":
          return (value as number) < (node.value as number);
        case ">":
          return (value as number) > (node.value as number);
        case "<=":
          return (value as number) <= (node.value as number);
        case ">=":
          return (value as number) >= (node.value as number);
      }
    }
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a) < String(b) ? -1 : 1;
}

export function createInMemoryDatabase(seed: FixtureTables, options: InMemoryDatabaseOptions = {}) {
  const defaults = options.defaults ?? {};
  const uniqueKeys = options.uniqueKeys ?? {};
  const tables: Record<string, FixtureRow[]> = {};
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = rows.map((row) => ({ ...row }));
  }
  const queryLog: QueryLogEntry[] = [];
  let syntheticId = 1000;

  const autoIncrement: Record<string, number> = {};
  for (const [name, rows] of Object.entries(tables)) {
    const maxId = rows.reduce((max, row) => (typeof row.id === "number" && row.id > max ? row.id : max), 0);
    autoIncrement[name] = maxId + 1;
  }

  function rowsOf(table: string): FixtureRow[] {
    if (!tables[table]) tables[table] = [];
    return tables[table];
  }

  function insertRow(table: string, columns: string[], values: Array<unknown | typeof DEFAULT_VALUE>): number {
    const row: FixtureRow = { ...(defaults[table] ?? {}) };
    columns.forEach((column, index) => {
      const value = values[index];
      // Drizzle emits the literal `default` for columns backed by a schema
      // default (autoincrement id, defaultNow() timestamps, enum defaults).
      // Those keep the fixture default / stay undefined, mirroring MySQL.
      if (value !== DEFAULT_VALUE) row[column] = value;
    });
    const unique = uniqueKeys[table] ?? [];
    const duplicate = unique.length
      ? rowsOf(table).find((existing) => unique.every((key) => existing[key] === row[key]))
      : undefined;
    if (duplicate) return duplicate.id as number;
    if (row.id === undefined) row.id = autoIncrement[table] ?? (autoIncrement[table] = 1);
    const id = row.id as number;
    if (typeof id === "number" && id >= autoIncrement[table]) autoIncrement[table] = id + 1;
    rowsOf(table).push(row);
    return id;
  }

  const db = drizzle(async (rawSql, params: unknown[], method) => {
    const sql = stripBackticks(rawSql);
    queryLog.push({ method, sql, params: [...params] });

    const insertMatch = /^insert into ([A-Za-z_][A-Za-z0-9_]*) \(([^)]*)\) values \(([^)]*)\)([\s\S]*)$/i.exec(sql);
    if (insertMatch) {
      const [, table, columnList, valueList, tail] = insertMatch;
      const columns = splitTopLevel(columnList);
      const valueSlots = splitTopLevel(valueList);
      if (valueSlots.some((slot) => slot !== "?" && slot.toLowerCase() !== "default")) {
        throw new Error(`In-memory DB supports only placeholder INSERT values: ${sql}`);
      }
      const placeholderCount = valueSlots.filter((slot) => slot === "?").length;
      let valueCursor = 0;
      const insertValues: Array<unknown | typeof DEFAULT_VALUE> = valueSlots.map((slot) =>
        slot === "?" ? params[valueCursor++] : DEFAULT_VALUE,
      );
      const insertId = insertRow(table, columns, insertValues);
      const duplicateTail = /on duplicate key update ([\s\S]*)$/i.exec(tail.trim());
      if (duplicateTail) {
        const assignments = splitTopLevel(duplicateTail[1]).map((assignment) => {
          const match = /^([A-Za-z_][A-Za-z0-9_]*) = \?$/i.exec(assignment.trim());
          if (!match) throw new Error(`Unsupported ON DUPLICATE KEY assignment: ${assignment}`);
          return match[1];
        });
        const values = params.slice(placeholderCount, placeholderCount + assignments.length);
        const unique = uniqueKeys[table] ?? [];
        const target = rowsOf(table).find((row) => row.id === insertId && unique.some((key) => key in row));
        if (target) {
          assignments.forEach((column, index) => {
            target[column] = values[index];
          });
        }
      }
      return { rows: [{ insertId, affectedRows: 1 }] };
    }

    const updateMatch = /^update ([A-Za-z_][A-Za-z0-9_]*) set ([\s\S]*?)(?: where ([\s\S]*))?$/i.exec(sql);
    if (updateMatch) {
      const [, table, setClause, whereClause] = updateMatch;
      const columns = splitTopLevel(setClause).map((assignment) => {
        const match = /^([A-Za-z_][A-Za-z0-9_]*) = \?$/i.exec(assignment.trim());
        if (!match) throw new Error(`Unsupported UPDATE assignment: ${assignment}`);
        return match[1];
      });
      let paramIndex = 0;
      const values = columns.map(() => params[paramIndex++]);
      const predicate = whereClause ? new WhereParser(whereClause, params, paramIndex).parse() : ({ t: "true" } as WhereNode);
      let affectedRows = 0;
      for (const row of rowsOf(table)) {
        if (!evaluate(predicate, row)) continue;
        columns.forEach((column, index) => {
          row[column] = values[index];
        });
        // Mirror MySQL's `onUpdateNow()` behaviour for the audit-relevant tables.
        if ("updatedAt" in row) row.updatedAt = new Date();
        affectedRows += 1;
      }
      return { rows: [{ insertId: 0, affectedRows }] };
    }

    const selectMatch = /^select ([\s\S]*?) from ([\s\S]*)$/i.exec(sql);
    if (selectMatch) {
      const [, selectList, rest] = selectMatch;
      let remainder = rest;
      const fromMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(remainder);
      if (!fromMatch) throw new Error(`Unsupported SELECT FROM: ${sql}`);
      const baseTable = fromMatch[1];
      remainder = remainder.slice(fromMatch[0].length);

      type JoinSpec = { type: "inner" | "left"; table: string; leftColumn: string; rightColumn: string };
      const joins: JoinSpec[] = [];
      for (;;) {
        const joinMatch = /^ (inner|left) join ([A-Za-z_][A-Za-z0-9_]*) on ([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*) = ([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/i.exec(remainder);
        if (!joinMatch) break;
        joins.push({
          type: joinMatch[1].toLowerCase() as "inner" | "left",
          table: joinMatch[2],
          leftColumn: `${joinMatch[3]}.${joinMatch[4]}`,
          rightColumn: `${joinMatch[5]}.${joinMatch[6]}`,
        });
        remainder = remainder.slice(joinMatch[0].length);
      }

      let orderBy: { ref: ColumnRef; direction: "asc" | "desc" }[] = [];

      // Peel trailing LIMIT / ORDER BY clauses first, then parse the WHERE clause
      // (placeholder values are consumed in SQL text order).
      let limitSlot: string | undefined;
      const limitMatch = / limit (\?|\d+)$/i.exec(remainder);
      if (limitMatch) {
        limitSlot = limitMatch[1];
        remainder = remainder.slice(0, limitMatch.index);
      }
      const orderMatch = / order by (.*)$/i.exec(remainder);
      if (orderMatch) {
        orderBy = splitTopLevel(orderMatch[1]).map((item) => {
          const desc = / desc$/i.test(item);
          const ref = parseColumnRef(item.replace(/ (asc|desc)$/i, ""), baseTable);
          return { ref, direction: desc ? "desc" : "asc" };
        });
        remainder = remainder.slice(0, orderMatch.index);
      }
      const whereMatch = /^ where (.*)$/i.exec(remainder);
      if (!whereMatch && remainder.trim()) {
        throw new Error(`Unsupported SELECT tail: ${remainder}`);
      }
      const whereClause = whereMatch ? whereMatch[1].trim() : undefined;
      const predicate = whereClause ? new WhereParser(whereClause, params).parse() : ({ t: "true" } as WhereNode);
      const limit =
        limitSlot === undefined
          ? undefined
          : limitSlot === "?"
            ? (params[(whereClause?.match(/\?/g) ?? []).length] as number)
            : Number(limitSlot);

      // Materialise joins: each joined row is a flat map keyed by "table.column".
      let joined: Record<string, unknown>[] = rowsOf(baseTable).map((row) => {
        const flat: Record<string, unknown> = {};
        for (const [column, value] of Object.entries(row)) {
          flat[`${baseTable}.${column}`] = value;
          flat[column] = value;
        }
        return flat;
      });
      for (const join of joins) {
        const next: Record<string, unknown>[] = [];
        for (const flat of joined) {
          const matches = rowsOf(join.table).filter((candidate) => candidate[join.rightColumn.split(".")[1]] === flat[join.leftColumn]);
          if (!matches.length) {
            if (join.type === "left") {
              const nulls: Record<string, unknown> = { ...flat };
              for (const [column] of Object.entries(rowsOf(join.table)[0] ?? { id: null })) {
                nulls[`${join.table}.${column}`] = null;
              }
              next.push(nulls);
            }
            continue;
          }
          for (const candidate of matches) {
            const combined: Record<string, unknown> = { ...flat };
            for (const [column, value] of Object.entries(candidate)) {
              combined[`${join.table}.${column}`] = value;
            }
            next.push(combined);
          }
        }
        joined = next;
      }

      const filtered = joined.filter((row) => evaluate(predicate, row));
      if (orderBy.length) {
        filtered.sort((a, b) => {
          for (const key of orderBy) {
            const direction = key.direction === "desc" ? -1 : 1;
            const comparison = compareValues(columnValue(a, key.ref), columnValue(b, key.ref));
            if (comparison !== 0) return comparison * direction;
          }
          return 0;
        });
      }
      const limited = limit === undefined ? filtered : filtered.slice(0, limit);

      const selected = splitTopLevel(selectList).map((item) => parseColumnRef(item.replace(/ as .*$/i, ""), baseTable));
      const rows = limited.map((row) => selected.map((ref) => columnValue(row, ref)));
      return { rows };
    }

    throw new Error(`In-memory DB cannot execute: ${sql}`);
  });

  return { db, queryLog, tables, nextSyntheticId: () => (syntheticId += 1) };
}

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CellValue, Workbook, Worksheet } from 'exceljs';
import ExcelJS from 'exceljs';
import { z } from 'zod';

type JsonCell = string | number | boolean | null;
type JsonRow = JsonCell[];

export interface WorkbookInfo {
  filePath: string;
  sheetCount: number;
  sheets: Array<{
    index: number;
    name: string;
    rowCount: number;
    columnCount: number;
    actualRowCount: number;
    actualColumnCount: number;
  }>;
}

export interface ReadSheetOptions {
  sheetName?: string;
  sheetIndex?: number;
  startRow?: number;
  startCol?: number;
  maxRows?: number;
  maxCols?: number;
  includeEmptyRows?: boolean;
}

export interface ReadSheetResult {
  filePath: string;
  sheetName: string;
  sheetIndex: number;
  startRow: number;
  startCol: number;
  rowCount: number;
  columnCount: number;
  rows: JsonRow[];
}

export interface WriteSheetOptions {
  mode?: 'overwrite' | 'append';
}

export interface WriteSheetResult {
  filePath: string;
  sheetName: string;
  mode: 'overwrite' | 'append';
  rowsWritten: number;
  sheetCount: number;
}

const DEFAULT_READ_ROWS = 100;
const DEFAULT_READ_COLS = 50;
const MAX_READ_ROWS = 5000;
const MAX_READ_COLS = 200;
const INVALID_SHEET_NAME = /[\\/?*:[\]]/;

export function registerExcelTools(server: McpServer): void {
  server.tool(
    'excel_workbook_info',
    'Load an .xlsx workbook and list sheet names, indexes, and dimensions.',
    {
      file_path: z.string().min(1).describe('Path to a .xlsx workbook'),
    },
    async ({ file_path }) => {
      try {
        return toolResult(JSON.stringify(await getWorkbookInfo(file_path), null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'excel_read_sheet',
    'Read a sheet from an .xlsx workbook and return rows as JSON arrays.',
    {
      file_path: z.string().min(1).describe('Path to a .xlsx workbook'),
      sheet_name: z.string().optional().describe('Sheet name. Defaults to the first sheet.'),
      sheet_index: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('1-based sheet index. Used only when sheet_name is omitted.'),
      start_row: z.number().int().min(1).optional().describe('1-based start row. Default 1.'),
      start_col: z.number().int().min(1).optional().describe('1-based start column. Default 1.'),
      max_rows: z
        .number()
        .int()
        .min(1)
        .max(MAX_READ_ROWS)
        .optional()
        .describe(`Maximum rows to return. Default ${DEFAULT_READ_ROWS}.`),
      max_cols: z
        .number()
        .int()
        .min(1)
        .max(MAX_READ_COLS)
        .optional()
        .describe(`Maximum columns to return. Default ${DEFAULT_READ_COLS}.`),
      include_empty_rows: z.boolean().optional().describe('Include empty rows in the output.'),
    },
    async ({
      file_path,
      sheet_name,
      sheet_index,
      start_row,
      start_col,
      max_rows,
      max_cols,
      include_empty_rows,
    }) => {
      try {
        const result = await readSheetRows(file_path, {
          sheetName: sheet_name,
          sheetIndex: sheet_index,
          startRow: start_row,
          startCol: start_col,
          maxRows: max_rows,
          maxCols: max_cols,
          includeEmptyRows: include_empty_rows,
        });
        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'excel_write_sheet',
    'Write JSON array rows to a sheet in an .xlsx workbook, preserving other sheets.',
    {
      file_path: z.string().min(1).describe('Path to write. Existing workbooks are updated.'),
      sheet_name: z.string().min(1).describe('Sheet name to create, overwrite, or append to.'),
      rows_json: z
        .string()
        .min(2)
        .describe('JSON array of row arrays, e.g. [["name","amount"],["Ada",42]].'),
      mode: z
        .enum(['overwrite', 'append'])
        .optional()
        .describe('overwrite replaces the target sheet; append adds rows. Default overwrite.'),
    },
    async ({ file_path, sheet_name, rows_json, mode }) => {
      try {
        const rows = parseRowsJson(rows_json);
        const result = await writeSheetRows(file_path, sheet_name, rows, { mode });
        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}

export async function getWorkbookInfo(filePath: string): Promise<WorkbookInfo> {
  const workbook = await loadWorkbook(filePath);
  return {
    filePath,
    sheetCount: workbook.worksheets.length,
    sheets: workbook.worksheets.map((sheet, index) => ({
      index: index + 1,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      actualRowCount: sheet.actualRowCount,
      actualColumnCount: sheet.actualColumnCount,
    })),
  };
}

export async function readSheetRows(
  filePath: string,
  options: ReadSheetOptions = {},
): Promise<ReadSheetResult> {
  const workbook = await loadWorkbook(filePath);
  const sheet = selectWorksheet(workbook, options.sheetName, options.sheetIndex);
  const startRow = options.startRow ?? 1;
  const startCol = options.startCol ?? 1;
  const maxRows = options.maxRows ?? DEFAULT_READ_ROWS;
  const maxCols = options.maxCols ?? DEFAULT_READ_COLS;
  const endRow = Math.min(sheet.rowCount, startRow + maxRows - 1);
  const endCol = Math.min(Math.max(sheet.columnCount, startCol), startCol + maxCols - 1);
  const rows: JsonRow[] = [];

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
    const sheetRow = sheet.getRow(rowNumber);
    const cells: JsonRow = [];
    let hasValue = false;
    for (let colNumber = startCol; colNumber <= endCol; colNumber++) {
      const value = normalizeCellValue(sheetRow.getCell(colNumber).value);
      if (value !== null && value !== '') hasValue = true;
      cells.push(value);
    }
    if (hasValue || options.includeEmptyRows) rows.push(cells);
  }

  return {
    filePath,
    sheetName: sheet.name,
    sheetIndex: workbook.worksheets.indexOf(sheet) + 1,
    startRow,
    startCol,
    rowCount: rows.length,
    columnCount: endCol >= startCol ? endCol - startCol + 1 : 0,
    rows,
  };
}

export async function writeSheetRows(
  filePath: string,
  sheetName: string,
  rows: JsonRow[],
  options: WriteSheetOptions = {},
): Promise<WriteSheetResult> {
  const validatedSheetName = validateSheetName(sheetName);
  const mode = options.mode ?? 'overwrite';
  const workbook = new ExcelJS.Workbook();

  if (existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
  }

  let sheet = workbook.getWorksheet(validatedSheetName);
  if (sheet && mode === 'overwrite') {
    workbook.removeWorksheet(sheet.id);
    sheet = undefined;
  }
  if (!sheet) {
    sheet = workbook.addWorksheet(validatedSheetName);
  }

  sheet.addRows(rows);
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await workbook.xlsx.writeFile(filePath);

  return {
    filePath,
    sheetName: sheet.name,
    mode,
    rowsWritten: rows.length,
    sheetCount: workbook.worksheets.length,
  };
}

export function parseRowsJson(rowsJson: string): JsonRow[] {
  const parsed: unknown = JSON.parse(rowsJson);
  if (!Array.isArray(parsed)) {
    throw new Error('rows_json must be a JSON array of row arrays');
  }
  return parsed.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      throw new Error(`rows_json row ${rowIndex + 1} must be an array`);
    }
    return row.map((cell, colIndex) => {
      if (cell === null || ['string', 'number', 'boolean'].includes(typeof cell)) {
        return cell as JsonCell;
      }
      throw new Error(
        `rows_json cell ${rowIndex + 1}:${colIndex + 1} must be string, number, boolean, or null`,
      );
    });
  });
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  if (!existsSync(filePath)) {
    throw new Error(`Workbook not found: ${filePath}`);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

function selectWorksheet(
  workbook: Workbook,
  sheetName: string | undefined,
  sheetIndex: number | undefined,
): Worksheet {
  const sheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets[(sheetIndex ?? 1) - 1];
  if (!sheet) {
    const requested = sheetName ? `name "${sheetName}"` : `index ${sheetIndex ?? 1}`;
    throw new Error(`Worksheet not found by ${requested}`);
  }
  return sheet;
}

function validateSheetName(sheetName: string): string {
  const trimmed = sheetName.trim();
  if (!trimmed) throw new Error('sheet_name must not be blank');
  if (trimmed.length > 31) throw new Error('sheet_name must be 31 characters or fewer');
  if (INVALID_SHEET_NAME.test(trimmed)) {
    throw new Error('sheet_name must not contain any of: \\ / ? * : [ ]');
  }
  return trimmed;
}

function normalizeCellValue(value: CellValue): JsonCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if ('result' in value && value.result !== undefined) {
    return normalizeCellValue(value.result);
  }
  if ('text' in value && typeof value.text === 'string') {
    return value.text;
  }
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('');
  }
  return JSON.stringify(value);
}

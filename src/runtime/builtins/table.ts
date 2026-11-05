export interface TableCell {
  text: string;
  bgcolor: string;
  text_color: string;
  text_size: string;
  text_halign: string;
  text_valign: string;
  tooltip: string;
  colspan: number;
  rowspan: number;
  width: number | string;
  height: number | string;
  text_font_family: string;
  text_formatting: string;
}

export interface TableObject {
  id: number;
  position: string;
  columns: number;
  rows: number;
  bgcolor: string;
  border_color: string;
  border_width: number;
  frame_color: string;
  frame_width: number;
  cells: (TableCell | null)[][];
  _deleted: boolean;
}

export function createTableModule() {
  let nextId = 0;
  const tables: TableObject[] = [];

  function getCell(table: TableObject, col: number, row: number): TableCell | null {
    if (row >= 0 && row < table.rows && col >= 0 && col < table.columns) {
      return table.cells[row][col];
    }
    return null;
  }

  function ensureCell(table: TableObject, col: number, row: number): TableCell {
    if (!table || typeof table !== 'object' || !Array.isArray(table.cells) ||
        !Number.isFinite(col) || !Number.isFinite(row) || !table.cells[row]) {
      // `table.cell` on an `na` handle is a no-op in Pine.
      return {
        text: '', bgcolor: '', text_color: '#000000', text_size: 'auto',
        text_halign: 'center', text_valign: 'center', tooltip: '',
        colspan: 1, rowspan: 1, width: 0, height: 0,
        text_font_family: '', text_formatting: '',
      };
    }
    if (row < 0 || row >= table.rows || col < 0 || col >= table.columns) {
      throw new Error(`Cell (${col}, ${row}) is out of bounds for table with ${table.columns} columns and ${table.rows} rows`);
    }
    let cell = table.cells[row][col];
    if (!cell) {
      cell = {
        text: '',
        bgcolor: '',
        text_color: '#000000',
        text_size: 'auto',
        text_halign: 'center',
        text_valign: 'center',
        tooltip: '',
        colspan: 1,
        rowspan: 1,
        width: 0,
        height: 0,
        text_font_family: 'default',
        text_formatting: '',
      };
      table.cells[row][col] = cell;
    }
    return cell;
  }

  function createEmptyCells(columns: number, rows: number): (TableCell | null)[][] {
    const cells: (TableCell | null)[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: (TableCell | null)[] = [];
      for (let c = 0; c < columns; c++) {
        row.push(null);
      }
      cells.push(row);
    }
    return cells;
  }

  return {
    new(
      position: string,
      columns: number,
      rows: number,
      opts?: {
        bgcolor?: string;
        border_color?: string;
        border_width?: number;
        frame_color?: string;
        frame_width?: number;
      }
    ): TableObject {
      const table: TableObject = {
        id: nextId++,
        position,
        columns,
        rows,
        bgcolor: opts?.bgcolor ?? '',
        border_color: opts?.border_color ?? '#000000',
        border_width: opts?.border_width ?? 0,
        frame_color: opts?.frame_color ?? '#000000',
        frame_width: opts?.frame_width ?? 0,
        cells: createEmptyCells(columns, rows),
        _deleted: false,
      };
      tables.push(table);
      return table;
    },

    cell(
      table: TableObject,
      column: number,
      row: number,
      text?: string,
      opts?: {
        bgcolor?: string;
        text_color?: string;
        text_size?: string;
        text_halign?: string;
        text_valign?: string;
        tooltip?: string;
        colspan?: number;
        rowspan?: number;
        width?: number | string;
        height?: number | string;
        text_font_family?: string;
        text_formatting?: string;
      }
    ): void {
      const cell = ensureCell(table, column, row);
      if (text !== undefined) {
        cell.text = text;
      }
      if (opts?.bgcolor !== undefined) cell.bgcolor = opts.bgcolor;
      if (opts?.text_color !== undefined) cell.text_color = opts.text_color;
      if (opts?.text_size !== undefined) cell.text_size = opts.text_size;
      if (opts?.text_halign !== undefined) cell.text_halign = opts.text_halign;
      if (opts?.text_valign !== undefined) cell.text_valign = opts.text_valign;
      if (opts?.tooltip !== undefined) cell.tooltip = opts.tooltip;
      if (opts?.colspan !== undefined) cell.colspan = opts.colspan;
      if (opts?.rowspan !== undefined) cell.rowspan = opts.rowspan;
      if (opts?.width !== undefined) cell.width = opts.width;
      if (opts?.height !== undefined) cell.height = opts.height;
      if (opts?.text_font_family !== undefined) cell.text_font_family = opts.text_font_family;
      if (opts?.text_formatting !== undefined) cell.text_formatting = opts.text_formatting;
    },

    merge_cells(
      table: TableObject,
      startCol: number,
      startRow: number,
      endCol: number,
      endRow: number
    ): void {
      const cell = ensureCell(table, startCol, startRow);
      cell.colspan = endCol - startCol + 1;
      cell.rowspan = endRow - startRow + 1;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (r === startRow && c === startCol) continue;
          table.cells[r][c] = null;
        }
      }
    },

    delete(table: TableObject): void {
      if (!table || typeof table !== 'object') return;
      table._deleted = true;
    },

    clear(
      table: TableObject,
      startCol: number,
      startRow: number,
      endCol: number,
      endRow: number
    ): void {
      if (!table || typeof table !== 'object' || !Array.isArray(table.cells)) return;
      for (let r = startRow; r <= endRow && r < table.rows; r++) {
        for (let c = startCol; c <= endCol && c < table.columns; c++) {
          table.cells[r][c] = null;
        }
      }
    },

    set_bgcolor(table: TableObject, val: string): void {
      if (!table || typeof table !== 'object') return;
      table.bgcolor = val;
    },

    set_border_color(table: TableObject, val: string): void {
      if (!table || typeof table !== 'object') return;
      table.border_color = val;
    },

    set_border_width(table: TableObject, val: number): void {
      if (!table || typeof table !== 'object') return;
      table.border_width = val;
    },

    set_frame_color(table: TableObject, val: string): void {
      table.frame_color = val;
    },

    set_frame_width(table: TableObject, val: number): void {
      table.frame_width = val;
    },

    set_position(table: TableObject, val: string): void {
      table.position = val;
    },

    cell_set_text(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.text = val;
    },

    cell_set_bgcolor(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.bgcolor = val;
    },

    cell_set_text_color(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.text_color = val;
    },

    cell_set_text_size(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.text_size = val;
    },

    cell_set_text_halign(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.text_halign = val;
    },

    cell_set_text_valign(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.text_valign = val;
    },

    cell_set_tooltip(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.tooltip = val;
    },

    cell_set_width(table: TableObject, col: number, row: number, val: number | string): void {
      const cell = ensureCell(table, col, row);
      cell.width = val;
    },

    cell_set_height(table: TableObject, col: number, row: number, val: number | string): void {
      const cell = ensureCell(table, col, row);
      cell.height = val;
    },

    cell_set_text_font_family(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.text_font_family = val;
    },

    cell_set_text_formatting(table: TableObject, col: number, row: number, val: string): void {
      const cell = ensureCell(table, col, row);
      cell.text_formatting = val;
    },

    get all(): TableObject[] {
      return tables.filter((t) => !t._deleted);
    },
  };
}

import { CellComponent } from 'tabulator-tables'
import { AppEvent } from '@/common/AppEvent'
import { isJsonDataType, normalizeDataType } from '@/common/utils'

/** JSON gets validation and format/minify; text is edited as-is. */
export type CellEditorMode = 'json' | 'text'

/** Columns too big for the inline editor. Everything else edits in place. */
const TEXT_TYPES = ['text', 'tsvector']

/**
 * The drawer mode for a column, or null if it should edit inline.
 *
 * Array columns are edited as JSON: their values arrive as real arrays and
 * render as one long `["...","..."]` line, which the inline editor can't show.
 * Postgres names them with a leading underscore (`_date` is `date[]`), and
 * callers that know the column is an array can say so explicitly.
 */
export function drawerModeFor(
  dataType?: string,
  options: { array?: boolean } = {}
): CellEditorMode | null {
  if (!dataType) return null
  if (isJsonDataType(dataType)) return 'json'
  if (options.array || dataType.startsWith('_')) return 'json'
  return TEXT_TYPES.includes(normalizeDataType(dataType)) ? 'text' : null
}

export interface CellEditorDrawerPayload {
  cell: CellComponent
  columnName: string
  dataType?: string
  value: unknown
  readOnly: boolean
  mode: CellEditorMode
  /** Array columns take a parsed value back, not a string. */
  array?: boolean
}

/**
 * Opens the cell editor drawer in the secondary sidebar. Shared by the table
 * view and the query results grid.
 */
export const CellEditorDrawerMixin = {
  methods: {
    drawerModeFor,
    openCellEditorDrawer(
      cell: CellComponent,
      options: { dataType?: string; readOnly: boolean; mode: CellEditorMode; array?: boolean }
    ) {
      this.trigger(AppEvent.toggleSecondarySidebar, true)
      this.trigger(AppEvent.selectSecondarySidebarTab, 'cell-editor')
      this.trigger(AppEvent.openCellEditorDrawer, {
        cell,
        columnName: cell.getField(),
        dataType: options.dataType,
        value: cell.getValue(),
        readOnly: options.readOnly,
        mode: options.mode,
        array: options.array,
      } as CellEditorDrawerPayload)
    },
  },
}

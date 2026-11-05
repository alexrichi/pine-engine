import { DiagnosticReporter } from '../diagnostics/diagnostic';
import { ScriptMetadata, InputDef, PlotDef } from '../index';
import { FunctionMapper, COLOR_CONSTANTS } from './function-mapper';
import {
  Program, Statement, Expression,
  VariableDeclaration, FunctionDeclaration,
  TypeDeclaration, MethodDeclaration,
  IfStatement, ForStatement, ForInStatement, WhileStatement,
  SwitchStatement, ReturnStatement,
  ExpressionStatement, AssignmentStatement,
  BinaryExpression, UnaryExpression, ConditionalExpression,
  CallExpression, MemberExpression, IndexExpression,
  IdentifierExpression, LiteralExpression, ArrayLiteralExpression,
  GroupExpression, TupleExpression, LambdaExpression,
  IfExpression, SwitchExpression,
  BlockExpression,
  CallArgument,
  FunctionParam,
} from '../ast/nodes';

export interface GenerateResult {
  code: string;
  metadata: ScriptMetadata;
}

// Pine identifiers may be JavaScript reserved words (`new` is a common variable
// name in Library scripts). Rename only those; everything else stays verbatim.
const JS_RESERVED = new Set([
  'arguments', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'enum', 'eval', 'export',
  'extends', 'false', 'finally', 'for', 'function', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package',
  'private', 'protected', 'public', 'return', 'static', 'super', 'switch',
  'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield',
]);

function safeIdent(name: string): string {
  return JS_RESERVED.has(name) ? `__pine_${name}` : name;
}

// Pine keeps functions in a namespace separate from variables, so a local
// `var rbf = rbf(...)` must not shadow the function `rbf`. Generated user
// functions therefore live under their own prefix.
function fnName(name: string): string {
  return `__fn_${safeIdent(name)}`;
}

// UDT constructors live in their own namespace for the same reason as functions.
function udtName(name: string): string {
  return `__udt_${safeIdent(name)}`;
}

const ARRAY_METHOD_RUNTIME: Record<string, string> = {
  binary_search: 'binarySearch',
  binary_search_leftmost: 'binarySearchLeftmost',
  binary_search_rightmost: 'binarySearchRightmost',
  percentile_linear_interpolation: 'percentileLinearInterpolation',
  percentile_nearest_rank: 'percentileNearestRank',
  sort_indices: 'sortIndices',
};

const MATRIX_METHOD_RUNTIME: Record<string, string> = {
  add_row: 'addRow',
  add_col: 'addCol',
  remove_row: 'removeRow',
  remove_col: 'removeCol',
  elements_count: 'elementsCount',
  is_square: 'isSquare',
  is_zero: 'isZero',
  is_binary: 'isBinary',
  is_identity: 'isIdentity',
  is_diagonal: 'isDiagonal',
  is_antidiagonal: 'isAntidiagonal',
  is_symmetric: 'isSymmetric',
  is_antisymmetric: 'isAntisymmetric',
  is_triangular: 'isTriangular',
  is_stochastic: 'isStochastic',
};

// Method names that only a matrix owns. Used when the receiver's type was not
// tracked, e.g. `matrix.pinv(m).mult(v)`.
const MATRIX_ONLY_METHODS = new Set([
  'mult', 'pow', 'kron', 'trace', 'det', 'inv', 'pinv', 'rank', 'eigenvalues',
  'eigenvectors', 'transpose', 'reshape', 'submatrix', 'row', 'col', 'rows',
  'columns', 'add_row', 'add_col', 'remove_row', 'remove_col', 'elements_count',
  'is_square', 'is_zero', 'is_binary', 'is_identity', 'is_diagonal',
  'is_antidiagonal', 'is_symmetric', 'is_antisymmetric', 'is_triangular',
  'is_stochastic',
]);

// Method names that only an array owns. Ambiguous names (get/set/copy/sort/fill)
// stay with the receiver's tracked type.
const ARRAY_ONLY_METHODS = new Set([
  'push', 'pop', 'size', 'shift', 'unshift', 'reverse', 'clear', 'insert',
  'remove', 'includes', 'indexof', 'lastindexof', 'join', 'slice', 'sum',
  'avg', 'max', 'min', 'first', 'last', 'range', 'median', 'stdev', 'variance',
  'concat', 'from', 'abs', 'binary_search', 'binary_search_leftmost',
  'binary_search_rightmost', 'every', 'some', 'covariance', 'mode',
  'percentile_linear_interpolation', 'percentile_nearest_rank', 'percentrank',
  'standardize', 'sort_indices',
]);

// Method names that only a map owns.
const MAP_ONLY_METHODS = new Set(['put', 'contains', 'keys', 'values']);

const DRAWING_NAMESPACES = new Set(['line', 'label', 'box', 'table', 'linefill', 'polyline']);

// Drawing methods whose name identifies the owning namespace even when the
// receiver's type was not tracked (e.g. `l = array.get(lines, i)`).
const DRAWING_METHOD_NAMESPACES: Record<string, string> = {
  // Shared drawing methods operate on the plain object fields, so the line
  // module handles them for every drawing type.
  delete: 'line', set_color: 'line', set_style: 'line',
  get_color: 'line', get_style: 'line',
  set_first_point: 'line', set_second_point: 'line',
  get_line1: 'linefill', get_line2: 'linefill',
  set_point: 'label', set_xloc: 'line', set_text_font_family: 'label',
  set_text_formatting: 'label', set_text_wrap: 'box',
  set_bottom_right_point: 'box', set_top_left_point: 'box',
  set_x1: 'line', set_y1: 'line', set_x2: 'line', set_y2: 'line',
  set_xy1: 'line', set_xy2: 'line', set_extend: 'line', set_width: 'line',
  get_x1: 'line', get_y1: 'line', get_x2: 'line', get_y2: 'line', get_price: 'line',
  set_x: 'label', set_y: 'label', set_xy: 'label', set_yloc: 'label',
  set_text: 'label', set_tooltip: 'label', set_textcolor: 'label',
  set_size: 'label', set_textalign: 'label',
  get_x: 'label', get_y: 'label', get_text: 'label',
  set_left: 'box', set_top: 'box', set_right: 'box', set_bottom: 'box',
  set_lefttop: 'box', set_rightbottom: 'box', set_bgcolor: 'box',
  set_border_color: 'box', set_border_width: 'box', set_border_style: 'box',
  set_text_color: 'box', set_text_size: 'box', set_text_halign: 'box',
  set_text_valign: 'box',
  get_left: 'box', get_top: 'box', get_right: 'box', get_bottom: 'box',
  cell: 'table', merge_cells: 'table', set_position: 'table',
  set_frame_color: 'table', set_frame_width: 'table',
  cell_set_text: 'table', cell_set_bgcolor: 'table', cell_set_text_color: 'table',
  cell_set_text_size: 'table', cell_set_text_halign: 'table',
  cell_set_text_valign: 'table', cell_set_tooltip: 'table',
};

// Known namespaces that should NOT be treated as method-call objects
const KNOWN_NAMESPACES = new Set([
  'ta', 'math', 'str', 'array', 'color', 'line', 'label', 'box', 'table',
  'request', 'syminfo', 'timeframe', 'barstate', 'strategy', 'log', 'ticker',
  'map', 'matrix', 'input', 'chart', 'runtime', 'linefill', 'polyline',
]);

/** Builtin sources that request.security can resample from the chart's own bars. */
const SECURITY_SOURCES = new Set([
  'open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'time', 'bar_index',
]);

const ARRAY_METHODS = new Set([
  'size', 'get', 'set', 'push', 'pop', 'shift', 'unshift', 'clear', 'remove',
  'insert', 'sort', 'reverse', 'join', 'slice', 'includes', 'indexof',
  'lastindexof', 'sum', 'avg', 'max', 'min', 'median', 'stdev', 'variance',
  'copy', 'concat', 'first', 'last',
]);

export class CodeGenerator {
  private reporter: DiagnosticReporter;
  private mapper: FunctionMapper;

  // State for tracking var/varip declarations
  private varDecls: Map<string, string> = new Map(); // name -> 'var' | 'varip'
  private initLines: string[] = [];

  // Phase 3: Track variables that are used with history (myVar[1])
  private historyVars: Set<string> = new Set();

  // Phase 3: Track variable types for method dispatch (name -> inferred namespace)
  private varTypes: Map<string, string> = new Map();

  // UDT support: track declared type names and their field order
  private udtTypes: Set<string> = new Set();
  private udtFieldOrder: Map<string, string[]> = new Map();
  // UDT methods: track user-defined method names (methodName -> thisType)
  private udtMethods: Map<string, string> = new Map();

  // Counters for plot/hline indices
  private plotIndex = 0;
  private hlineIndex = 0;
  private plotshapeIndex = 0;
  private plotcharIndex = 0;
  private plotarrowIndex = 0;
  private plotcandleIndex = 0;
  private plotbarIndex = 0;
  // Stable id for each ta.* call site so stateful TA and chained sources do not
  // share state with a second call to the same function.
  private callSiteIndex = 0;
  private usedInputIds: Set<string> = new Set();
  private userFunctions: Set<string> = new Set();
  /** Methods declared on builtin drawing types; called as plain functions. */
  private builtinMethods: Map<string, string> = new Map();
/** Receiver alias while generating a free function for a builtin-type method. */
private thisAlias: string | null = null;

  // Metadata extracted from indicator()/strategy() calls
  private metadata: ScriptMetadata = {
    type: 'indicator',
    title: 'Pine Script',
    shorttitle: '',
    overlay: false,
    inputs: [],
    plots: [],
  };

  // Indentation
  private indentLevel = 0;
  private readonly INDENT = '    ';

  constructor(reporter: DiagnosticReporter) {
    this.reporter = reporter;
    this.mapper = new FunctionMapper();
  }

  generate(program: Program): GenerateResult {
    // Reset state
    this.varDecls = new Map();
    this.initLines = [];
    this.plotIndex = 0;
    this.hlineIndex = 0;
    this.plotshapeIndex = 0;
    this.plotcharIndex = 0;
    this.plotarrowIndex = 0;
    this.plotcandleIndex = 0;
    this.plotbarIndex = 0;
    this.callSiteIndex = 0;
    this.usedInputIds = new Set();
    this.userFunctions = new Set();
    this.builtinMethods = new Map();
    this.thisAlias = null;
    this.metadata = {
      type: 'indicator',
      title: 'Pine Script',
      shorttitle: '',
      overlay: false,
      inputs: [],
      plots: [],
    };

    // Reset Phase 3 state
    this.historyVars = new Set();
    this.varTypes = new Map();

    // Reset UDT state
    this.udtTypes = new Set();
    this.udtFieldOrder = new Map();
    this.udtMethods = new Map();

    // First pass: extract metadata and collect var/varip declarations
    this.firstPass(program);

    // Pre-scan AST for user variables accessed with history (myVar[1])
    this.scanForHistoryVars(program);

    // Second pass: generate execute body
    const executeLines: string[] = [];
    this.generateBody(program.body, executeLines, true);

    // Build the output
    const metaJson = JSON.stringify(this.metadata);
    const lines: string[] = [];

    lines.push('(function(__rt) {');
    lines.push(`    __rt.setMetadata(${metaJson});`);

    // Init function (only if there are var/varip)
    if (this.initLines.length > 0) {
      lines.push('    __rt.setInit(function() {');
      for (const l of this.initLines) {
        lines.push('        ' + l);
      }
      lines.push('    });');
    }

    lines.push('    __rt.setExecute(function() {');
    for (const l of executeLines) {
      lines.push('    ' + l);
    }
    lines.push('    });');
    lines.push('})');

    return {
      code: lines.join('\n'),
      metadata: this.metadata,
    };
  }

  // ───────── First pass: extract metadata (indicator/strategy calls) ─────────

  private firstPass(program: Program): void {
    for (const stmt of program.body) {
      // Pre-register UDT type names so they're available for constructor detection
      if (stmt.kind === 'TypeDeclaration') {
        const td = stmt as TypeDeclaration;
        this.udtTypes.add(td.name);
        this.udtFieldOrder.set(td.name, td.fields.map(f => f.name));
      }
      // User functions are hoisted by the generated JS; unknown bare calls that
      // are not declared here are treated as unsupported builtins.
      if (stmt.kind === 'FunctionDeclaration') {
        this.userFunctions.add((stmt as FunctionDeclaration).name);
      }
      // Pre-register method names
      if (stmt.kind === 'MethodDeclaration') {
        const md = stmt as MethodDeclaration;
        this.udtMethods.set(md.name, md.thisType);
        if (['line', 'label', 'box', 'table', 'linefill', 'polyline', 'chart', 'array', 'map', 'matrix', 'float', 'int', 'bool', 'string', 'color'].includes(md.thisType)) {
          this.builtinMethods.set(md.name, md.thisType);
          this.userFunctions.add(md.name);
        }
      }
      if (stmt.kind === 'ExpressionStatement') {
        const expr = (stmt as ExpressionStatement).expression;
        if (expr.kind === 'CallExpression') {
          const call = expr as CallExpression;
          const calleeName = this.calleeToString(call.callee);
          if (calleeName === 'indicator') {
            this.extractIndicatorMeta(call);
          } else if (calleeName === 'strategy') {
            this.extractStrategyMeta(call);
          }
        }
      }
    }
  }

  private extractIndicatorMeta(call: CallExpression): void {
    this.metadata.type = 'indicator';
    const args = call.args;

    // indicator("Title", "short", overlay=true, ...)
    if (args[0]) {
      const v = this.getLiteralValue(args[0].value);
      if (typeof v === 'string') this.metadata.title = v;
    }
    if (args[1] && args[1].name === null) {
      const v = this.getLiteralValue(args[1].value);
      if (typeof v === 'string') this.metadata.shorttitle = v;
    }

    for (const arg of args) {
      if (arg.name === 'title') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') this.metadata.title = v;
      } else if (arg.name === 'shorttitle') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') this.metadata.shorttitle = v;
      } else if (arg.name === 'overlay') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'boolean') this.metadata.overlay = v;
      }
    }
  }

  private extractStrategyMeta(call: CallExpression): void {
    this.metadata.type = 'strategy';
    const args = call.args;

    if (args[0]) {
      const v = this.getLiteralValue(args[0].value);
      if (typeof v === 'string') this.metadata.title = v;
    }

    for (const arg of args) {
      if (arg.name === 'title') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') this.metadata.title = v;
      } else if (arg.name === 'shorttitle') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') this.metadata.shorttitle = v;
      } else if (arg.name === 'overlay') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'boolean') this.metadata.overlay = v;
      }
    }
  }

  /** Pre-scan the AST for IndexExpression where object is a non-builtin identifier. */
  private scanForHistoryVars(program: Program): void {
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'IndexExpression') {
        const idx = node as IndexExpression;
        if (idx.object.kind === 'IdentifierExpression') {
          const name = (idx.object as IdentifierExpression).name;
          if (!this.mapper.isBuiltinVar(name) && name !== 'na') {
            this.historyVars.add(name);
          }
        }
      }
      // Recurse into all properties
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === 'object' && item.kind) visit(item);
          }
        } else if (val && typeof val === 'object' && val.kind) {
          visit(val);
        }
      }
    };
    for (const stmt of program.body) visit(stmt);
  }

  /** Infer the namespace type from an RHS call expression. */
  private inferTypeFromCall(calleeName: string): string | null {
    if (calleeName.startsWith('array.new') || calleeName.startsWith('array.from') ||
        calleeName.startsWith('array.copy') || calleeName.startsWith('array.slice')) return 'array';
    if (calleeName === 'line.new' || calleeName === 'line.copy') return 'line';
    if (calleeName === 'label.new' || calleeName === 'label.copy') return 'label';
    if (calleeName === 'box.new' || calleeName === 'box.copy') return 'box';
    if (calleeName === 'table.new') return 'table';
    if (calleeName === 'map.new') return 'map';
    if (calleeName === 'matrix.new') return 'matrix';
    // UDT constructor: TypeName.new(...)
    if (calleeName.endsWith('.new')) {
      const typeName = calleeName.slice(0, -4);
      if (this.udtTypes.has(typeName)) return typeName;
    }
    return null;
  }

  /** Infer the namespace type from a type annotation. */
  private inferTypeFromAnnotation(baseType: string): string | null {
    const typeMap: Record<string, string> = {
      'array': 'array', 'line': 'line', 'label': 'label',
      'box': 'box', 'table': 'table', 'map': 'map', 'matrix': 'matrix',
      'linefill': 'linefill', 'polyline': 'polyline',
    };
    return typeMap[baseType] ?? null;
  }

  private getLiteralValue(expr: Expression): unknown {
    if (expr.kind === 'LiteralExpression') {
      return (expr as LiteralExpression).value;
    }
    if (expr.kind === 'UnaryExpression') {
      const unary = expr as UnaryExpression;
      const inner = this.getLiteralValue(unary.operand);
      if (unary.operator === '-' && typeof inner === 'number') return -inner;
      if (unary.operator === '+' && typeof inner === 'number') return inner;
      if (unary.operator === 'not' && typeof inner === 'boolean') return !inner;
      return undefined;
    }
    if (expr.kind === 'MemberExpression') {
      const member = expr as MemberExpression;
      if (member.object.kind === 'IdentifierExpression') {
        const namespace = (member.object as IdentifierExpression).name;
        const full = `${namespace}.${member.property}`;
        const colorHex = COLOR_CONSTANTS[full];
        if (colorHex) return colorHex;
        if (namespace === 'hline') return member.property.replace(/^style_/, '');
        if (namespace === 'plot' || namespace === 'hline' || namespace === 'line' ||
            namespace === 'label' || namespace === 'box' || namespace === 'xloc' ||
            namespace === 'yloc' || namespace === 'extend' || namespace === 'shape' ||
            namespace === 'location' || namespace === 'size' || namespace === 'text' ||
            namespace === 'position' || namespace === 'display' || namespace === 'barmerge' ||
            namespace === 'format' || namespace === 'scale' || namespace === 'adjustment' ||
            namespace === 'currency' || namespace === 'order' || namespace === 'alert' ||
            namespace === 'font' || namespace === 'dayofweek') {
          return member.property;
        }
      }
    }
    return undefined;
  }

  // ───────── Statement generation ─────────

  private generateBody(stmts: Statement[], out: string[], isTopLevel = false): void {
    for (const stmt of stmts) {
      this.generateStatement(stmt, out, isTopLevel);
    }
  }

  private generateStatement(stmt: Statement, out: string[], isTopLevel = false): void {
    switch (stmt.kind) {
      case 'VariableDeclaration':
        this.genVarDecl(stmt as VariableDeclaration, out, isTopLevel);
        break;
      case 'FunctionDeclaration':
        this.genFunctionDecl(stmt as FunctionDeclaration, out);
        break;
      case 'ExpressionStatement': {
        const es = stmt as ExpressionStatement;
        // Skip top-level indicator/strategy calls — already handled in first pass
        if (isTopLevel && es.expression.kind === 'CallExpression') {
          const calleeName = this.calleeToString((es.expression as CallExpression).callee);
          if (calleeName === 'indicator' || calleeName === 'strategy') {
            break;
          }
        }
        const exprStr = this.genExpr(es.expression);
        out.push(this.indent() + exprStr + ';');
        break;
      }
      case 'AssignmentStatement':
        this.genAssignment(stmt as AssignmentStatement, out);
        break;
      case 'IfStatement':
        this.genIfStatement(stmt as IfStatement, out);
        break;
      case 'ForStatement':
        this.genForStatement(stmt as ForStatement, out);
        break;
      case 'ForInStatement':
        this.genForInStatement(stmt as ForInStatement, out);
        break;
      case 'WhileStatement':
        this.genWhileStatement(stmt as WhileStatement, out);
        break;
      case 'SwitchStatement':
        this.genSwitchStatement(stmt as SwitchStatement, out);
        break;
      case 'ReturnStatement': {
        const rs = stmt as ReturnStatement;
        if (rs.value) {
          out.push(this.indent() + `return ${this.genExpr(rs.value)};`);
        } else {
          out.push(this.indent() + 'return;');
        }
        break;
      }
      case 'BreakStatement':
        out.push(this.indent() + 'break;');
        break;
      case 'ContinueStatement':
        out.push(this.indent() + 'continue;');
        break;
      case 'TypeDeclaration':
        this.genTypeDecl(stmt as TypeDeclaration, out);
        break;
      case 'MethodDeclaration':
        this.genMethodDecl(stmt as MethodDeclaration, out);
        break;
      // Skip EnumDeclaration, ImportStatement, ExportStatement
      default:
        break;
    }
  }

  private genVarDecl(decl: VariableDeclaration, out: string[], isTopLevel = false): void {
    if (decl.isTupleDestructure && decl.tupleNames) {
      // [a, b, c] = ta.macd(...)
      const tupleNames = decl.tupleNames.map(safeIdent);
      const names = tupleNames.join(', ');
      const valStr = this.genExpr(decl.value);
      out.push(
        this.indent() +
          `var [${names}] = __rt.tuple(${valStr}, ${decl.tupleNames.length});`,
      );
      // Track history and types for each tuple name
      for (let index = 0; index < decl.tupleNames.length; index += 1) {
        const tname = decl.tupleNames[index]!;
        if (this.historyVars.has(tname)) {
          out.push(this.indent() + `__rt.userSeriesSet(${JSON.stringify(tname)}, ${tupleNames[index]});`);
        }
      }
      return;
    }

    const name = decl.name;

    // Infer type from annotation or RHS call
    if (decl.typeAnnotation) {
      const inferred = this.inferTypeFromAnnotation(decl.typeAnnotation.baseType);
      if (inferred) this.varTypes.set(name, inferred);
    }
    if (decl.value.kind === 'CallExpression') {
      const calleeName = this.calleeToString((decl.value as CallExpression).callee);
      const inferred = this.inferTypeFromCall(calleeName);
      if (inferred) this.varTypes.set(name, inferred);
    }

    if (decl.modifier === 'var') {
      // var declarations keep their first assignment. The guard runs on the
      // first bar, so `var x = close` sees the first close, not an empty series.
      this.varDecls.set(name, 'var');
      const valStr = this.genExpr(decl.value);
      out.push(
        this.indent() +
          `if (!(${JSON.stringify(name)} in __rt.state)) __rt.state.${name} = __rt.scalar(${valStr});`,
      );
      // Emit userSeriesSet for history-tracked var/varip
      if (this.historyVars.has(name)) {
        const store = `__rt.state.${name}`;
        out.push(this.indent() + `__rt.userSeriesSet(${JSON.stringify(name)}, ${store});`);
      }
    } else if (decl.modifier === 'varip') {
      // varip declarations: first assignment in persistentState
      this.varDecls.set(name, 'varip');
      const valStr = this.genExpr(decl.value);
      out.push(
        this.indent() +
          `if (!(${JSON.stringify(name)} in __rt.persistentState)) __rt.persistentState.${name} = __rt.scalar(${valStr});`,
      );
      if (this.historyVars.has(name)) {
        const store = `__rt.persistentState.${name}`;
        out.push(this.indent() + `__rt.userSeriesSet(${JSON.stringify(name)}, ${store});`);
      }
    } else {
      // Plain declaration
      const valStr = this.genExpr(decl.value);
      out.push(this.indent() + `var ${safeIdent(name)} = ${valStr};`);
      // Emit userSeriesSet for history-tracked variables
      if (this.historyVars.has(name)) {
        out.push(this.indent() + `__rt.userSeriesSet(${JSON.stringify(name)}, ${safeIdent(name)});`);
      }
    }
  }

  private genFunctionDecl(decl: FunctionDeclaration, out: string[]): void {
    const params = decl.params.map(p => safeIdent(p.name)).join(', ');
    out.push(this.indent() + `function ${fnName(decl.name)}(${params}) {`);
    this.indentLevel++;
    const savedTypes = this.pushParamTypes(decl.params);
    if (Array.isArray(decl.body)) {
      // A block-bodied Pine function returns the value of its last statement,
      // including the last expression inside an if/else branch.
      this.genTailBlock(decl.body, out);
    } else {
      // Expression body
      out.push(this.indent() + `return ${this.genExpr(decl.body)};`);
    }
    this.restoreParamTypes(savedTypes);
    this.indentLevel--;
    out.push(this.indent() + '}');
  }

  /** Make typed parameters visible to method dispatch inside the body. */
  private pushParamTypes(params: FunctionParam[]): Map<string, string | undefined> {
    const saved = new Map<string, string | undefined>();
    for (const param of params) {
      saved.set(param.name, this.varTypes.get(param.name));
      if (param.typeAnnotation) this.varTypes.set(param.name, param.typeAnnotation.baseType);
    }
    return saved;
  }

  private restoreParamTypes(saved: Map<string, string | undefined>): void {
    for (const [name, type] of saved) {
      if (type === undefined) this.varTypes.delete(name);
      else this.varTypes.set(name, type);
    }
  }

  private genTailBlock(body: Statement[], out: string[]): void {
    for (const stmt of body.slice(0, -1)) {
      this.generateStatement(stmt, out);
    }
    const last = body[body.length - 1];
    if (!last) {
      out.push(this.indent() + 'return __rt.na;');
      return;
    }
    this.genTailStatement(last, out);
  }

  private genTailStatement(stmt: Statement, out: string[]): void {
    if (stmt.kind === 'ExpressionStatement') {
      out.push(this.indent() + `return ${this.genExpr((stmt as ExpressionStatement).expression)};`);
      return;
    }
    if (stmt.kind === 'IfStatement') {
      const ifStmt = stmt as IfStatement;
      out.push(this.indent() + `if (__rt.scalar(${this.genExpr(ifStmt.condition)})) {`);
      this.indentLevel++;
      this.genTailBlock(ifStmt.thenBlock, out);
      this.indentLevel--;
      if (ifStmt.elseBlock) {
        out.push(this.indent() + '} else {');
        this.indentLevel++;
        if (Array.isArray(ifStmt.elseBlock)) {
          this.genTailBlock(ifStmt.elseBlock, out);
        } else {
          this.genTailStatement(ifStmt.elseBlock, out);
        }
        this.indentLevel--;
      }
      out.push(this.indent() + '}');
      out.push(this.indent() + 'return __rt.na;');
      return;
    }
    if (stmt.kind === 'SwitchStatement') {
      this.genTailSwitch(stmt as SwitchStatement, out);
      out.push(this.indent() + 'return __rt.na;');
      return;
    }
    this.generateStatement(stmt, out);
  }

  private genTailSwitch(stmt: SwitchStatement, out: string[]): void {
    if (stmt.discriminant) {
      out.push(this.indent() + `switch (__rt.scalar(${this.genExpr(stmt.discriminant)})) {`);
      this.indentLevel++;
      for (const c of stmt.cases) {
        for (const value of c.values) {
          out.push(this.indent() + `case __rt.scalar(${this.genExpr(value)}):`);
        }
        this.indentLevel++;
        this.genTailBlock(c.body, out);
        this.indentLevel--;
      }
      if (stmt.defaultCase) {
        out.push(this.indent() + 'default:');
        this.indentLevel++;
        this.genTailBlock(stmt.defaultCase, out);
        this.indentLevel--;
      }
      this.indentLevel--;
      out.push(this.indent() + '}');
      return;
    }

    let first = true;
    for (const c of stmt.cases) {
      const condition = c.values.map((value) => this.genExpr(value)).join(' || ');
      out.push(this.indent() + `${first ? 'if' : 'else if'} (${condition}) {`);
      first = false;
      this.indentLevel++;
      this.genTailBlock(c.body, out);
      this.indentLevel--;
      out.push(this.indent() + '}');
    }
    if (stmt.defaultCase) {
      out.push(this.indent() + 'else {');
      this.indentLevel++;
      this.genTailBlock(stmt.defaultCase, out);
      this.indentLevel--;
      out.push(this.indent() + '}');
    }
  }

  private genTypeDecl(decl: TypeDeclaration, out: string[]): void {
    const name = decl.name;
    // Register in case firstPass missed it (shouldn't happen, but be safe)
    this.udtTypes.add(name);
    this.udtFieldOrder.set(name, decl.fields.map(f => f.name));

    // Constructor function
    out.push(this.indent() + `function ${udtName(name)}(fields) {`);
    this.indentLevel++;
    out.push(this.indent() + 'fields = fields || {};');
    for (const field of decl.fields) {
      const defVal = field.defaultValue
        ? this.genExpr(field.defaultValue)
        : this.defaultForType(field.typeAnnotation.baseType);
      out.push(this.indent() +
        `this.${field.name} = (fields.${field.name} !== undefined) ? fields.${field.name} : ${defVal};`
      );
    }
    this.indentLevel--;
    out.push(this.indent() + '}');

    // Static .new() factory
    out.push(this.indent() + `${udtName(name)}.new = function(fields) { return new ${udtName(name)}(fields || {}); };`);
  }

  private defaultForType(baseType: string): string {
    switch (baseType) {
      case 'float': return '__rt.na';
      case 'int':   return '__rt.na';
      case 'bool':  return 'false';
      case 'string': return '__rt.na';
      case 'color':  return '__rt.na';
      default:       return 'null'; // nested UDT or unknown
    }
  }

  private genMethodDecl(decl: MethodDeclaration, out: string[]): void {
    const typeName = decl.thisType;
    // params already excludes the self/this param (parser slices params[1:])
    const params = decl.params.map(p => p.name).join(', ');

    // A method on a builtin drawing type is a plain function with the object as
    // its first parameter; there is no class to attach a prototype to.
    if (this.builtinMethods.has(decl.name)) {
      // `this` is not a legal JS parameter name, so the receiver is bound to a
      // local alias that genIdentifier emits for `this` inside the body.
      const selfName = decl.selfName === 'this' ? '__pine_self' : safeIdent(decl.selfName);
      const allParams = [selfName, ...decl.params.map(p => safeIdent(p.name))].join(', ');
      out.push(this.indent() + `function ${fnName(decl.name)}(${allParams}) {`);
      this.indentLevel++;
      this.thisAlias = selfName;
      out.push(this.indent() + `var self = ${selfName};`);
      if (Array.isArray(decl.body)) {
        this.genTailBlock(decl.body, out);
      } else {
        out.push(this.indent() + `return ${this.genExpr(decl.body)};`);
      }
      this.thisAlias = null;
      this.indentLevel--;
      out.push(this.indent() + '}');
      return;
    }

    out.push(this.indent() + `${udtName(typeName)}.prototype.${decl.name} = function(${params}) {`);
    this.indentLevel++;
    out.push(this.indent() + 'var self = this;');
    // Pine lets the receiver parameter keep its own name (`IS`, `Gap`, ...).
    if (decl.selfName !== 'self' && decl.selfName !== 'this' &&
        /^[A-Za-z_]\w*$/.test(decl.selfName)) {
      out.push(this.indent() + `var ${safeIdent(decl.selfName)} = this;`);
    }
    if (Array.isArray(decl.body)) {
      this.generateBody(decl.body, out);
    } else {
      out.push(this.indent() + `return ${this.genExpr(decl.body)};`);
    }
    this.indentLevel--;
    out.push(this.indent() + '};');
  }

  private genUdtConstructor(typeName: string, call: CallExpression): string {
    const fieldNames = this.udtFieldOrder.get(typeName) ?? [];
    const parts: string[] = [];

    for (let i = 0; i < call.args.length; i++) {
      const arg = call.args[i];
      const key = arg.name ?? fieldNames[i];
      if (key !== undefined) {
        parts.push(`${key}: ${this.genExpr(arg.value)}`);
      } else {
        // Positional arg without field name mapping — emit as positional-ish
        parts.push(this.genExpr(arg.value));
      }
    }

    return `${udtName(typeName)}.new({${parts.join(', ')}})`;
  }

  private genAssignment(stmt: AssignmentStatement, out: string[]): void {
    const target = stmt.target;
    const op = stmt.operator;
    const rhs = this.genExpr(stmt.value);

    // Track the declared type for plain declarations, so method syntax on
    // `x = map.new<...>()` or `x = Type.new(...)` dispatches correctly.
    if (op === '=' && target.kind === 'IdentifierExpression' && stmt.value.kind === 'CallExpression') {
      const inferred = this.inferTypeFromCall(this.calleeToString((stmt.value as CallExpression).callee));
      if (inferred) this.varTypes.set((target as IdentifierExpression).name, inferred);
    }

    // Determine if target is a var/varip
    const targetName = this.getIdentName(target);

    if (targetName && this.varDecls.has(targetName)) {
      const storeType = this.varDecls.get(targetName);
      const store = storeType === 'varip' ? `__rt.persistentState.${targetName}` : `__rt.state.${targetName}`;
      if (op === ':=' || op === '=') {
        out.push(this.indent() + `${store} = __rt.scalar(${rhs});`);
      } else {
        // Compound assignment: +=, -=, etc.
        const jsOp = op; // same operators in JS
        out.push(this.indent() + `${store} ${jsOp} ${rhs};`);
      }
      // Update user series for history tracking
      if (targetName && this.historyVars.has(targetName)) {
        out.push(this.indent() + `__rt.userSeriesSet(${JSON.stringify(targetName)}, ${store});`);
      }
    } else {
      const lhsStr = target.kind === 'MemberExpression' ? this.genLValue(target) : this.genExpr(target);
      // `=` is a Pine declaration, not a reassignment (`:=`). Declaring with
      // `var` keeps user names out of the global object: `top`, `length` and
      // similar names are read-only window properties, so a bare assignment
      // silently leaves the global value in place in the browser. `var` also
      // merges with a generated function of the same name (Pine scripts
      // sometimes shadow a function with a variable).
      const declares = op === '=' && (target.kind === 'IdentifierExpression' || target.kind === 'TupleExpression');
      if (declares) {
        out.push(this.indent() + `var ${lhsStr} = ${rhs};`);
      } else if (op === ':=') {
        out.push(this.indent() + `${lhsStr} = ${rhs};`);
      } else {
        out.push(this.indent() + `${lhsStr} ${op} ${rhs};`);
      }
      // Update user series for history tracking
      if (targetName && this.historyVars.has(targetName)) {
        out.push(this.indent() + `__rt.userSeriesSet(${JSON.stringify(targetName)}, ${lhsStr});`);
      }
    }
  }

  private getIdentName(expr: Expression): string | null {
    if (expr.kind === 'IdentifierExpression') {
      return (expr as IdentifierExpression).name;
    }
    return null;
  }

  private genIfStatement(stmt: IfStatement, out: string[]): void {
    const cond = `__rt.scalar(${this.genExpr(stmt.condition)})`;
    out.push(this.indent() + `if (${cond}) {`);
    this.indentLevel++;
    this.generateBody(stmt.thenBlock, out);
    this.indentLevel--;
    out.push(this.indent() + '}');

    if (stmt.elseBlock) {
      if (Array.isArray(stmt.elseBlock)) {
        out.push(this.indent() + 'else {');
        this.indentLevel++;
        this.generateBody(stmt.elseBlock, out);
        this.indentLevel--;
        out.push(this.indent() + '}');
      } else {
        // else if
        out.push(this.indent() + 'else {');
        this.indentLevel++;
        this.genIfStatement(stmt.elseBlock as IfStatement, out);
        this.indentLevel--;
        out.push(this.indent() + '}');
      }
    }
  }

  private genForStatement(stmt: ForStatement, out: string[]): void {
    const start = this.genExpr(stmt.start);
    const end = this.genExpr(stmt.end);
    const step = stmt.step ? this.genExpr(stmt.step) : '1';
    const v = stmt.variable;
    out.push(this.indent() + `for (var ${safeIdent(v)} = ${start}; ${safeIdent(v)} <= ${end}; ${safeIdent(v)} += ${step}) {`);
    this.indentLevel++;
    this.generateBody(stmt.body, out);
    this.indentLevel--;
    out.push(this.indent() + '}');
  }

  private genForInStatement(stmt: ForInStatement, out: string[]): void {
    const iter = `__rt.iterable(${this.genExpr(stmt.iterable)})`;
    const v = stmt.variable;
    if (stmt.indexVariable) {
      // for [index, value] in arr → for (var __idx = 0; __idx < arr.length; __idx++) { var index = __idx; var value = arr[__idx]; ... }
      const idx = safeIdent(stmt.indexVariable);
      out.push(this.indent() + `for (var ${idx} = 0; ${idx} < ${iter}.length; ${idx}++) {`);
      this.indentLevel++;
      out.push(this.indent() + `var ${safeIdent(v)} = ${iter}[${idx}];`);
      this.generateBody(stmt.body, out);
      this.indentLevel--;
      out.push(this.indent() + '}');
    } else {
      out.push(this.indent() + `for (var ${safeIdent(v)} of ${iter}) {`);
      this.indentLevel++;
      this.generateBody(stmt.body, out);
      this.indentLevel--;
      out.push(this.indent() + '}');
    }
  }

  private genWhileStatement(stmt: WhileStatement, out: string[]): void {
    const cond = `__rt.scalar(${this.genExpr(stmt.condition)})`;
    out.push(this.indent() + `while (${cond}) {`);
    this.indentLevel++;
    this.generateBody(stmt.body, out);
    this.indentLevel--;
    out.push(this.indent() + '}');
  }

  private genSwitchStatement(stmt: SwitchStatement, out: string[]): void {
    if (stmt.discriminant) {
      const disc = `__rt.scalar(${this.genExpr(stmt.discriminant)})`;
      out.push(this.indent() + `switch (${disc}) {`);
      this.indentLevel++;
      for (const c of stmt.cases) {
        for (const val of c.values) {
          out.push(this.indent() + `case __rt.scalar(${this.genExpr(val)}):`);
        }
        this.indentLevel++;
        this.generateBody(c.body, out);
        out.push(this.indent() + 'break;');
        this.indentLevel--;
      }
      if (stmt.defaultCase) {
        out.push(this.indent() + 'default:');
        this.indentLevel++;
        this.generateBody(stmt.defaultCase, out);
        this.indentLevel--;
      }
      this.indentLevel--;
      out.push(this.indent() + '}');
    } else {
      // Truthy switch without discriminant: emit as if-else chain
      let first = true;
      for (const c of stmt.cases) {
        const cond = c.values.map(v => `__rt.scalar(${this.genExpr(v)})`).join(' || ');
        if (first) {
          out.push(this.indent() + `if (${cond}) {`);
          first = false;
        } else {
          out.push(this.indent() + `else if (${cond}) {`);
        }
        this.indentLevel++;
        this.generateBody(c.body, out);
        this.indentLevel--;
        out.push(this.indent() + '}');
      }
      if (stmt.defaultCase) {
        out.push(this.indent() + 'else {');
        this.indentLevel++;
        this.generateBody(stmt.defaultCase, out);
        this.indentLevel--;
        out.push(this.indent() + '}');
      }
    }
  }

  // ───────── Expression generation ─────────

  private genExpr(expr: Expression): string {
    switch (expr.kind) {
      case 'LiteralExpression':
        return this.genLiteral(expr as LiteralExpression);
      case 'IdentifierExpression':
        return this.genIdentifier(expr as IdentifierExpression);
      case 'BinaryExpression':
        return this.genBinary(expr as BinaryExpression);
      case 'UnaryExpression':
        return this.genUnary(expr as UnaryExpression);
      case 'ConditionalExpression':
        return this.genConditional(expr as ConditionalExpression);
      case 'CallExpression':
        return this.genCall(expr as CallExpression);
      case 'MemberExpression':
        return this.genMember(expr as MemberExpression);
      case 'IndexExpression':
        return this.genIndex(expr as IndexExpression);
      case 'ArrayLiteralExpression':
        return this.genArrayLiteral(expr as ArrayLiteralExpression);
      case 'GroupExpression':
        return `(${this.genExpr((expr as GroupExpression).expression)})`;
      case 'TupleExpression': {
        const elems = (expr as TupleExpression).elements.map(e => this.genExpr(e));
        return `[${elems.join(', ')}]`;
      }
      case 'LambdaExpression':
        return this.genLambda(expr as LambdaExpression);
      case 'IfExpression':
        return this.genIfExpr(expr as IfExpression);
      case 'SwitchExpression':
        return this.genSwitchExpr(expr as SwitchExpression);
      case 'BlockExpression':
        return this.genBlockExpr(expr as BlockExpression);
      default:
        return '/* unknown expr */';
    }
  }

  private genLiteral(lit: LiteralExpression): string {
    if (lit.valueType === 'na') return '__rt.na';
    if (lit.valueType === 'string') return JSON.stringify(lit.value);
    if (lit.valueType === 'bool') return lit.value ? 'true' : 'false';
    if (lit.valueType === 'color') return JSON.stringify(lit.value);
    // int or float
    return String(lit.value);
  }

  private genIdentifier(id: IdentifierExpression): string {
    const name = id.name;

    // na keyword
    if (name === 'na') return '__rt.na';

    // Built-in variables
    if (this.mapper.isBuiltinVar(name)) {
      return this.mapper.mapBuiltinVar(name);
    }

    // Check color constant (e.g. bare "color" identifier - unlikely but handle)
    const colorHex = COLOR_CONSTANTS[name];
    if (colorHex) return JSON.stringify(colorHex);

    // var/varip references
    if (this.varDecls.has(name)) {
      const storeType = this.varDecls.get(name);
      return storeType === 'varip' ? `__rt.persistentState.${name}` : `__rt.state.${name}`;
    }

    // barstate properties accessed as top-level identifier
    if (name === 'barstate') return '__rt.barstate';

    // `this` is the UDT method receiver and is already a valid JS binding.
    if (name === 'this') return this.thisAlias ?? 'this';

    // Time functions used as variables (e.g. hour, minute - they're both functions and vars in Pine)
    const timeFnVars = new Set(['hour', 'minute', 'second', 'dayofweek', 'dayofmonth', 'month', 'year']);
    if (timeFnVars.has(name)) return `__rt.${name}()`;

    return safeIdent(name);
  }

  private genBinary(expr: BinaryExpression): string {
    const left = this.genExpr(expr.left);
    const right = this.genExpr(expr.right);
    let op = expr.operator;

    // Pine uses 'and', 'or', 'not'
    if (op === 'and') op = '&&';
    else if (op === 'or') op = '||';
    else if (op === '!=') op = '!==';
    else if (op === '==') op = '===';

    // A variable can hold a builtin Series (`x = close`); equality and logical
    // operators need its current value, not the object identity.
    if (['===', '!==', '<', '>', '<=', '>=', '&&', '||'].includes(op)) {
      return `__rt.scalar(${left}) ${op} __rt.scalar(${right})`;
    }
    return `${left} ${op} ${right}`;
  }

  private genUnary(expr: UnaryExpression): string {
    let op = expr.operator;
    if (op === 'not') op = '!';
    const operand = this.genExpr(expr.operand);
    const value = op === '!' ? `__rt.scalar(${operand})` : operand;
    if (expr.prefix) {
      return `${op}${value}`;
    }
    return `${value}${op}`;
  }

  private genConditional(expr: ConditionalExpression): string {
    const cond = `__rt.scalar(${this.genExpr(expr.condition)})`;
    const cons = this.genExpr(expr.consequent);
    const alt = this.genExpr(expr.alternate);
    return `(${cond} ? ${cons} : ${alt})`;
  }

  private genCall(call: CallExpression): string {
    const calleeName = this.calleeToString(call.callee);

    // `na` is lexed as the NA literal, so `na(x)` arrives with a literal callee.
    if (call.callee.kind === 'LiteralExpression' &&
        (call.callee as LiteralExpression).valueType === 'na') {
      const args = this.genArgs(call.args);
      return args ? `__rt.isNa(${args})` : '__rt.na';
    }

    // Metadata calls — already extracted, return empty (will be skipped at statement level)
    if (calleeName === 'indicator' || calleeName === 'strategy') {
      return '/* metadata */';
    }

    // input() handling
    if (calleeName === 'input' || calleeName === 'input.int' || calleeName === 'input.float' ||
        calleeName === 'input.bool' || calleeName === 'input.string' || calleeName === 'input.source' ||
        calleeName === 'input.color' || calleeName === 'input.timeframe' ||
        calleeName === 'input.session' || calleeName === 'input.symbol' || calleeName === 'input.price' ||
        calleeName === 'input.text_area' ||
        calleeName === 'input.time' ||
        calleeName === 'input.enum') {
      return this.genInputCall(call);
    }

    // plot() handling
    if (calleeName === 'plot') {
      return this.genPlotCall(call);
    }

    // hline() handling
    if (calleeName === 'hline') {
      return this.genHlineCall(call);
    }

    // fill() handling
    if (calleeName === 'fill') {
      return this.genFillCall(call);
    }

    // bgcolor()
    if (calleeName === 'bgcolor') {
      return this.genBgcolorCall(call);
    }

    // plotshape() handling
    if (calleeName === 'plotshape') {
      return this.genPlotshapeCall(call);
    }

    // plotchar() handling
    if (calleeName === 'plotchar') {
      return this.genPlotcharCall(call);
    }

    // plotarrow() handling
    if (calleeName === 'plotarrow') {
      return this.genPlotarrowCall(call);
    }

    // plotcandle() handling
    if (calleeName === 'plotcandle') {
      return this.genPlotcandleCall(call);
    }

    // plotbar() handling
    if (calleeName === 'plotbar') {
      return this.genPlotbarCall(call);
    }

    // barcolor()
    if (calleeName === 'barcolor') {
      const args = this.genArgs(call.args);
      return `__rt.barcolor(${args})`;
    }

    // color.new()
    if (calleeName === 'color.new') {
      const args = this.genArgs(call.args);
      return `__rt.color.colorNew(${args})`;
    }

    // na() check
    if (calleeName === 'na') {
      const args = this.genArgs(call.args);
      return args ? `__rt.isNa(${args})` : '__rt.na';
    }

    // UDT constructor call: TypeName.new(...)
    if (call.callee.kind === 'MemberExpression') {
      const mem = call.callee as MemberExpression;
      if (mem.property === 'new' && mem.object.kind === 'IdentifierExpression') {
        const typeName = (mem.object as IdentifierExpression).name;
        if (this.udtTypes.has(typeName)) {
          return this.genUdtConstructor(typeName, call);
        }
      }
    }

    // Check color constant function-like (rarely used)

    // Drawing constructors take positional anchors plus a single options
    // object; Pine code usually supplies the options as named arguments.
    // Tables take positional anchors plus a single options object.
    if (calleeName === 'table.new') return this.genTableCall(call, 'new');
    if (calleeName === 'table.cell') return this.genTableCall(call, 'cell');
    if (calleeName === 'line.new') return this.genDrawingNew(call, 'line');
    if (calleeName === 'box.new') return this.genDrawingNew(call, 'box');
    if (calleeName === 'label.new') return this.genDrawingNew(call, 'label');

    // Type casts share their name with the type keywords.
    if (calleeName === 'int' || calleeName === 'float' || calleeName === 'bool' || calleeName === 'string') {
      const helper = calleeName === 'int' ? 'toInt' :
        calleeName === 'float' ? 'toFloat' :
        calleeName === 'bool' ? 'toBool' : 'toStr';
      return `__rt.${helper}(${this.genArgs(call.args)})`;
    }

    // Drawing-type casts (`line(na)`, `box(na)`) keep the handle or yield null.
    if (calleeName === 'line' || calleeName === 'label' || calleeName === 'box' ||
        calleeName === 'table' || calleeName === 'linefill' || calleeName === 'polyline' ||
        calleeName === 'chart.point') {
      return `__rt.drawingHandle(${this.genArgs(call.args)})`;
    }

    // Function forms of syminfo variables: syminfo.ticker(symbol), syminfo.prefix(symbol).
    if (calleeName === 'syminfo.ticker') {
      return `__rt.syminfo.tickerOf(${this.genArgs(call.args)})`;
    }
    if (calleeName === 'syminfo.prefix') {
      return `__rt.syminfo.prefixOf(${this.genArgs(call.args)})`;
    }

    // `time(...)` is the session filter; bare `time` stays the bar timestamp.
    if (calleeName === 'time' && call.args.length > 0) {
      return `__rt.timeCall(${this.genArgs(call.args)})`;
    }
    if (calleeName === 'time_close' && call.args.length > 0) {
      return `__rt.timeCloseCall(${this.genArgs(call.args)})`;
    }

    // Higher-timeframe builtin sources can be resampled from the chart bars.
    // Arbitrary expressions still return na with a warning.
    if (calleeName === 'request.security') {
      const specs = this.securitySpecs(this.securityArg(call, 'expression', 2)?.value);
      if (specs) {
        const symbol = this.securityExprArg(call, 'symbol', 0);
        const timeframe = this.securityExprArg(call, 'timeframe', 1);
        const gaps = this.securityExprArg(call, 'gaps', 3);
        const lookahead = this.securityExprArg(call, 'lookahead', 4);
        const value = this.securitySpecsSource(specs);
        const ignoreSymbol = this.securityOption(call, 'ignore_invalid_symbol');
        const ignoreTimeframe = this.securityOption(call, 'ignore_invalid_timeframe');
        return `__rt.request.securitySource(${symbol}, ${timeframe}, ${value}, ${gaps}, ${lookahead}, ${ignoreSymbol}, ${ignoreTimeframe})`;
      }
    }
    if (calleeName === 'request.security_lower_tf') {
      const specs = this.securitySpecs(this.securityArg(call, 'expression', 2)?.value);
      if (specs) {
        const symbol = this.securityExprArg(call, 'symbol', 0);
        const timeframe = this.securityExprArg(call, 'timeframe', 1);
        const ignoreSymbol = this.securityOption(call, 'ignore_invalid_symbol');
        const ignoreTimeframe = this.securityOption(call, 'ignore_invalid_timeframe');
        return `__rt.request.securityLowerSource(${symbol}, ${timeframe}, ${this.securitySpecsSource(specs, true)}, ${ignoreSymbol}, ${ignoreTimeframe})`;
      }
    }

    // Try to map to runtime
    const mapped = this.mapper.mapFunction(calleeName);
    if (mapped !== undefined) {
      const args = this.genArgs(call.args);
      // The runtime needs a stable call-site key for stateful TA and for the
      // source series behind `ta.ema(fast, 9)`. Other namespaces take their
      // arguments as-is.
      const isTa = mapped.startsWith('__rt.ta.');
      const withId = (value: string): string => {
        if (!isTa) return value;
        const id = `"__cs${this.callSiteIndex++}"`;
        return value ? `${id}, ${value}` : id;
      };

      // Inject implicit series arguments for TA functions that need them.
      // In Pine Script, these functions implicitly use the chart's high/low/close/volume,
      // but the runtime requires them as explicit parameters.
      if (calleeName === 'ta.atr') {
        // Pine: ta.atr(length) -> Runtime: atr(length, high, low, close)
        return `${mapped}(${withId(args)}, __rt.high, __rt.low, __rt.close)`;
      }
      if (calleeName === 'ta.dmi') {
        // Pine: ta.dmi(diLength, adxSmoothing) -> Runtime: dmi(diLength, adxSmoothing, high, low, close)
        return `${mapped}(${withId(args)}, __rt.high, __rt.low, __rt.close)`;
      }
      if (calleeName === 'ta.stoch') {
        // Pine: ta.stoch(source, high, low, length) — args already explicit in Pine
        return `${mapped}(${withId(args)})`;
      }
      if (calleeName === 'ta.pivothigh' || calleeName === 'ta.pivotlow') {
        // Pine allows ta.pivothigh(left, right) over the chart's highs/lows.
        const id = `"__cs${this.callSiteIndex++}"`;
        if (call.args.length >= 3) return `${mapped}(${id}, ${args})`;
        const source = calleeName === 'ta.pivothigh' ? '__rt.high' : '__rt.low';
        return `${mapped}(${id}, ${source}, ${args})`;
      }
      if (calleeName === 'ta.vwma') {
        // Pine: ta.vwma(source, length) -> Runtime: vwma(source, volume, length)
        // Need to inject volume between source and length
        if (call.args.length === 2) {
          const source = this.genExpr(call.args[0].value);
          const length = this.genExpr(call.args[1].value);
          return `${mapped}(${withId(`${source}, __rt.volume, ${length}`)})`;
        }
        return `${mapped}(${withId(args)})`;
      }

      return `${mapped}(${withId(args)})`;
    }

    // Method syntax dispatch: obj.method(args) → __rt.{namespace}.{method}(obj, args)
    if (call.callee.kind === 'MemberExpression') {
      const mem = call.callee as MemberExpression;
      // A field access such as `IS.imbalance.size()` still dispatches to the
      // array module; only identifier objects carry a tracked type.
      if (mem.object.kind !== 'IdentifierExpression' && ARRAY_METHODS.has(mem.property)) {
        const objExpr = this.genExpr(mem.object);
        const argsStr = call.args.length > 0 ? ', ' + this.genArgs(call.args) : '';
        const runtime = ARRAY_METHOD_RUNTIME[mem.property] ?? mem.property;
        return `__rt.array.${runtime}(${objExpr}${argsStr})`;
      }
      // Only if object is NOT a known namespace
      if (mem.object.kind === 'IdentifierExpression') {
        const objName = (mem.object as IdentifierExpression).name;
        if (!KNOWN_NAMESPACES.has(objName)) {          const method = mem.property;

          // Check if this is a UDT method call — emit as direct prototype method call
          const objVarType = this.varTypes.get(objName);
          if (this.builtinMethods.has(method)) {
            const objExpr = this.genExpr(mem.object);
            const argsStr = call.args.length > 0 ? ', ' + this.genArgs(call.args) : '';
            return `${fnName(method)}(${objExpr}${argsStr})`;
          }
          if (objVarType && this.udtTypes.has(objVarType)) {
            const objExpr = this.genExpr(mem.object);
            const argsStr = call.args.length > 0 ? this.genArgs(call.args) : '';
            return `__rt.udtCall(${objExpr}, ${JSON.stringify(method)}, [${argsStr}])`;
          }

          // Determine the namespace from tracked type or method name
          let ns = this.varTypes.get(objName) ?? null;
          if (!ns) {
            // Fall back to method name lookup
            const arrayMethods = new Set([
              'push', 'pop', 'size', 'get', 'set', 'shift', 'unshift', 'sort',
              'reverse', 'clear', 'copy', 'insert', 'remove', 'includes', 'indexof',
              'lastindexof', 'join', 'slice', 'sum', 'avg', 'max', 'min', 'first',
              'last', 'range', 'median', 'stdev', 'variance', 'concat', 'from', 'abs',
              'binary_search', 'binary_search_leftmost', 'binary_search_rightmost',
              'every', 'some', 'fill', 'covariance', 'mode', 'percentile_linear_interpolation',
              'percentile_nearest_rank', 'percentrank', 'standardize',
            ]);
            const mapMethods = new Set([
              'put', 'contains', 'keys', 'values',
            ]);
            const matrixMethods = new Set([
              'rows', 'columns', 'add_row', 'add_col', 'remove_row', 'remove_col',
              'transpose', 'reshape', 'row', 'col', 'submatrix',
            ]);
            const tableMethods = new Set([
              'cell', 'merge_cells', 'set_position',
              'set_frame_color', 'set_frame_width',
              'cell_set_text', 'cell_set_bgcolor', 'cell_set_text_color',
              'cell_set_text_size', 'cell_set_text_halign', 'cell_set_text_valign',
              'cell_set_tooltip',
            ]);
            if (MATRIX_ONLY_METHODS.has(method)) ns = 'matrix';
            else if (ARRAY_ONLY_METHODS.has(method)) ns = 'array';
            else if (MAP_ONLY_METHODS.has(method)) ns = 'map';
            else if (arrayMethods.has(method)) ns = 'array';
            else if (tableMethods.has(method)) ns = 'table';
            else if (mapMethods.has(method)) {
              // Map methods - use tracked type if available
              ns = this.varTypes.get(objName) === 'map' ? 'map' : null;
            }
            else if (matrixMethods.has(method)) {
              ns = this.varTypes.get(objName) === 'matrix' ? 'matrix' : null;
            }
            else if (DRAWING_METHOD_NAMESPACES[method]) {
              // The method name identifies the drawing type when the receiver's
              // type is unknown (array element, function return, ...).
              ns = DRAWING_METHOD_NAMESPACES[method]!;
            }
          }
          if (ns) {
            const objExpr = this.genExpr(mem.object);
            const argsStr = call.args.length > 0 ? ', ' + this.genArgs(call.args) : '';
            const runtime = ns === 'array' ? ARRAY_METHOD_RUNTIME[method] ?? method
              : ns === 'matrix' ? MATRIX_METHOD_RUNTIME[method] ?? method
              : method;
            const receiver = DRAWING_NAMESPACES.has(ns) ? `__rt.drawingCall(${objExpr})` : objExpr;
            return `__rt.${ns}.${runtime}(${receiver}${argsStr})`;
          }
          if (this.udtMethods.has(method)) {
            const objExpr = this.genExpr(mem.object);
            const argsStr = call.args.length > 0 ? this.genArgs(call.args) : '';
            return `__rt.udtCall(${objExpr}, ${JSON.stringify(method)}, [${argsStr}])`;
          }
        }
      }
      // A drawing method on a field or call result (`element.bull.set_rightbottom`).
      if (mem.object.kind !== 'IdentifierExpression') {
        const objExpr = this.genExpr(mem.object);
        const argsStr = call.args.length > 0 ? ', ' + this.genArgs(call.args) : '';
        const method = mem.property;
        const ns = DRAWING_METHOD_NAMESPACES[method];
        if (ns) {
          return `__rt.${ns}.${method}(__rt.drawingCall(${objExpr})${argsStr})`;
        }
        if (MATRIX_ONLY_METHODS.has(method)) {
          return `__rt.matrix.${MATRIX_METHOD_RUNTIME[method] ?? method}(${objExpr}${argsStr})`;
        }
        if (ARRAY_ONLY_METHODS.has(method)) {
          return `__rt.array.${ARRAY_METHOD_RUNTIME[method] ?? method}(${objExpr}${argsStr})`;
        }
        if (MAP_ONLY_METHODS.has(method)) {
          return `__rt.map.${method}(${objExpr}${argsStr})`;
        }
        if (this.builtinMethods.has(method)) {
          return `${fnName(method)}(${objExpr}${argsStr})`;
        }
        if (this.udtMethods.has(method)) {
          return `__rt.udtCall(${objExpr}, ${JSON.stringify(method)}, [${argsStr.slice(2)}])`;
        }
      }
    }

    // Runtime built times and alert stubs.
    if (calleeName === 'color') {
      return `__rt.colorCall(${this.genArgs(call.args)})`;
    }
    if (calleeName === 'alert') {
      return `__rt.alert(${this.genArgs(call.args)})`;
    }
    if (calleeName === 'alertcondition') {
      return `__rt.alertcondition(${this.genArgs(call.args)})`;
    }

    // Unknown - declared user functions are hoisted; anything else is an
    // unsupported builtin, which the runtime stubs and reports instead of
    // throwing a ReferenceError.
    if (call.callee.kind === 'IdentifierExpression') {
      const name = (call.callee as IdentifierExpression).name;
      const args = this.genArgs(call.args);
      if (this.userFunctions.has(name)) return `${fnName(name)}(${args})`;
      return `__rt.missing(${JSON.stringify(name)})(${args})`;
    }

    // Unknown - emit as-is but try to resolve callee expression
    const calleeStr = this.genExpr(call.callee);
    const args = this.genArgs(call.args);
    return `${calleeStr}(${args})`;
  }

  private securitySpecs(expr: Expression | undefined): {
    items: ({ kind: 'source'; name: string; offset?: number } | { kind: 'ta'; fn: string; args: string[]; offset?: number } | null)[];
    tuple: boolean;
  } | null {
    if (!expr) return null;
    const specOf = (element: Expression): ({ kind: 'source'; name: string; offset?: number } | { kind: 'ta'; fn: string; args: string[]; offset?: number } | null) => {
      let offset: number | undefined;
      let node = element;
      if (node.kind === 'IndexExpression') {
        const index = node as IndexExpression;
        const value = index.index.kind === 'LiteralExpression' ? (index.index as LiteralExpression).value : null;
        if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
          offset = value;
          node = index.object;
        } else {
          return null;
        }
      }
      if (node.kind === 'IdentifierExpression') {
        const name = (node as IdentifierExpression).name;
        return SECURITY_SOURCES.has(name) ? { kind: 'source', name, offset } : null;
      }
      if (node.kind === 'CallExpression') {
        const call = node as CallExpression;
        if (call.callee.kind !== 'MemberExpression') return null;
        const member = call.callee as MemberExpression;
        if (member.object.kind !== 'IdentifierExpression') return null;
        if ((member.object as IdentifierExpression).name !== 'ta') return null;
        if (member.property !== 'atr') return null;
        const length = call.args[0]?.value;
        if (!length) return null;
        return { kind: 'ta', fn: 'atr', args: [this.genExpr(length)], offset };
      }
      return null;
    };

    if (expr.kind === 'ArrayLiteralExpression') {
      const items = (expr as ArrayLiteralExpression).elements.map(specOf);
      return items.some((item) => item !== null) ? { items, tuple: true } : null;
    }
    const single = specOf(expr);
    return single ? { items: [single], tuple: false } : null;
  }

  private securitySpecsSource(
    specs: { items: ({ kind: 'source'; name: string; offset?: number } | { kind: 'ta'; fn: string; args: string[]; offset?: number } | null)[]; tuple: boolean },
    forceArray = false,
  ): string {
    const one = (spec: (typeof specs.items)[number]): string => {
      if (!spec) return 'null';
      if (spec.kind === 'ta') {
        return `{kind:"ta",fn:${JSON.stringify(spec.fn)},args:[${spec.args.join(',')}]${spec.offset ? `,offset:${spec.offset}` : ''}}`;
      }
      return JSON.stringify(spec.offset ? { name: spec.name, offset: spec.offset } : { name: spec.name });
    };
    return specs.tuple || forceArray
      ? `[${specs.items.map(one).join(',')}]`
      : one(specs.items[0]!);
  }

  private securityOption(call: CallExpression, name: string): string {
    const arg = call.args.find((candidate) => candidate.name === name);
    return arg ? this.genExpr(arg.value) : 'false';
  }

  private securityArg(call: CallExpression, name: string, position: number): CallArgument | undefined {
    const named = call.args.find((candidate) => candidate.name === name);
    if (named) return named;
    return call.args.filter((candidate) => candidate.name === null)[position];
  }

  private securityExprArg(call: CallExpression, name: string, position: number): string {
    const arg = this.securityArg(call, name, position);
    return arg ? this.genExpr(arg.value) : 'undefined';
  }

  private genTableCall(call: CallExpression, kind: 'new' | 'cell'): string {
    const required =
      kind === 'new' ? ['position', 'columns', 'rows'] : ['table_id', 'column', 'row', 'text'];
    const optional =
      kind === 'new'
        ? ['bgcolor', 'border_color', 'border_width', 'frame_color', 'frame_width']
        : ['width', 'height', 'bgcolor', 'text_color', 'text_size', 'text_halign',
           'text_valign', 'tooltip', 'text_font_family', 'text_formatting'];
    const slots: (string | null)[] = required.map(() => null);
    const options: string[] = [];
    let positionalIndex = 0;

    for (const arg of call.args) {
      const value = this.genExpr(arg.value);
      if (arg.name === null) {
        if (positionalIndex < required.length) slots[positionalIndex] = value;
        else {
          const key = optional[positionalIndex - required.length];
          if (key) options.push(`${JSON.stringify(key)}: ${value}`);
        }
        positionalIndex++;
      } else {
        const index = kind === 'cell' && arg.name === 'table'
          ? 0
          : required.indexOf(arg.name);
        if (index >= 0) slots[index] = value;
        else options.push(`${JSON.stringify(arg.name)}: ${value}`);
      }
    }

    const args: string[] = slots.map((slot) => slot ?? 'undefined');
    if (options.length > 0) args.push(`{${options.join(', ')}}`);
    return `__rt.table.${kind}(${args.join(', ')})`;
  }

  private genDrawingNew(call: CallExpression, kind: 'line' | 'box' | 'label'): string {
    const required =
      kind === 'line' ? ['x1', 'y1', 'x2', 'y2'] :
      kind === 'box' ? ['left', 'top', 'right', 'bottom'] :
      ['x', 'y', 'text'];
    const optional =
      kind === 'line' ? ['xloc', 'extend', 'color', 'style', 'width'] :
      kind === 'box'
        ? ['border_color', 'border_width', 'border_style', 'extend', 'xloc', 'bgcolor',
           'text', 'text_size', 'text_color', 'text_halign', 'text_valign', 'text_wrap',
           'text_font_family', 'text_formatting']
        : ['xloc', 'yloc', 'color', 'textcolor', 'style', 'size', 'textalign', 'tooltip'];
    const slots: (string | null)[] = required.map(() => null);
    const options: string[] = [];
    let positionalIndex = 0;

    for (const arg of call.args) {
      const value = this.genExpr(arg.value);
      if (arg.name === null) {
        if (positionalIndex < required.length) {
          slots[positionalIndex] = value;
        } else {
          const key = optional[positionalIndex - required.length];
          if (key) options.push(`${JSON.stringify(key)}: ${value}`);
        }
        positionalIndex++;
      } else {
        const index = required.indexOf(arg.name);
        if (index >= 0) slots[index] = value;
        else options.push(`${JSON.stringify(arg.name)}: ${value}`);
      }
    }

    const args: string[] = slots.map((slot) => slot ?? 'undefined');
    if (options.length > 0) args.push(`{${options.join(', ')}}`);
    return `__rt.${kind}.new(${args.join(', ')})`;
  }

  private genInputCall(call: CallExpression): string {
    // Extract input metadata and return __rt.getInput(id)
    let id = `input_${this.metadata.inputs.length}`;
    let title = id;
    let defaultValue: unknown = undefined;
    let type = 'float';
    let defaultSource = 'close';

    const calleeName = this.calleeToString(call.callee);
    if (calleeName === 'input.int') type = 'int';
    else if (calleeName === 'input.bool') type = 'bool';
    else if (calleeName === 'input.string') type = 'string';
    else if (calleeName === 'input.color') type = 'color';
    else if (calleeName === 'input.source') type = 'source';
    else if (calleeName === 'input.timeframe') type = 'timeframe';
    else if (calleeName === 'input.session') type = 'session';
    else if (calleeName === 'input.symbol') type = 'symbol';
    else if (calleeName === 'input.price') type = 'price';
    else if (calleeName === 'input.text_area') type = 'text_area';
    else if (calleeName === 'input.time') type = 'time';
    else if (calleeName === 'input.enum') type = 'enum';

    call.args.forEach((arg, index) => {
      if (arg.name === 'defval' || (arg.name === null && index === 0)) {
        defaultValue = this.getLiteralValue(arg.value);
        if (arg.value.kind === 'IdentifierExpression') defaultSource = (arg.value as IdentifierExpression).name;
      } else if (arg.name === 'title' || (arg.name === null && index === 1)) {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') { title = v; id = v; }
      } else if (arg.name === 'id') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') id = v;
      }
    });

    if (type === 'color' && defaultValue === undefined) {
      defaultValue = this.resolveColor(call.args[0]?.value) ?? '#2962FF';
    }
    if (type === 'source') {
      defaultValue = defaultSource;
      // A source input is a series name in the settings; resolve it per bar so
      // `input.source(close)` keeps returning a series when the user changes it.
      const fallback = this.genExpr(call.args[0]?.value ?? {
        kind: 'IdentifierExpression',
        name: 'close',
      } as IdentifierExpression);
      this.metadata.inputs.push({ id, title, type, defaultValue });
      return `__rt.getSourceInput(${JSON.stringify(id)}, ${fallback})`;
    }
    if (defaultValue === undefined) {
      if (type === 'int' || type === 'float' || type === 'price' || type === 'time') defaultValue = 0;
      else if (type === 'bool') defaultValue = false;
      else if (type === 'string' || type === 'text_area' || type === 'timeframe' || type === 'session' || type === 'symbol' || type === 'enum') defaultValue = '';
    }

    // Input ids are user-visible settings keys. Titles keep them readable, but
    // two inputs can share a title, so fall back to a numbered suffix.
    if (!call.args.some((arg) => arg.name === 'id')) {
      const base = id;
      let suffix = 1;
      while (this.usedInputIds.has(id)) id = `${base}_${suffix++}`;
    }
    this.usedInputIds.add(id);

    this.metadata.inputs.push({ id, title, type, defaultValue });
    return `__rt.getInput(${JSON.stringify(id)})`;
  }

  private genPlotCall(call: CallExpression): string {
    const idx = this.plotIndex++;
    const args = call.args;

    let val = 'null';
    let title = `plot_${idx}`;
    let colorStr = '#2962FF';
    let linewidth = 1;
    let style = 'line';

    if (args[0]) val = this.genExpr(args[0].value);

    for (const arg of args) {
      if (arg.name === 'title' || (arg.name === null && args.indexOf(arg) === 1)) {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') title = v;
      } else if (arg.name === 'color' || (arg.name === null && args.indexOf(arg) === 2)) {
        colorStr = this.resolveColor(arg.value) ?? colorStr;
      } else if (arg.name === 'linewidth' || (arg.name === null && args.indexOf(arg) === 3)) {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'number') linewidth = v;
      } else if (arg.name === 'style') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') style = v;
      }
    }

    // Register plot in metadata
    this.metadata.plots.push({ index: idx, title, color: colorStr, linewidth, style });

    const opts = `{title:${JSON.stringify(title)},color:${JSON.stringify(colorStr)},linewidth:${linewidth},style:${JSON.stringify(style)}}`;
    return `__rt.plot(${idx}, ${val}, ${opts})`;
  }

  private genHlineCall(call: CallExpression): string {
    const idx = this.hlineIndex++;
    const args = call.args;

    let price = '0';
    let title = `hline_${idx}`;
    let colorStr = '#787B86';
    let linewidth = 1;
    let linestyle = 'solid';

    const priceArg = args.find((arg) => arg.name === 'price') ?? args.find((arg) => arg.name === null);
    if (priceArg) price = this.genExpr(priceArg.value);

    // Pine's positional order is price, title, color, linestyle, linewidth.
    let positionalIndex = -1;
    for (const arg of args) {
      if (arg.name === null) positionalIndex += 1;
      const field = arg.name
        ?? (positionalIndex === 1
          ? 'title'
          : positionalIndex === 2
            ? 'color'
            : positionalIndex === 3
              ? 'linestyle'
              : positionalIndex === 4
                ? 'linewidth'
                : null);
      if (field === 'title') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') title = v;
      } else if (field === 'color') {
        colorStr = this.resolveColor(arg.value) ?? colorStr;
      } else if (field === 'linewidth') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'number') linewidth = v;
      } else if (field === 'linestyle') {
        const v = this.getLiteralValue(arg.value);
        if (typeof v === 'string') linestyle = v;
      }
    }

    const opts = `{title:${JSON.stringify(title)},color:${JSON.stringify(colorStr)},linewidth:${linewidth},linestyle:${JSON.stringify(linestyle)}}`;
    return `__rt.hline(${idx}, ${price}, ${opts})`;
  }

  private genFillCall(call: CallExpression): string {
    const args = call.args;
    const positional = args.filter((arg) => arg.name === null);
    const first = args.find((arg) => arg.name === 'plot1' || arg.name === 'hline1') ?? positional[0];
    const second = args.find((arg) => arg.name === 'plot2' || arg.name === 'hline2') ?? positional[1];
    const p1 = first ? this.genExpr(first.value) : 'null';
    const p2 = second ? this.genExpr(second.value) : 'null';
    let colorArg: CallArgument | undefined;

    let positionalIndex = -1;
    for (const arg of args) {
      if (arg.name === null) positionalIndex += 1;
      if (arg.name === 'color' || (arg.name === null && positionalIndex === 2)) {
        colorArg = arg;
      }
    }

    if (colorArg) {
      const resolved = this.resolveColor(colorArg.value);
      const colorExpr = resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(colorArg.value);
      return `__rt.fill(${p1}, ${p2}, {color:${colorExpr}})`;
    }
    return `__rt.fill(${p1}, ${p2})`;
  }

  private genBgcolorCall(call: CallExpression): string {
    if (call.args[0]) {
      const colorVal = this.resolveColor(call.args[0].value);
      if (colorVal !== undefined) {
        return `__rt.bgcolor(${JSON.stringify(colorVal)})`;
      }
      return `__rt.bgcolor(${this.genExpr(call.args[0].value)})`;
    }
    return '__rt.bgcolor(null)';
  }

  private genPlotshapeCall(call: CallExpression): string {
    const idx = this.plotshapeIndex++;
    const args = call.args;

    // plotshape(series, title, style, location, color, offset, text, textcolor, size)
    let series = 'null';
    const optParts: string[] = [];

    if (args[0]) series = this.genExpr(args[0].value);

    for (const arg of args) {
      if (arg.name === 'title' || (arg.name === null && args.indexOf(arg) === 1)) {
        optParts.push(`title:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'style' || (arg.name === null && args.indexOf(arg) === 2)) {
        optParts.push(`style:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'location' || (arg.name === null && args.indexOf(arg) === 3)) {
        optParts.push(`location:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'color' || (arg.name === null && args.indexOf(arg) === 4)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`color:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'offset' || (arg.name === null && args.indexOf(arg) === 5)) {
        optParts.push(`offset:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'text' || (arg.name === null && args.indexOf(arg) === 6)) {
        optParts.push(`text:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'textcolor' || (arg.name === null && args.indexOf(arg) === 7)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`textcolor:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'size' || (arg.name === null && args.indexOf(arg) === 8)) {
        optParts.push(`size:${this.genExpr(arg.value)}`);
      }
    }

    const opts = optParts.length > 0 ? `, {${optParts.join(',')}}` : '';
    return `__rt.plotshape(${idx}, ${series}${opts})`;
  }

  private genPlotcharCall(call: CallExpression): string {
    const idx = this.plotcharIndex++;
    const args = call.args;

    // plotchar(series, title, char, location, color, offset, text, textcolor, size)
    let series = 'null';
    const optParts: string[] = [];

    if (args[0]) series = this.genExpr(args[0].value);

    for (const arg of args) {
      if (arg.name === 'title' || (arg.name === null && args.indexOf(arg) === 1)) {
        optParts.push(`title:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'char' || (arg.name === null && args.indexOf(arg) === 2)) {
        optParts.push(`char:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'location' || (arg.name === null && args.indexOf(arg) === 3)) {
        optParts.push(`location:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'color' || (arg.name === null && args.indexOf(arg) === 4)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`color:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'offset' || (arg.name === null && args.indexOf(arg) === 5)) {
        optParts.push(`offset:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'text' || (arg.name === null && args.indexOf(arg) === 6)) {
        optParts.push(`text:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'textcolor' || (arg.name === null && args.indexOf(arg) === 7)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`textcolor:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'size' || (arg.name === null && args.indexOf(arg) === 8)) {
        optParts.push(`size:${this.genExpr(arg.value)}`);
      }
    }

    const opts = optParts.length > 0 ? `, {${optParts.join(',')}}` : '';
    return `__rt.plotchar(${idx}, ${series}${opts})`;
  }

  private genPlotarrowCall(call: CallExpression): string {
    const idx = this.plotarrowIndex++;
    const args = call.args;

    // plotarrow(series, title, colorup, colordown, offset, minheight, maxheight)
    let series = 'null';
    const optParts: string[] = [];

    if (args[0]) series = this.genExpr(args[0].value);

    for (const arg of args) {
      if (arg.name === 'title' || (arg.name === null && args.indexOf(arg) === 1)) {
        optParts.push(`title:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'colorup' || (arg.name === null && args.indexOf(arg) === 2)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`colorup:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'colordown' || (arg.name === null && args.indexOf(arg) === 3)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`colordown:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'offset' || (arg.name === null && args.indexOf(arg) === 4)) {
        optParts.push(`offset:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'minheight' || (arg.name === null && args.indexOf(arg) === 5)) {
        optParts.push(`minheight:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'maxheight' || (arg.name === null && args.indexOf(arg) === 6)) {
        optParts.push(`maxheight:${this.genExpr(arg.value)}`);
      }
    }

    const opts = optParts.length > 0 ? `, {${optParts.join(',')}}` : '';
    return `__rt.plotarrow(${idx}, ${series}${opts})`;
  }

  private genPlotcandleCall(call: CallExpression): string {
    const idx = this.plotcandleIndex++;
    const args = call.args;

    // plotcandle(open, high, low, close, title, color, wickcolor, bordercolor)
    let openExpr = 'null';
    let highExpr = 'null';
    let lowExpr = 'null';
    let closeExpr = 'null';
    const optParts: string[] = [];

    if (args[0]) openExpr = this.genExpr(args[0].value);
    if (args[1] && args[1].name === null) highExpr = this.genExpr(args[1].value);
    if (args[2] && args[2].name === null) lowExpr = this.genExpr(args[2].value);
    if (args[3] && args[3].name === null) closeExpr = this.genExpr(args[3].value);

    for (const arg of args) {
      if (arg.name === 'open') openExpr = this.genExpr(arg.value);
      else if (arg.name === 'high') highExpr = this.genExpr(arg.value);
      else if (arg.name === 'low') lowExpr = this.genExpr(arg.value);
      else if (arg.name === 'close') closeExpr = this.genExpr(arg.value);
      else if (arg.name === 'title' || (arg.name === null && args.indexOf(arg) === 4)) {
        optParts.push(`title:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'color' || (arg.name === null && args.indexOf(arg) === 5)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`color:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'wickcolor' || (arg.name === null && args.indexOf(arg) === 6)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`wickcolor:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      } else if (arg.name === 'bordercolor' || (arg.name === null && args.indexOf(arg) === 7)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`bordercolor:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      }
    }

    const opts = optParts.length > 0 ? `, {${optParts.join(',')}}` : '';
    return `__rt.plotcandle(${idx}, ${openExpr}, ${highExpr}, ${lowExpr}, ${closeExpr}${opts})`;
  }

  private genPlotbarCall(call: CallExpression): string {
    const idx = this.plotbarIndex++;
    const args = call.args;

    // plotbar(open, high, low, close, title, color)
    let openExpr = 'null';
    let highExpr = 'null';
    let lowExpr = 'null';
    let closeExpr = 'null';
    const optParts: string[] = [];

    if (args[0]) openExpr = this.genExpr(args[0].value);
    if (args[1] && args[1].name === null) highExpr = this.genExpr(args[1].value);
    if (args[2] && args[2].name === null) lowExpr = this.genExpr(args[2].value);
    if (args[3] && args[3].name === null) closeExpr = this.genExpr(args[3].value);

    for (const arg of args) {
      if (arg.name === 'open') openExpr = this.genExpr(arg.value);
      else if (arg.name === 'high') highExpr = this.genExpr(arg.value);
      else if (arg.name === 'low') lowExpr = this.genExpr(arg.value);
      else if (arg.name === 'close') closeExpr = this.genExpr(arg.value);
      else if (arg.name === 'title' || (arg.name === null && args.indexOf(arg) === 4)) {
        optParts.push(`title:${this.genExpr(arg.value)}`);
      } else if (arg.name === 'color' || (arg.name === null && args.indexOf(arg) === 5)) {
        const resolved = this.resolveColor(arg.value);
        optParts.push(`color:${resolved !== undefined ? JSON.stringify(resolved) : this.genExpr(arg.value)}`);
      }
    }

    const opts = optParts.length > 0 ? `, {${optParts.join(',')}}` : '';
    return `__rt.plotbar(${idx}, ${openExpr}, ${highExpr}, ${lowExpr}, ${closeExpr}${opts})`;
  }

  private resolveColor(expr: Expression): string | undefined {
    // Check if it's a color constant member expression or identifier
    if (expr.kind === 'MemberExpression') {
      const mem = expr as MemberExpression;
      const fullName = `${this.genExpr(mem.object)}.${mem.property}`;
      // Resolve color constants
      const hex = COLOR_CONSTANTS[fullName];
      if (hex) return hex;
    }
    if (expr.kind === 'IdentifierExpression') {
      const name = (expr as IdentifierExpression).name;
      const hex = COLOR_CONSTANTS[name];
      if (hex) return hex;
    }
    if (expr.kind === 'LiteralExpression') {
      const lit = expr as LiteralExpression;
      if (lit.valueType === 'color' || lit.valueType === 'string') {
        return lit.value as string;
      }
    }
    // For dynamic color expressions, generate the expression
    return undefined;
  }

  private genMember(expr: MemberExpression): string {
    const objStr = this.genExpr(expr.object);
    const prop = expr.property;
    const fullName = `${objStr}.${prop}`;

    // Check color constant
    const colorHex = COLOR_CONSTANTS[fullName];
    if (colorHex) return JSON.stringify(colorHex);

    // Shape constants: shape.triangleup -> "triangleup"
    if (objStr === 'shape') return JSON.stringify(prop);

    // Location constants: location.belowbar -> "belowbar"
    if (objStr === 'location') return JSON.stringify(prop);

    // Size constants: size.normal -> "normal"
    if (objStr === 'size') return JSON.stringify(prop);

    // Plot style constants: plot.style_line -> "style_line"
    if (objStr === 'plot') return JSON.stringify(prop);

    // Enum constants — xloc, yloc, extend, text, position, display, barmerge, adjustment, currency, format
    if (objStr === 'xloc') return JSON.stringify(prop); // xloc.bar_time → "bar_time"
    if (objStr === 'yloc') return JSON.stringify(prop); // yloc.price → "price"
    if (objStr === 'extend') return JSON.stringify(prop); // extend.none → "none"
    if (objStr === 'text') return JSON.stringify(prop); // text.align_left → "align_left"
    if (objStr === 'position') return JSON.stringify(prop); // position.top_right → "top_right"
    if (objStr === 'display') return JSON.stringify(prop); // display.all → "all"
    if (objStr === 'barmerge') return JSON.stringify(prop); // barmerge.lookahead_on → "lookahead_on"
    if (objStr === 'format') return JSON.stringify(prop); // format.price → "price"
    if (objStr === 'scale') return JSON.stringify(prop); // scale.right → "right"
    if (objStr === 'adjustment') return JSON.stringify(prop); // adjustment.none → "none"
    if (objStr === 'currency') return JSON.stringify(prop); // currency.USD → "USD"
    if (objStr === 'order') return JSON.stringify(prop); // order.ascending → "ascending"
    if (objStr === 'alert') return JSON.stringify(prop); // alert.freq_once_per_bar → "freq_once_per_bar"
    if (objStr === 'font') return JSON.stringify(prop); // font.family_default → "family_default"
    if (objStr === 'earnings') return JSON.stringify(prop);
    if (objStr === 'dividends') return JSON.stringify(prop);
    if (objStr === 'splits') return JSON.stringify(prop);
    if (objStr === 'session') return `__rt.session.${prop}`;

    // dayofweek constants: dayofweek.monday → 2 (1=Sunday, 7=Saturday)
    if (objStr === 'dayofweek') {
      const dayMap: Record<string, number> = {
        sunday: 1, monday: 2, tuesday: 3, wednesday: 4,
        thursday: 5, friday: 6, saturday: 7,
      };
      if (dayMap[prop] !== undefined) return String(dayMap[prop]);
      return JSON.stringify(prop);
    }

    // hline style constants: hline.style_solid → "solid" (strip "style_" prefix)
    if (objStr === 'hline') {
      const stripped = prop.startsWith('style_') ? prop.slice(6) : prop;
      return JSON.stringify(stripped);
    }

    // line style constants: line.style_solid → "solid"  +  line.new → __rt.line.new
    if (objStr === 'line') {
      if (prop.startsWith('style_')) return JSON.stringify(prop.slice(6));
      // Drawing methods: line.new, line.delete, line.set_*, line.get_*, line.copy
      return `__rt.line.${prop}`;
    }

    // label style constants: label.style_label_left → "label_left"  +  label.new → __rt.label.new
    if (objStr === 'label') {
      if (prop.startsWith('style_')) return JSON.stringify(prop.slice(6));
      return `__rt.label.${prop}`;
    }

    // box style: box.new, box.delete, box.set_*, box.get_*
    if (objStr === 'box') return `__rt.box.${prop}`;

    // table: table.new, table.cell, table.merge_cells, table.delete, table.clear
    if (objStr === 'table') return `__rt.table.${prop}`;
    if (objStr === 'linefill') return `__rt.linefill.${prop}`;
    if (objStr === 'polyline') return `__rt.polyline.${prop}`;

    // barstate properties
    if (objStr === '__rt.barstate' || objStr === 'barstate') {
      return `__rt.barstate.${prop}`;
    }

    // strategy namespace — constants (strategy.long, strategy.short) return string literals
    if (objStr === 'strategy') {
      if (prop === 'long' || prop === 'short') return JSON.stringify(prop);
      return `__rt.strategy.${prop}`;
    }

    // ta namespace
    if (objStr === 'ta') return `__rt.ta.${prop}`;

    // math namespace
    if (objStr === 'math') return `__rt.math.${prop}`;

    // color namespace
    if (objStr === 'color') return `__rt.color.${prop}`;

    // syminfo, timeframe etc
    if (objStr === 'syminfo') return `__rt.syminfo.${prop}`;
    if (objStr === 'timeframe') return `__rt.timeframe.${prop}`;
    if (objStr === 'chart') return `__rt.chart.${prop}`;
    if (objStr === 'str') return `__rt.str.${prop}`;
    if (objStr === 'array') return `__rt.array.${prop}`;
    if (objStr === 'request') return `__rt.request.${prop}`;
    if (objStr === 'runtime') return `__rt.runtime.${prop}`;
    if (objStr === 'map') return `__rt.map.${prop}`;
    if (objStr === 'matrix') return `__rt.matrix.${prop}`;
    if (objStr === 'ticker') return `__rt.ticker.${prop}`;

    // log namespace
    if (objStr === 'log') return `__rt.log.${prop}`;

    // Field access on a UDT or a drawing object. Pine returns `na` when the
    // object is `na` instead of throwing.
    return `__rt.field(${objStr}, ${JSON.stringify(prop)})`;
  }

  /** Direct member access for assignment targets (never wrapped in field()). */
  private genLValue(expr: Expression): string {
    if (expr.kind === 'MemberExpression') {
      const mem = expr as MemberExpression;
      return `${this.genLValue(mem.object)}.${mem.property}`;
    }
    return this.genExpr(expr);
  }

  private genIndex(expr: IndexExpression): string {
    const objExpr = expr.object;
    const idxStr = this.genExpr(expr.index);

    // close[1], open[2], etc. — series access
    if (objExpr.kind === 'IdentifierExpression') {
      const name = (objExpr as IdentifierExpression).name;
      if (this.mapper.isBuiltinVar(name)) {
        return this.mapper.mapSeriesGet(name, idxStr);
      }
      // User variable history: myVar[1] → __rt.userSeriesGet("myVar", 1)
      if (this.historyVars.has(name)) {
        return `__rt.userSeriesGet(${JSON.stringify(name)}, ${idxStr})`;
      }
    }

    // Member expression series: e.g. custom series
    const objStr = this.genExpr(objExpr);
    return `${objStr}[${idxStr}]`;
  }

  private genArrayLiteral(expr: ArrayLiteralExpression): string {
    const elems = expr.elements.map(e => this.genExpr(e));
    return `[${elems.join(', ')}]`;
  }

  private genLambda(expr: LambdaExpression): string {
    const params = expr.params.map(p => p.name).join(', ');
    const body = this.genExpr(expr.body);
    return `(${params}) => ${body}`;
  }

  private genIfExpr(expr: IfExpression): string {
    const cond = `__rt.scalar(${this.genExpr(expr.condition)})`;
    const then = this.genExpr(expr.thenBranch);
    const alt = expr.elseBranch ? this.genExpr(expr.elseBranch) : '__rt.na';
    return `(${cond} ? ${then} : ${alt})`;
  }

  private genBlockExpr(expr: BlockExpression): string {
    const lines: string[] = [];
    this.indentLevel++;
    try {
      for (const stmt of expr.statements) this.generateStatement(stmt, lines);
      lines.push(`${this.indent()}return ${this.genExpr(expr.value)};`);
    } finally {
      this.indentLevel--;
    }
    return `(() => {\n${lines.join('\n')}\n${this.indent()}})()`;
  }

  private genSwitchExpr(expr: SwitchExpression): string {
    // Generate as immediately-invoked function with if/else chain
    const parts: string[] = [];
    parts.push('(function() {');
    if (expr.discriminant) {
      parts.push(`var __sw = __rt.scalar(${this.genExpr(expr.discriminant)});`);
      for (const c of expr.cases) {
        const cond = c.values.map(v => `__sw === __rt.scalar(${this.genExpr(v)})`).join(' || ');
        parts.push(`if (${cond}) return ${this.genExpr(c.body)};`);
      }
    } else {
      for (const c of expr.cases) {
        const cond = c.values.map(v => `__rt.scalar(${this.genExpr(v)})`).join(' || ');
        parts.push(`if (${cond}) return ${this.genExpr(c.body)};`);
      }
    }
    if (expr.defaultCase) {
      parts.push(`return ${this.genExpr(expr.defaultCase)};`);
    } else {
      parts.push('return __rt.na;');
    }
    parts.push('})()');
    return parts.join(' ');
  }

  private genArgs(args: CallArgument[]): string {
    return args.map(arg => this.genExpr(arg.value)).join(', ');
  }

  // ───────── Helpers ─────────

  private indent(): string {
    return this.INDENT.repeat(this.indentLevel);
  }

  private calleeToString(callee: Expression): string {
    if (callee.kind === 'IdentifierExpression') {
      return (callee as IdentifierExpression).name;
    }
    if (callee.kind === 'MemberExpression') {
      const mem = callee as MemberExpression;
      const obj = this.calleeToString(mem.object);
      return `${obj}.${mem.property}`;
    }
    return '';
  }
}

/**
 * Avaliador SEGURO de fórmulas aritméticas — sem `eval`/`new Function`.
 *
 * Substitui o conversor shunting-yard original por um parser descendente
 * recursivo que gera uma AST validada na compilação.
 *
 * Gramática (da menor para a maior precedência):
 *   expr    := term (('+' | '-') term)*            associatividade à esquerda
 *   term    := unary (('*' | '/' | '%') unary)*    associatividade à esquerda
 *   unary   := ('-' | '+') unary | power
 *   power   := primary ('^' unary)?                associatividade à direita
 *   primary := número | coluna | função '(' args ')' | '(' expr ')'
 *
 * Consequências: `-2^2 = -4`, `2^3^2 = 512`, `2^-1 = 0.5`, `8/4/2 = 1`.
 *
 * Colunas: identificadores com letras Unicode (acentos), dígitos, `_` e
 * espaços internos (`renda mensal`), ou entre colchetes para qualquer
 * caractere (`[cat=x]`, `[valor (R$)]`).
 *
 * Funções: log (base 10), ln, log2, sqrt, abs, exp, round, floor, ceil
 * (1 argumento) e min, max (1+ argumentos).
 *
 * Semântica numérica: valores ausentes/não numéricos na linha, divisão por
 * zero, log de não positivos e qualquer resultado não finito produzem `null`
 * (antes eram trocados silenciosamente por 0). Sem arredondamento.
 */
import type { NumericParseOptions, Row } from '../types/index.js';
import { NeurixDataError, toNumberOrNull } from '../internal/values.js';

type Node =
  | { k: 'num'; v: number }
  | { k: 'col'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '%' | '^'; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

type Token =
  | { t: 'num'; v: number; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number };

const FUNCS: Record<string, { arity: number | 'variadic'; f: (...a: number[]) => number }> = {
  log: { arity: 1, f: Math.log10 },
  ln: { arity: 1, f: Math.log },
  log2: { arity: 1, f: Math.log2 },
  sqrt: { arity: 1, f: Math.sqrt },
  abs: { arity: 1, f: Math.abs },
  exp: { arity: 1, f: Math.exp },
  round: { arity: 1, f: Math.round },
  floor: { arity: 1, f: Math.floor },
  ceil: { arity: 1, f: Math.ceil },
  min: { arity: 'variadic', f: Math.min },
  max: { arity: 'variadic', f: Math.max },
};

const NUM_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const ID_START = /[\p{L}_]/u;
const ID_PART = /[\p{L}\p{N}_ ]/u;

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = NUM_RE.exec(src.slice(i));
      if (!m) throw new NeurixDataError('FORMULA_SYNTAX', `Número inválido na posição ${i + 1}.`);
      const next = src[i + m[0].length];
      if (next !== undefined && /[0-9.\p{L}_]/u.test(next)) throw new NeurixDataError('FORMULA_SYNTAX', `Número inválido na posição ${i + 1}.`);
      out.push({ t: 'num', v: Number(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (ch === '[') {
      const end = src.indexOf(']', i + 1);
      if (end < 0) throw new NeurixDataError('FORMULA_SYNTAX', `Colchete não fechado na posição ${i + 1}.`);
      const name = src.slice(i + 1, end);
      if (!name.trim()) throw new NeurixDataError('FORMULA_SYNTAX', `Nome de coluna vazio na posição ${i + 1}.`);
      out.push({ t: 'id', v: `[${name}]`, pos: i });
      i = end + 1;
      continue;
    }
    if (ID_START.test(ch)) {
      let j = i;
      while (j < src.length && ID_PART.test(src[j]!)) j++;
      out.push({ t: 'id', v: src.slice(i, j).trim(), pos: i });
      i = j;
      continue;
    }
    if ('+-*/%^(),'.includes(ch)) {
      out.push({ t: 'op', v: ch, pos: i });
      i++;
      continue;
    }
    throw new NeurixDataError('FORMULA_SYNTAX', `Caractere inválido na fórmula: "${ch}" (posição ${i + 1}).`);
  }
  return out;
}

class Parser {
  private i = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token | undefined {
    return this.toks[this.i];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  }
  private expect(v: string): void {
    if (!this.isOp(v)) {
      const t = this.peek();
      throw new NeurixDataError('FORMULA_SYNTAX', t ? `Esperado "${v}" na posição ${t.pos + 1}.` : `Esperado "${v}" no fim da fórmula.`);
    }
    this.i++;
  }

  parse(): Node {
    if (!this.toks.length) throw new NeurixDataError('FORMULA_SYNTAX', 'Fórmula vazia.');
    const n = this.expr();
    const t = this.peek();
    if (t) throw new NeurixDataError('FORMULA_SYNTAX', `Símbolo inesperado "${t.v}" na posição ${t.pos + 1}.`);
    return n;
  }
  private expr(): Node {
    let a = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: '+' | '-' }).v;
      a = { k: 'bin', op, a, b: this.term() };
    }
    return a;
  }
  private term(): Node {
    let a = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = (this.toks[this.i++] as { v: '*' | '/' | '%' }).v;
      a = { k: 'bin', op, a, b: this.unary() };
    }
    return a;
  }
  private unary(): Node {
    if (this.isOp('-')) {
      this.i++;
      return { k: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }
  private power(): Node {
    const base = this.primary();
    if (this.isOp('^')) {
      this.i++;
      return { k: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }
  private primary(): Node {
    const t = this.peek();
    if (!t) throw new NeurixDataError('FORMULA_SYNTAX', 'Fórmula incompleta.');
    if (t.t === 'num') {
      this.i++;
      return { k: 'num', v: t.v };
    }
    if (t.t === 'id') {
      this.i++;
      const isBracket = t.v.startsWith('[');
      if (!isBracket && this.isOp('(')) {
        const fn = t.v.toLowerCase();
        const spec = FUNCS[fn];
        if (!spec) throw new NeurixDataError('FORMULA_UNKNOWN_FUNCTION', `Função desconhecida: "${t.v}".`);
        this.i++;
        const args: Node[] = [];
        if (!this.isOp(')')) {
          args.push(this.expr());
          while (this.isOp(',')) {
            this.i++;
            args.push(this.expr());
          }
        }
        this.expect(')');
        const ok = spec.arity === 'variadic' ? args.length >= 1 : args.length === spec.arity;
        if (!ok) throw new NeurixDataError('FORMULA_ARITY', `Função "${fn}" recebeu ${args.length} argumento(s).`);
        return { k: 'call', fn, args };
      }
      return { k: 'col', name: isBracket ? t.v.slice(1, -1) : t.v };
    }
    if (t.v === '(') {
      this.i++;
      const n = this.expr();
      this.expect(')');
      return n;
    }
    throw new NeurixDataError('FORMULA_SYNTAX', `Símbolo inesperado "${t.v}" na posição ${t.pos + 1}.`);
  }
}

function collectColumns(n: Node, acc: Set<string>): void {
  if (n.k === 'col') acc.add(n.name);
  else if (n.k === 'neg') collectColumns(n.a, acc);
  else if (n.k === 'bin') {
    collectColumns(n.a, acc);
    collectColumns(n.b, acc);
  } else if (n.k === 'call') n.args.forEach((a) => collectColumns(a, acc));
}

function evaluate(n: Node, row: Row, opts: NumericParseOptions): number | null {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'col':
      return toNumberOrNull(row[n.name], opts);
    case 'neg': {
      const a = evaluate(n.a, row, opts);
      return a === null ? null : -a;
    }
    case 'call': {
      const args: number[] = [];
      for (const a of n.args) {
        const v = evaluate(a, row, opts);
        if (v === null) return null;
        args.push(v);
      }
      const r = FUNCS[n.fn]!.f(...args);
      return Number.isFinite(r) ? r : null;
    }
    case 'bin': {
      const a = evaluate(n.a, row, opts);
      const b = evaluate(n.b, row, opts);
      if (a === null || b === null) return null;
      let r: number;
      switch (n.op) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = a * b; break;
        case '/': r = b === 0 ? NaN : a / b; break;
        case '%': r = b === 0 ? NaN : a % b; break;
        case '^': r = a ** b; break;
      }
      return Number.isFinite(r) ? r : null;
    }
  }
}

/** Fórmula compilada: chamável por linha, com metadados. */
export interface CompiledFormula {
  (row: Row): number | null;
  /** Colunas referenciadas, em ordem alfabética. */
  readonly columns: string[];
  readonly source: string;
}

export interface CompileFormulaOptions extends NumericParseOptions {
  /** Se informado, valida que toda coluna referenciada existe. */
  knownColumns?: string[];
}

/**
 * Compila uma fórmula. Erros de sintaxe, funções desconhecidas, aridade
 * incorreta e (opcionalmente) colunas inexistentes lançam `NeurixDataError`.
 */
export function compileFormula(formula: string, options: CompileFormulaOptions = {}): CompiledFormula {
  if (typeof formula !== 'string') throw new NeurixDataError('FORMULA_SYNTAX', 'A fórmula deve ser uma string.');
  const ast = new Parser(tokenize(formula)).parse();
  const cols = new Set<string>();
  collectColumns(ast, cols);
  const columns = [...cols].sort();
  if (options.knownColumns) {
    const known = new Set(options.knownColumns);
    const missing = columns.filter((c) => !known.has(c));
    if (missing.length) throw new NeurixDataError('FORMULA_UNKNOWN_COLUMN', `Coluna(s) inexistente(s) na fórmula: ${missing.join(', ')}.`);
  }
  const opts: NumericParseOptions = { decimalSeparator: options.decimalSeparator };
  const fn = ((row: Row) => evaluate(ast, row, opts)) as CompiledFormula;
  Object.defineProperty(fn, 'columns', { value: columns, enumerable: true });
  Object.defineProperty(fn, 'source', { value: formula, enumerable: true });
  return fn;
}

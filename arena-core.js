/* Algo Arena core: a small C interpreter, the trace-lab programs, the exam
 * question bank and the C Lab challenges. Pure logic only (no DOM), so it can be
 * tested in Node. The browser UI lives in arena.js. */
(function (root) {
  "use strict";

  /* ---------------------------------------------------------------- *
   *  Small C interpreter (a teaching subset, runs entirely in the page)
   * ---------------------------------------------------------------- */
  class CError extends Error {
    constructor(message, line) {
      super(line ? `Line ${line}: ${message}` : message);
      this.line = line || null;
    }
  }

  const TYPE_WORDS = new Set(["int", "float", "double", "char", "long", "short", "unsigned", "signed", "void", "const"]);
  const RESERVED = new Set(["if", "else", "while", "do", "for", "break", "continue", "return"]);
  const OPS2 = ["++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=", "<=", ">=", "&&", "||"];
  const BIN_LEVELS = [["||"], ["&&"], ["==", "!="], ["<", ">", "<=", ">="], ["+", "-"], ["*", "/", "%"]];

  function preprocess(src) {
    const defines = new Map();
    const lines = String(src).replace(/\r\n?/g, "\n").split("\n").map(line => {
      const m = /^\s*#\s*(\w+)\s*(.*)$/.exec(line);
      if (!m) return line;
      if (m[1] === "define") {
        const d = /^(\w+)\s+(.+?)\s*$/.exec(m[2]);
        if (d) defines.set(d[1], d[2]);
      }
      return ""; // #include and other directives are ignored; keep line numbers
    });
    return { text: lines.join("\n"), defines };
  }

  function unescapeChar(ch) {
    return ({ n: "\n", t: "\t", r: "\r", "0": "\0", "\\": "\\", "'": "'", '"': '"' })[ch] ?? ch;
  }

  function tokenize(text, defines) {
    const tokens = [];
    const n = text.length;
    let i = 0;
    let line = 1;
    const push = (t, v, extra) => tokens.push({ t, v, line, ...extra });
    while (i < n) {
      const c = text[i];
      if (c === "\n") { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === "/" && text[i + 1] === "/") { while (i < n && text[i] !== "\n") i++; continue; }
      if (c === "/" && text[i + 1] === "*") {
        const end = text.indexOf("*/", i + 2);
        const stop = end < 0 ? n : end + 2;
        for (let k = i; k < stop; k++) if (text[k] === "\n") line++;
        i = stop;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i + 1;
        while (j < n && /\w/.test(text[j])) j++;
        const word = text.slice(i, j);
        if (defines.has(word)) {
          const sub = tokenize(defines.get(word), new Map());
          sub.pop();
          for (const token of sub) tokens.push({ ...token, line });
        } else push("id", word);
        i = j;
        continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(text[i + 1] || ""))) {
        const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fFlLuU]*/.exec(text.slice(i));
        const raw = m[0];
        push("num", parseFloat(raw), { f: /[.eE]/.test(raw.replace(/[fFlLuU]+$/, "")) });
        i += raw.length;
        continue;
      }
      if (c === '"') {
        let j = i + 1;
        let s = "";
        while (j < n && text[j] !== '"') {
          if (text[j] === "\n") throw new CError("Missing closing quote of a string", line);
          if (text[j] === "\\") { s += unescapeChar(text[j + 1]); j += 2; } else s += text[j++];
        }
        if (j >= n) throw new CError("Missing closing quote of a string", line);
        push("str", s);
        i = j + 1;
        continue;
      }
      if (c === "'") {
        let j = i + 1;
        let s = "";
        while (j < n && text[j] !== "'" && text[j] !== "\n") {
          if (text[j] === "\\") { s += unescapeChar(text[j + 1]); j += 2; } else s += text[j++];
        }
        if (text[j] !== "'" || s.length !== 1) throw new CError("A character constant must contain exactly one character, like 'a'", line);
        push("num", s.charCodeAt(0), { f: false });
        i = j + 1;
        continue;
      }
      const two = text.slice(i, i + 2);
      if (OPS2.includes(two)) { push("op", two); i += 2; continue; }
      if ("+-*/%=<>!&(){}[];,?:".includes(c)) { push("op", c); i++; continue; }
      throw new CError(`Unexpected character '${c}'`, line);
    }
    tokens.push({ t: "eof", v: "end of file", line });
    return tokens;
  }

  class Parser {
    constructor(tokens) { this.tk = tokens; this.p = 0; }
    peek(o = 0) { return this.tk[Math.min(this.p + o, this.tk.length - 1)]; }
    next() { const t = this.peek(); if (this.p < this.tk.length - 1) this.p++; return t; }
    isOp(v, o = 0) { const t = this.peek(o); return t.t === "op" && t.v === v; }
    isId(v, o = 0) { const t = this.peek(o); return t.t === "id" && t.v === v; }
    isTypeWord(o = 0) { const t = this.peek(o); return t.t === "id" && TYPE_WORDS.has(t.v); }
    expectOp(v) {
      const t = this.peek();
      if (t.t === "op" && t.v === v) { this.next(); return t; }
      const where = v === ";" && this.p > 0 ? this.tk[this.p - 1].line : t.line;
      throw new CError(`Expected '${v}' but found '${t.v}'`, where);
    }

    parseProgram() {
      const globals = [];
      let main = null;
      while (this.peek().t !== "eof") {
        if (!this.isTypeWord()) throw new CError(`Unexpected '${this.peek().v}'`, this.peek().line);
        let k = 0;
        while (this.isTypeWord(k)) k++;
        const nameTok = this.peek(k);
        if (nameTok.t === "id" && this.isOp("(", k + 1)) {
          if (nameTok.v !== "main") throw new CError("Only the main() function is supported in this editor", nameTok.line);
          this.p += k + 1;
          this.expectOp("(");
          if (this.isId("void")) this.next();
          this.expectOp(")");
          main = this.parseBlock();
        } else {
          globals.push(this.parseDeclaration());
        }
      }
      if (!main) throw new CError("No main() function found");
      return { globals, main };
    }

    parseBlock() {
      const line = this.expectOp("{").line;
      const body = [];
      while (!this.isOp("}")) {
        if (this.peek().t === "eof") throw new CError("Missing closing '}'", line);
        body.push(this.parseStatement());
      }
      this.next();
      return { k: "block", body, line };
    }

    parseDeclaration() {
      const line = this.peek().line;
      let isFloat = false;
      let isChar = false;
      while (this.isTypeWord()) {
        const w = this.next().v;
        if (w === "float" || w === "double") isFloat = true;
        if (w === "char") isChar = true;
        if (w === "void") throw new CError("A variable cannot have type void", line);
      }
      const type = isFloat ? "float" : isChar ? "char" : "int";
      const decls = [];
      do {
        const nameTok = this.next();
        if (nameTok.t !== "id" || TYPE_WORDS.has(nameTok.v) || RESERVED.has(nameTok.v)) {
          throw new CError(`Expected a variable name but found '${nameTok.v}'`, nameTok.line);
        }
        let size = null;
        let init = null;
        if (this.isOp("[")) { this.next(); size = this.parseExpr(); this.expectOp("]"); }
        if (this.isOp("=")) {
          this.next();
          if (this.isOp("{")) {
            this.next();
            init = [];
            if (!this.isOp("}")) {
              do { init.push(this.parseAssign()); } while (this.isOp(",") && this.next());
            }
            this.expectOp("}");
          } else init = this.parseAssign();
        }
        decls.push({ name: nameTok.v, size, init, line: nameTok.line });
      } while (this.isOp(",") && this.next());
      this.expectOp(";");
      return { k: "decl", type, decls, line };
    }

    parseStatement() {
      const t = this.peek();
      const line = t.line;
      if (t.t === "op") {
        if (t.v === "{") return this.parseBlock();
        if (t.v === ";") { this.next(); return { k: "empty", line }; }
      }
      if (t.t === "id") {
        if (t.v === "if") {
          this.next(); this.expectOp("(");
          const cond = this.parseExpr();
          this.expectOp(")");
          const then = this.parseStatement();
          let els = null;
          if (this.isId("else")) { this.next(); els = this.parseStatement(); }
          return { k: "if", cond, then, els, line };
        }
        if (t.v === "while") {
          this.next(); this.expectOp("(");
          const cond = this.parseExpr();
          this.expectOp(")");
          return { k: "while", cond, body: this.parseStatement(), line };
        }
        if (t.v === "do") {
          this.next();
          const body = this.parseStatement();
          if (!this.isId("while")) throw new CError("Expected 'while' after the body of do", this.peek().line);
          this.next(); this.expectOp("(");
          const cond = this.parseExpr();
          this.expectOp(")"); this.expectOp(";");
          return { k: "do", cond, body, line };
        }
        if (t.v === "for") {
          this.next(); this.expectOp("(");
          let init = null;
          if (this.isOp(";")) this.next();
          else if (this.isTypeWord()) init = this.parseDeclaration();
          else { init = { k: "expr", expr: this.parseExpr(), line }; this.expectOp(";"); }
          let cond = null;
          if (!this.isOp(";")) cond = this.parseExpr();
          this.expectOp(";");
          let update = null;
          if (!this.isOp(")")) update = this.parseExpr();
          this.expectOp(")");
          return { k: "for", init, cond, update, body: this.parseStatement(), line };
        }
        if (t.v === "break" || t.v === "continue") {
          this.next(); this.expectOp(";");
          return { k: t.v, line };
        }
        if (t.v === "return") {
          this.next();
          let e = null;
          if (!this.isOp(";")) e = this.parseExpr();
          this.expectOp(";");
          return { k: "return", e, line };
        }
        if (TYPE_WORDS.has(t.v)) return this.parseDeclaration();
      }
      const expr = this.parseExpr();
      this.expectOp(";");
      return { k: "expr", expr, line };
    }

    parseExpr() { return this.parseAssign(); }

    parseAssign() {
      const left = this.parseTernary();
      const t = this.peek();
      if (t.t === "op" && ["=", "+=", "-=", "*=", "/=", "%="].includes(t.v)) {
        this.next();
        if (left.k !== "var" && left.k !== "index") throw new CError("The left side of an assignment must be a variable", t.line);
        return { k: "assign", op: t.v, target: left, value: this.parseAssign(), line: t.line };
      }
      return left;
    }

    parseTernary() {
      const cond = this.parseBinary(0);
      if (this.isOp("?")) {
        const line = this.next().line;
        const a = this.parseAssign();
        this.expectOp(":");
        const b = this.parseTernary();
        return { k: "cond", cond, a, b, line };
      }
      return cond;
    }

    parseBinary(level) {
      if (level >= BIN_LEVELS.length) return this.parseUnary();
      let left = this.parseBinary(level + 1);
      while (this.peek().t === "op" && BIN_LEVELS[level].includes(this.peek().v)) {
        const op = this.next();
        left = { k: "bin", op: op.v, l: left, r: this.parseBinary(level + 1), line: op.line };
      }
      return left;
    }

    parseUnary() {
      const t = this.peek();
      if (t.t === "op") {
        if (t.v === "-" || t.v === "+" || t.v === "!") {
          this.next();
          return { k: "un", op: t.v, e: this.parseUnary(), line: t.line };
        }
        if (t.v === "++" || t.v === "--") {
          this.next();
          const e = this.parseUnary();
          if (e.k !== "var" && e.k !== "index") throw new CError(`${t.v} needs a variable`, t.line);
          return { k: "incdec", op: t.v, prefix: true, target: e, line: t.line };
        }
        if (t.v === "&") {
          this.next();
          const e = this.parseUnary();
          if (e.k !== "var" && e.k !== "index") throw new CError("& needs a variable", t.line);
          return { k: "addr", target: e, line: t.line };
        }
        if (t.v === "(" && this.isTypeWord(1) && !this.isId("void", 1)) {
          this.next();
          let isFloat = false;
          let isChar = false;
          while (this.isTypeWord()) {
            const w = this.next().v;
            if (w === "float" || w === "double") isFloat = true;
            if (w === "char") isChar = true;
          }
          this.expectOp(")");
          return { k: "cast", type: isFloat ? "float" : isChar ? "char" : "int", e: this.parseUnary(), line: t.line };
        }
      }
      return this.parsePostfix();
    }

    parsePostfix() {
      let e = this.parsePrimary();
      while (this.peek().t === "op" && (this.peek().v === "++" || this.peek().v === "--")) {
        const op = this.next();
        if (e.k !== "var" && e.k !== "index") throw new CError(`${op.v} needs a variable`, op.line);
        e = { k: "incdec", op: op.v, prefix: false, target: e, line: op.line };
      }
      return e;
    }

    parsePrimary() {
      const t = this.next();
      if (t.t === "num") return { k: "num", v: t.v, f: t.f, line: t.line };
      if (t.t === "str") return { k: "str", v: t.v, line: t.line };
      if (t.t === "id") {
        if (TYPE_WORDS.has(t.v) || RESERVED.has(t.v)) throw new CError(`Unexpected '${t.v}'`, t.line);
        if (this.isOp("(")) {
          this.next();
          const args = [];
          if (!this.isOp(")")) {
            do { args.push(this.parseAssign()); } while (this.isOp(",") && this.next());
          }
          this.expectOp(")");
          return { k: "call", name: t.v, args, line: t.line };
        }
        if (this.isOp("[")) {
          this.next();
          const idx = this.parseExpr();
          this.expectOp("]");
          return { k: "index", name: t.v, idx, line: t.line };
        }
        return { k: "var", name: t.v, line: t.line };
      }
      if (t.t === "op" && t.v === "(") {
        const e = this.parseExpr();
        this.expectOp(")");
        return e;
      }
      throw new CError(`Unexpected '${t.v}'`, t.line);
    }
  }

  const coerce = (type, v) => {
    if (type === "float") return v;
    if (type === "char") return (Math.trunc(v) << 24) >> 24;
    return Math.trunc(v) | 0;
  };

  function arith(op, a, b, line) {
    if (a.s || b.s) throw new CError("A string cannot be used in a calculation", line);
    const f = a.f || b.f;
    switch (op) {
      case "+": return f ? { v: a.v + b.v, f } : { v: (a.v + b.v) | 0, f };
      case "-": return f ? { v: a.v - b.v, f } : { v: (a.v - b.v) | 0, f };
      case "*": return f ? { v: a.v * b.v, f } : { v: Math.imul(a.v, b.v), f };
      case "/":
        if (!f && b.v === 0) throw new CError("Division by zero", line);
        return f ? { v: a.v / b.v, f } : { v: Math.trunc(a.v / b.v) | 0, f };
      case "%":
        if (f) throw new CError("The % operator needs integer operands", line);
        if (b.v === 0) throw new CError("Division by zero", line);
        return { v: (a.v % b.v) | 0, f: false };
      case "==": return { v: a.v === b.v ? 1 : 0, f: false };
      case "!=": return { v: a.v !== b.v ? 1 : 0, f: false };
      case "<": return { v: a.v < b.v ? 1 : 0, f: false };
      case ">": return { v: a.v > b.v ? 1 : 0, f: false };
      case "<=": return { v: a.v <= b.v ? 1 : 0, f: false };
      case ">=": return { v: a.v >= b.v ? 1 : 0, f: false };
    }
    throw new CError(`Unsupported operator ${op}`, line);
  }

  function formatNumberC(x, digits) {
    if (Number.isNaN(x)) return "nan";
    if (!Number.isFinite(x)) return x < 0 ? "-inf" : "inf";
    return x.toFixed(digits);
  }

  function formatPrintf(fmt, args, line) {
    let ai = 0;
    return fmt.replace(/%([-0 +]*)(\d+)?(?:\.(\d+))?(?:ll|l|h)?([diufcsxX%])/g, (m, flags, width, prec, conv) => {
      if (conv === "%") return "%";
      if (ai >= args.length) throw new CError("printf has more format specifiers than values", line);
      const a = args[ai++];
      let s;
      if (conv === "s") {
        if (!a.s) throw new CError("%s needs a string in quotes in this editor", line);
        s = prec === undefined ? a.v : a.v.slice(0, Number(prec));
      } else {
        if (a.s) throw new CError(`%${conv} needs a number, not a string`, line);
        if (conv === "d" || conv === "i" || conv === "u") s = String(Math.trunc(a.v));
        else if (conv === "f") s = formatNumberC(a.v, prec === undefined ? 6 : Number(prec));
        else if (conv === "c") s = String.fromCharCode(a.v);
        else s = (a.v >>> 0).toString(16)[conv === "X" ? "toUpperCase" : "toString"]();
      }
      if (flags.includes("+") && (conv === "d" || conv === "i" || conv === "f") && a.v >= 0) s = "+" + s;
      if (width && s.length < Number(width)) {
        const w = Number(width);
        if (flags.includes("-")) s = s.padEnd(w);
        else if (flags.includes("0") && conv !== "s" && conv !== "c") {
          const sign = s[0] === "-" || s[0] === "+" ? s[0] : "";
          s = sign + s.slice(sign.length).padStart(w - sign.length, "0");
        } else s = s.padStart(w);
      }
      return s;
    });
  }

  function runC(source, stdin = "", options = {}) {
    const maxSteps = options.maxSteps || 200000;
    const maxOutput = options.maxOutput || 20000;
    let output = "";
    let steps = 0;
    try {
      const { text, defines } = preprocess(source);
      const program = new Parser(tokenize(text, defines)).parseProgram();

      const inputTokens = String(stdin).split(/\s+/).filter(Boolean);
      let inputPos = 0;
      const scopes = [new Map()];

      const write = s => {
        output += s;
        if (output.length > maxOutput) throw new CError("Output limit reached; the program printed too much");
      };
      const tick = () => {
        if (++steps > maxSteps) throw new CError("The program was stopped after too many steps. Is there an infinite loop?");
      };
      const lookup = node => {
        for (let i = scopes.length - 1; i >= 0; i--) {
          const cell = scopes[i].get(node.name);
          if (cell) return cell;
        }
        throw new CError(`'${node.name}' is used but was not declared`, node.line);
      };
      const resolve = node => {
        const cell = lookup(node);
        if (node.k === "var") {
          if (cell.a) throw new CError(`'${node.name}' is an array; write ${node.name}[index]`, node.line);
          return { type: cell.type, get: () => cell.v, set: v => { cell.v = v; } };
        }
        if (!cell.a) throw new CError(`'${node.name}' is not an array`, node.line);
        const idx = ev(node.idx);
        if (idx.f || idx.s) throw new CError("An array index must be an integer", node.line);
        if (idx.v < 0 || idx.v >= cell.a.length) throw new CError(`Index ${idx.v} is outside the array '${node.name}' (size ${cell.a.length})`, node.line);
        return { type: cell.type, get: () => cell.a[idx.v], set: v => { cell.a[idx.v] = v; } };
      };

      const ev = n => {
        switch (n.k) {
          case "num": return { v: n.v, f: n.f };
          case "str": return { v: n.v, f: false, s: true };
          case "var":
          case "index": {
            const ref = resolve(n);
            return { v: ref.get(), f: ref.type === "float" };
          }
          case "un": {
            const x = ev(n.e);
            if (x.s) throw new CError("A string cannot be used in a calculation", n.line);
            if (n.op === "!") return { v: x.v ? 0 : 1, f: false };
            if (n.op === "-") return { v: x.f ? -x.v : (-x.v) | 0, f: x.f };
            return x;
          }
          case "bin": {
            if (n.op === "&&") return { v: ev(n.l).v && ev(n.r).v ? 1 : 0, f: false };
            if (n.op === "||") return { v: ev(n.l).v || ev(n.r).v ? 1 : 0, f: false };
            return arith(n.op, ev(n.l), ev(n.r), n.line);
          }
          case "assign": {
            const ref = resolve(n.target);
            let val = ev(n.value);
            if (val.s) throw new CError("Strings cannot be stored in this editor's variables", n.line);
            if (n.op !== "=") val = arith(n.op[0], { v: ref.get(), f: ref.type === "float" }, val, n.line);
            const stored = coerce(ref.type, val.v);
            ref.set(stored);
            return { v: stored, f: ref.type === "float" };
          }
          case "incdec": {
            const ref = resolve(n.target);
            const old = ref.get();
            const updated = coerce(ref.type, n.op === "++" ? old + 1 : old - 1);
            ref.set(updated);
            return { v: n.prefix ? updated : old, f: ref.type === "float" };
          }
          case "cond": return ev(n.cond).v ? ev(n.a) : ev(n.b);
          case "cast": {
            const x = ev(n.e);
            if (x.s) throw new CError("A string cannot be converted to a number", n.line);
            return { v: coerce(n.type, x.v), f: n.type === "float" };
          }
          case "addr": throw new CError("& can only be used with scanf in this editor", n.line);
          case "call": return call(n);
        }
        throw new CError("Unsupported expression", n.line);
      };

      const call = n => {
        const args = () => n.args.map(ev);
        switch (n.name) {
          case "printf": {
            if (!n.args.length || n.args[0].k !== "str") throw new CError("printf needs a format string in quotes first", n.line);
            const [fmt, ...rest] = args();
            write(formatPrintf(fmt.v, rest, n.line));
            return { v: 0, f: false };
          }
          case "puts": {
            const [s] = args();
            if (!s || !s.s) throw new CError("puts needs a string in quotes", n.line);
            write(s.v + "\n");
            return { v: 0, f: false };
          }
          case "putchar": {
            const [c] = args();
            write(String.fromCharCode(c.v));
            return { v: c.v, f: false };
          }
          case "scanf": {
            if (!n.args.length || n.args[0].k !== "str") throw new CError("scanf needs a format string in quotes first", n.line);
            const specs = [...n.args[0].v.matchAll(/%(l?[dif]|c)/g)].map(m => m[1].replace("l", ""));
            let count = 0;
            for (let i = 0; i < specs.length; i++) {
              const target = n.args[i + 1];
              if (!target || target.k !== "addr") throw new CError("scanf needs &variable for each value to read", n.line);
              if (inputPos >= inputTokens.length) break;
              const ref = resolve(target.target);
              if (specs[i] === "c") {
                const token = inputTokens[inputPos];
                ref.set(coerce(ref.type, token.charCodeAt(0)));
                if (token.length > 1) inputTokens[inputPos] = token.slice(1); else inputPos++;
                count++;
              } else {
                const token = inputTokens[inputPos];
                const num = Number(token);
                if (Number.isNaN(num)) break;
                inputPos++;
                ref.set(coerce(ref.type, specs[i] === "f" ? num : Math.trunc(num)));
                count++;
              }
            }
            return { v: count, f: false };
          }
          case "abs": { const [x] = args(); return { v: Math.abs(Math.trunc(x.v)) | 0, f: false }; }
          case "fabs": { const [x] = args(); return { v: Math.abs(x.v), f: true }; }
          case "sqrt": { const [x] = args(); return { v: Math.sqrt(x.v), f: true }; }
          case "pow": { const [x, y] = args(); return { v: Math.pow(x.v, y.v), f: true }; }
          case "floor": { const [x] = args(); return { v: Math.floor(x.v), f: true }; }
          case "ceil": { const [x] = args(); return { v: Math.ceil(x.v), f: true }; }
          case "round": { const [x] = args(); return { v: Math.sign(x.v) * Math.round(Math.abs(x.v)), f: true }; }
        }
        throw new CError(`The function '${n.name}' is not available in this editor`, n.line);
      };

      const declare = s => {
        const scope = scopes[scopes.length - 1];
        for (const d of s.decls) {
          if (scope.has(d.name)) throw new CError(`'${d.name}' is already declared in this block`, d.line);
          if (d.size) {
            const size = ev(d.size);
            if (size.f || size.v < 1 || size.v > 10000) throw new CError("An array size must be an integer between 1 and 10000", d.line);
            const a = new Array(size.v).fill(0);
            if (Array.isArray(d.init)) {
              if (d.init.length > size.v) throw new CError("Too many values for this array", d.line);
              d.init.forEach((e, i) => { a[i] = coerce(s.type, ev(e).v); });
            }
            scope.set(d.name, { type: s.type, a });
          } else {
            let v = 0;
            if (d.init) {
              if (Array.isArray(d.init)) throw new CError("A single variable cannot be initialised with a list", d.line);
              const x = ev(d.init);
              if (x.s) throw new CError("Strings cannot be stored in this editor's variables", d.line);
              v = coerce(s.type, x.v);
            }
            scope.set(d.name, { type: s.type, v });
          }
        }
      };

      // Returns undefined, or "break" | "continue" | "return".
      const exec = s => {
        tick();
        switch (s.k) {
          case "decl": declare(s); return undefined;
          case "expr": ev(s.expr); return undefined;
          case "empty": return undefined;
          case "break": return "break";
          case "continue": return "continue";
          case "return": if (s.e) ev(s.e); return "return";
          case "block": {
            scopes.push(new Map());
            try {
              for (const st of s.body) {
                const r = exec(st);
                if (r) return r;
              }
            } finally { scopes.pop(); }
            return undefined;
          }
          case "if": {
            if (ev(s.cond).v) return exec(s.then);
            return s.els ? exec(s.els) : undefined;
          }
          case "while": {
            while (ev(s.cond).v) {
              const r = exec(s.body);
              if (r === "break") break;
              if (r === "return") return r;
              tick();
            }
            return undefined;
          }
          case "do": {
            do {
              const r = exec(s.body);
              if (r === "break") break;
              if (r === "return") return r;
              tick();
            } while (ev(s.cond).v);
            return undefined;
          }
          case "for": {
            scopes.push(new Map());
            try {
              if (s.init) exec(s.init);
              while (!s.cond || ev(s.cond).v) {
                const r = exec(s.body);
                if (r === "break") break;
                if (r === "return") return r;
                if (s.update) ev(s.update);
                tick();
              }
            } finally { scopes.pop(); }
            return undefined;
          }
        }
        throw new CError("Unsupported statement", s.line);
      };

      program.globals.forEach(declare);
      exec(program.main);
      return { ok: true, output, error: null, steps };
    } catch (e) {
      if (e instanceof CError) return { ok: false, output, error: e.message, steps };
      return { ok: false, output, error: `Internal error: ${e.message}`, steps };
    }
  }

  /* ---------------------------------------------------------------- *
   *  Trace Lab programs (pseudocode in the style of the course)
   * ---------------------------------------------------------------- */
  const END = -1;
  const read = (...names) => (v, io) => { names.forEach(name => { v[name] = io.inputs[name]; }); };
  const print = (...names) => (v, io) => { io.out.push(names.map(name => fmtNum(v[name])).join(", ")); };
  const nop = () => undefined;

  function fmtNum(x) {
    if (x === undefined) return "—";
    if (typeof x !== "number") return String(x);
    return Number.isInteger(x) ? String(x) : String(parseFloat(x.toFixed(4)));
  }

  const TRACE_PROGRAMS = {
    swap: {
      id: "swap", title: "Swap two variables", inputs: [{ name: "a", min: -20, max: 99 }, { name: "b", min: -20, max: 99 }],
      vars: ["a", "b", "tmp"], answers: ["a", "b"],
      steps: [
        ["Read(a, b)", read("a", "b")],
        ["tmp ← a", v => { v.tmp = v.a; }],
        ["a ← b", v => { v.a = v.b; }],
        ["b ← tmp", v => { v.b = v.tmp; }],
        ["Print(a, b)", print("a", "b")]
      ]
    },
    avg: {
      id: "avg", title: "Average of two numbers", inputs: [{ name: "a", min: 0, max: 40 }, { name: "b", min: 0, max: 40 }],
      vars: ["a", "b", "s", "m"], answers: ["s", "m"],
      steps: [
        ["Read(a, b)", read("a", "b")],
        ["s ← a + b", v => { v.s = v.a + v.b; }],
        ["m ← s / 2", v => { v.m = v.s / 2; }],
        ["Print(m)", print("m")]
      ]
    },
    rect: {
      id: "rect", title: "Perimeter and area of a rectangle", inputs: [{ name: "L", min: 2, max: 20 }, { name: "W", min: 2, max: 20 }],
      vars: ["L", "W", "P", "S"], answers: ["P", "S"],
      steps: [
        ["Read(L, W)", read("L", "W")],
        ["P ← 2 * (L + W)", v => { v.P = 2 * (v.L + v.W); }],
        ["S ← L * W", v => { v.S = v.L * v.W; }],
        ["Print(P, S)", print("P", "S")]
      ]
    },
    incr: {
      id: "incr", title: "Assignment and increment", inputs: [{ name: "a", min: 1, max: 30 }],
      vars: ["a", "x", "y"], answers: ["x", "y"],
      steps: [
        ["Read(a)", read("a")],
        ["x ← a", v => { v.x = v.a; }],
        ["x ← x + 3", v => { v.x = v.x + 3; }],
        ["x ← x * 2", v => { v.x = v.x * 2; }],
        ["y ← x - a", v => { v.y = v.x - v.a; }],
        ["Print(x, y)", print("x", "y")]
      ]
    },
    max3: {
      id: "max3", title: "Maximum of three numbers", inputs: [{ name: "a", min: -20, max: 99 }, { name: "b", min: -20, max: 99 }, { name: "c", min: -20, max: 99 }],
      vars: ["a", "b", "c", "max"], answers: ["max"],
      steps: [
        ["Read(a, b, c)", read("a", "b", "c")],
        ["max ← a", v => { v.max = v.a; }],
        ["if (b > max) then", v => (v.b > v.max ? undefined : 4)],
        ["    max ← b", v => { v.max = v.b; }],
        ["end if", nop],
        ["if (c > max) then", v => (v.c > v.max ? undefined : 7)],
        ["    max ← c", v => { v.max = v.c; }],
        ["end if", nop],
        ["Print(max)", print("max")]
      ]
    },
    abs: {
      id: "abs", title: "Absolute value", inputs: [{ name: "x", min: -50, max: 50 }],
      vars: ["x", "y"], answers: ["y"],
      steps: [
        ["Read(x)", read("x")],
        ["if (x < 0) then", v => (v.x < 0 ? undefined : 4)],
        ["    y ← -x", v => { v.y = -v.x; return 5; }],
        ["else", () => 5],
        ["    y ← x", v => { v.y = v.x; }],
        ["end if", nop],
        ["Print(y)", print("y")]
      ]
    },
    countpos: {
      id: "countpos", title: "Count the positive numbers", inputs: [{ name: "a", min: -9, max: 9 }, { name: "b", min: -9, max: 9 }, { name: "c", min: -9, max: 9 }],
      vars: ["a", "b", "c", "cnt"], answers: ["cnt"],
      steps: [
        ["Read(a, b, c)", read("a", "b", "c")],
        ["cnt ← 0", v => { v.cnt = 0; }],
        ["if (a > 0) then", v => (v.a > 0 ? undefined : 4)],
        ["    cnt ← cnt + 1", v => { v.cnt += 1; }],
        ["end if", nop],
        ["if (b > 0) then", v => (v.b > 0 ? undefined : 7)],
        ["    cnt ← cnt + 1", v => { v.cnt += 1; }],
        ["end if", nop],
        ["if (c > 0) then", v => (v.c > 0 ? undefined : 10)],
        ["    cnt ← cnt + 1", v => { v.cnt += 1; }],
        ["end if", nop],
        ["Print(cnt)", print("cnt")]
      ]
    },
    sum: {
      id: "sum", title: "Sum of the first n integers", inputs: [{ name: "n", min: 3, max: 9 }],
      vars: ["n", "s", "i"], answers: ["s"],
      steps: [
        ["Read(n)", read("n")],
        ["s ← 0", v => { v.s = 0; }],
        ["i ← 1", v => { v.i = 1; }],
        ["while (i ≤ n) do", v => (v.i <= v.n ? undefined : 7)],
        ["    s ← s + i", v => { v.s += v.i; }],
        ["    i ← i + 1", v => { v.i += 1; }],
        ["end while", () => 3],
        ["Print(s)", print("s")]
      ]
    },
    fact: {
      id: "fact", title: "Factorial of n", inputs: [{ name: "n", min: 2, max: 6 }],
      vars: ["n", "f", "i"], answers: ["f"],
      steps: [
        ["Read(n)", read("n")],
        ["f ← 1", v => { v.f = 1; }],
        ["i ← 2", v => { v.i = 2; }],
        ["while (i ≤ n) do", v => (v.i <= v.n ? undefined : 7)],
        ["    f ← f * i", v => { v.f *= v.i; }],
        ["    i ← i + 1", v => { v.i += 1; }],
        ["end while", () => 3],
        ["Print(f)", print("f")]
      ]
    },
    gcd: {
      id: "gcd", title: "Greatest common divisor (Euclid)", inputs: [{ name: "a", min: 6, max: 60 }, { name: "b", min: 6, max: 60 }],
      vars: ["a", "b", "r"], answers: ["a"],
      steps: [
        ["Read(a, b)", read("a", "b")],
        ["while (b ≠ 0) do", v => (v.b !== 0 ? undefined : 6)],
        ["    r ← a mod b", v => { v.r = v.a % v.b; }],
        ["    a ← b", v => { v.a = v.b; }],
        ["    b ← r", v => { v.b = v.r; }],
        ["end while", () => 1],
        ["Print(a)", print("a")]
      ]
    },
    digits: {
      id: "digits", title: "Sum of the digits of n", inputs: [{ name: "n", min: 100, max: 9999 }],
      vars: ["n", "s"], answers: ["s"],
      steps: [
        ["Read(n)", read("n")],
        ["s ← 0", v => { v.s = 0; }],
        ["while (n > 0) do", v => (v.n > 0 ? undefined : 6)],
        ["    s ← s + (n mod 10)", v => { v.s += v.n % 10; }],
        ["    n ← n div 10", v => { v.n = Math.floor(v.n / 10); }],
        ["end while", () => 2],
        ["Print(s)", print("s")]
      ]
    }
  };
  Object.values(TRACE_PROGRAMS).forEach(p => {
    p.lines = p.steps.map(s => s[0]);
    p.ops = p.steps.map(s => s[1]);
  });

  /** Runs a trace program. frames[k] is the state after k executed lines. */
  function runTrace(program, inputs, maxSteps = 400) {
    const v = {};
    const out = [];
    const io = { inputs, out };
    const frames = [{ next: 0, executed: null, vars: {}, out: [] }];
    let pc = 0;
    let truncated = false;
    while (pc !== null) {
      if (frames.length > maxSteps) { truncated = true; break; }
      const r = program.ops[pc](v, io);
      const executed = pc;
      pc = r === undefined ? pc + 1 : r;
      if (pc === END || pc >= program.ops.length) pc = null;
      frames.push({ next: pc, executed, vars: { ...v }, out: [...out] });
    }
    return { frames, truncated };
  }

  /* ---------------------------------------------------------------- *
   *  Tracks, levels, XP and ranks
   * ---------------------------------------------------------------- */
  const LEVEL_XP = 100;
  const TRACKS = {
    trace: {
      id: "trace", name: "Trace Lab", icon: "◎", tagline: "Follow an algorithm line by line",
      blurb: "Step through pseudocode, watch every variable change, then predict the result yourself.",
      levels: [
        { n: 1, name: "Sequential Starter", desc: "Assignments and arithmetic, one instruction after another.", programs: ["swap", "avg", "rect", "incr"] },
        { n: 2, name: "Decision Maker", desc: "Conditions: follow the branch that the data selects.", programs: ["max3", "abs", "countpos"] },
        { n: 3, name: "Loop Runner", desc: "Repeat instructions until a condition stops them.", programs: ["sum", "fact", "gcd", "digits"] }
      ]
    },
    exam: {
      id: "exam", name: "Exam Bank", icon: "✦", tagline: "Exam-style questions with a score",
      blurb: "Eight random questions per attempt. Score 70% or more to clear the level.",
      levels: [
        { n: 1, name: "Foundations", desc: "Computers, information processing and what an algorithm is." },
        { n: 2, name: "Pseudocode & Variables", desc: "Assignments, variables, constants and sequential algorithms." },
        { n: 3, name: "C Essentials", desc: "Syntax, operators, input/output and the compiler." }
      ]
    },
    clab: {
      id: "clab", name: "C Lab", icon: "‹/›", tagline: "Write C and run it in your browser",
      blurb: "A small C editor that runs your program on the page. Pass every test to clear a level.",
      levels: [
        { n: 1, name: "Hello, C", desc: "Your first program: print a message." },
        { n: 2, name: "Rectangle", desc: "Read two numbers and compute a perimeter and an area." },
        { n: 3, name: "Decisions", desc: "Turn the maximum-of-three algorithm into a C program." }
      ]
    }
  };
  const TRACK_ORDER = ["trace", "exam", "clab"];
  const LEVEL_COUNT = TRACK_ORDER.reduce((sum, id) => sum + TRACKS[id].levels.length, 0);
  const levelId = (trackId, n) => `${trackId}-${n}`;

  const RANKS = [
    { xp: 0, name: "Newcomer" },
    { xp: 100, name: "Apprentice" },
    { xp: 300, name: "Explorer" },
    { xp: 500, name: "Builder" },
    { xp: 700, name: "Algorithmist" },
    { xp: 900, name: "ADS1 Master" }
  ];
  function rankFor(xp) {
    let index = 0;
    RANKS.forEach((r, i) => { if (xp >= r.xp) index = i; });
    const next = RANKS[index + 1] || null;
    return { index, name: RANKS[index].name, next, toNext: next ? next.xp - xp : 0 };
  }

  /* ---------------------------------------------------------------- *
   *  Random helpers and trace challenges
   * ---------------------------------------------------------------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomInputs(program, rng) {
    const inputs = {};
    program.inputs.forEach(def => { inputs[def.name] = randInt(rng, def.min, def.max); });
    if (program.id === "gcd" && inputs.a === inputs.b) inputs.b = inputs.a > 30 ? inputs.a - 5 : inputs.a + 5;
    return inputs;
  }
  function finalVars(program, inputs) {
    const { frames } = runTrace(program, inputs);
    return frames[frames.length - 1].vars;
  }

  function makeTraceChallenge(levelNumber, rng = Math.random, count = 3) {
    const ids = TRACKS.trace.levels[levelNumber - 1].programs;
    const order = shuffle(ids, rng);
    const items = [];
    for (let i = 0; i < count; i++) {
      const program = TRACE_PROGRAMS[order[i % order.length]];
      const inputs = randomInputs(program, rng);
      const varName = program.answers[randInt(rng, 0, program.answers.length - 1)];
      items.push({ programId: program.id, inputs, varName, expected: finalVars(program, inputs)[varName] });
    }
    return items;
  }
  function gradeNumber(given, expected) {
    const text = String(given ?? "").trim().replace(",", ".");
    if (text === "" || Number.isNaN(Number(text))) return false;
    return Math.abs(Number(text) - expected) < 0.011;
  }

  /* ---------------------------------------------------------------- *
   *  Exam bank
   * ---------------------------------------------------------------- */
  const Q = (q, a, w, why) => ({ q, a, w, why });
  const EXAM_BANK = {
    1: [
      Q("Which component executes the instructions of a program?", "The processor (CPU)", ["The hard disk", "The monitor", "The keyboard"], "The CPU fetches, decodes and executes instructions."),
      Q("What is the correct order of the information processing cycle?", "Input → Processing → Output", ["Output → Processing → Input", "Processing → Input → Output", "Input → Output → Processing"], "Data enters the computer, is processed, and the results come out; storage supports every stage."),
      Q("Which of these is an input device?", "Keyboard", ["Printer", "Monitor", "Speaker"], "A keyboard sends data to the computer; the others show or print results."),
      Q("Which of these is an output device?", "Monitor", ["Keyboard", "Mouse", "Scanner"], "A monitor displays results coming from the computer."),
      Q("What is the main role of RAM?", "Temporarily holding the data and programs currently in use", ["Permanently storing all your files", "Executing the instructions", "Connecting the computer to the internet"], "RAM is fast working memory; its content is lost when the power is off."),
      Q("What is an algorithm?", "A finite sequence of well-defined steps that solves a problem", ["A program written in C", "A piece of computer hardware", "A file produced by a compiler"], "An algorithm describes the solution, independently of any language."),
      Q("Which of these is NOT a way to represent an algorithm?", "A compiled executable file", ["Natural language", "Pseudocode", "A flowchart"], "Algorithms are described in natural language, pseudocode or flowcharts. An executable is a program."),
      Q("What is the relationship between an algorithm and a program?", "A program implements an algorithm in a programming language", ["An algorithm is the machine code of a program", "They are exactly the same thing", "A program is always written before its algorithm"], "The algorithm is the plan; the program is its implementation."),
      Q("Which sequence leads from a problem to something a computer can run?", "Problem → Algorithm → Program → Executable", ["Problem → Program → Algorithm → Executable", "Algorithm → Problem → Executable → Program", "Program → Problem → Algorithm → Executable"], "You design the algorithm first, then write the program, then compile it."),
      Q("Which statement about algorithms is true?", "An algorithm does not depend on a particular programming language", ["An algorithm can only be written in C", "An algorithm is executed directly by the processor", "An algorithm must always contain a loop"], "The same algorithm can be implemented in C, Python, Java and others."),
      Q("What is a programming language?", "A formal set of rules (syntax and semantics) for writing programs", ["A spoken language used to explain algorithms", "A type of processor", "The list of devices connected to a computer"], "Syntax says how to write instructions; semantics says what they mean."),
      Q("What does a compiler do?", "Translates a whole source program into machine code", ["Types the program for you", "Finds the best algorithm automatically", "Stores the program in RAM permanently"], "The compiler turns source code into an executable program.")
    ],
    2: [
      Q("In pseudocode, what does x ← 5 do?", "Assigns the value 5 to the variable x", ["Compares x with 5", "Declares that x can never change", "Prints 5 on the screen"], "The arrow ← is the assignment operator."),
      Q("After x ← 5 and then x ← x + 2, what is the value of x?", "7", ["5", "2", "52"], "The right side is computed first (5 + 2), then stored in x."),
      Q("Which instruction increases i by one?", "i ← i + 1", ["i + 1 ← i", "i ← 1", "1 ← i + i"], "The new value of i is its old value plus one."),
      Q("What is a variable?", "A named memory location whose value can change", ["A value that can never change", "A type of loop", "A device that stores files"], "A variable has a name, a type and a value that may change during execution."),
      Q("What is a constant?", "A named value that does not change during execution", ["A variable that is always zero", "A value read from the keyboard", "An instruction that repeats"], "Constants keep the same value from start to end."),
      Q("What does Read(a) do?", "Gets a value from the user and stores it in a", ["Displays the value of a", "Sets a to zero", "Compares a with the keyboard"], "Read is the input instruction."),
      Q("What does Print(a * b) display when a = 3 and b = 4?", "12", ["7", "34", "a * b"], "The expression is evaluated first: 3 × 4 = 12."),
      Q("a ← 10, then a ← a - 4, then a ← a * 2. What is a?", "12", ["6", "20", "16"], "10 - 4 = 6, then 6 × 2 = 12."),
      Q("To swap the values of a and b you need…", "A temporary variable", ["Nothing: a ← b then b ← a is enough", "Two loops", "A constant"], "Without a temporary copy, a ← b would erase the old value of a."),
      Q("Which expression computes the average of a and b?", "(a + b) / 2", ["a + b / 2", "(a * b) / 2", "a / 2 + b / 2 + 1"], "Parentheses make the addition happen before the division."),
      Q("In a sequential algorithm, the instructions are executed…", "One after another, in the order written", ["In a random order", "Only if a condition is true", "Repeatedly until the user stops them"], "Sequential means each instruction runs once, in order."),
      Q("a = 3 and b = 9. m ← a, then if (b > m) then m ← b. What is m?", "9", ["3", "12", "6"], "9 is greater than 3, so m takes the value of b."),
      Q("Which type is the most appropriate to store the number 3.14?", "Real (decimal number)", ["Integer", "Character", "Boolean"], "Integers cannot hold a fractional part.")
    ],
    3: [
      Q("Which header file declares printf and scanf?", "<stdio.h>", ["<math.h>", "<string.h>", "<stdlib.h>"], "stdio.h is the standard input/output library."),
      Q("Where does the execution of a C program begin?", "In the main function", ["At the first #include line", "At the last line of the file", "In the function printf"], "Every C program starts in main()."),
      Q("What does printf(\"Hi\\n\"); do?", "Prints Hi and moves to a new line", ["Reads the word Hi", "Prints Hi\\n literally on the screen", "Does nothing: \\n is an error"], "\\n is the newline character."),
      Q("Which symbol ends a simple statement in C?", "A semicolon ;", ["A colon :", "A period .", "A comma ,"], "Each simple statement ends with ;"),
      Q("What is the value of x after int x = 7 / 2; ?", "3", ["3.5", "4", "2"], "Dividing two integers gives an integer: the decimal part is dropped."),
      Q("What is the result of 17 % 5 ?", "2", ["3", "3.4", "12"], "% gives the remainder of the division: 17 = 3 × 5 + 2."),
      Q("Which is the correct C instruction to store 5 in a?", "a = 5;", ["a ← 5;", "5 = a;", "a := 5;"], "C uses = for assignment."),
      Q("What is the difference between = and == in C?", "= assigns a value, == compares two values", ["= compares, == assigns", "They are the same", "== declares a variable"], "Using = inside a condition by mistake is a classic bug."),
      Q("Why is & used in scanf(\"%d\", &n); ?", "It gives scanf the address of n so it can store the value there", ["It prints n", "It multiplies n by itself", "It declares n as an integer"], "scanf must know where in memory to put the value."),
      Q("Which format specifier prints a float with printf?", "%f", ["%d", "%c", "%s"], "%d is for int, %c for a character, %s for a string."),
      Q("After int a = 5; a++; what is a?", "6", ["5", "4", "55"], "a++ increases a by one."),
      Q("What is the value of 7 / 2.0 in C?", "3.5", ["3", "4", "An error"], "If one operand is real, the division is a real division."),
      Q("Which line is a comment in C?", "// this is a comment", ["# this is a comment", "-- this is a comment", "<!-- this is a comment -->"], "// starts a comment that runs to the end of the line."),
      Q("What does the compiler produce from main.c?", "An executable program (machine code)", ["A new algorithm", "A PDF document", "A copy of main.c without comments"], "Compiling translates the source code into machine code.")
    ]
  };

  function makeExamAttempt(levelNumber, rng = Math.random, count = 8) {
    const pool = shuffle(EXAM_BANK[levelNumber], rng).slice(0, count);
    return pool.map(item => {
      const options = shuffle([{ text: item.a, ok: true }, ...item.w.map(text => ({ text, ok: false }))], rng);
      return { q: item.q, options: options.map(o => o.text), correct: options.findIndex(o => o.ok), why: item.why };
    });
  }
  function gradeExam(questions, answers) {
    const correct = questions.reduce((sum, q, i) => sum + (answers[i] === q.correct ? 1 : 0), 0);
    return { correct, total: questions.length, percent: questions.length ? Math.round(correct / questions.length * 100) : 0 };
  }
  const EXAM_PASS_PERCENT = 70;

  function dailyQuestion(dayNumber) {
    const all = [1, 2, 3].flatMap(level => EXAM_BANK[level]);
    const rng = mulberry32(dayNumber * 2654435761);
    const item = all[dayNumber % all.length];
    const options = shuffle([{ text: item.a, ok: true }, ...item.w.map(text => ({ text, ok: false }))], rng);
    return { q: item.q, options: options.map(o => o.text), correct: options.findIndex(o => o.ok), why: item.why };
  }

  /* ---------------------------------------------------------------- *
   *  C Lab
   * ---------------------------------------------------------------- */
  const STARTER = "#include <stdio.h>\n\nint main() {\n    // write your code here\n\n    return 0;\n}\n";
  const CLAB_LEVELS = {
    1: {
      statement: "Write a program that prints exactly this line: Hello, ADS1!",
      hint: "Use printf(\"...\\n\"); the \\n moves to a new line.",
      starter: STARTER,
      tests: [{ input: "", expected: "Hello, ADS1!" }]
    },
    2: {
      statement: "Read the length and the width of a rectangle (two integers). Print the perimeter on the first line and the area on the second line.",
      hint: "Use scanf(\"%d %d\", &L, &W); then perimeter = 2 * (L + W) and area = L * W.",
      starter: "#include <stdio.h>\n\nint main() {\n    int L, W;\n    // read L and W, then print the perimeter and the area\n\n    return 0;\n}\n",
      tests: [
        { input: "3 4", expected: "14\n12" },
        { input: "10 2", expected: "24\n20" },
        { input: "7 7", expected: "28\n49" }
      ]
    },
    3: {
      statement: "Read three integers a, b and c and print the largest one. This is the maximum-of-three algorithm from Chapter 1.",
      hint: "Start with max = a, then use two if statements to compare b and c with max.",
      starter: "#include <stdio.h>\n\nint main() {\n    int a, b, c, max;\n    // read a, b, c and print the largest\n\n    return 0;\n}\n",
      tests: [
        { input: "12 25 7", expected: "25" },
        { input: "9 3 6", expected: "9" },
        { input: "-4 -9 -1", expected: "-1" },
        { input: "5 5 5", expected: "5" }
      ]
    }
  };
  const normalizeOutput = text => String(text).replace(/\r/g, "").split("\n").map(line => line.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "").replace(/^\n+/, "");

  function checkCLab(levelNumber, source) {
    const level = CLAB_LEVELS[levelNumber];
    const results = level.tests.map(test => {
      const run = runC(source, test.input);
      const actual = normalizeOutput(run.output);
      return { input: test.input, expected: test.expected, actual, error: run.error, ok: run.ok && actual === normalizeOutput(test.expected) };
    });
    const passed = results.filter(r => r.ok).length;
    return { passed, total: results.length, results, allPassed: passed === results.length };
  }

  const C_EXAMPLES = [
    { name: "Hello, World", input: "", code: "#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}\n" },
    { name: "Sum of two numbers", input: "8 5", code: "#include <stdio.h>\n\nint main() {\n    int a, b, sum;\n    scanf(\"%d %d\", &a, &b);\n    sum = a + b;\n    printf(\"%d + %d = %d\\n\", a, b, sum);\n    return 0;\n}\n" },
    { name: "Average (real numbers)", input: "7 2", code: "#include <stdio.h>\n\nint main() {\n    int a, b;\n    float avg;\n    scanf(\"%d %d\", &a, &b);\n    avg = (a + b) / 2.0;\n    printf(\"Average = %.2f\\n\", avg);\n    return 0;\n}\n" },
    { name: "Maximum of three", input: "12 25 7", code: "#include <stdio.h>\n\nint main() {\n    int a, b, c, max;\n    scanf(\"%d %d %d\", &a, &b, &c);\n    max = a;\n    if (b > max) {\n        max = b;\n    }\n    if (c > max) {\n        max = c;\n    }\n    printf(\"Maximum = %d\\n\", max);\n    return 0;\n}\n" },
    { name: "Sum of 1 to n (loop)", input: "10", code: "#include <stdio.h>\n\nint main() {\n    int n, i, s = 0;\n    scanf(\"%d\", &n);\n    for (i = 1; i <= n; i++) {\n        s = s + i;\n    }\n    printf(\"Sum = %d\\n\", s);\n    return 0;\n}\n" },
    { name: "Multiplication table", input: "7", code: "#include <stdio.h>\n\nint main() {\n    int n, i;\n    scanf(\"%d\", &n);\n    for (i = 1; i <= 10; i++) {\n        printf(\"%d x %d = %d\\n\", n, i, n * i);\n    }\n    return 0;\n}\n" }
  ];

  const api = {
    runC, runTrace, fmtNum, TRACE_PROGRAMS, TRACKS, TRACK_ORDER, LEVEL_COUNT, LEVEL_XP, levelId,
    RANKS, rankFor, mulberry32, shuffle, makeTraceChallenge, gradeNumber,
    EXAM_BANK, EXAM_PASS_PERCENT, makeExamAttempt, gradeExam, dailyQuestion,
    CLAB_LEVELS, checkCLab, C_EXAMPLES
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ADS1Arena = api;
})(typeof window !== "undefined" ? window : globalThis);

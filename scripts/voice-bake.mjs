#!/usr/bin/env node
/**
 * Ziggy's voice bank: every FIXED sentence the site reads aloud, recorded
 * offline in Ziggy's own voice (VOICES MAX GEN, `hv-tts`), so those sentences
 * never go to the server voice (/api/tts → Google) and always sound the same.
 *
 *   node scripts/voice-bake.mjs collect            # list the sentences (scripts/voice-bake/sentences.json)
 *   node scripts/voice-bake.mjs render [--limit N] # record what is missing → public/voice/{fr,en}/<id>.mp3
 *   node scripts/voice-bake.mjs manifest           # rewrite public/voice/manifest.json from the bank
 *   node scripts/voice-bake.mjs stats              # sizes and coverage
 *
 * collect — a static walk of the TypeScript program (the compiler API, no
 * running code). It starts at every read-aloud call (`<SayButton texts>`,
 * `useAutoSay`, `useSay()`'s function, `speak`, `speakSequence`) and follows
 * each argument back to its texts: `tr({ fr, en }, locale)` objects, next-intl
 * `t('key')` messages, constants, object properties (also through JSX props and
 * event payloads, by property symbol), helper functions (arguments bound to
 * parameters) and arrays. Anything built at run time (template strings with
 * values, concatenation, `fmt()` placeholders, AI replies, names) is skipped:
 * those sentences keep the current path (device voice when personal, server
 * voice otherwise). Each sentence gets a stable id: `clipId` of
 * src/lib/voice-key.ts (normalised text → 53-bit hash), the same function the
 * browser runs.
 *
 * render — incremental: a clip is recorded again only when its text or the
 * engine signature (hv-tts version + binary hash + voice options + encoder)
 * changes. WAVs are temporary (deleted after encoding, or kept outside the
 * repo with --wav-cache DIR). MP3 (ffmpeg + libmp3lame, build machine only,
 * never shipped): mono 24 kHz VBR quality 6 (measured on 60 clips: 10 %
 * smaller than q5 for 1.2 dB less SNR, ~11× smaller than 16-bit WAV), the
 * codec of the bedtime stories, played by every browser including old Safari
 * (Opus/WebM would be ~40 % smaller, but older iPads cannot play it).
 *
 * The bank (scripts/voice-bake/bank.json) records, per id: language, style,
 * text, duration, engine signature and QA verdict; `exclude.json` lists ids
 * left out after listening checks (they fall back to the current path).
 *
 * Environment: HV_TTS (the hv-tts binary), HV_TTS_CACHE (its model cache).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Worker, isMainThread } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning'); // Node's notice about type stripping
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const ts = require('typescript');
const { clipId, spokenText } = await import(path.join(ROOT, 'src/lib/voice-key.ts'));

const DIR = path.join(ROOT, 'scripts/voice-bake');
const SENTENCES = path.join(DIR, 'sentences.json');
const BANK = path.join(DIR, 'bank.json');
const EXCLUDE = path.join(DIR, 'exclude.json');
const ENGINES = path.join(DIR, 'engines.json');
const PUBLIC = path.join(ROOT, 'public/voice');
const MANIFEST = path.join(PUBLIC, 'manifest.json');
const EXT = 'mp3';
/** Longest sentence recorded (characters): longer texts are stories, kept on the existing path. */
const MAX_CHARS = 420;

const args = process.argv.slice(2);
const cmd = args[0] ?? 'stats';
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const readJson = (p, dflt) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return dflt;
  }
};
/** JSON with one record per line (lists and maps of records): compact, and diffs stay readable. */
const writeJson = (p, v, pretty = true) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  let out = JSON.stringify(v);
  if (pretty && Array.isArray(v)) out = `[\n${v.map((x) => JSON.stringify(x)).join(',\n')}\n]`;
  else if (pretty && v && typeof v === 'object') out = `{\n${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(',\n')}\n}`;
  fs.writeFileSync(p, out + '\n');
};

/* ───────────────────────────── collect ───────────────────────────── */

function collect() {
  const cfgPath = path.join(ROOT, 'tsconfig.json');
  const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, ROOT);
  const skip = (opt('exclude', '') || '').split(',').filter(Boolean);
  const files = cfg.fileNames.filter(
    (f) => f.includes('/src/') && !/\.(test|spec)\.tsx?$/.test(f) && !f.includes('/.next') && !skip.some((s) => f.includes(`/${s}`))
  );
  const program = ts.createProgram(files, { ...cfg.options, noEmit: true, incremental: false });
  const checker = program.getTypeChecker();
  const sources = program.getSourceFiles().filter((sf) => files.includes(path.resolve(sf.fileName)));

  const messages = { fr: readJson(path.join(ROOT, 'messages/fr.json'), {}), en: readJson(path.join(ROOT, 'messages/en.json'), {}) };
  const msgAt = (obj, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  const flatKeys = (obj, prefix = '') =>
    Object.entries(obj ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

  /* Syntactic indexes, built once. */
  const propsByName = new Map(); // name → PropertyAssignment | ShorthandPropertyAssignment | JsxAttribute
  const callsByName = new Map(); // callee (last) name → CallExpression
  const jsxByTag = new Map(); // tag name → JSX opening/self-closing element
  const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
  for (const sf of sources) {
    (function walk(n) {
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) push(propsByName, n.name.text, n);
      else if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name)) push(propsByName, n.name.text, n);
      else if (ts.isCallExpression(n)) {
        const c = n.expression;
        const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
        if (name) push(callsByName, name, n);
      } else if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) push(jsxByTag, n.tagName.getText(), n);
      ts.forEachChild(n, walk);
    })(sf);
  }

  const found = new Map(); // `${style}|${lang}|${text}` → { lang, style, text, sources:Set }
  const unresolved = new Map(); // where → count
  const dynamic = new Map();
  const where = (n) => {
    const sf = n.getSourceFile();
    return `${path.relative(ROOT, sf.fileName)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  };
  const bump = (m, n) => m.set(where(n), (m.get(where(n)) ?? 0) + 1);

  const symbolOf = (n) => {
    let s = checker.getSymbolAtLocation(n);
    if (s && s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
    return s;
  };
  const declsOf = (s) => (s ? s.declarations ?? [] : []);
  const strip = (e) => {
    while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(e)))) e = e.expression;
    return e;
  };
  const isStr = (e) => e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e));
  const pairOf = (obj) => {
    if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
    const p = {};
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop) && prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) && (prop.name.text === 'fr' || prop.name.text === 'en')) p[prop.name.text] = strip(prop.initializer);
    }
    return p.fr && p.en ? p : null;
  };

  /** Functions: the node that holds parameters, and how to find its call sites. */
  const fnName = (fn) => {
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) return { name: fn.name.getText(), node: fn.name };
    let p = fn.parent;
    // const f = useCallback((…) => …, deps) / memo(…)
    if (p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && /^(useCallback|useMemo|memo|forwardRef)$/.test(p.expression.text)) p = p.parent;
    if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return { name: p.name.text, node: p.name };
    if (p && (ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) && p.name) return { name: p.name.getText(), node: p.name };
    return null;
  };
  const returnsOf = (fn) => {
    if (!fn.body) return [];
    if (!ts.isBlock(fn.body)) return [fn.body];
    const out = [];
    (function walk(n) {
      if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
      if (ts.isFunctionLike(n) && n !== fn) return;
      ts.forEachChild(n, walk);
    })(fn.body);
    return out;
  };
  const sameDecl = (a, b) => {
    const da = declsOf(a);
    const db = declsOf(b);
    return da.some((d) => db.includes(d));
  };
  /** Values flowing into property symbol `sym` (object literals, JSX attributes typed by it). */
  const flowCache = new Map();
  const flowsInto = (sym) => {
    const ck = declsOf(sym)[0] ?? sym;
    if (!flowCache.has(ck)) flowCache.set(ck, flowsIntoUncached(sym));
    return flowCache.get(ck);
  };
  /** An untyped object literal that has every property of the type that declares `sym` (at least 3). */
  const shapeMatches = (obj, sym) => {
    const owner = sym.parent;
    const members = owner?.members ? [...owner.members.keys()].map(String) : [];
    if (members.length < 3) return false;
    const have = new Set(obj.properties.map((q) => q.name?.getText()).filter(Boolean));
    const required = members.filter((m) => !(owner.members.get(m).flags & ts.SymbolFlags.Optional));
    return required.length >= 3 && required.every((m) => have.has(m));
  };
  const flowsIntoUncached = (sym) => {
    const name = sym.getName();
    const out = [];
    for (const p of propsByName.get(name) ?? []) {
      let ps = null;
      if (ts.isJsxAttribute(p)) ps = symbolOf(p.name);
      else {
        const ctx = checker.getContextualType(p.parent);
        if (ctx) {
          for (const t of ctx.isUnion() ? ctx.types : [ctx]) {
            const s = checker.getPropertyOfType(t, name);
            if (s && sameDecl(s, sym)) {
              ps = s;
              break;
            }
          }
        }
        // e.g. built in a generic `.map(…)` callback: no usable contextual type, but the right shape.
        // Only for copied fields (`title: q.title`), where a wrong match costs nothing.
        const copied = ts.isPropertyAssignment(p) && ts.isPropertyAccessExpression(strip(p.initializer)) && strip(p.initializer).name.text === name;
        if (!ps && copied && shapeMatches(p.parent, sym)) ps = sym;
      }
      if (!ps || !sameDecl(ps, sym)) continue;
      if (ts.isJsxAttribute(p)) {
        if (p.initializer && ts.isJsxExpression(p.initializer) && p.initializer.expression) out.push(p.initializer.expression);
        else if (p.initializer && ts.isStringLiteral(p.initializer)) out.push(p.initializer);
      } else if (ts.isShorthandPropertyAssignment(p)) out.push(p.name);
      else out.push(p.initializer);
    }
    return out;
  };

  /**
   * Harvest the texts an expression can produce. `mode`: 'text' (a spoken
   * string), 'deep' (every { fr, en } inside a value: records, arrays of
   * records). `hint`: 'fr' | 'en' when a branch is known to be one language.
   */
  const MAX_DEPTH = 40;
  const done = new Set();
  const NO_ENV = new Map();
  function harvest(e, ctx) {
    const { depth = 0, env = new Map(), mode = 'text', hint = null, style, stack = new Set() } = ctx;
    e = strip(e);
    if (!e || depth > MAX_DEPTH) return;
    const key = `${e.pos}:${e.end}:${e.getSourceFile().fileName}:${mode}`;
    if (stack.has(key)) return;
    // Same expression, same mode, no bound arguments: its texts are already in `found`.
    const memo = `${key}:${hint}:${style}`;
    if (!env.size) {
      if (done.has(memo)) return;
      done.add(memo);
    }
    const next = (x, more = {}) => harvest(x, { depth: depth + 1, env, mode, hint, style, stack: new Set([...stack, key]), ...more });
    // Leaving this expression for a declaration elsewhere: bound arguments no longer apply.
    const jump = (x, more = {}) => next(x, { env: NO_ENV, ...more });
    const add = (lang, text, at) => {
      if (typeof text !== 'string' || !text.trim()) return;
      const k = `${style}|${lang}|${text}`;
      const rec = found.get(k) ?? found.set(k, { lang, style, text, sources: new Set(), entries: new Set() }).get(k);
      rec.sources.add(where(at));
      rec.entries.add(currentEntry);
    };
    const addPair = (p) => {
      for (const lang of hint ? [hint] : ['fr', 'en']) {
        const v = p[lang];
        if (isStr(v)) add(lang, v.text, v);
        else if (mode === 'text') next(v, { hint: lang });
      }
    };

    if (isStr(e)) {
      if (mode !== 'text') return;
      const t = e.text;
      // A bare string is a sentence only when it reads like one (not an id or a class name).
      if (!/\p{L}/u.test(t) || (!/\s/.test(t) && !/[.!?…]$/.test(t))) return;
      const lang = hint ?? guessLang(t);
      if (lang) add(lang, t, e);
      return;
    }
    if (ts.isTemplateExpression(e) || (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken)) return void bump(dynamic, e);
    if (ts.isConditionalExpression(e)) {
      const cond = e.condition.getText();
      const frTest = /locale\s*===\s*['"]fr['"]|lang\s*===\s*['"]fr['"]|\bisFr\b|\bfr\b\s*$/.test(cond);
      const enTest = /locale\s*===\s*['"]en['"]|lang\s*===\s*['"]en['"]/.test(cond);
      next(e.whenTrue, frTest ? { hint: 'fr' } : enTest ? { hint: 'en' } : {});
      next(e.whenFalse, frTest ? { hint: 'en' } : enTest ? { hint: 'fr' } : {});
      return;
    }
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind;
      if (k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.BarBarToken) {
        next(e.left);
        next(e.right);
      } else if (k === ts.SyntaxKind.AmpersandAmpersandToken) next(e.right);
      return;
    }
    if (ts.isArrayLiteralExpression(e)) {
      for (const el of e.elements) next(ts.isSpreadElement(el) ? el.expression : el);
      return;
    }
    if (ts.isObjectLiteralExpression(e)) {
      const p = pairOf(e);
      if (p) return addPair(p);
      if (mode === 'deep')
        for (const prop of e.properties) {
          if (ts.isPropertyAssignment(prop)) next(prop.initializer);
          else if (ts.isShorthandPropertyAssignment(prop)) next(prop.name);
          else if (ts.isSpreadAssignment(prop)) next(prop.expression);
        }
      return;
    }
    if (ts.isIdentifier(e)) {
      if (e.text === 'undefined') return;
      const s = symbolOf(e);
      if (!s) return void bump(unresolved, e);
      if (env.has(s)) return jump(env.get(s));
      const shorthand = ts.isShorthandPropertyAssignment(e.parent) ? checker.getShorthandAssignmentValueSymbol(e.parent) : null;
      const sym = shorthand ?? s;
      if (env.has(sym)) return jump(env.get(sym));
      let any = false;
      for (const d of declsOf(sym)) {
        if (ts.isVariableDeclaration(d)) {
          if (d.initializer) {
            any = true;
            jump(d.initializer);
          }
        } else if (ts.isBindingElement(d)) {
          any = true;
          harvestBinding(d, jump);
        } else if (ts.isParameter(d)) {
          any = true;
          harvestParam(d, jump);
        } else if (ts.isPropertyAssignment(d)) {
          any = true;
          jump(d.initializer);
        } else if (ts.isEnumMember(d) && d.initializer) {
          any = true;
          jump(d.initializer);
        }
      }
      if (!any) bump(unresolved, e);
      return;
    }
    if (ts.isPropertyAccessExpression(e)) {
      // `T.title`, `quest.intro`, `payload.lines`: every value written to that property.
      const s = symbolOf(e.name) ?? symbolOf(e);
      if (!s) return void bump(unresolved, e);
      if (['length'].includes(e.name.text)) return;
      // `l.fr` / `l.en`: one side of the texts `l` can hold (not every `fr` of the program).
      if (e.name.text === 'fr' || e.name.text === 'en') return next(e.expression, { hint: e.name.text });
      let any = false;
      for (const d of declsOf(s)) {
        if (ts.isPropertyAssignment(d)) {
          any = true;
          jump(d.initializer);
        } else if (ts.isShorthandPropertyAssignment(d)) {
          any = true;
          jump(d.name);
        } else if (ts.isPropertyDeclaration(d) && d.initializer) {
          any = true;
          jump(d.initializer);
        } else if (ts.isGetAccessorDeclaration(d)) {
          any = true;
          for (const r of returnsOf(d)) jump(r);
        }
      }
      if (!any || declsOf(s).some((d) => ts.isPropertySignature(d) || ts.isPropertyDeclaration(d))) {
        let flows = flowsInto(s);
        if (flows.length > 250) {
          // A property this generic says nothing about what is spoken.
          bump(unresolved, e);
          flows = [];
        }
        for (const f of flows) jump(f);
        if (!any && !flows.length) bump(unresolved, e);
      }
      return;
    }
    if (ts.isElementAccessExpression(e)) return next(e.expression, { mode: 'deep' });
    if (ts.isCallExpression(e)) return harvestCall(e, next, mode, hint, depth);
    if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return; // a callback, not a text
    bump(unresolved, e);
  }

  /** `const { title, text } = item` or `({ title }) =>` props: what flows into that property. */
  function harvestBinding(d, next) {
    const name = (d.propertyName ?? d.name).getText();
    const pattern = d.parent;
    // A component's props: the JSX attributes of that name, wherever the component is used.
    const holder = pattern.parent;
    const t = checker.getTypeAtLocation(pattern);
    const s = t && checker.getPropertyOfType(t, name);
    if (ts.isParameter(holder)) {
      const fn = holder.parent;
      const named = fnName(fn);
      if (named) {
        const target = symbolOf(named.node);
        for (const el of jsxByTag.get(named.name) ?? []) {
          if (!target || !sameDecl(symbolOf(el.tagName), target)) continue;
          for (const a of el.attributes.properties) {
            if (ts.isJsxAttribute(a) && a.name.getText() === name && a.initializer) next(ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer);
          }
        }
      }
    } else if (ts.isVariableDeclaration(holder) && holder.initializer && s) {
      for (const dd of declsOf(s)) if (ts.isPropertyAssignment(dd)) next(dd.initializer);
    }
    if (s) for (const f of flowsInto(s)) next(f);
  }

  /** A plain parameter: the matching argument at every call site of its function. */
  function harvestParam(d, next) {
    const fn = d.parent;
    const i = fn.parameters.indexOf(d);
    // `list.map((item) => …)`: the item is any element of the list.
    const call = fn.parent;
    if (i === 0 && call && ts.isCallExpression(call) && call.arguments[0] === fn && ts.isPropertyAccessExpression(call.expression) && /^(map|flatMap|forEach|filter|find|some|every)$/.test(call.expression.name.text)) return next(call.expression.expression, { mode: 'deep' });
    const named = fnName(fn);
    if (!named) return;
    const target = symbolOf(named.node);
    for (const call of callsByName.get(named.name) ?? []) {
      const callee = ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression;
      if (!target || !sameDecl(symbolOf(callee), target)) continue;
      if (d.dotDotDotToken) for (const a of call.arguments.slice(i)) next(a);
      else if (call.arguments[i]) next(call.arguments[i]);
    }
  }

  function harvestCall(e, next, mode, hint, depth = 0) {
    const c = strip(e.expression);
    const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : '';
    const recv = ts.isPropertyAccessExpression(c) ? c.expression : null;
    if (name === 'tr' || name === 'trAll' || name === 'trText') return next(e.arguments[0]);
    // Placeholder fillers: the template itself (dropped later if it has {placeholders}, kept when it has none).
    if (['fmt', 'fill', 'fillL'].includes(name)) return next(e.arguments[0]);
    if (['joinL', 'toString', 'join', 'toFixed', 'toLocaleString', 'String', 'Number'].includes(name)) return void bump(dynamic, e);
    if (recv && ['filter', 'slice', 'concat', 'flat', 'reverse', 'sort', 'toSorted', 'trim', 'trimEnd', 'trimStart'].includes(name)) {
      next(recv);
      if (name === 'concat') for (const a of e.arguments) next(a);
      return;
    }
    if (recv && name === 'replace') {
      // Only emoji clean-ups keep the sentence the same once normalised.
      if (/Pictographic|\\u\{?1F|️/.test(e.arguments[0]?.getText() ?? '')) return next(recv);
      // Typographic spaces (« Bravo ! » with no-break spaces): the bank key folds them away.
      const rep = strip(e.arguments[1]);
      if (rep && isStr(rep) && /^(?:[\s\u00a0\u202f«»]|\$\d|\$&)*$/.test(rep.text)) return next(recv);
      return void bump(dynamic, e);
    }
    if (recv && ['map', 'flatMap'].includes(name)) {
      const cb = strip(e.arguments[0]);
      if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) for (const r of returnsOf(cb)) next(r);
      else if (cb) next(cb);
      return;
    }
    if (recv && ['find', 'at', 'pop', 'shift'].includes(name)) return next(recv, { mode: 'deep' });
    // next-intl: t('key') with const t = useTranslations('ns').
    const s = ts.isIdentifier(c) ? symbolOf(c) : null;
    const decl = declsOf(s)[0];
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
      let init = strip(decl.initializer);
      if (ts.isAwaitExpression(init)) init = strip(init.expression);
      if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && /^(useTranslations|getTranslations)$/.test(init.expression.text)) {
        const a0 = init.arguments[0];
        const ns = a0 && isStr(a0) ? a0.text : a0 && ts.isObjectLiteralExpression(a0) ? (a0.properties.find((p) => p.name?.getText() === 'namespace')?.initializer?.text ?? '') : '';
        const k = strip(e.arguments[0]);
        if (e.arguments.length > 1) return void bump(dynamic, e); // values: {name}, {count}…
        const keys = isStr(k) ? [k.text] : ts.isTemplateExpression(k) ? flatKeys(ns ? msgAt(messages.en, ns) : messages.en).filter((x) => x.startsWith(k.head.text)) : [];
        if (!keys.length) return void bump(unresolved, e);
        for (const key of keys) {
          const full = ns ? `${ns}.${key}` : key;
          for (const lang of ['fr', 'en']) {
            const v = msgAt(messages[lang], full);
            if (typeof v === 'string' && !/[{<]/.test(v)) addFound(lang, v, e, currentStyle);
          }
        }
        return;
      }
    }
    // Any other function of the program: its return values, arguments bound to parameters.
    const target = ts.isPropertyAccessExpression(c) ? symbolOf(c.name) : symbolOf(c);
    let fns = declsOf(target).filter((d) => ts.isFunctionLike(d) && d.body);
    if (!fns.length)
      for (const d of declsOf(target)) {
        if (ts.isVariableDeclaration(d) && d.initializer) {
          let f = strip(d.initializer);
          if (ts.isCallExpression(f) && ts.isIdentifier(f.expression) && /^(useCallback|useMemo)$/.test(f.expression.text)) f = strip(f.arguments[0]);
          if (f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f))) fns.push(f);
        }
      }
    if (!fns.length) return void bump(unresolved, e);
    for (const fn of fns) {
      const env = new Map();
      fn.parameters.forEach((p, i) => {
        if (ts.isIdentifier(p.name) && e.arguments[i]) env.set(symbolOf(p.name), e.arguments[i]);
      });
      for (const r of returnsOf(fn)) harvest(r, { depth: depth + 1, env, mode, hint, style: currentStyle });
    }
  }

  function addFound(lang, text, at, style) {
    const k = `${style}|${lang}|${text}`;
    const rec = found.get(k) ?? found.set(k, { lang, style, text, sources: new Set(), entries: new Set() }).get(k);
    rec.sources.add(where(at));
    rec.entries.add(currentEntry);
  }
  let currentStyle = 'ziggy';
  let currentEntry = '';

  /* The read-aloud entry points. */
  const entries = [];
  const isFrom = (node, file, names) => {
    const s = symbolOf(node);
    return declsOf(s).some((d) => d.getSourceFile().fileName.endsWith(file) && names.includes(s.getName()));
  };
  // The read-aloud helpers themselves only pass their callers' texts on: their callers are the entries.
  const wrappers = ['src/lib/voice.ts', 'src/components/arcade/read-aloud.tsx'];
  for (const sf of sources.filter((f) => !wrappers.some((w) => f.fileName.endsWith(w)))) {
    (function walk(n) {
      if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && /^(SayButton|SantaVoiceButton)$/.test(n.tagName.getText())) {
        for (const a of n.attributes.properties) if (ts.isJsxAttribute(a) && a.name.getText() === 'texts' && a.initializer && ts.isJsxExpression(a.initializer)) entries.push({ expr: a.initializer.expression, style: 'ziggy' });
      } else if (ts.isCallExpression(n)) {
        const c = n.expression;
        if (ts.isIdentifier(c)) {
          if (isFrom(c, 'src/lib/voice.ts', ['speakSequence'])) {
            const st = n.arguments[4];
            entries.push({ expr: n.arguments[1], style: st && isStr(st) && st.text === 'bedtime' ? 'bedtime' : st && !isStr(st) ? 'either' : 'ziggy' });
          } else if (isFrom(c, 'src/lib/voice.ts', ['speak'])) entries.push({ expr: n.arguments[1], style: 'ziggy' });
          else if (isFrom(c, 'read-aloud.tsx', ['useAutoSay'])) entries.push({ expr: n.arguments[1], style: 'ziggy' });
          else {
            // const say = useSay(); say(id, ...texts)
            const d = declsOf(symbolOf(c))[0];
            const init = d && ts.isVariableDeclaration(d) && d.initializer && strip(d.initializer);
            if (init && ts.isCallExpression(init) && ts.isIdentifier(init.expression) && isFrom(init.expression, 'read-aloud.tsx', ['useSay'])) for (const a of n.arguments.slice(1)) entries.push({ expr: a, style: 'ziggy' });
          }
        }
      }
      ts.forEachChild(n, walk);
    })(sf);
  }

  for (const { expr, style } of entries) {
    if (!expr) continue;
    currentEntry = where(expr);
    for (const st of style === 'either' ? ['ziggy', 'bedtime'] : [style]) {
      currentStyle = st;
      harvest(expr, { style: st });
    }
  }

  /* Keep fixed sentences only, with their stable ids. */
  const out = [];
  const seen = new Set();
  let personal = 0;
  for (const r of found.values()) {
    const text = spokenText(r.text);
    if (!text || text.length > MAX_CHARS) continue;
    if (/\{\w+\}|\$\{|%s|\{\{/.test(text)) continue; // placeholders filled at run time
    if (looksPersonal(text)) {
      personal++;
      continue;
    }
    const id = clipId(text, r.lang, r.style);
    if (!id) continue;
    const k = `${r.style}:${r.lang}:${id}`;
    if (seen.has(k)) {
      const prev = out.find((o) => o.id === id && o.lang === r.lang && o.style === r.style);
      for (const s of r.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
      for (const e of r.entries) if (!prev.from.includes(e.replace(/:\d+$/, ''))) prev.from.push(e.replace(/:\d+$/, ''));
      continue;
    }
    seen.add(k);
    out.push({ id, lang: r.lang, style: r.style, text, sources: [...r.sources].sort(), from: [...new Set([...r.entries].map((e) => e.replace(/:\d+$/, '')))].sort() });
  }
  out.sort((a, b) => a.style.localeCompare(b.style) || a.lang.localeCompare(b.lang) || a.id.localeCompare(b.id));
  // `sources`: where the text is written; `from`: the read-aloud call sites (pages) that say it.
  writeJson(SENTENCES, out.map((o) => ({ ...o, sources: o.sources.slice(0, 4), from: o.from.sort().slice(0, 6) })));
  const perEntry = new Map();
  for (const r of found.values()) for (const en of r.entries) perEntry.set(en, (perEntry.get(en) ?? 0) + r.text.length);
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  writeJson(path.join(DIR, '.collect-report.json'), { entries: entries.length, charsPerEntry: top(perEntry), unresolved: top(unresolved), dynamic: top(dynamic) });
  const count = (f) => out.filter(f).length;
  const chars = (f) => out.filter(f).reduce((n, o) => n + o.text.length, 0);
  console.log(`entry points ${entries.length}; sentences ${out.length} (fr ${count((o) => o.lang === 'fr')}, en ${count((o) => o.lang === 'en')}; bedtime ${count((o) => o.style === 'bedtime')}); chars fr ${chars((o) => o.lang === 'fr')} en ${chars((o) => o.lang === 'en')}; skipped as personal ${personal}`);
  console.log(`unresolved sites ${unresolved.size}, dynamic sites ${dynamic.size} (details: scripts/voice-bake/.collect-report.json)`);
}

/** A rough language guess for a bare string (no { fr, en } around it). */
function guessLang(t) {
  const fr = (t.match(/[éèêàùçôîœ]|\b(le|la|les|un|une|des|et|est|tu|je|on|pas|avec|pour|dans|c'est|ton|ta|tes)\b/gi) ?? []).length;
  const en = (t.match(/\b(the|a|and|is|you|your|it|to|with|for|in|of|let's|this|that)\b/gi) ?? []).length;
  if (fr === en) return null;
  return fr > en ? 'fr' : 'en';
}

/** Never bake what looks like personal data (the runtime check in src/lib/privacy/personal.ts also applies). */
function looksPersonal(t) {
  return /@\w|\b0[1-9](?:[\s.-]?\d{2}){4}\b|\b(je m'appelle|my name is)\s+[A-Z]/i.test(t);
}

/* ───────────────────────────── render ───────────────────────────── */

function hvTts() {
  const bin = process.env.HV_TTS ?? path.resolve(ROOT, '../hyper-engine/rust/hv-tts/target/release/hv-tts');
  if (!fs.existsSync(bin)) throw new Error(`hv-tts not found at ${bin} (set HV_TTS)`);
  return bin;
}

/** What makes two recordings of the same text differ: engine, voice and encoder settings. */
const VOICE = {
  ziggy: { voice: 'ziggy', chain: 'ziggy', register: 'courant' },
  bedtime: { voice: 'ziggy-warm', chain: 'ziggy', register: 'courant' },
};
const MP3 = ['-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-q:a', '6'];

/** The recording itself (engine binary + voice options), without the encoder. */
function renderSignature(bin) {
  const version = execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim();
  const hash = crypto.createHash('sha256').update(fs.readFileSync(bin)).digest('hex').slice(0, 12);
  return `${version} bin:${hash}`;
}

/**
 * Record what is missing. `--wav-cache DIR` keeps the mastered WAVs (outside
 * the repo) so a change of encoder settings re-encodes without re-recording.
 */
function render() {
  const bin = hvTts();
  const rsig = renderSignature(bin);
  const sig = `${rsig} mp3:${MP3.join(' ')}`;
  const sentences = readJson(SENTENCES, null);
  if (!sentences) throw new Error('run collect first');
  const bank = readJson(BANK, {});
  // Each bank entry keeps a short hash of its engine; the signatures themselves are listed in engines.json.
  const engines = readJson(ENGINES, {});
  for (const b of Object.values(bank)) {
    // Older entries stored the whole signature: keep its hash only.
    if (b.engine && b.engine.length > 10) {
      const h = crypto.createHash('sha256').update(b.engine).digest('hex').slice(0, 10);
      engines[h] = b.engine;
      b.engine = h;
    }
  }
  const engineOf = (s) => {
    const full = `${sig} ${JSON.stringify(VOICE[s.style])}`;
    const h = crypto.createHash('sha256').update(full).digest('hex').slice(0, 10);
    engines[h] = full;
    return h;
  };
  const exclude = new Set(Object.keys(readJson(EXCLUDE, {})));
  const limit = Number(opt('limit', '0')) || Infinity;
  const only = opt('only', ''); // fr | en
  const todo = sentences
    .filter((s) => {
      if (only && s.lang !== only) return false;
      if (exclude.has(s.id)) return false;
      const b = bank[s.id];
      const file = path.join(PUBLIC, s.lang, `${s.id}.${EXT}`);
      return !(b && b.engine === engineOf(s) && b.text === s.text && fs.existsSync(file));
    })
    .slice(0, limit);
  console.log(`engine ${sig}\nto record: ${todo.length} of ${sentences.length}`);
  if (!todo.length) return manifest();
  const cacheRoot = opt('wav-cache', '');
  const cacheDir = (s) => cacheRoot && path.join(cacheRoot, crypto.createHash('sha256').update(`${rsig} ${JSON.stringify(VOICE[s.style])}`).digest('hex').slice(0, 12));
  const cached = (s) => cacheRoot && fs.existsSync(path.join(cacheDir(s), `${s.id}.wav`)) && fs.existsSync(path.join(cacheDir(s), `${s.id}.json`));
  const work = opt('work', path.join(os.tmpdir(), `voice-bake-${process.pid}`));
  const batch = Number(opt('batch', '200'));
  const threads = opt('threads', '4');
  const encode = (s, wav, stats) => {
    const dst = path.join(PUBLIC, s.lang, `${s.id}.${EXT}`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, ...MP3, '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', dst]);
    bank[s.id] = { lang: s.lang, style: s.style, text: s.text, dur: Math.round((stats.seconds ?? 0) * 100) / 100, lufs: Math.round((stats.lufs ?? 0) * 10) / 10, tp: Math.round((stats.true_peak_db ?? 0) * 10) / 10, engine: engineOf(s) };
  };
  // Already recorded with this engine: encode only.
  const fresh = [];
  for (const s of todo) {
    if (cached(s) && readJson(path.join(cacheDir(s), `${s.id}.json`), {}).text === s.text) encode(s, path.join(cacheDir(s), `${s.id}.wav`), readJson(path.join(cacheDir(s), `${s.id}.json`), {}));
    else fresh.push(s);
  }
  if (fresh.length < todo.length) {
    writeJson(BANK, sortKeys(bank));
    writeJson(ENGINES, sortKeys(engines));
    console.log(`  re-encoded ${todo.length - fresh.length} from the WAV cache`);
  }
  for (let at = 0; at < fresh.length; at += batch) {
    const part = fresh.slice(at, at + batch);
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    const items = part.map((s) => ({ id: s.id, text: s.text, lang: s.lang, ...VOICE[s.style] }));
    writeJson(path.join(work, 'manifest.json'), { items, pcm16: true }, false);
    const t0 = Date.now();
    const r = spawnSync(bin, ['bake', '--manifest', path.join(work, 'manifest.json'), '--out', work, '--threads', threads], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`hv-tts bake failed:\n${r.stderr?.slice(-2000)}`);
    const baked = readJson(path.join(work, 'bake.json'), {});
    for (const s of part) {
      const wav = path.join(work, `${s.id}.wav`);
      const stats = baked[s.id] ?? {};
      encode(s, wav, stats);
      if (cacheRoot) {
        fs.mkdirSync(cacheDir(s), { recursive: true });
        fs.copyFileSync(wav, path.join(cacheDir(s), `${s.id}.wav`));
        writeJson(path.join(cacheDir(s), `${s.id}.json`), { ...stats, text: s.text }, false);
      }
    }
    writeJson(BANK, sortKeys(bank));
    writeJson(ENGINES, sortKeys(engines));
    fs.rmSync(work, { recursive: true, force: true }); // the temporary WAVs
    console.log(`  ${Math.min(at + batch, fresh.length)}/${fresh.length} (${((Date.now() - t0) / 1000).toFixed(0)} s for ${part.length})`);
  }
  manifest();
}

const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

/* ───────────────────────────── manifest ───────────────────────────── */

/**
 * public/voice/manifest.json — what the browser loads (once, lazily): for each
 * style and language, the ids that have a clip. No text in it.
 */
function manifest() {
  const sentences = readJson(SENTENCES, []);
  const bank = readJson(BANK, {});
  const exclude = readJson(EXCLUDE, {});
  const wanted = new Set(sentences.map((s) => s.id));
  const m = { v: 1, ext: EXT, ziggy: { fr: [], en: [] }, bedtime: { fr: [], en: [] } };
  for (const [id, b] of Object.entries(bank)) {
    if (!wanted.has(id) || exclude[id]) continue;
    if (!fs.existsSync(path.join(PUBLIC, b.lang, `${id}.${EXT}`))) continue;
    m[b.style][b.lang].push(id);
  }
  for (const st of ['ziggy', 'bedtime']) for (const l of ['fr', 'en']) m[st][l].sort();
  // Clips no longer wanted (text changed, excluded): removed from public/voice.
  for (const lang of ['fr', 'en']) {
    const dir = path.join(PUBLIC, lang);
    if (!fs.existsSync(dir)) continue;
    const keep = new Set([...m.ziggy[lang], ...m.bedtime[lang]]);
    for (const f of fs.readdirSync(dir)) if (!keep.has(f.replace(/\.\w+$/, ''))) fs.rmSync(path.join(dir, f));
  }
  // Clip URLs carry ?v=<engine>: a new voice reaches every cache, adding clips does not re-download the others.
  const engines = [...new Set(Object.entries(bank).filter(([id]) => wanted.has(id)).map(([, b]) => b.engine))].sort();
  m.version = crypto.createHash('sha256').update(engines.join('\n')).digest('hex').slice(0, 10);
  writeJson(MANIFEST, m, false);
  stats();
}

function stats() {
  const m = readJson(MANIFEST, null);
  const sentences = readJson(SENTENCES, []);
  if (!m) return console.log('no manifest yet');
  let bytes = 0;
  let files = 0;
  for (const lang of ['fr', 'en']) {
    const dir = path.join(PUBLIC, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      bytes += fs.statSync(path.join(dir, f)).size;
      files++;
    }
  }
  const n = (st, l) => m[st][l].length;
  const want = (st, l) => sentences.filter((s) => s.style === st && s.lang === l).length;
  console.log(`clips ${files}, ${(bytes / 1e6).toFixed(1)} MB; manifest ${(fs.statSync(MANIFEST).size / 1024).toFixed(1)} KB`);
  for (const st of ['ziggy', 'bedtime']) console.log(`  ${st}: fr ${n(st, 'fr')}/${want(st, 'fr')}, en ${n(st, 'en')}/${want(st, 'en')}`);
}

const commands = { collect, render, manifest, stats };
if (!commands[cmd]) {
  console.error(`usage: node scripts/voice-bake.mjs ${Object.keys(commands).join('|')}`);
  process.exit(2);
}
if (cmd === 'collect' && isMainThread) {
  // The walk recurses deeply (and so does the type checker under it): a worker with a big stack.
  const w = new Worker(fileURLToPath(import.meta.url), { argv: args, resourceLimits: { stackSizeMb: 256, maxOldGenerationSizeMb: 6144 } });
  w.on('exit', (code) => process.exit(code));
} else commands[cmd]();

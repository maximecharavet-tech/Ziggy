/**
 * Asset manifest validator (pure). File checks go through an injected
 * `fileExists`, so the same code runs in Vitest (Node fs), in a build script,
 * or with no file check at all in the browser.
 */
import {
  ALLOWED_LICENCES,
  APPROVAL_LICENCES,
  ASSET_FORMATS,
  ASSET_TYPES,
  MANIFEST_SCHEMA_VERSION,
  type AssetEntry,
  type AssetIssue,
  type AssetManifest,
} from './types';

/** `lutins.ref.pepin`: 2+ dot-separated segments of lowercase letters, digits and dashes. */
export const ASSET_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

/** Semantic Versioning 2.0.0 (the official regex, without a leading `v`). */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const isSemver = (v: unknown): v is string => typeof v === 'string' && SEMVER_RE.test(v);
export const isAllowedLicence = (l: unknown): boolean => (ALLOWED_LICENCES as readonly unknown[]).includes(l);
export const needsApproval = (l: unknown): boolean => (APPROVAL_LICENCES as readonly unknown[]).includes(l);

/** Types that are pictures: they must say their pixel size. */
const SIZED_TYPES = new Set(['image', 'texture', 'spritesheet', 'video']);
/** Formats a given extension may be written with (jpeg → jpg). */
const EXT_ALIASES: Record<string, string> = { jpeg: 'jpg' };

export interface ValidateOptions {
  /**
   * Does this file exist? Receives a path from the repo root (`public/…` for
   * public assets, the source path otherwise). Omit to skip file checks.
   */
  fileExists?: (repoPath: string) => boolean;
}

function extOf(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  const e = m ? m[1].toLowerCase() : '';
  return EXT_ALIASES[e] ?? e;
}

/** A clean relative path: no `..`, no backslash, no scheme, no double slash. */
function cleanPath(p: string): boolean {
  return !p.includes('..') && !p.includes('\\') && !/^[a-z]+:/i.test(p) && !p.includes('//');
}

function checkEntry(a: AssetEntry, opts: ValidateOptions, out: AssetIssue[]) {
  const id = typeof a?.id === 'string' ? a.id : '?';
  const err = (code: AssetIssue['code'], message: string) => out.push({ level: 'error', id, code, message });
  const warn = (code: AssetIssue['code'], message: string) => out.push({ level: 'warning', id, code, message });

  if (!a || typeof a !== 'object') return err('schema', 'entry is not an object');
  if (!ASSET_ID_RE.test(id)) err('bad-id', `id "${id}" must be dot-separated lowercase segments (e.g. lutins.ref.pepin)`);
  if (!(ASSET_TYPES as readonly string[]).includes(a.type)) err('schema', `unknown type "${String(a.type)}"`);
  if (!(ASSET_FORMATS as readonly string[]).includes(a.format)) err('schema', `unknown format "${String(a.format)}"`);
  if (!isSemver(a.version)) err('bad-version', `version "${String(a.version)}" is not semver (x.y.z)`);
  if (typeof a.description !== 'string' || a.description.trim().length < 8) err('schema', 'description is missing or too short');
  if (typeof a.copyright !== 'string' || !a.copyright.trim()) err('schema', 'copyright is missing');

  // Licence: allowed list, or owner-approved list with a recorded approval.
  if (needsApproval(a.licence)) {
    if (!a.licenceApproval?.trim()) err('licence-needs-approval', `licence ${a.licence} needs the owner's OK in licenceApproval`);
  } else if (!isAllowedLicence(a.licence)) {
    err('licence-forbidden', `licence "${String(a.licence)}" is not allowed (MIT / Apache-2.0 / BSD / CC0 / our own only)`);
  }

  // Source: third-party assets must say where they come from.
  const src = a.source;
  if (!src || typeof src !== 'object' || typeof src.kind !== 'string') err('schema', 'source.kind is missing');
  else if ((src.kind === 'download' || src.kind === 'npm-copy') && !src.origin) err('missing-origin', `a ${src.kind} asset needs source.origin`);
  if (src?.script && !cleanPath(src.script)) err('bad-location', `source.script "${src.script}" is not a clean repo path`);

  // Resolution.
  if (SIZED_TYPES.has(a.type) && !a.resolution) err('bad-resolution', `a ${a.type} needs a resolution`);
  if (a.resolution) {
    const { width, height } = a.resolution;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 8192 || height > 8192) {
      err('bad-resolution', `resolution ${width}×${height} must be positive integers ≤ 8192`);
    }
  }

  // Location.
  const loc = a.location;
  if (!loc || typeof loc !== 'object' || typeof loc.path !== 'string') return err('bad-location', 'location.path is missing');
  if (loc.kind === 'public') {
    if (!loc.path.startsWith('/') || !cleanPath(loc.path.slice(1))) err('bad-location', `public path "${loc.path}" must start with "/" and stay inside public/`);
  } else if (loc.kind === 'source') {
    if (loc.path.startsWith('/') || !cleanPath(loc.path)) err('bad-location', `source path "${loc.path}" must be a clean path from the repo root`);
  } else {
    return err('bad-location', `location.kind must be "public" or "source" (remote assets are not allowed)`);
  }
  // A code-built model or material is a TypeScript source file; a file asset is not.
  const ext = extOf(loc.path);
  if (ext !== a.format) err('format-mismatch', `format "${a.format}" but the file is ".${ext}"`);
  const codeTypes = ['code-model', 'code-material', 'code-audio'];
  if (codeTypes.includes(a.type) && loc.kind !== 'source') err('bad-location', `a ${a.type} must point at its source file (location.kind "source")`);

  // Files.
  if (opts.fileExists) {
    const repoPath = loc.kind === 'public' ? `public${loc.path}` : loc.path;
    const provisioned = loc.kind === 'public' ? loc.provisionedBy : undefined;
    if (provisioned) {
      if (!opts.fileExists(provisioned)) err('missing-file', `provisioning script ${provisioned} not found`);
      if (!opts.fileExists(repoPath)) warn('missing-file', `${repoPath} not present (run ${provisioned})`);
    } else if (!opts.fileExists(repoPath)) {
      err('missing-file', `${repoPath} not found`);
    }
    if (src?.script && !opts.fileExists(src.script)) err('missing-file', `source.script ${src.script} not found`);
  }
}

/** Every problem of the manifest (an empty list = valid). */
export function validateManifest(manifest: AssetManifest, opts: ValidateOptions = {}): AssetIssue[] {
  const out: AssetIssue[] = [];
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.assets)) {
    return [{ level: 'error', id: 'manifest', code: 'schema', message: 'manifest must be { schemaVersion, assets: [] }' }];
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    out.push({ level: 'error', id: 'manifest', code: 'schema', message: `schemaVersion must be ${MANIFEST_SCHEMA_VERSION}` });
  }

  const seen = new Set<string>();
  for (const a of manifest.assets) {
    checkEntry(a, opts, out);
    if (a && typeof a.id === 'string') {
      if (seen.has(a.id)) out.push({ level: 'error', id: a.id, code: 'duplicate-id', message: `id "${a.id}" is used more than once` });
      seen.add(a.id);
    }
  }

  // Dependencies: exist, not self, no cycle.
  const byId = new Map(manifest.assets.filter((a) => a && typeof a.id === 'string').map((a) => [a.id, a] as const));
  for (const a of byId.values()) {
    for (const d of a.dependencies ?? []) {
      if (d === a.id) out.push({ level: 'error', id: a.id, code: 'dependency-cycle', message: 'an asset cannot depend on itself' });
      else if (!byId.has(d)) out.push({ level: 'error', id: a.id, code: 'missing-dependency', message: `dependency "${d}" is not in the manifest` });
    }
  }
  const state = new Map<string, 1 | 2>(); // 1 = visiting, 2 = done
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const loop = [...path.slice(path.indexOf(id)), id].join(' → ');
      out.push({ level: 'error', id, code: 'dependency-cycle', message: `dependency cycle: ${loop}` });
      return;
    }
    state.set(id, 1);
    for (const d of byId.get(id)?.dependencies ?? []) if (d !== id && byId.has(d)) visit(d, [...path, id]);
    state.set(id, 2);
  };
  for (const id of byId.keys()) visit(id, []);

  return out;
}

/** Only the errors (what must be fixed before merging). */
export const manifestErrors = (m: AssetManifest, opts?: ValidateOptions) => validateManifest(m, opts).filter((i) => i.level === 'error');

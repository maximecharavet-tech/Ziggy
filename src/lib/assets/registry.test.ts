import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import manifestJson from '@/data/assets/manifest.json';
import { AssetRegistry, assets } from './registry';
import { isSemver, manifestErrors, validateManifest } from './validate';
import { ALLOWED_LICENCES, type AssetEntry, type AssetManifest } from './types';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const fileExists = (p: string) => existsSync(join(repo, p));
const manifest = manifestJson as AssetManifest;

/** A valid entry to break one field at a time. */
const base = (over: Partial<AssetEntry> = {}): AssetEntry => ({
  id: 'test.thing',
  type: 'image',
  format: 'png',
  resolution: { width: 64, height: 64 },
  version: '1.0.0',
  licence: 'LicenseRef-Ziggy',
  copyright: '© Ziggy',
  description: 'A test picture.',
  location: { kind: 'public', path: '/test/thing.png' },
  source: { kind: 'code' },
  ...over,
});
const codes = (entries: AssetEntry[], opts = {}) => validateManifest({ schemaVersion: 1, assets: entries }, opts).map((i) => i.code);

describe('the project manifest', () => {
  it('is valid, with every local file present', () => {
    expect(manifestErrors(manifest, { fileExists })).toEqual([]);
  });

  it('has unique ids', () => {
    const ids = manifest.assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses allowed licences only (no approval-only licence without the OK)', () => {
    for (const a of manifest.assets) {
      if (!(ALLOWED_LICENCES as readonly string[]).includes(a.licence)) expect(a.licenceApproval, a.id).toBeTruthy();
    }
  });

  it('has semver versions', () => {
    for (const a of manifest.assets) expect(isSemver(a.version), `${a.id} ${a.version}`).toBe(true);
  });

  it('lists the existing Lutins, Santa, MediaPipe and mascot assets', () => {
    for (const id of ['lutins.ref.sheet', 'lutins.ref.pepin', 'lutins.avatar.noisette', 'lutins.model.grelotte', 'santa.mediapipe.selfie-segmenter', 'lutins.mediapipe.efficientdet-lite0', 'mascot.ziggy-wave', 'santa.model', 'ziggy.model']) {
      expect(assets.has(id), id).toBe(true);
    }
    for (const a of assets.byTag('ml')) if (a.type === 'ml-model') expect(a.licence).toBe('Apache-2.0');
  });
});

describe('AssetRegistry', () => {
  it('gives versioned URLs for served files and refuses code-built ones', () => {
    expect(assets.url('lutins.ref.pepin')).toBe('/lutins/refs/pepin.png?v=1.0.0');
    expect(assets.url('lutins.ref.pepin', { bust: false })).toBe('/lutins/refs/pepin.png');
    expect(() => assets.url('lutins.model.pepin')).toThrow(/built in code/);
    expect(() => assets.get('nope.nothing')).toThrow(/Unknown asset/);
  });

  it('orders dependencies before dependents', () => {
    const order = assets.loadOrder('lutins.ref.sheet').map((a) => a.id);
    expect(order.at(-1)).toBe('lutins.ref.sheet');
    expect(order.indexOf('lutins.bible')).toBeLessThan(order.indexOf('lutins.model.pepin'));
    expect(order.indexOf('lutins.model.pepin')).toBeLessThan(order.indexOf('lutins.ref.sheet'));
    expect(new Set(order).size).toBe(order.length);
    expect(assets.dependents('lutins.model.pepin').map((a) => a.id)).toEqual(expect.arrayContaining(['lutins.ref.pepin', 'lutins.avatar.pepin', 'lutins.ref.sheet']));
  });

  it('rejects duplicate ids and detects cycles', () => {
    expect(() => new AssetRegistry({ schemaVersion: 1, assets: [base(), base()] })).toThrow(/twice/);
    const r = new AssetRegistry({ schemaVersion: 1, assets: [base({ id: 'a.one', dependencies: ['a.two'] }), base({ id: 'a.two', dependencies: ['a.one'] })] });
    expect(() => r.loadOrder('a.one')).toThrow(/cycle/);
  });
});

describe('validateManifest catches', () => {
  it('a valid entry passes', () => {
    expect(codes([base()])).toEqual([]);
  });
  it('duplicate and malformed ids', () => {
    expect(codes([base(), base()])).toContain('duplicate-id');
    expect(codes([base({ id: 'Bad Id' })])).toContain('bad-id');
    expect(codes([base({ id: 'single' })])).toContain('bad-id');
  });
  it('non-semver versions', () => {
    for (const v of ['1', '1.0', 'v1.0.0', '01.0.0', '1.0.0.0']) expect(codes([base({ version: v })]), v).toContain('bad-version');
    expect(isSemver('2.1.0-beta.1+build.5')).toBe(true);
  });
  it('forbidden licences and approval-only licences without the OK', () => {
    for (const l of ['GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'MPL-2.0', 'CC-BY-NC-4.0', 'proprietary']) {
      expect(codes([base({ licence: l as AssetEntry['licence'] })]), l).toContain('licence-forbidden');
    }
    expect(codes([base({ licence: 'ISC' })])).toContain('licence-needs-approval');
    expect(codes([base({ licence: 'ISC', licenceApproval: 'owner, 2026-11-09' })])).toEqual([]);
  });
  it('missing files, bad paths, remote locations and format mismatches', () => {
    expect(codes([base()], { fileExists: () => false })).toContain('missing-file');
    expect(codes([base({ location: { kind: 'public', path: 'no-slash.png' } })])).toContain('bad-location');
    expect(codes([base({ location: { kind: 'public', path: '/../secret.png' } })])).toContain('bad-location');
    expect(codes([base({ location: { kind: 'remote', path: 'https://cdn.example.com/a.png' } as unknown as AssetEntry['location'] })])).toContain('bad-location');
    expect(codes([base({ location: { kind: 'public', path: '/test/thing.webp' } })])).toContain('format-mismatch');
    expect(codes([base({ type: 'code-model', format: 'ts', resolution: undefined, location: { kind: 'public', path: '/x/model.ts' } })])).toContain('bad-location');
  });
  it('a provisioned file only needs its script', () => {
    const e = base({ location: { kind: 'public', path: '/test/thing.png', provisionedBy: 'scripts/x.mjs' } });
    const issues = validateManifest({ schemaVersion: 1, assets: [e] }, { fileExists: (p) => p === 'scripts/x.mjs' });
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(issues.map((i) => i.code)).toContain('missing-file');
  });
  it('resolution, origin, dependencies and cycles', () => {
    expect(codes([base({ resolution: undefined })])).toContain('bad-resolution');
    expect(codes([base({ resolution: { width: 0, height: 10 } })])).toContain('bad-resolution');
    expect(codes([base({ source: { kind: 'download' } })])).toContain('missing-origin');
    expect(codes([base({ dependencies: ['nope.nothing'] })])).toContain('missing-dependency');
    expect(codes([base({ dependencies: ['test.thing'] })])).toContain('dependency-cycle');
    expect(codes([base({ id: 'a.one', dependencies: ['a.two'] }), base({ id: 'a.two', dependencies: ['a.one'] })])).toContain('dependency-cycle');
  });
  it('a broken manifest shape', () => {
    expect(validateManifest({} as AssetManifest)[0].code).toBe('schema');
    expect(validateManifest({ schemaVersion: 2, assets: [] } as unknown as AssetManifest)[0].code).toBe('schema');
  });
});

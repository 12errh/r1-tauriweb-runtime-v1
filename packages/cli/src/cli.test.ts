import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileExists, toSnakeCase, createBackup } from './utils.js';
import { patchBuildRs } from './patch-build-rs.js';
import { patchCargo } from './patch-cargo.js';

describe('CLI Utils', () => {
  it('toSnakeCase converts kebab-case to snake_case', () => {
    expect(toSnakeCase('my-app-name')).toBe('my_app_name');
    expect(toSnakeCase('test-greet')).toBe('test_greet');
    expect(toSnakeCase('already_snake')).toBe('already_snake');
  });
});

describe('patchBuildRs', () => {
  const testDir = path.join(process.cwd(), 'test-temp');
  const srcTauriDir = path.join(testDir, 'src-tauri');
  const buildRsPath = path.join(srcTauriDir, 'build.rs');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(srcTauriDir)) {
      fs.mkdirSync(srcTauriDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('empties build.rs', async () => {
    // Create a build.rs with content
    fs.writeFileSync(buildRsPath, 'fn main() {\n    tauri_build::build()\n}\n');

    await patchBuildRs(testDir);

    const content = fs.readFileSync(buildRsPath, 'utf-8');
    expect(content.trim()).toBe('fn main() {}');
  });

  it('creates backup file', async () => {
    const originalContent = 'fn main() {\n    tauri_build::build()\n}\n';
    fs.writeFileSync(buildRsPath, originalContent);

    await patchBuildRs(testDir);

    const backupPath = buildRsPath + '.r1-backup';
    expect(fileExists(backupPath)).toBe(true);
    
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    expect(backupContent).toBe(originalContent);
  });

  it('is idempotent (safe to run twice)', async () => {
    fs.writeFileSync(buildRsPath, 'fn main() {\n    tauri_build::build()\n}\n');

    await patchBuildRs(testDir);
    await patchBuildRs(testDir);

    const content = fs.readFileSync(buildRsPath, 'utf-8');
    expect(content.trim()).toBe('fn main() {}');
  });

  it('does nothing if build.rs does not exist', async () => {
    await patchBuildRs(testDir);
    expect(fileExists(buildRsPath)).toBe(false);
  });
});

describe('patchCargo', () => {
  const testDir = path.join(process.cwd(), 'test-temp-cargo');
  const srcTauriDir = path.join(testDir, 'src-tauri');
  const cargoPath = path.join(srcTauriDir, 'Cargo.toml');

  beforeEach(() => {
    if (!fs.existsSync(srcTauriDir)) {
      fs.mkdirSync(srcTauriDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('adds wasm-bindgen dependency', async () => {
    const cargoContent = `[package]
name = "test-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = "2.0"
`;
    fs.writeFileSync(cargoPath, cargoContent);

    await patchCargo(testDir);

    const result = fs.readFileSync(cargoPath, 'utf-8');
    expect(result).toContain('wasm-bindgen');
    expect(result).toContain('serde');
    expect(result).toContain('serde_json');
  });

  it('adds [lib] section', async () => {
    const cargoContent = `[package]
name = "test-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = "2.0"
`;
    fs.writeFileSync(cargoPath, cargoContent);

    await patchCargo(testDir);

    const result = fs.readFileSync(cargoPath, 'utf-8');
    expect(result).toContain('[lib]');
    expect(result).toContain('name = "test_app"');
    expect(result).toContain('crate-type');
  });

  it('moves tauri to cfg target', async () => {
    const cargoContent = `[package]
name = "test-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = "2.0"
`;
    fs.writeFileSync(cargoPath, cargoContent);

    await patchCargo(testDir);

    const result = fs.readFileSync(cargoPath, 'utf-8');
    // Check that tauri is in a target-specific section (the exact format may vary)
    expect(result).toMatch(/target.*wasm32.*dependencies/);
    expect(result).toContain('tauri = "2.0"');
    // Verify tauri is NOT in the main dependencies section anymore
    const lines = result.split('\n');
    let inMainDeps = false;
    let foundTauriInMain = false;
    for (const line of lines) {
      if (line.trim() === '[dependencies]') {
        inMainDeps = true;
      } else if (line.trim().startsWith('[') && !line.includes('dependencies.')) {
        inMainDeps = false;
      }
      if (inMainDeps && line.includes('tauri')) {
        foundTauriInMain = true;
      }
    }
    expect(foundTauriInMain).toBe(false);
  });

  it('removes [build-dependencies]', async () => {
    const cargoContent = `[package]
name = "test-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = "2.0"

[build-dependencies]
tauri-build = "2.0"
`;
    fs.writeFileSync(cargoPath, cargoContent);

    await patchCargo(testDir);

    const result = fs.readFileSync(cargoPath, 'utf-8');
    expect(result).not.toContain('[build-dependencies]');
    expect(result).not.toContain('tauri-build');
  });
});

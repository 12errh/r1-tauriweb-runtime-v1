import { describe, it, expect } from 'vitest';
import { patchSqlImportsInContent } from './patch-sql-imports.js';

describe('SQL Import Patcher', () => {
  describe('Default import patterns', () => {
    it('should patch default import with double quotes', () => {
      const input = `import Database from "@tauri-apps/plugin-sql";`;
      const expected = `import { Database } from "@r1/apis/sql";`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });

    it('should patch default import with single quotes', () => {
      const input = `import Database from '@tauri-apps/plugin-sql';`;
      const expected = `import { Database } from "@r1/apis/sql";`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });

    it('should patch default import with extra whitespace', () => {
      const input = `import   Database   from   "@tauri-apps/plugin-sql"  ;`;
      const expected = `import { Database } from "@r1/apis/sql"  ;`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });

  describe('Named import patterns', () => {
    it('should patch named import', () => {
      const input = `import { Database } from "@tauri-apps/plugin-sql";`;
      const expected = `import { Database } from "@r1/apis/sql";`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });

    it('should patch named import with whitespace', () => {
      const input = `import {  Database  } from "@tauri-apps/plugin-sql";`;
      const expected = `import { Database } from "@r1/apis/sql";`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });

  describe('Type import patterns', () => {
    it('should patch type default import', () => {
      const input = `import type Database from "@tauri-apps/plugin-sql";`;
      const expected = `import type { Database } from "@r1/apis/sql";`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });

    it('should patch type named import', () => {
      const input = `import type { Database } from "@tauri-apps/plugin-sql";`;
      const expected = `import type { Database } from "@r1/apis/sql";`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });

  describe('CommonJS patterns', () => {
    it('should patch require statement', () => {
      const input = `const Database = require("@tauri-apps/plugin-sql");`;
      const expected = `const { Database } = require("@r1/apis/sql");`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });

    it('should patch require with single quotes', () => {
      const input = `const Database = require('@tauri-apps/plugin-sql');`;
      const expected = `const { Database } = require("@r1/apis/sql");`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });

  describe('Dynamic import patterns', () => {
    it('should patch dynamic import', () => {
      const input = `const db = await import("@tauri-apps/plugin-sql");`;
      const expected = `const db = await import("@r1/apis/sql");`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });

  describe('Multiple imports in one file', () => {
    it('should patch multiple imports', () => {
      const input = `
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type { Database as DB } from "@tauri-apps/plugin-sql";
`;
      const expected = `
import { Database } from "@r1/apis/sql";
import { invoke } from "@tauri-apps/api/core";
import type { Database as DB } from "@r1/apis/sql";
`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });

  describe('Real-world code examples', () => {
    it('should patch complete TypeScript file', () => {
      const input = `
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

export async function initDB() {
  const db = await Database.load("sqlite:app.db");
  await db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)");
  return db;
}
`;
      const expected = `
import { Database } from "@r1/apis/sql";
import { invoke } from "@tauri-apps/api/core";

export async function initDB() {
  const db = await Database.load("sqlite:app.db");
  await db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)");
  return db;
}
`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });

    it('should patch React component with SQL', () => {
      const input = `
import React, { useEffect, useState } from 'react';
import Database from "@tauri-apps/plugin-sql";

export function App() {
  const [db, setDb] = useState<Database | null>(null);
  
  useEffect(() => {
    Database.load("sqlite:app.db").then(setDb);
  }, []);
  
  return <div>App</div>;
}
`;
      const expected = `
import React, { useEffect, useState } from 'react';
import { Database } from "@r1/apis/sql";

export function App() {
  const [db, setDb] = useState<Database | null>(null);
  
  useEffect(() => {
    Database.load("sqlite:app.db").then(setDb);
  }, []);
  
  return <div>App</div>;
}
`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });

  describe('Edge cases', () => {
    it('should not modify non-SQL imports', () => {
      const input = `
import { readFile } from "@tauri-apps/api/fs";
import { invoke } from "@tauri-apps/api/core";
`;
      expect(patchSqlImportsInContent(input)).toBe(input);
    });

    it('should not modify comments', () => {
      const input = `
// import Database from "@tauri-apps/plugin-sql";
/* import Database from "@tauri-apps/plugin-sql"; */
`;
      expect(patchSqlImportsInContent(input)).toBe(input);
    });

    it('should not modify strings', () => {
      const input = `
const str = 'import Database from "@tauri-apps/plugin-sql"';
const str2 = "import Database from '@tauri-apps/plugin-sql'";
`;
      expect(patchSqlImportsInContent(input)).toBe(input);
    });

    it('should handle empty content', () => {
      expect(patchSqlImportsInContent('')).toBe('');
    });

    it('should handle content with no imports', () => {
      const input = `
export function hello() {
  return "world";
}
`;
      expect(patchSqlImportsInContent(input)).toBe(input);
    });
  });

  describe('Already patched files', () => {
    it('should not modify already patched imports', () => {
      const input = `import { Database } from "@r1/apis/sql";`;
      expect(patchSqlImportsInContent(input)).toBe(input);
    });

    it('should handle mixed patched and unpatched', () => {
      const input = `
import { Database } from "@r1/apis/sql";
import Database from "@tauri-apps/plugin-sql";
`;
      const expected = `
import { Database } from "@r1/apis/sql";
import { Database } from "@r1/apis/sql";
`;
      expect(patchSqlImportsInContent(input)).toBe(expected);
    });
  });
});

/*
** wasm_vfs.c — Minimal in-memory SQLite VFS for wasm32-unknown-unknown.
** Self-contained version (no sqlite3.h dependency).
*/

#include <stdlib.h>
#include <string.h>

/* Minimal SQLite definitions for the VFS */
#define SQLITE_OK            0
#define SQLITE_CANTOPEN     14
#define SQLITE_IOERR_NOMEM   (1 | (12<<8)) 
#define SQLITE_IOERR_SHORT_READ (1 | (2<<8))
#define SQLITE_NOTFOUND     12
#define SQLITE_OPEN_CREATE  0x00000004
#define SQLITE_FCNTL_VFSNAME 16
#define SQLITE_IOCAP_IMMUTABLE 0x00002000
#define SQLITE_IOCAP_POWERSAFE_OVERWRITE 0x00001000
#define SQLITE_IOCAP_SAFE_APPEND 0x00000200
#define SQLITE_IOCAP_SEQUENTIAL 0x00000400

typedef long long sqlite3_int64;

typedef struct sqlite3_io_methods sqlite3_io_methods;
typedef struct sqlite3_file sqlite3_file;
struct sqlite3_file {
  const sqlite3_io_methods *pMethods;
};

struct sqlite3_io_methods {
  int iVersion;
  int (*xClose)(sqlite3_file*);
  int (*xRead)(sqlite3_file*, void*, int iAmt, sqlite3_int64 iOfst);
  int (*xWrite)(sqlite3_file*, const void*, int iAmt, sqlite3_int64 iOfst);
  int (*xTruncate)(sqlite3_file*, sqlite3_int64 size);
  int (*xSync)(sqlite3_file*, int flags);
  int (*xFileSize)(sqlite3_file*, sqlite3_int64 *pSize);
  int (*xLock)(sqlite3_file*, int);
  int (*xUnlock)(sqlite3_file*, int);
  int (*xCheckReservedLock)(sqlite3_file*, int *pResOut);
  int (*xFileControl)(sqlite3_file*, int op, void *pArg);
  int (*xSectorSize)(sqlite3_file*);
  int (*xDeviceCharacteristics)(sqlite3_file*);
};

typedef struct sqlite3_vfs sqlite3_vfs;
struct sqlite3_vfs {
  int iVersion;
  int szOsFile;
  int mxPathname;
  sqlite3_vfs *pNext;
  const char *zName;
  void *pAppData;
  int (*xOpen)(sqlite3_vfs*, const char *zName, sqlite3_file*, int flags, int *pOutFlags);
  int (*xDelete)(sqlite3_vfs*, const char *zName, int syncDir);
  int (*xAccess)(sqlite3_vfs*, const char *zName, int flags, int *pResOut);
  int (*xFullPathname)(sqlite3_vfs*, const char *zName, int nOut, char *zOut);
  void *xDlOpen;
  void *xDlError;
  void *xDlSym;
  void *xDlClose;
  int (*xRandomness)(sqlite3_vfs*, int nByte, char *zOut);
  int (*xSleep)(sqlite3_vfs*, int microseconds);
  int (*xCurrentTime)(sqlite3_vfs*, double*);
  int (*xGetLastError)(sqlite3_vfs*, int, char *);
};

int sqlite3_vfs_register(sqlite3_vfs*, int makeDefault);
char *sqlite3_mprintf(const char*, ...);
int sqlite3_snprintf(int, char*, const char*, ...);

#define WASM_VFS_NAME    "wasm-mem"
#define WASM_MAX_FILES   64
#define WASM_PATH_MAX    256

typedef struct WasmBuf {
  char     zName[WASM_PATH_MAX];
  unsigned char *aData;
  int      nData;
  int      nRef;
  int      bActive;
} WasmBuf;

static WasmBuf gBufs[WASM_MAX_FILES];

static WasmBuf *wasmBufFind(const char *zName) {
  int i;
  if (!zName || !zName[0]) return 0;
  for (i = 0; i < WASM_MAX_FILES; i++) {
    if (gBufs[i].bActive && strcmp(gBufs[i].zName, zName) == 0)
      return &gBufs[i];
  }
  return 0;
}

static WasmBuf *wasmBufAlloc(const char *zName) {
  int i;
  for (i = 0; i < WASM_MAX_FILES; i++) {
    if (!gBufs[i].bActive) {
      memset(&gBufs[i], 0, sizeof(gBufs[i]));
      if (zName && zName[0])
        sqlite3_snprintf(WASM_PATH_MAX, gBufs[i].zName, "%s", zName);
      gBufs[i].bActive = 1;
      return &gBufs[i];
    }
  }
  return 0;
}

typedef struct WasmFile {
  sqlite3_file base;
  WasmBuf *pBuf;
} WasmFile;

static int wasmClose(sqlite3_file *p) {
  WasmFile *f = (WasmFile *)p;
  if (f->pBuf) {
    f->pBuf->nRef--;
    if (f->pBuf->nRef <= 0 && !f->pBuf->zName[0]) {
      free(f->pBuf->aData);
      f->pBuf->aData = 0;
      f->pBuf->nData = 0;
      f->pBuf->bActive = 0;
    }
    f->pBuf = 0;
  }
  return SQLITE_OK;
}

static int wasmRead(sqlite3_file *p, void *zBuf, int iAmt, sqlite3_int64 iOfst) {
  WasmFile *f = (WasmFile *)p;
  WasmBuf *b = f->pBuf;
  int nAvail;
  if ((int)iOfst >= b->nData) {
    memset(zBuf, 0, iAmt);
    return SQLITE_IOERR_SHORT_READ;
  }
  nAvail = b->nData - (int)iOfst;
  if (nAvail >= iAmt) {
    memcpy(zBuf, b->aData + iOfst, iAmt);
    return SQLITE_OK;
  }
  memcpy(zBuf, b->aData + iOfst, nAvail);
  memset((char *)zBuf + nAvail, 0, iAmt - nAvail);
  return SQLITE_IOERR_SHORT_READ;
}

static int wasmWrite(sqlite3_file *p, const void *zBuf, int iAmt, sqlite3_int64 iOfst) {
  WasmFile *f = (WasmFile *)p;
  WasmBuf *b = f->pBuf;
  int newEnd = (int)iOfst + iAmt;
  if (newEnd > b->nData) {
    unsigned char *newData = (unsigned char *)malloc(newEnd);
    if (!newData) return SQLITE_IOERR_NOMEM;
    if (b->aData) {
      memcpy(newData, b->aData, b->nData);
      free(b->aData);
    }
    memset(newData + b->nData, 0, newEnd - b->nData);
    b->aData = newData;
    b->nData = newEnd;
  }
  memcpy(b->aData + iOfst, zBuf, iAmt);
  return SQLITE_OK;
}

static int wasmTruncate(sqlite3_file *p, sqlite3_int64 nSize) {
  WasmFile *f = (WasmFile *)p;
  if ((int)nSize < f->pBuf->nData) f->pBuf->nData = (int)nSize;
  return SQLITE_OK;
}

static int wasmSync(sqlite3_file *p, int flags) { return SQLITE_OK; }

static int wasmFileSize(sqlite3_file *p, sqlite3_int64 *pSize) {
  *pSize = ((WasmFile *)p)->pBuf->nData;
  return SQLITE_OK;
}

static int wasmLock(sqlite3_file *p, int eLock)           { return SQLITE_OK; }
static int wasmUnlock(sqlite3_file *p, int eLock)         { return SQLITE_OK; }
static int wasmCheckReservedLock(sqlite3_file *p, int *r) { *r = 0; return SQLITE_OK; }

static int wasmFileControl(sqlite3_file *p, int op, void *pArg) {
  if (op == SQLITE_FCNTL_VFSNAME) {
    *(char **)pArg = sqlite3_mprintf(WASM_VFS_NAME);
    return SQLITE_OK;
  }
  return SQLITE_NOTFOUND;
}

static int wasmSectorSize(sqlite3_file *p)         { return 4096; }
static int wasmDeviceCharacteristics(sqlite3_file *p) {
  return SQLITE_IOCAP_IMMUTABLE | SQLITE_IOCAP_POWERSAFE_OVERWRITE
       | SQLITE_IOCAP_SAFE_APPEND | SQLITE_IOCAP_SEQUENTIAL;
}

static const sqlite3_io_methods gWasmIoMethods = {
  1,
  wasmClose,
  wasmRead,
  wasmWrite,
  wasmTruncate,
  wasmSync,
  wasmFileSize,
  wasmLock,
  wasmUnlock,
  wasmCheckReservedLock,
  wasmFileControl,
  wasmSectorSize,
  wasmDeviceCharacteristics,
};

static int wasmOpen(
  sqlite3_vfs *pVfs, const char *zName,
  sqlite3_file *pFile, int flags, int *pOutFlags
) {
  WasmFile *f = (WasmFile *)pFile;
  WasmBuf *b;
  int isMemory = (!zName || !zName[0] || strcmp(zName, ":memory:") == 0);

  memset(f, 0, sizeof(*f));
  f->base.pMethods = &gWasmIoMethods;

  if (!isMemory) {
    b = wasmBufFind(zName);
    if (!b) {
      if (!(flags & SQLITE_OPEN_CREATE)) return SQLITE_CANTOPEN;
      b = wasmBufAlloc(zName);
      if (!b) return SQLITE_IOERR_NOMEM;
    }
  } else {
    b = wasmBufAlloc(0);
    if (!b) return SQLITE_IOERR_NOMEM;
  }

  b->nRef++;
  f->pBuf = b;
  if (pOutFlags) *pOutFlags = flags;
  return SQLITE_OK;
}

static int wasmDelete(sqlite3_vfs *v, const char *z, int s) {
  WasmBuf *b = wasmBufFind(z);
  if (b) { free(b->aData); memset(b, 0, sizeof(*b)); }
  return SQLITE_OK;
}

static int wasmAccess(sqlite3_vfs *v, const char *z, int f, int *r) {
  *r = (wasmBufFind(z) != 0);
  return SQLITE_OK;
}

static int wasmFullPathname(sqlite3_vfs *v, const char *z, int n, char *out) {
  sqlite3_snprintf(n, out, "%s", z ? z : "");
  return SQLITE_OK;
}

static int wasmRandomness(sqlite3_vfs *v, int n, char *out) {
  static unsigned int s = 0xDEADBEEF;
  int i; for (i = 0; i < n; i++) { s = s * 1664525 + 1013904223; out[i] = (char)(s >> 16); }
  return SQLITE_OK;
}

static int wasmSleep(sqlite3_vfs *v, int us)              { return 0; }
static int wasmCurrentTime(sqlite3_vfs *v, double *p)     { *p = 2440587.5; return SQLITE_OK; }
static int wasmGetLastError(sqlite3_vfs *v, int n, char *z){ return 0; }

static sqlite3_vfs gWasmVfs = {
  1,
  sizeof(WasmFile),
  WASM_PATH_MAX,
  0,
  WASM_VFS_NAME,
  0,
  wasmOpen,
  wasmDelete,
  wasmAccess,
  wasmFullPathname,
  0, 0, 0, 0,
  wasmRandomness,
  wasmSleep,
  wasmCurrentTime,
  wasmGetLastError,
};

int sqlite3_os_init(void) {
  return sqlite3_vfs_register(&gWasmVfs, 1);
}

int sqlite3_os_end(void) {
  return 0;
}

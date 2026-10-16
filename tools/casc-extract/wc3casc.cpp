// wc3casc — minimal CascLib CLI for extracting Warcraft III (Reforged)
// CASC storages into a loose tree. Point <storage> at your own Warcraft III
// installation directory (the one containing .build.info / Data).
// modes:
//   list        <storage> <outListFile>
//   extract     <storage> <name> <outFile>
//   extract-mask<storage> <mask> <outDir>       (names 'war3.mpq:a/b' -> outDir/war3.mpq/a/b)
// Builds against CascLib (github.com/ladislav-zezula/CascLib); see build.sh.
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <string>
#include <sys/stat.h>
#include "CascLib.h"

static void mkdirs(const std::string &path) {
    std::string cur;
    for (char c : path) {
        cur += c;
        if (c == '/') mkdir(cur.c_str(), 0755);
    }
    mkdir(path.c_str(), 0755);
}

static std::string nameToPath(const std::string &name) {
    std::string out;
    out.reserve(name.size());
    for (char c : name) out += (c == ':' || c == '\\') ? '/' : c;
    return out;
}

static bool writeFile(HANDLE storage, const char *name, const std::string &dest, unsigned long long *bytesOut) {
    HANDLE f = NULL;
    if (!CascOpenFile(storage, name, 0, CASC_OPEN_BY_NAME, &f)) return false;
    size_t slash = dest.find_last_of('/');
    if (slash != std::string::npos) mkdirs(dest.substr(0, slash));
    FILE *out = fopen(dest.c_str(), "wb");
    if (!out) { CascCloseFile(f); return false; }
    char buf[0x10000];
    DWORD got = 0;
    unsigned long long total = 0;
    for (;;) {
        if (!CascReadFile(f, buf, sizeof(buf), &got) || got == 0) break;
        fwrite(buf, 1, got, out);
        total += got;
    }
    fclose(out);
    CascCloseFile(f);
    if (bytesOut) *bytesOut = total;
    return true;
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "usage:\n  %s list <storage> [outListFile]\n  %s extract <storage> <name> <outFile>\n  %s extract-mask <storage> <mask> <outDir>\n",
                argv[0], argv[0], argv[0]);
        return 2;
    }
    const char *mode = argv[1];
    HANDLE storage = NULL;
    if (!CascOpenStorage(argv[2], 0, &storage)) {
        fprintf(stderr, "CascOpenStorage(%s) failed: err=%u\n", argv[2], GetCascError());
        return 1;
    }
    printf("storage opened: %s\n", argv[2]);

    if (!strcmp(mode, "list")) {
        const char *outList = (argc > 3) ? argv[3] : "casc-list.txt";
        FILE *lf = fopen(outList, "w");
        CASC_FIND_DATA fd;
        memset(&fd, 0, sizeof(fd));
        HANDLE h = CascFindFirstFile(storage, "*", &fd, NULL);
        long long n = 0;
        if (h && h != INVALID_HANDLE_VALUE) {
            do {
                n++;
                if (lf) fprintf(lf, "%llu\t%s\n", (unsigned long long)fd.FileSize, fd.szFileName);
                if (n <= 30) printf("  %s\n", fd.szFileName);
            } while (CascFindNextFile(h, &fd));
            CascFindClose(h);
        } else {
            fprintf(stderr, "find failed err=%u\n", GetCascError());
        }
        if (lf) fclose(lf);
        printf("total files: %lld (list written to %s)\n", n, outList);
    } else if (!strcmp(mode, "extract")) {
        if (argc < 5) { fprintf(stderr, "extract needs <storage> <name> <outFile>\n"); return 2; }
        unsigned long long total = 0;
        if (!writeFile(storage, argv[3], argv[4], &total)) {
            fprintf(stderr, "extract failed for %s (err=%u)\n", argv[3], GetCascError());
            return 1;
        }
        printf("extracted %s -> %s (%llu bytes)\n", argv[3], argv[4], total);
    } else if (!strcmp(mode, "extract-mask")) {
        if (argc < 5) { fprintf(stderr, "extract-mask needs <storage> <mask> <outDir>\n"); return 2; }
        std::string outDir = argv[4];
        CASC_FIND_DATA fd;
        memset(&fd, 0, sizeof(fd));
        HANDLE h = CascFindFirstFile(storage, argv[3], &fd, NULL);
        long long ok = 0, fail = 0;
        if (h && h != INVALID_HANDLE_VALUE) {
            do {
                std::string dest = outDir + "/" + nameToPath(fd.szFileName);
                unsigned long long total = 0;
                if (writeFile(storage, fd.szFileName, dest, &total)) {
                    ok++;
                    if (ok % 500 == 0) printf("  ... %lld files\n", ok);
                } else {
                    fail++;
                    if (fail <= 20) fprintf(stderr, "  FAIL(%u): %s\n", GetCascError(), fd.szFileName);
                }
            } while (CascFindNextFile(h, &fd));
            CascFindClose(h);
        } else {
            fprintf(stderr, "find failed err=%u\n", GetCascError());
        }
        printf("extract-mask done: ok=%lld fail=%lld -> %s\n", ok, fail, argv[4]);
    } else if (!strcmp(mode, "extract-list")) {
        if (argc < 5) { fprintf(stderr, "extract-list needs <storage> <nameFile> <outDir>\n"); return 2; }
        std::string outDir = argv[4];
        FILE *nl = fopen(argv[3], "r");
        if (!nl) { fprintf(stderr, "cannot open %s\n", argv[3]); return 2; }
        char line[4096];
        long long ok = 0, fail = 0;
        while (fgets(line, sizeof(line), nl)) {
            size_t len = strlen(line);
            while (len && (line[len - 1] == '\n' || line[len - 1] == '\r')) line[--len] = 0;
            if (!len) continue;
            std::string dest = outDir + "/" + nameToPath(line);
            unsigned long long total = 0;
            if (writeFile(storage, line, dest, &total)) {
                ok++;
                if (ok % 1000 == 0) printf("  ... %lld files\n", ok);
            } else {
                fail++;
                if (fail <= 30) fprintf(stderr, "  FAIL(%u): %s\n", GetCascError(), line);
            }
        }
        fclose(nl);
        printf("extract-list done: ok=%lld fail=%lld -> %s\n", ok, fail, argv[4]);
    } else {
        fprintf(stderr, "unknown mode %s\n", mode);
        return 2;
    }

    CascCloseStorage(storage);
    return 0;
}

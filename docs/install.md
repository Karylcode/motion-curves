**English** | [繁體中文](install.zh-TW.md) · [Docs index](README.md)

# Installation

## Use the live site

Nothing to install. Open https://karylcode.github.io/motion-curves/ in a browser with WebGL. The interface is in Traditional Chinese.

The live site has no motions. Drag your own files in: see [Importing motions](importing.md).

## Run on your computer

You need:

- Node.js 20.19+ or 22.12+ (required by Vite 7.1.7). GitHub Actions builds with Node 22.
- npm (comes with Node.js).

```bash
git clone https://github.com/Karylcode/motion-curves.git
cd motion-curves
npm install
npm run dev
```

Open http://127.0.0.1:5200/. The dev server listens only on 127.0.0.1, and it stops if port 5200 is already taken (`--strictPort`).

On Windows you can double-click `啟動網站.bat` instead. It runs `npm install` the first time (when `node_modules` is missing), opens http://127.0.0.1:5200/ and starts `npm run dev`.

A fresh clone has no motions: `public/motions/` is in `.gitignore`. Drag files into the page ([Importing motions](importing.md)) or export from Unity ([Exporting from Unity](unity-export.md)).

## Optional tools

| For | You need |
|---|---|
| Naming tools (`tools/naming-*.py`) | Python 3, numpy, Pillow. `naming-pack.py` loads the font `C:\Windows\Fonts\msjh.ttc`, so as written it runs on Windows. |
| Full Unity export (`unity/*.cs.txt`) | A Unity project with UniVRM and Newtonsoft.Json (`com.unity.nuget.newtonsoft-json`), plus [MCP for Unity](https://github.com/CoplayDev/unity-mcp) to run the scripts. See [Exporting from Unity](unity-export.md). |

Building and deploying: see [Development](development.md).

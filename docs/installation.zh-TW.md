[English](installation.md) | **繁體中文** · [文件索引](README.zh-TW.md)

# 安裝

## 用線上版

不用安裝。用支援 WebGL 的瀏覽器打開 https://karylcode.github.io/motion-curves/ 。介面是繁體中文。

線上版沒有任何動作，要把自己的動作檔拖進去，見[匯入動作](importing.zh-TW.md)。

## 在自己電腦上跑

需要：

- Node.js 20.19 以上或 22.12 以上（Vite 7.1.7 的要求）。GitHub Actions 用 Node 22 打包。
- npm（裝 Node.js 就有）。

```bash
git clone https://github.com/Karylcode/motion-curves.git
cd motion-curves
npm install
npm run dev
```

打開 http://127.0.0.1:5200/ 。開發伺服器只聽 127.0.0.1；5200 埠被占用時會直接停掉（`--strictPort`）。

Windows 也可以雙擊 `啟動網站.bat`。第一次（還沒有 `node_modules`）會先跑 `npm install`，接著打開 http://127.0.0.1:5200/ 並執行 `npm run dev`。

剛 clone 下來沒有任何動作：`public/motions/` 在 `.gitignore` 裡。把檔案拖進網頁（[匯入動作](importing.zh-TW.md)），或從 Unity 匯出（[從 Unity 匯出](unity-export.zh-TW.md)）。

## 選用工具

| 用途 | 需要 |
|---|---|
| 命名工具（`tools/naming-*.py`） | Python 3、numpy、Pillow。`naming-pack.py` 會讀字型 `C:\Windows\Fonts\msjh.ttc`，照現在的寫法只能在 Windows 跑。 |
| 完整的 Unity 匯出（`unity/*.cs.txt`） | Unity 專案要有 UniVRM、Newtonsoft.Json（`com.unity.nuget.newtonsoft-json`），再用 [MCP for Unity](https://github.com/CoplayDev/unity-mcp) 跑腳本。見[從 Unity 匯出](unity-export.zh-TW.md)。 |

打包和部署：見[開發](development.zh-TW.md)。

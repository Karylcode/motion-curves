[English](README.md) | **繁體中文**

# Motion Curves

[![Pages](https://github.com/Karylcode/motion-curves/actions/workflows/pages.yml/badge.svg)](https://github.com/Karylcode/motion-curves/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20.19+](https://img.shields.io/badge/node-20.19%2B-blue.svg)](https://nodejs.org/)
[![three.js 0.180.0](https://img.shields.io/badge/three.js-0.180.0-orange.svg)](https://threejs.org/)

把人形動作變成看得懂、也讀得到的數據：在網頁上用 VRM 角色播放動作，旁邊畫出關節角度、Unity 肌肉曲線。每一格的數字都能下載，也能讓 AI 透過 `window.motionCurves` 直接在瀏覽器裡讀。這個倉庫**不含任何動作**，只附一個角色（`AvatarSample_A.vrm`）。打開網頁後把自己的動作檔拖進去就能看。用 three.js、@pixiv/three-vrm、@pixiv/three-vrm-animation、Vite 做的。完整的 Unity 曲線要用 C# 腳本在 Unity 編輯器裡匯出。網頁介面是繁體中文。

**線上試用：** https://karylcode.github.io/motion-curves/

## 可以做什麼

- **播放**：六個視角、逐格、慢速、Root 移動（位置和轉向）、骨架線、武器和武器尖端軌跡、頭髮物理。
- **關節角度**：膝蓋、手肘、大腿、上臂、上身傾斜、骨盆和胸口轉向、頭、腳離地高度、兩腳距離、手高度共 28 項，加上左右腳踩地的時段。點圖就跳到那一格。
- **Unity 曲線**（Unity 匯出的動作才有）：95 條 Humanoid 肌肉值、身體重心、Root 移動、手腳 IK 目標，照 Unity 實際播放的方式畫。
- **選單**：照武器、類型、姿勢、位移、播放（循環／單次）、手篩選，也能搜尋名稱、英文名、描述。
- **換角色**：把 `.vrm` 拖進來就換成你的角色（VRM 1.0 和 0.x 都可以），下次打開還是它。
- **給 AI**：`window.motionCurves` 可以拿任一條數據每一格的值、某一格全部的值、骨頭位置、截圖（`motionCurves.help()` 看全部）。

## 需求

- 線上版：支援 WebGL 的瀏覽器，不用安裝。
- 在自己電腦上跑：Node.js 20.19 以上或 22.12 以上，加上 npm。
- 選用：Python 3＋numpy＋Pillow（命名工具）；Unity＋UniVRM＋Newtonsoft.Json＋MCP for Unity（完整的 Unity 匯出）。

詳細：[安裝](docs/installation.zh-TW.md)。

## 快速開始

**用線上版。** 打開 https://karylcode.github.io/motion-curves/ ，把 `.vrma` 或 `.fbx` 拖進網頁，或按「匯入動作／角色」。

**在自己電腦上跑。**

```bash
git clone https://github.com/Karylcode/motion-curves.git
cd motion-curves
npm install
npm run dev
```

打開 http://127.0.0.1:5200/ 。Windows 也可以雙擊 `啟動網站.bat`。網址後面加 `#動作id` 會直接開那支動作。

接著看：[使用方式](docs/usage.zh-TW.md)。

## 疑難排解

- **「FBX 骨頭名稱對不上」**：先轉成 VRMA，或改用 Mixamo、Unity Humanoid、UE 的骨頭名稱。
- **兩個 Unity 分頁按不了**：網頁匯入的動作沒有 Unity 曲線，要從 Unity 匯出才有。
- **匯入的動作不見了**：動作只存在這台瀏覽器的 IndexedDB，清除瀏覽器資料或換電腦就沒了。
- **`npm run dev` 跑不起來**：5200 埠可能被占用（指令有加 `--strictPort`），或 Node 版本低於 20.19。

更多：[疑難排解](docs/troubleshooting.zh-TW.md)。

## 文件

- [文件索引](docs/README.zh-TW.md)：所有頁面、從哪裡開始讀，以及 Unity 端的專案筆記
- [安裝](docs/installation.zh-TW.md)：需求、在自己電腦上跑、選用工具
- [使用方式](docs/usage.zh-TW.md)：播放、圖表、下載、`#id` 網址、`window.motionCurves`
- [匯入動作](docs/importing.zh-TW.md)：拖進網頁、隱私、限制
- [從 Unity 匯出](docs/unity-export.zh-TW.md)：Unity 流程和腳本
- [資料格式](docs/data-format.zh-TW.md)：每支動作的三個 JSON
- [Unity 實際怎麼播](docs/how-unity-plays.zh-TW.md)：dense 和 curve，以及怎麼驗證
- [開發](docs/development.zh-TW.md)：npm 指令、打包、工具、程式結構
- [疑難排解](docs/troubleshooting.zh-TW.md)：常見錯誤和處理方式

## 授權

MIT，詳見 [LICENSE](LICENSE)。
- `public/models/AvatarSample_A.vrm`：用 VRoid Studio 做的角色，檔案裡的授權（[VRM Public License 1.0](https://vrm.dev/licenses/1.0/)）允許所有人使用、商用、再散布、改作後再散布，不用標示作者。
- 用到 [three.js](https://threejs.org/)、[@pixiv/three-vrm](https://github.com/pixiv/three-vrm)（都是 MIT）。
- 這個倉庫不含任何第三方動作或模型素材。用商城素材匯出的動作和武器模型不要放進公開倉庫（`.gitignore` 已經排除 `public/motions/` 和武器模型）。

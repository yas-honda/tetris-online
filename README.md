# テトリス・オンライン

Node.js + Express + Socket.IO で動作する、2人用リアルタイム対戦テトリスです。

## ローカル起動

```bash
npm install
npm start
```

ブラウザで http://localhost:3000 を開きます。

## Renderへのデプロイ

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Region: Singapore（日本からの接続向け）
- Health Check Path: `/health`

GitHubにこのフォルダ内のファイルをアップロードしてください。`node_modules` はアップロード不要です。

## 遊び方

1. 1人目がルームを作成し、表示された5文字のコードを共有。
2. 2人目がコードを入力して参加。
3. 2人とも「準備OK」を押すと開始。
4. ラインを2行以上消すと相手にお邪魔ブロックを送ります。

操作: ← → 移動 / ↓ 落下 / ↑ または X 回転 / Space ハードドロップ

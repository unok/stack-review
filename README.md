# stack-review

`gh stack` で積んだ stacked PRs を、GitHub に submit する前に自分で読み切るための CLI。リポジトリの中で `stack-review` と打つと、herdr に専用ワークスペースが立ち上がり、各レイヤーの差分が hunk のタブに 1 枚ずつ開く。

レビュアーが PR で見るのと同じ切り口（親レイヤーからの差分）で、submit する前に自分で確認できる。

```
workspace: review: myrepo          ← 新規作成。既存のワークスペースには触れない
┌[control][1 auth-layer]-[2 api-endpoints]-[3 frontend]┐
│ review: myrepo   3 layers                            │
│                                                      │
│   #  branch          files  TODO  hunk               │
│   1  auth-layer          2     1  ● live             │
│   2  api-endpoints       5     0  ● live             │
│   3  frontend            3     2  ○ closed           │
│                                                      │
│   全部見終えたら Enter → _                           │
└──────────────────────────────────────────────────────┘
```

## 必要なもの

| ツール | 用途 |
|---|---|
| [herdr](https://herdr.dev) | ワークスペースとタブの構築 |
| [hunk](https://www.npmjs.com/package/hunk) 0.17 以上 | 差分表示と `session` API |
| [gh](https://cli.github.com/) + [gh-stack](https://github.com/github/gh-stack) | スタック構成の取得と submit |
| Node.js 22.18 以上 | `.ts` の直接実行（型ストリップ） |

ビルド工程は無い。`src/cli.ts` を Node がそのまま実行する。型ストリップが既定で有効になった Node 22.18 未満では動かないため、`package.json` の `engines` でも宣言している。

## 導入

```bash
git clone git@github.com:unok/stack-review.git
cd stack-review
pnpm install
npm link
```

Claude Code のスキルとしても使うなら、`.skill` をリンクする。

```bash
ln -s "$PWD/.skill" ~/.claude/skills/stack-review
```

## 使い方

スタックを積んだリポジトリの中で実行する。

```bash
stack-review
```

コマンドはレビュー環境を組み立てたら終了するので、起動したペインはすぐ解放される。以降は control タブが受け持つ。

各レイヤーのタブを見て回り、直したい箇所には hunk の上でコメントを付ける。付けたコメントは control タブに TODO 件数として即座に反映される。全部見終えたら control タブで Enter を押す。

Enter を押すと、付けたコメントが Markdown にまとまって表示され、`<absolute-git-dir>/stack-review/latest.md` に保存される。`<absolute-git-dir>` は `git rev-parse --absolute-git-dir` の出力で、worktree では `.git` 直下ではない。

- コメントが 0 件なら `gh stack submit` を実行するか聞かれる。`--auto` は付かないので、PR のタイトルと本文は対話エディタで自分で書く
- コメントが 1 件でもあれば submit は聞かれない。修正してからもう一度レビューする

最後にレビュー用ワークスペースを閉じるか聞かれる。既定は閉じる。

途中で Ctrl-C を押しても、それまでに付けたコメントは保存される。この場合 submit は聞かれない。

## 仕組みで注意している点

**hunk を先に閉じてもコメントは失われない。** Hunk セッションは TUI の終了と同時に消え、そこに付いたコメントも一緒に消える。そのため control タブは待機中に 2 秒間隔でコメントを取り続け、最新のスナップショットを保持している。いつ hunk を閉じても、閉じる直前の状態が残る。

**レビューメモは worktree ごとに分かれる。** 保存先は `git rev-parse --absolute-git-dir` の配下なので、worktree で作業していればその worktree 専用の場所に書かれる。worktree が違えばスタックも違うため。

**既存のワークスペースには一切触れない。** レビュー環境は毎回新しいワークスペースとして作られ、終了時に丸ごと閉じられる。組み立ての途中で失敗した場合も作りかけのワークスペースは片付けられる。

## レビューメモの形

```markdown
# レビューメモ

## auth-layer

- `src/auth/session.go:42`
  この分岐、トークン期限切れのときに落ちない？

## frontend

- `src/components/Login.tsx:18`
  エラー文言がハードコードされている
```

前回のメモは `<absolute-git-dir>/stack-review/history/<タイムスタンプ>.md` に退避される。

## 開発

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
```

外部コマンド（herdr / hunk / gh / git）の呼び出しは `src/exec.ts` の `CommandRunner` に集約してあり、テストではモックを差し込む。テストが実際の herdr ワークスペースや GitHub を触ることはない。

用語は [CONTEXT.md](./CONTEXT.md)、設計判断は [docs/adr/](./docs/adr/) にある。

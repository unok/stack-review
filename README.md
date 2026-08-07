# stack-review

`gh stack` で積んだ stacked PRs を、GitHub に submit する前に自分で読み切るための CLI。リポジトリの中で `stack-review` と打つと、herdr に専用ワークスペースが立ち上がり、各レイヤーのコード差分と PR description が hunk のタブに開く。

レビュアーが PR で見るコードと本文を、submit 前に同じレイヤー単位で確認できる。レビュー後の submit は Claude に依頼し、`stack-review submit` が draft の内容で PR を作成または更新する。

```
workspace: review: myrepo   ← 新規作成。既存のワークスペースには触れない
┌[control][1 auth][1 auth desc][2 api][2 api desc]┐
│ review: myrepo   2 layers                       │
│                                                 │
│   #  branch  files  TODO  hunk      desc        │
│   1  auth        2     1  ● live    書済        │
│   2  api         5     0  ○ closed  空          │
│                                                 │
│   全部見終えたら Enter → _                      │
└─────────────────────────────────────────────────┘
```

## 必要なもの

| ツール | 用途 |
|---|---|
| [herdr](https://herdr.dev) | ワークスペースとタブの構築 |
| [hunk](https://www.npmjs.com/package/hunk) 0.17 以上 | 差分表示と `session` API |
| [gh](https://cli.github.com/) + [gh-stack](https://github.com/github/gh-stack) | スタック構成の取得、push、PR の作成と更新 |
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

各レイヤーにはコード差分のタブと、名前の末尾が `desc` の本文タブがある。本文タブには既存 PR の description と draft の差分が開く。コードだけでなく、タイトルと本文もプリフライトレビューの対象になる。

直したい箇所には hunk の上でコメントを付ける。コード差分と本文のコメントは control タブの TODO 件数に合算される。全部見終えたら control タブで Enter を押す。

Enter を押すと、付けたコメントが Markdown にまとまって表示され、`<absolute-git-dir>/stack-review/latest.md` に保存される。`<absolute-git-dir>` は `git rev-parse --absolute-git-dir` の出力で、worktree では `.git` 直下ではない。

コメントが 0 件なら、Claude に渡す依頼文が表示される。draft が未記入なら、先に draft を書く依頼文になる。コメントが 1 件でもあれば依頼文は出ない。修正してからもう一度レビューする。

最後にレビュー用ワークスペースを閉じるか聞かれる。既定は閉じる。

途中で Ctrl-C を押しても、それまでに付けたコメントは保存される。この場合 submit は聞かれない。

## PR description の draft

draft は次の場所に置く。`<absolute-git-dir>` は `git rev-parse --absolute-git-dir` の出力で、worktree ごとに異なる。

```text
<absolute-git-dir>/stack-review/descriptions/<エンコード済みブランチ名>.md
```

ファイル名は JavaScript の `encodeURIComponent` でエンコードする。たとえば `refactor/foo` の draft は `refactor%2Ffoo.md` になる。

1 行目の `# ` 見出しが PR タイトルで、2 行目以降が PR 本文になる。本文は空でもよいが、submit 前に全レイヤーのタイトルが必要になる。

```markdown
# セッション期限切れを処理する

認証トークンの期限切れを明示的に扱う。
```

`stack-review` を先に起動すると、存在しない draft は `# ` だけのテンプレートとして作られる。先にファイルを用意してもよい。

## Submit

control タブに依頼文が出たら、その一行を Claude に渡す。Claude は対象リポジトリで次を実行する。

```bash
stack-review submit
```

このコマンドは全 draft のタイトルを検査してから全ブランチを push し、下のレイヤーから PR を作成または更新する。新規 PR は draft 状態で作り、最後に全ブランチを `gh stack link` でスタック化する。途中で失敗した場合はそこで止まり、完了済みの PR を表示する。

`gh stack submit` は PR 本文を渡せないため直接実行しない。

## スタック構造の変更

レイヤーの差し込み・並べ替え・リネーム・削除は、利用者が `gh stack modify` の対話 TUI で行う。エージェントからは操作できない。変更後に `stack-review submit` を実行すると、最後の `gh stack link` が全ブランチを下から上の順で受け取り、GitHub 上のスタック構成を現在のブランチ順に合わせる。既存 PR の base は `gh pr edit` では変更しない。

リネームしたレイヤーは、`descriptions/` の draft ファイルも新しいブランチ名へ手でリネームする。古いファイルを残すと孤児 draft の警告が出て、既存 PR を発見できず重複 PR が作られる。レイヤーを削除しても GitHub 上の PR は残るため、不要な PR は手で閉じる。

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

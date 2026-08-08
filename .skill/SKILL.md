---
name: stack-review
description: gh stack で積んだ stacked PRs を submit 前に利用者自身が読み切るためのレビュー環境を herdr 上に立ち上げる。PR description の draft 作成、レビューメモに沿った修正、stack-review submit による PR 作成・更新も扱う。トリガー例「プリフライトレビュー」「stack-review 起動して」「draft を書いて」「レビュー終わった、修正して」「stack-review の submit を実行して」。
---

# stack-review

`stack-review` コマンドは、herdr に専用ワークスペースを作り、スタックの各レイヤーのコード差分と PR description を hunk で開く。

**プリフライトレビューで差分を読むのは利用者であってあなたではない。** あなたはレビュー環境の起動、draft の作成、レビューメモに沿った修正、submit を担当する。

## 起動を頼まれたとき

対象リポジトリの中で実行する。

```bash
stack-review
```

これだけ。コマンドはレビュー環境を組み立てたら即座に終了する。以降の進行は control タブの中で動くプロセスが受け持つので、あなたは待たない。

実行後に伝えること:

- `review: <リポジトリ名>` ワークスペースが開いたこと
- 各レイヤーのコード差分と本文がタブに分かれていること
- 見終えたら control タブで Enter を押すこと

### やってはいけないこと

- `hunk diff` や `hunk show` を直接実行しない。TUI があなたのペインを占有して利用者が操作できなくなる
- 差分を読んで評価しない。指摘を先回りして出さない。利用者が自分で読む前提で設計されている
- `gh stack submit` を実行しない。PR 本文を渡せないため、submit は `stack-review submit` に一本化している
- `herdr workspace close` を実行しない。control タブが確認したうえで閉じる

### スタックが無いと言われたとき

`gh stack` のスタックが未作成。`gh stack init <branch>...` で作るところから提案する。

### 未コミット変更の警告が出たとき

警告であって失敗ではない。レビューは続行される。その変更はどのレイヤーにも入っていないので submit しても反映されない、という事実だけ伝える。

## 修正を頼まれたとき

利用者が「レビュー終わった」「修正して」と言ったら、レビューメモを読む。

```bash
cat "$(git rev-parse --absolute-git-dir)/stack-review/latest.md"
```

`## <ブランチ名>` の見出しごとに、`` `ファイルパス:行番号` `` と本文が並んでいる。見出しがそのまま修正すべきレイヤーを指す。

修正は**そのレイヤーのブランチで行う**。上の層で辻褄を合わせない。

```bash
gh stack checkout <ブランチ名>
# 修正してコミット
gh stack rebase --upstack
```

複数レイヤーにメモがあるときは下の層から順に直す。1 つの層を直すたびに `gh stack rebase --upstack` を実行する。

過去のレビュー分は `$(git rev-parse --absolute-git-dir)/stack-review/history/<タイムスタンプ>.md` にある。今回のメモに無いものを蒸し返さない。

## draft を頼まれたとき

draft は `stack-review` の実行前でも後でも書ける。ただし `stack-review submit` の前に、全レイヤーのタイトルを埋める。レビュー起動後に書いた draft は control タブの表示に反映されないが、submit は最新の内容を読む。

保存先は次の形になる。`<absolute-git-dir>` は `git rev-parse --absolute-git-dir` で調べる。

```text
<absolute-git-dir>/stack-review/descriptions/<エンコード済みブランチ名>.md
```

ファイル名には JavaScript の `encodeURIComponent` を使う。`refactor/foo` なら `refactor%2Ffoo.md` になる。ブランチ名をそのままディレクトリとして扱わない。

1 行目の `# ` 見出しが PR タイトルで、2 行目以降が本文になる。1 行目が `# ` で始まらないファイルはエラーになる。

```markdown
# セッション期限切れを処理する

認証トークンの期限切れを明示的に扱う。
```

`stack-review` を実行すると、存在しない draft は `# ` だけのファイルとして作られる。そのファイルを編集しても、先に同じパスへ作成してもよい。

## スタック構造の変更を頼まれたとき

レイヤーの差し込み・並べ替え・リネーム・削除には `gh stack modify` の対話 TUI が必要になる。あなたからは操作できないため、対象リポジトリで利用者に実行してもらう。変更後の `stack-review submit` は、最後の `gh stack link` に全ブランチを下から上の順で渡し、GitHub 上のスタック構成を現在のブランチ順に合わせる。既存 PR の base は `gh pr edit` では変更しない。

リネームした場合は、`descriptions/` の draft ファイルも新しいブランチ名へ利用者が手でリネームする。リネームしないと本文が引き継がれず、孤児 draft の警告が出る。既存 PR はブランチ名で探すため、リネーム後の submit では旧ブランチの PR は更新されず、新しい PR が作られる。旧 PR と、削除したレイヤーの PR は GitHub 上に残るため、利用者が手で閉じる。

## submit を頼まれたとき

対象リポジトリで次を実行する。

```bash
stack-review submit
```

タイトルが未記入のレイヤーが表示されたら、その draft を書いてから同じコマンドを再実行する。成功時は作成・更新された PR の番号と URL を利用者へ伝える。途中で失敗した場合は、表示された完了済み PR と失敗箇所をそのまま報告し、作成済み PR を削除しない。

`gh stack submit` は直接実行しない。PR 本文を渡せず、draft と GitHub 上の本文がずれるため。

## 用語

リポジトリ直下の `CONTEXT.md` に定義がある。特に紛らわしいもの:

- **プリフライトレビュー** — submit 前に利用者が自分で読む行為。このツールの対象
- **PR レビュー** — submit 後に GitHub 上で他人が行うレビュー。対象外
- **レビューメモ** — 利用者が hunk 上で付けた inline コメント。hunk のエージェントコメントとは別物

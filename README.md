# ilo
issue bot for [nanpa](https://github.com/nbsp/nanpa), the language-agnostic release manager

[![install app](https://img.shields.io/badge/app-ilo--nanpa-green)](https://github.com/apps/ilo-nanpa) ![GitHub Action](https://img.shields.io/badge/action-nbsp%2Filo%2Fnanpa%40v1-blue)

built with [Probot](https://probot.github.io). refer to their website for information on running
this yourself.

## installation

[click here](https://github.com/apps/ilo-nanpa) to install this bot.

## action

this repository also provides a GitHub Action for using nanpa in your workflows, to use in tandem
with ilo. the following workflow should serve as a good template for using ilo:

<details>
<summary>a sample GitHub Actions workflow</summary>

```yml
on:
  workflow_dispatch:
    inputs:
      packages:
        description: "packages to bump"
        type: string
        required: true

jobs:
  bump:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(github.event.inputs.packages) }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Get package path
        id: path
        run: export GITHUB_OUTPUT=path=$(sed 's|[^/]*/\(.*\)@.*|\1|' <<< ${{ matrix.package }} | sed 's|^[^/]*$||')
          
      - name: Run nanpa
        uses: nbsp/ilo/nanpa@v1
        with:
          args: changeset ${{ steps.path.outputs.path }} -y
 
      - name: Diff git repository
        run: |
          git add -N .
          git diff > ${{ matrix.package }}.diff

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.package }}
          path: ${{ matrix.package }}.diff

  commit:
    needs: [bump]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: .

      - name: Apply all diffs
        run: for diff in $(find . -name *.diff); do git apply "$diff"; rm "$diff"; done

      - name: Git commit
        run: |
          git config user.name '${{ github.actor }}'
          git config user.email https://github.com/nbsp/ilo
          git add .
          git commit -m"nanpa: bump"
          git push

  tags:
    needs: [commit]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(github.event.inputs.packages) }}
    permissions:
      contents: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Git tag
        run: |
          git config user.name '${{ github.actor }}'
          git config user.email https://github.com/nbsp/ilo
          git pull
          git tag ${{ matrix.package }} -m ${{ matrix.package }}
          git push --tags
```
</details>

## support
if you need help, or you think you've found a bug, send a [plain text 
email](https://useplaintext.email) to [the mailing list](mailto:~nbsp/public-inbox@lists.sr.ht).
the issue tracker is for *confirmed bugs only*; unconfirmed issues and general support requests will
be closed.

## contributing
open pull requests, or send patches to [the mailing list](https://lists.sr.ht/~nbsp/public-inbox).

prefix patches with "`[PATCH nanpa]`". see [the guide to `git send-email`](https://git-send-email.io)
if this is your first time using sourcehut.

## license
ilo is licensed under the GNU Affero General Public License, version 3. refer to [the license](LICENSE) for details.

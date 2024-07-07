# ilo
pull request bot for nanpa, the language-agnostic release manager

built with [Probot](https://probot.github.io). refer to their website for information on running this yourself.

deployed on vercel.

## installation

[click here](https://github.com/apps/ilo-nanpa) to install this bot.

## action

this repository also provides a GitHub Action for using nanpa in your workflows, to use in tandem with ilo. the following workflow should serve as a good template for using ilo:

```yml
on:
  workflow_dispatch:
    inputs:
      packages:
        description: "packages to bump"
        required: true
        default: []

jobs:
  bump:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ github.event.inputs.packages }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Run nanpa
        uses: nbsp/ilo/nanpa@v1
        with:
          args: 'changeset ${{ matrix.package }}'
```


## contributing
open pull requests, or send patches to [the mailing list](https://lists.sr.ht/~nbsp/public-inbox). prefix patches with "`[PATCH ilo]`" (see [the guide to `git send-email`](https://git-send-email.io) if this is your first time using sourcehut).

## license
ilo is licensed under the GNU Affero General Public License, version 3. refer to [the license](LICENSE) for details.

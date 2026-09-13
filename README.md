# Dadbot

**A small corner of the internet for curious people.**

[Visit dadbot.blog](https://dadbot.blog/) · [About Dadbot](https://dadbot.blog/about/) · [Legal & privacy](https://dadbot.blog/legal/)

Dadbot is an independent blog about technology, everyday life, books, and the stories worth a closer look. Written with dads in mind, open to everyone.

The aim is simple: explain things clearly, show the evidence, and leave room for readers to make up their own minds. There are also a desk radio and a game, because even curiosity needs the occasional tea break.

This repository contains the site's content, Hugo templates, styling, browser features, and tests.

## Around the site

| Section | What you'll find |
| --- | --- |
| [News](https://dadbot.blog/news/) | Current stories with context, sources, and competing views. |
| [Blog](https://dadbot.blog/posts/) | Longer reads on tech, money, football, and everyday life. |
| [Book reviews](https://dadbot.blog/books/) | Reviews to help you decide what deserves your reading time. |
| [Conspiracy Corner](https://dadbot.blog/conspiracy-corner/) | A skeptical but curious look at extraordinary claims and documented events. |
| [Token Wars](https://dadbot.blog/games/) | A browser-based trading game with fictional AI tokens and questionable financial decisions. |
| [Radio](https://dadbot.blog/radio/) | A terminal-style desk radio for browsing and listening to stations around the world. |

## Built with

- [Hugo](https://gohugo.io/), a static-site generator, with Markdown content.
- [Re-Terminal](https://github.com/mirus-ua/hugo-theme-re-terminal), included as a Git submodule, with custom layouts and styling.
- JavaScript modules for interactive features, including Token Wars, radio, and weather.
- GitHub Actions for tests and builds, and GitHub Pages for hosting.
- Python tooling for article-image generation and its tests.

The design borrows from old terminals: monospace type, square panels, and muted green controls. The site is static, with browser-side JavaScript where interaction calls for it.

## Run locally

Install Git and **Hugo Extended 0.163.3** to match the deployment workflow. The Extended edition is needed for the theme's Sass processing.

For a fresh checkout:

```sh
git clone --recurse-submodules https://github.com/doughn8/dadbot-blog.git
cd dadbot-blog
```

If you've already cloned the repository without its theme:

```sh
git submodule update --init --recursive
```

Start the local preview:

```sh
hugo server -D --bind 127.0.0.1 --port 1313 --baseURL http://127.0.0.1:1313/
```

Open **http://127.0.0.1:1313/**. Hugo refreshes the preview as files change. The `-D` flag includes draft content; omit it to preview without drafts.

Build the production site:

```sh
hugo --gc --minify --baseURL "https://dadbot.blog/"
```

Hugo writes the generated site to `public/`.

## Repository layout

```text
content/                 Articles, section pages, and site copy
layouts/                 Custom Hugo templates and partials
assets/                  Assets processed by Hugo
static/                  CSS, images, and browser-side features
  games/token-wars/       Token Wars game code and styles
  radio/                 Radio player code and styles
scripts/                 Article-image tooling
config/                  Image-generation configuration
tests/                   JavaScript and Python tests
themes/re-terminal/      Upstream theme (Git submodule)
hugo.toml                Site settings and navigation
.github/workflows/       Test, build, and deployment workflow
```

Site-specific changes belong in the root-level layouts and assets rather than edits inside the theme submodule.

## Tests

The deployment workflow uses **Node.js 22** and **Python 3.11**. Run these commands from the repository root.

JavaScript tests use Node's built-in test runner:

```sh
node --test tests/*.test.mjs tests/*/*.test.mjs
```

For the Python tests, install the image tooling's dependencies in a virtual environment:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-image-system.txt
python -m unittest discover -s tests -p 'test_*.py'
```

Node and Python are needed for these checks, not for the basic Hugo preview. Automated tests do not replace checking changed pages in a browser, especially navigation, keyboard controls, and layouts at phone and tablet widths.

## Publishing

The [deployment workflow](.github/workflows/deploy.yml) runs on pushes to `main` and can also be triggered manually. It runs the JavaScript and Python tests, builds the production site, and deploys the generated files to GitHub Pages at **dadbot.blog**.

Work is reviewed locally before publication. A local edit, a commit, and a push are separate steps: pushing to `main` starts the publishing workflow.

## Corrections and changes

Found a broken page or something an article gets wrong? Include the page URL and enough detail to reproduce the problem or check the claim. Sources are particularly helpful for factual corrections. Contact details are on the [legal page](https://dadbot.blog/legal/).

For code changes, keep the scope small, run the relevant tests, and preview the result before proposing it. Discuss larger design changes first; the terminal look is intentional.

## Credits and reuse

Dadbot builds on the Re-Terminal theme. Third-party code, fonts, images, and book covers retain their respective rights and licence terms.

This repository does not currently include a project-wide licence. Public access is not a blanket licence to reuse its code, writing, or images; ask before republishing material.

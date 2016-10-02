# a9

**a9** is an Evernote-style note-taking application.

## Features

With a9, you can ...

* edit and preview a [Markdown](http://daringfireball.net/projects/markdown/) document at the same time
* save the document in Markdown format, which can be opened directly by other editors
* export the document and view it in the viewer
* organize documents into "books" like in [Evernote](https://evernote.com/)
* print documents in full-page format
* customize styling by editing the CSS files
* insert LaTeX formulas using `$..$` and `$$..$$` — the equations will be displayed using [MathJax](http://www.mathjax.org/)
* draw simple graphics (like graphical models) with special SVG hacks (to be documented)

The documents are saved locally.
To sync or back up the documents, use [an existing sync or backup service](http://alternativeto.net/category/backup-and-sync/).
I put it in my [Dropbox](https://www.dropbox.com/).

## Screenshot

![a9 screenshot](/../screenshot/static/images/screenshot.png?raw=true "a9 screenshot")

## Requirements

Python 2.7 and a modern browser (i.e., not IE <= 8)

## Setup

Run `a9-server.py` either by double-clicking the icon or invoking through a terminal.

## Keyboard Shortcuts

Keyboard shortcuts can be modified in `static/main.js` 

| Key | Command |
| --- | ------- |
| **— Document —** | |
| Ctrl-S | Save |
| Ctrl-Q | Preview (without saving) |
| Shift-Ctrl-S | Export |
| **— Edit —** | |
| Ctrl-Z | Undo |
| Ctrl-Y **or** Shift-Ctrl-Z | Redo |
| Ctrl-X | Cut |
| Ctrl-C | Copy |
| Ctrl-V | Paste |
| Ctrl-D | Delete Line |
| **— Format —** | |
| Ctrl-B | Bold: `x` → `**x**` |
| Ctrl-I | Italic: `x` → `_x_` |
| Ctrl-L | Plain Link: `x` → `<x>` |
| Ctrl-/ | Labeled Link: `x` → `[x]()` |
| Ctrl-\` | Code: `x` → <code>\`x\`</code> |
| Ctrl-^ **or** Ctrl-. | Superscript: `x` → `<sup>x</sup>` |
| Ctrl-\_ **or** Ctrl-,| Subscript: `x` → `<sub>x</sub>` |
| Shift-Ctrl-B **or** Ctrl-\* | Apply bullets on selected text |
| Ctrl-] **or** Tab | Indent More |
| Ctrl-[ **or** Shift-Tab | Indent Less |
| Ctrl-Alt-[0-5] | Add Pinyin Tone: lv → lv/lǖ/lǘ/lǚ/lǜ/lü |
| **— Insert —** | |
| Ctrl-H | Insert Horizontal Line |
| Ctrl-N **or** Alt-/ | Auto-complete<sup>1</sup> |
| Ctrl-A | Alchemy (Compose)<sup>2</sup> |
| Ctrl-' | Citation |

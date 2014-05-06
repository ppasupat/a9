r9
==

**r9** (*remembered*) is a web-based note-taking application.
It's basically (Evernote) + (LaTeX support) - (upload limit).

Features
--------

With r9, you can ...

* edit and preview a [Markdown](http://daringfireball.net/projects/markdown/) document side by side
* save the document in Markdown format, which can be opened directly by other editors
* organize documents into "books" like in [Evernote](https://evernote.com/)
* print the documents in full-page format
* insert LaTeX formula using `$..$` and `$$..$$` — the equations will be displayed using [MathJax](http://www.mathjax.org/)
* draw simple graphics (like graphical models) with special SVG hacks (to be documented)

The documents are saved locally.
To sync or backup the documents, use [an existing sync or backup service](http://alternativeto.net/category/backup-and-sync/).

Requirements
------------

Python 2.7 and a modern browser (i.e., not IE <= 8)

Setup
-----

Run `server.py` either by double-clicking the icon or invoking through the terminal.

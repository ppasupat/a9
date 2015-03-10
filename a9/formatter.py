#!/usr/bin/env python
# -*- coding: utf-8 -*-

import markdown
MD_PROCESSOR = markdown.Markdown(
    extensions=['mdx_mathjax', 'sane_lists', 'extra']
)

def markdown_to_html(content):
    return MD_PROCESSOR.convert(content)

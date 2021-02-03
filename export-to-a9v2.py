#!/usr/bin/env python3
import json
import os
import re
import shutil
import sys


BASEDIR = 'a9v2-exported'
INDEXED_TITLE = re.compile(r'^\[([^\]]*)\] (.*)$')


def normalize(name):
  """Returns a name suitable for a filename."""
  name = re.sub(r'[^a-z0-9]', ' ', name.lower())
  name = re.sub(r'\s+', '-', name.strip())
  if not name:
    name = 'untitled'
  return name


def format_content(content):
  # KaTeX uses aligned instead
  content = content.replace('align*', 'aligned')
  # Renamed the macro
  content = content.replace(r'\trps', r'\T')
  return content


def main():
  # Read the names file
  books = {}
  with open('data/names') as fin:
    for line in fin:
      tokens = line.rstrip('\n').split('\t')
      if tokens[0] == 'B':
        name = tokens[2]
        norm_name = normalize(name)
        while norm_name in books.values():
          norm_name += '-alt'
        books[tokens[1]] = norm_name
        os.makedirs(os.path.join(BASEDIR, norm_name), exist_ok=True)
      else:
        nid = tokens[1]
        book = books[tokens[2]]
        name = tokens[3]
        m = INDEXED_TITLE.match(name)
        if m:
          index, title = m.groups()
        else:
          index, title = '', name
        norm_name = normalize(name)
        print(book, '/', norm_name, '|||', index, '|||', title)
        src_file = os.path.join('data', nid + '.md')
        tgt_file = os.path.join(BASEDIR, book, norm_name + '.md')
        while os.path.exists(tgt_file):
          tgt_file = tgt_file + '-alt.md'
        with open(src_file) as fin:
          with open(tgt_file, 'w') as fout:
            print('<!-- ' + json.dumps({
              'index': index,
              'title': title,
              'timestamp': 0,
            }) + ' -->', file=fout)
            content = format_content(fin.read())
            fout.write(content)



if __name__ == '__main__':
  main()

#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Install or upgrade the viewer in an external directory.

For example, to put the viewer in a Dropbox public folder, use:
  ./viewer-install.py ~/Dropbox/Public/a9online
"""

import sys, os, shutil, re, argparse
from os.path import exists as E
from os.path import join as J

def prompt(text, default):
    if (raw_input(text) or default)[0].lower() != 'y':
        exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('destination_directory')
    args = parser.parse_args()

    # Get the source directory
    srcdir = os.path.dirname(os.path.realpath(__file__))
    # Check if the destination directory exists
    dstdir = args.destination_directory
    if os.path.exists(dstdir):
        if not os.path.isdir(dstdir):
            print 'Error: {} exists but is not a directory'.format(dstdir)
            exit(1)
        # First check if the directory is either empty or is an a9 viewer directory
        if os.listdir(dstdir):
            if E(J(dstdir, 'index.html')) and E(J(dstdir, 'static')) and not E(J(dstdir, 'a9')):
                prompt('{} seems to contain a9 viewer. Upgrade? (Y/n)'.format(dstdir), 'y')
            else:
                print 'Warning: {} does not seem to be an a9 viewer directory'.format(dstdir)
                prompt('This might CORRUPT the data! Continue anyway? (y/N)', 'n')
        else:
            print 'Info: Directory {} exists but is empty'.format(dstdir)
    else:
        print 'Info: Creating directory {}'.format(dstdir)
        os.makedirs(dstdir)

    # Copy files
    def mkdir(dirname):
        if not os.path.isdir(dirname):
            os.makedirs(dirname)

    def copy(srcfile, dstfile=None):
        src = J(srcdir, srcfile)
        dst = J(dstdir, dstfile or srcfile)
        print '{} => {}'.format(src, dst)
        shutil.copy(src, dst)
    
    copy('viewer-index.html', 'index.html')
    mkdir(J(dstdir, 'data'))
    mkdir(J(dstdir, 'static'))
    copy(J('static', 'reset.css'))
    copy(J('static', 'viewer-style.css'))
    copy(J('static', 'content-style.css'))
    copy(J('static', 'print-style.css'))
    copy(J('static', 'jquery.min.js'))
    copy(J('static', 'marked.js'))
    copy(J('static', 'svg-hack.js'))
    copy(J('static', 'viewer-main.js'))
    mkdir(J(dstdir, 'static', 'icons'))
    copy(J('static', 'icons', 'favicon-pad.ico'))
    copy(J('static', 'icons', 'favicon-pad.png'))
    # Copy MathJax as a tree
    print 'Upgrading MathJax ...'
    dstmathjax = J(dstdir, 'static', 'mathjax')
    if os.path.exists(dstmathjax):
        shutil.rmtree(dstmathjax)
    shutil.copytree(J(srcdir, 'static', 'mathjax'), dstmathjax)
    print 'DONE!'

    from a9 import app
    print app.get_note(1000)

if __name__ == '__main__':
    main()


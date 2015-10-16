#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os, traceback, datetime, platform
basedir = os.path.dirname(os.path.abspath(__file__))

PORT = 8080

if __name__ == '__main__':
    if os.path.exists('lock'):
        with open('lock') as fin:
            print >> sys.stderr, fin.read()
        print >> sys.stderr, ('Lock file exists. ' +
            'Please close all other instances to prevent corrupted files.')
        exit(1)
    from a9.app import start
    with open('lock', 'w') as fout:
        print >> fout, 'Locked at %s on %s' %\
            (datetime.datetime.now().isoformat(), platform.node())
    try:
        start(PORT, basedir)
    except:
        print traceback.format_exc()
    os.remove('lock')

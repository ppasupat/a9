#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os, traceback
basedir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(basedir, 'lib'))

PORT = 8080

if __name__ == '__main__':
    from r9.app import run
    try:
        run(PORT, basedir)
    except:
        print traceback.format_exc()

#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os, traceback
basedir = os.path.dirname(os.path.abspath(__file__))

PORT = 8080

if __name__ == '__main__':
    from r9.app import start
    try:
        start(PORT, basedir)
    except:
        print traceback.format_exc()

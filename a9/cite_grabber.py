#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os, shutil, re, argparse, json
from codecs import open
from itertools import izip
from collections import defaultdict

import urllib
import xml.etree.ElementTree as ET

def clean(x):
    x = re.sub(r'\s+', ' ', x).strip()
    x = re.sub(r'\.$', '', x)
    return x

def format_citation(author='?', affiliation='?', venue='?', year='?', title='?', url='?'):
    return u'({} @ {}, {} {}) [{}]({})'.format(
            author, affiliation, venue, year, title, url)

################################
# DBLP

def dblp_search(title):
    api_url = 'http://dblp.dagstuhl.de/search/publ/api?format=json&q=' + urllib.quote_plus(title)
    print >> sys.stderr, 'Grabbing dblp information from', api_url
    data = json.load(urllib.urlopen(api_url))
    best_match = data['result']['hits']['hit'][0]['info']
    kwargs = {}
    if 'authors' in best_match:
        authors = best_match['authors']['author']
        if isinstance(authors, list):
            kwargs['author'] = clean(authors[0])
        else:   # Single author
            kwargs['author'] = clean(authors)
    if 'venue' in best_match:
        kwargs['venue'] = clean(best_match['venue'])
    if 'year' in best_match:
        kwargs['year'] = clean(best_match['year'])
    if 'title' in best_match:
        kwargs['title'] = clean(best_match['title'])
    if 'url' in best_match:
        kwargs['url'] = clean(best_match['url'])
    return kwargs

"http://dblp.org/rec/conf/emnlp/RitterCME11"
def dblp_fetch(dblp_url):
    if '/xml/' not in dblp_url:
        xml_url = dblp_url.replace('/rec/', '/rec/xml/')
    else:
        xml_url = dblp_url
    print >> sys.stderr, 'Grabbing DBLP information from', xml_url
    data = urllib.urlopen(xml_url)
    entry = ET.parse(data).getroot()[0]
    ee = entry.find('ee')
    if ee is not None:
        return ee.text
    return dblp_url
    
################################
# Arxiv

NS = {'atom': 'http://www.w3.org/2005/Atom'}

def arxiv_fetch(url):
    paper_id = url.split('/')[-1]
    api_url = 'http://export.arxiv.org/api/query?id_list=' + paper_id
    print >> sys.stderr, 'Grabbing arxiv information from', api_url
    data = urllib.urlopen(api_url)
    entry = ET.parse(data).getroot().find('atom:entry', NS)
    kwargs = {'url': url}
    year = entry.find('atom:published', NS)
    if year is not None:
        kwargs['year'] = year.text.split('-')[0]
    title = entry.find('atom:title', NS)
    if title is not None:
        kwargs['title'] = clean(title.text)
    author = entry.find('atom:author', NS)
    if author is not None:
        author = author.find('atom:name', NS)
        if author is not None:
            kwargs['author'] = clean(author.text)
    return kwargs

################################
# Main Function

def grab(url):
    if not url.startswith('http'):
        # Probably a title
        title = url
        try:
            kwargs = dblp_search(title)
            kwargs['url'] = dblp_fetch(kwargs['url'])
            return format_citation(**kwargs)
        except Exception, e:
            print >> sys.stderr, 'Error:', e
        # Give up
        return format_citation(title=title)
    # Arxiv
    if (url.startswith('http://arxiv.org') or 
            url.startswith('https://arxiv.org')):
        try:
            kwargs = arxiv_fetch(url)
            # Try cross-search with DBLP
            try:
                dblp_kwargs = dblp_search(kwargs['title'])
                dblp_kwargs['url'] = url
                return format_citation(**dblp_kwargs)
            except Exception, e:
                print >> sys.stderr, 'Error:', e
            return format_citation(**kwargs)
        except Exception, e:
            print >> sys.stderr, 'Error:', e
    # Give up
    return format_citation(url=url)

def main():
    # Test
    parser = argparse.ArgumentParser()
    parser.add_argument('url')
    args = parser.parse_args()
    print grab(args.url)

if __name__ == '__main__':
    main()


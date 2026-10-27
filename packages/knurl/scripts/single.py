# Strips the document skeleton from the single-file build so it can be published as a hosted page.
import re, sys
src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
s = re.sub(r'<!doctype html>\s*', '', s, flags=re.I)
s = re.sub(r'</?html[^>]*>', '', s); s = re.sub(r'</?head>', '', s); s = re.sub(r'</?body>', '', s)
s = re.sub(r'<meta charset="utf-8">\s*', '', s); s = re.sub(r'<meta name="viewport"[^>]*>\s*', '', s)
open(out, 'w').write(s.strip() + "\n")

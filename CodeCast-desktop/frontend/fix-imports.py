import re
fp = r'src/v2/__tests__/functionality-audit.test.tsx'
with open(fp, 'r', encoding='utf-8') as f:
    s = f.read()
# replace '../../pages/...' -> '../pages/...'
s = re.sub(r"import\(['\"]\.\./\.\./", "import('../", s)
s = re.sub(r"importActual<typeof import\(['\"]\.\./\.\./", "importActual<typeof import('../", s)
with open(fp, 'w', encoding='utf-8') as f:
    f.write(s)
print('OK', len(s), 'bytes')

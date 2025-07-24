#!/usr/bin/env python3

# Fix syntax error in issue-messages.ts
with open('apps/open-swe/src/utils/github/issue-messages.ts', 'r') as f:
    content = f.read()

# Replace the incorrect syntax
content = content.replace('    );', '    });')

with open('apps/open-swe/src/utils/github/issue-messages.ts', 'w') as f:
    f.write(content)

print('Fixed syntax error in issue-messages.ts')


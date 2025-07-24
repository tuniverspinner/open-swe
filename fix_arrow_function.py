#!/usr/bin/env python3

with open('apps/open-swe/src/utils/github/issue-messages.ts', 'r') as f:
    content = f.read()

content = content.replace('url => resolveImageUrl(url)', '(url) => resolveImageUrl(url)')

with open('apps/open-swe/src/utils/github/issue-messages.ts', 'w') as f:
    f.write(content)

print('Fixed arrow function syntax')


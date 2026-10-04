import { allText } from '../story.js';
import { execFileSync } from 'node:child_process';
const chars = allText().replace(/[A-Za-z]/g, '');
for (const [idx, name] of [[6, 'SongtiSC-Regular-sub.otf'], [0, 'SongtiSC-Black-sub.otf'], [1, 'SongtiSC-Bold-sub.otf']])
  console.log(execFileSync('node', ['../v4-cosmos/tools/ttc.mjs', 'sub', '/System/Library/Fonts/Supplemental/Songti.ttc', String(idx), 'fonts/' + name, chars]).toString().trim());

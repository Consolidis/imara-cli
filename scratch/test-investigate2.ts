import { InvestigateFileTool } from '../src/agent/tools/investigate-file.tool';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function main() {
  // Test 1: agent.ts (525 lignes) - strategie auto
  console.log('TEST 1: agent.ts (auto) 525 lignes');
  const r1 = await InvestigateFileTool.run({ path: 'src/agent/agent.ts' });
  console.log('  Lignes retour:', r1.split('\n').length);
  console.log('  Tokens (est.):', estimateTokens(r1));
  console.log('  Tokens < 3000 ?', estimateTokens(r1) < 3000 ? 'OUI' : 'NON (ATTENTION)');
  console.log('');

  // Test 2: query sur agent.ts
  console.log('TEST 2: agent.ts (query=isReadOnlyTool)');
  const r2 = await InvestigateFileTool.run({ path: 'src/agent/agent.ts', query: 'isReadOnlyTool' });
  console.log('  Lignes retour:', r2.split('\n').length);
  console.log('  Tokens (est.):', estimateTokens(r2));
  console.log('  Contient isReadOnlyTool:', r2.includes('isReadOnlyTool') ? 'OUI' : 'NON');
  console.log('  Tokens < 3000 ?', estimateTokens(r2) < 3000 ? 'OUI' : 'NON (ATTENTION)');
  console.log('');

  // Test 3: sections sur investigate-file.tool.ts (463 lignes)
  console.log('TEST 3: investigate-file.tool.ts (sections=[buildReport])');
  const r3 = await InvestigateFileTool.run({ path: 'src/agent/tools/investigate-file.tool.ts', sections: ['buildReport'] });
  console.log('  Lignes retour:', r3.split('\n').length);
  console.log('  Tokens (est.):', estimateTokens(r3));
  console.log('  Contient buildReport:', r3.includes('buildReport') ? 'OUI' : 'NON');
  console.log('  Tokens < 3000 ?', estimateTokens(r3) < 3000 ? 'OUI' : 'NON (ATTENTION)');
  console.log('');

  // Test 4: smart-read.tool.ts (338 lignes)
  console.log('TEST 4: smart-read.tool.ts (auto) 338 lignes');
  const r4 = await InvestigateFileTool.run({ path: 'src/agent/tools/smart-read.tool.ts' });
  console.log('  Lignes retour:', r4.split('\n').length);
  console.log('  Tokens (est.):', estimateTokens(r4));
  console.log('  Tokens < 3000 ?', estimateTokens(r4) < 3000 ? 'OUI' : 'NON (ATTENTION)');
  console.log('');

  // Test 5: overview forcee
  console.log('TEST 5: agent.ts (overview)');
  const r5 = await InvestigateFileTool.run({ path: 'src/agent/agent.ts', strategy: 'overview' });
  console.log('  Lignes retour:', r5.split('\n').length);
  console.log('  Tokens (est.):', estimateTokens(r5));
  console.log('  Tokens < 3000 ?', estimateTokens(r5) < 3000 ? 'OUI' : 'NON (ATTENTION)');
  console.log('');

  // Test 6: deep avec limite stricte
  console.log('TEST 6: agent.ts (deep, max_lines=30)');
  const r6 = await InvestigateFileTool.run({ path: 'src/agent/agent.ts', strategy: 'deep', max_lines: 30 });
  console.log('  Lignes retour:', r6.split('\n').length);
  console.log('  Tokens (est.):', estimateTokens(r6));
  console.log('  Contient troncature:', r6.includes('tronc') || r6.includes('limite') ? 'OUI' : 'NON');
  console.log('  Tokens < 3000 ?', estimateTokens(r6) < 3000 ? 'OUI' : 'NON (ATTENTION)');
  console.log('');

  // Test 7: targeted avec query (pour fichier > 300 lignes)
  console.log('TEST 7: agent.ts (targeted, query=isReadOnlyTool)');
  const r7 = await InvestigateFileTool.run({ path: 'src/agent/agent.ts', query: 'isReadOnlyTool' });
  console.log('  Lignes retour:', r7.split('\n').length);
  console.log('  Tokens (est.):', estimateTokens(r7));
  console.log('  Contient isReadOnlyTool:', r7.includes('isReadOnlyTool') ? 'OUI' : 'NON');
  console.log('');

  console.log('=== VERDICT FINAL ===');
  const results = [
    { name: 'agent.ts auto (525l)', tokens: estimateTokens(r1), ok: estimateTokens(r1) < 3000 },
    { name: 'agent.ts query (525l)', tokens: estimateTokens(r2), ok: estimateTokens(r2) < 3000 },
    { name: 'investigate-file.ts sections (463l)', tokens: estimateTokens(r3), ok: estimateTokens(r3) < 3000 },
    { name: 'smart-read.ts auto (338l)', tokens: estimateTokens(r4), ok: estimateTokens(r4) < 3000 },
    { name: 'agent.ts overview (525l)', tokens: estimateTokens(r5), ok: estimateTokens(r5) < 3000 },
    { name: 'agent.ts deep/30 (525l)', tokens: estimateTokens(r6), ok: estimateTokens(r6) < 3000 },
    { name: 'agent.ts targeted query (525l)', tokens: estimateTokens(r7), ok: estimateTokens(r7) < 3000 },
  ];
  for (const r of results) {
    console.log(r.name + ': ' + r.tokens + ' tokens ' + (r.ok ? 'OK' : 'DEPASSE 3000'));
  }
}

main().catch(console.error);

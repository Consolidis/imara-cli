/**
 * Script de test pour InvestigateFileTool.
 * Teste les différentes stratégies sur des fichiers de tailles variées.
 * Utilisation: npx ts-node scratch/test-investigate.ts
 */

import { InvestigateFileTool } from '../src/agent/tools/investigate-file.tool';

// Estimation du nombre de tokens (approximatif: 1 token ~= 4 charactères)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function runTest(label: string, args: { path: string; strategy?: string; query?: string; sections?: string[]; max_lines?: number }) {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: ' + label);
  console.log('Args: ' + JSON.stringify(args, null, 2));
  console.log('-'.repeat(70));

  const start = Date.now();
  try {
    const result = await InvestigateFileTool.run(args as any);
    const duration = Date.now() - start;
    const lineCount = result.split('\n').length;
    const tokenEstimate = estimateTokens(result);

    console.log('DUREE: ' + duration + 'ms');
    console.log('LIGNES: ' + lineCount);
    console.log('TOKENS (est.): ' + tokenEstimate);
    console.log('-'.repeat(70));
    console.log(result.substring(0, 2000));
    if (result.length > 2000) {
      console.log('... [truncated, total ' + result.length + ' chars]');
    }

    // Validation
    const violations: string[] = [];

    // Vérifier que le résultat est structuré
    if (!result.includes('RAPPORT')) {
      violations.push('ERREUR: Rapport manquant (doit contenir RAPPORT)');
    }
    if (!result.includes('--- STRUCTURE') && !result.includes('TOC')) {
      violations.push('ERREUR: Section STRUCTURE/TOC manquante');
    }
    if (!result.includes('--- CONTENU')) {
      violations.push('ERREUR: Section CONTENU manquante');
    }
    if (!result.includes('--- NOTES')) {
      violations.push('ERREUR: Section NOTES manquante');
    }

    // Vérifier que le volume de tokens est raisonnable pour les fichiers > 300 lignes
    if (args.strategy !== 'deep' && tokenEstimate > 3000) {
      violations.push('ATTENTION: Volume eleve: ' + tokenEstimate + ' tokens (> 3000)');
    }

    if (violations.length > 0) {
      console.log('VIOLATIONS:');
      violations.forEach(v => console.log('  - ' + v));
    } else {
      console.log('VALIDATION: OK');
    }

    return { duration, lineCount, tokenEstimate, violations };
  } catch (error) {
    console.log('ERREUR: ' + (error instanceof Error ? error.message : String(error)));
    return { duration: Date.now() - start, lineCount: 0, tokenEstimate: 0, violations: ['EXCEPTION: ' + String(error)] };
  }
}

async function main() {
  const results: Record<string, any> = {};

  // Test 1: Fichier court (< 100 lignes) - stratégie auto -> deep -> lecture complète
  results['small-auto'] = await runTest('Fichier court (auto)', {
    path: 'scratch/test-small.ts',
  });

  // Test 2: Fichier moyen (~130 lignes) - stratégie auto -> overview
  results['medium-auto'] = await runTest('Fichier moyen (auto)', {
    path: 'scratch/test-medium.ts',
  });

  // Test 3: Fichier moyen - stratégie targeted avec query
  results['medium-query'] = await runTest('Fichier moyen (query=connect)', {
    path: 'scratch/test-medium.ts',
    query: 'connect',
  });

  // Test 4: Fichier moyen - stratégie targeted avec sections
  results['medium-sections'] = await runTest('Fichier moyen (sections=[DatabaseConnection])', {
    path: 'scratch/test-medium.ts',
    sections: ['DatabaseConnection'],
  });

  // Test 5: Fichier long (~280 lignes) - stratégie auto -> targeted
  results['large-auto'] = await runTest('Fichier long (auto)', {
    path: 'scratch/test-large.ts',
  });

  // Test 6: Fichier long - stratégie overview
  results['large-overview'] = await runTest('Fichier long (overview)', {
    path: 'scratch/test-large.ts',
    strategy: 'overview',
  });

  // Test 7: Fichier long - stratégie targeted avec query
  results['large-query'] = await runTest('Fichier long (query=UserService)', {
    path: 'scratch/test-large.ts',
    query: 'UserService',
  });

  // Test 8: Fichier long - stratégie deep
  results['large-deep'] = await runTest('Fichier long (deep, max_lines=50)', {
    path: 'scratch/test-large.ts',
    strategy: 'deep',
    max_lines: 50,
  });

  // Test 9: Fichier inexistant
  results['not-found'] = await runTest('Fichier inexistant', {
    path: 'scratch/inexistant.ts',
  });

  // Résumé
  console.log('\n\n' + '='.repeat(70));
  console.log('RESUME DES TESTS');
  console.log('='.repeat(70));

  let totalViolations = 0;
  for (const [key, r] of Object.entries(results)) {
    const status = r.violations.length === 0 ? 'OK' : r.violations.length + ' violation(s)';
    const v = r.violations.filter((v: string) => v.startsWith('ERREUR')).length;
    const w = r.violations.filter((v: string) => v.startsWith('ATTENTION')).length;
    console.log(key + ': ' + r.tokenEstimate + ' tokens, ' + r.duration + 'ms [' + status + ']' + (v > 0 ? ' ERR=' + v : '') + (w > 0 ? ' WARN=' + w : ''));
    if (r.violations.length > 0) {
      r.violations.forEach((v: string) => console.log('  -> ' + v));
    }
    totalViolations += r.violations.length;
  }

  console.log('-'.repeat(70));
  if (totalViolations === 0) {
    console.log('TOUS LES TESTS ONT REUSSI');
  } else {
    console.log(totalViolations + ' violation(s) detectee(s)');
  }
}

main().catch(console.error);

# Plan — Track 004 : Intelligence (contexte/tokens)

- [ ] Scaffolding du module src/intelligence/
- [ ] Integration de js-tiktoken et classe TokenCounter
- [ ] Tests unitaires : TokenCounter sur messages simples et complexes
- [ ] Classe ContextWindow avec limite configurable et strategie d'eviction
- [ ] Tests unitaires : eviction des vieux messages, conservation des N recents
- [ ] Classe SessionSummarizer (generation de resume via LLM ou heuristique)
- [ ] Persistance des resumes dans .imara/sessions/
- [ ] Integration dans le pipeline de conversation actuel
- [ ] Tests E2E : session longue simulee avec verif de coherenc

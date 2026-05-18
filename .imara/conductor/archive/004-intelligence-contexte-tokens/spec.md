# Spec — Track 004 : Intelligence (contexte/tokens)

CONTEXTE :
Les sessions longues avec le CLI produisent un historique de messages qui peut rapidement atteindre la limite de contexte du modele LLM. Sans mecanisme de gestion, le modele oublie le contexte initial ou refuse de repondre.

OBJECTIFS :
1. Compter les tokens reels par message (entrant et sortant)
2. Gerer intelligemment la fenetre de contexte (suppression strategique des vieux messages)
3. Generer un resume de session pour les conversations longues

SPECIFICATIONS FONCTIONNELLES :
- Compteur de tokens : utiliser tiktoken ou equivalent pour compter les tokens avant envoi et apres reception
- Window manager : definir une limite configurable (par defaut 80% du contexte du modele utilise) ; lorsque la limite est atteinte, archiver les plus vieux messages sous forme de resume
- Resume de session : a chaque eviction de messages, generer un resume synthetique (role system) qui est injecte en debut de contexte

SPECIFICATIONS TECHNIQUES :
- Module : src/intelligence/
- Classes : TokenCounter, ContextWindow, SessionSummarizer
- Persistance : stocker les resumes dans .imara/sessions/
- Tests unitaires obligatoires pour le comptage et la truncation

DEPENDANCES :
- tiktoken (ou js-tiktoken pour compatibilite browser/Node)

CONTRAINTES :
- Ne pas casser le flux de conversation actuel
- Garder les N derniers messages complets pour eviter la perte de coherence immediate

SPECIFICATION TECHNIQUE : Optimisation SessionManager et resumes de session

CONTEXTE :
Le module de contexte du noyau IMARA CLI gere la persistance des sessions conversationnelles et la compression semantique lorsque la fenetre de contexte approche ses limites.

OBJECTIFS :
1. SessionManager : persistance asynchrone avec batching et compression (Phase 1 - FAITE)
2. SessionSummary : enrichir la logique de resume avec detection d'intention technique (Phase 2 - EN COURS)
3. ContextWindow : reduire le nombre d'appels au compteur de tokens (Phase 3 - A FAIRE)

PHASE 2 — SessionSummary :

- Filtrage : exclure les messages system et les resultats tool au contenu superieur a 500 tokens
- Segmentation par intention : detecter les demandes utilisateur (motifs "comment", "corrige", "ajoute", "optimise") et les regrouper avec les reponses associees
- Resume condense : pour chaque groupe, synthetiser le theme et le resultat (reussi / en cours / bloque)
- Format de sortie : `RESUME DES ECHANGES PRECEDENTS : X echanges precedents. Themes : theme1 ; theme2 ; theme3.`

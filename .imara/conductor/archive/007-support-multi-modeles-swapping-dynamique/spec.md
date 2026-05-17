SPECIFICATIONS TECHNIQUES — TRACK 007
Support Multi-Modèles & Swapping Dynamique

MODULES TOUCHES :
- src/ui/screens/welcome.ts (Détection des modèles natifs et panneau d'avertissement)
- src/api/imara-client.ts (Passe-plat pour modèles non-natifs et traduction de l'erreur wallet)
- backend/src/ai/agent.service.ts (Routage flexible, facturation forfaitaire de 5 FCFA et vérification du solde)
- src/cli/commands/chat.command.ts (Rafraîchissement dynamique du header lors du swap)

REGLES ET CONVERSIONS :

1. Identification des modèles natifs :
   - Modèles natifs autorisés : imara-zuri (zuri), imara (standard), imara-flash (flash).
   - Tout autre modèle est identifié comme non-natif.

2. Règle de facturation et Guardrail (Backend) :
   - Requête sur modèle natif : Facturation standard basée sur les tokens consommés (MODEL_PRICING).
   - Requête sur modèle non-natif : Tarif forfaitaire de 5.00 FCFA par requête.
   - Si le wallet de l'utilisateur possède un solde inférieur à 5.00 FCFA lors d'un appel non-natif, la transaction est annulée, et une erreur "Insufficient wallet balance" est levée.

3. Zone de notification d'avertissement (CLI) :
   - Si le modèle actif est non-natif, afficher un panneau d'avertissement encadré :
     ┌────────────────────────────────────────────────────────┐
     │ ⚠️  MODÈLE NON-NATIF ACTIF                              │
     ├────────────────────────────────────────────────────────┤
     │ • Un coût fixe de 5.00 FCFA est débité par requête.    │
     │ • Assurez-vous d'avoir des fonds suffisants.            │
     └────────────────────────────────────────────────────────┘

4. Traduction d'erreur utilisateur :
   - En cas d'erreur de solde retournée par le serveur, la CLI affiche :
     "Solde insuffisant dans votre wallet. Veuillez recharger vos crédits sur https://imara.consolidis.com pour utiliser ce modèle."

DEPENDANCES :
- Backend NestJS AgentService pour validation des transactions TypeORM en cascade.
- ImaraClient CLI pour interception de l'erreur 400.

SPEC : Persistance des sessions avec SQLite

CONTEXTE :
Aujourd'hui, les conversations IMARA-CLI sont ephemeres. A la fermeture du terminal, tout l'historique est perdu. L'utilisateur souhaite que les sessions soient persistantes, avec possibilite de reprendre une conversation arretee, de consulter l'historique, et de stocker l'etat des tracks Conductor.

BUT :
Implementer un stockage SQLite local pour :
- Les messages de conversation (session chat)
- L'etat des tracks Conductor (index, plan, statut)
- Les resumes de session generes par SessionSummary

La persistance doit etre activee par defaut, avec possibilite de desactiver via configuration.

NON-BUTS (hors scope) :
- Autonomie de l'IA (agent autonome deplanifiant des tracks) -> reporte au track suivant
- Replication cloud ou synchronisation multi-device
- Encryption des donnees stockees

CHOIX ARCHITECTURAUX :
- lib : better-sqlite3 (synchrone, simple, zero-dep natif compile)
- chemin DB : join(homedir(), '.imara', 'imara.db')
- schema minimal : tables sessions, messages, tracks
- migration : versionnememt de schema integre dans le code

TABLES :
1. sessions : id, name, model, created_at, updated_at, summary
2. messages : id, session_id, role, content, tool_calls, created_at, token_count
3. tracks : id, track_number, title, status, created_at, updated_at, current_task

CONFIGURATION :
- Nouvelle cle config : persistHistory (boolean, defaut true)
- Si false, pas de stockage SQLite, comportement ephemere conserve

INTEGRATION :
- ChatCommand : recuperer ou creer une session active, persister chaque message
- TrackManager : persister l'etat des tracks apres chaque modification
- StatusBar : indicater si session est persistee (icone discret)

API PUBLIQUE :
- SessionStore : init(), createSession(), getSession(), listSessions(), addMessage(), getMessages(), updateSummary()
- TrackStore : getAllTracks(), updateTrack(), getTrackById()

CRITERES D'ACCEPTATION :
- Demarrer un chat, quitter, relancer -> historique disponible
- Les tracks sont restaures depuis SQLite au demarrage
- persistHistory=false desactive tout stockage
- Tests unitaires sur SessionStore et TrackStore

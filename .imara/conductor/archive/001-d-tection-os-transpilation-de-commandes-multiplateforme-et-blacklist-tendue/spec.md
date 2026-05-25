# Spécifications — Détection OS, transpilation de commandes multiplateforme et blacklist étendue

## 1. Contexte & Enjeux

Actuellement, `run_command` exécute les commandes shell brutes sans tenir compte du système d'exploitation. Si l'IA envoie `ls` sur Windows, la commande échoue avec `'ls' n'est pas reconnu`. L'IA découvre le problème seulement après l'échec, ce qui gaspille un tour d'outil + des tokens.

Par ailleurs, la blacklist actuelle est trop permissive (6 patterns seulement) et ne couvre pas assez de commandes destructrices.

## 2. Architecture & Choix Techniques

### A — Détection et affichage du système d'exploitation dans le system prompt

- Modifier `ContextBuilder.buildSystemPrompt()` pour ajouter une ligne `SYSTEME : Windows 11 (10.0.22621)` ou `SYSTEME : Linux (Ubuntu 22.04)` ou `SYSTEME : macOS (Darwin 23.1.0)`
- Détection via `process.platform` + `os.release()` (module `os` natif de Node.js)
- Détecter WSL (Windows Subsystem for Linux) via la présence de `/proc/sys/kernel/osrelease` contenant "microsoft" ou "WSL"
- Détection de la distribution Linux via `/etc/os-release` (lecture du champ PRETTY_NAME)

### B — Transpileur de commandes multiplateforme dans run-command.tool.ts

Créer une fonction `transpileCommand(cmd: string, platform: string): string` qui convertit les commandes avant exécution.

**Transpilations Unix -> Windows** (quand l'IA écrit du Unix et qu'on est sur Windows) :

| Commande Unix | Équivalent Windows |
|--------------|-------------------|
| `ls [options] [path]` | `dir [path]` |
| `pwd` | `cd` |
| `cat fichier` | `type fichier` |
| `rm fichier` | `del fichier` |
| `rm -rf dossier` | `rmdir /s /q dossier` |
| `rm -r dossier` | `rmdir /s /q dossier` |
| `mv source dest` | `move source dest` |
| `cp source dest` | `copy source dest` (ou `xcopy` pour les dossiers) |
| `mkdir -p dossier` | `mkdir dossier` |
| `touch fichier` | `type nul > fichier` |
| `grep "pattern" fichier` | `findstr "pattern" fichier` |
| `wc -l fichier` | `find /c /v "" < fichier` |
| `chmod ...` | ignoré (warning) |
| `which commande` | `where commande` |
| `head -n X fichier` | (PowerShell) `Get-Content fichier -TotalCount X` |
| `tail -n X fichier` | (PowerShell) `Get-Content fichier -Tail X` |

**Transpilations Windows -> Unix** (quand l'IA écrit du Windows et qu'on est sur Linux) :

| Commande Windows | Équivalent Unix |
|-----------------|----------------|
| `dir [path]` | `ls [path]` |
| `type fichier` | `cat fichier` |
| `del fichier` | `rm fichier` |
| `move source dest` | `mv source dest` |
| `copy source dest` | `cp source dest` |
| `mkdir dossier` | `mkdir -p dossier` |
| `findstr "pattern" fichier` | `grep "pattern" fichier` |
| `where commande` | `which commande` |

**Règles de transpilation :**
- Utiliser des regex avec `\b` (word boundary) pour éviter les faux positifs (ex: `cat` dans `catch`)
- Ne pas transpiler si la commande est déjà native du système (ex: `dir` sur Windows reste `dir`)
- Ajouter un flag `--transpiled` dans le retour pour que l'IA sache que sa commande a été adaptée

### C — Blacklist étendue

Remplacer l'actuel tableau `BLACKLISTED_COMMANDS` par une détection par patterns plus large :

**Catégories à bloquer :**
- Formatage / destruction de disque : `format`, `mkfs`, `dd if=`, `parted`, `fdisk`, `gparted`, `diskpart`
- Suppression récursive systèmes : `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`, `rm -rf /*`
- Nettoyage forcé Windows : `rd /s /q C:\`, `del /s /q C:\`, `Remove-Item -Recurse -Force`
- Effacement de boot/system : `bootrec`, `bcdedit`, `grub-install`, `grub-mkconfig`
- Chiffrement / verrouillage : `cryptsetup`, `vlock`, `chattr +i`
- Modification de permissions système : `chmod 777`, `chown -R`
- Shutdown / reboot : `shutdown`, `reboot`, `poweroff`, `halt`, `init 0`
- Téléchargement / exécution de scripts distants : `curl ... | bash`, `wget ... | sh`, `Invoke-WebRequest ...`
- Suppression de Git : `rm -rf .git`, `del /s .git`
- Modification de hosts / firewall : `iptables`, `ufw`, `netsh`, `route`
- DDoS / réseaux : `ping -f`, `ping -t`, `hping3`, `nmap`
- Écrasement de mémoire / swap : `mkswap`, `swapon`, `dd if=/dev/urandom`

**Mécanisme :**
- Pour chaque pattern, stocker un niveau de sévérité : `block` (interdit) ou `warn` (demander confirmation)
- Si la commande match un pattern `block`, lancer une erreur immédiatement
- Si la commande match un pattern `warn`, afficher un message d'avertissement et demander confirmation à l'utilisateur

## 3. Critères d'Acceptation

- [ ] Le system prompt contient une ligne `SYSTEME : Windows 10` ou `Linux (Ubuntu 22.04)` au démarrage
- [ ] Sur Windows, `ls` est automatiquement converti en `dir` avant exécution
- [ ] Sur Linux, `dir` est automatiquement converti en `ls`
- [ ] Les conversions avec `\b` regex ne produisent pas de faux positifs (ex: `cat` dans `catch` inchangé)
- [ ] `rm -rf /` et toutes les variantes sont bloquées
- [ ] `format c:`, `mkfs`, `dd if=/dev/zero` sont bloqués
- [ ] Les commandes de shutdown/reboot sont bloquées
- [ ] Les commandes de téléchargement + exécution (`curl ... | bash`) sont bloquées
- [ ] Tous les tests existants passent (npm test)

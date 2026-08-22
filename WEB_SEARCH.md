# Recherche Web dans Imara CLI

Guide de prise en main de l'outil `web_search` de l'agent Imara.
L'agent utilise ce service des qu'il a besoin de se renseigner sur internet
(doc technique, actualites, prix, definitions, etc.).

## 1. Principe general

L'agent interroge directement l'API Tavily (https://tavily.com), comme le
fait le chat Imara. La CLI ne passe plus par un endpoint backend.

Trois briques composent le systeme :

- Tavily : moteur de recherche optimise pour les agents IA (reponse directe synthetisee + sources).
- Jina Reader (r.jina.ai) : extraction du contenu textuel d'une page web, avec repli sur un fetch direct.
- Cache local : ~/.imara/search-cache.json, evite de re-frapper Tavily a chaque recherche (economie de credits).

## 2. Configuration de la cle API Tavily

La recherche web en temps reel REQUIERT une cle API Tavily.
Sans cle, la recherche est desactivee (voir section 4).

### Methode 1 - Variable d'environnement (priorite maximale)

Exporter TAVILY_API_KEY dans votre shell, ou la definir dans votre .env :

    set TAVILY_API_KEY=tvly-votre-cle    (Windows CMD)
    $env:TAVILY_API_KEY = "tvly-votre-cle"   (PowerShell)
    export TAVILY_API_KEY=tvly-votre-cle  (Linux / macOS)

### Methode 2 - Configuration CLI (recommande)

    imara config set tavilyApiKey tvly-votre-cle

La cle est stockee dans ~/.imara/config.json (droits restreints).

Verifier la valeur enregistree :

    imara config get tavilyApiKey

Retirer la cle :

    imara config set tavilyApiKey ""

### Methode 3 - Keychain systeme

La CLI peut stocker la cle dans le trousseau du systeme d'exploitation
(compte "tavily-key"), avec repli sur un fichier ~/.imara/tavily-key.

## 3. Ordre de resolution de la cle

La CLI cherche la cle dans cet ordre :

    1. Variable d'environnement TAVILY_API_KEY
    2. Config CLI  (~/.imara/config.json -> tavilyApiKey)
    3. Keychain systeme (compte tavily-key)

La premiere cle trouvee est utilisee. Aucune cle n'est jamais affichee dans
les logs ni dans les resultats de recherche.

## 4. Comportement sans cle API Tavily

Si aucune cle n'est configuree et que l'agent veut lancer une recherche :

- L'outil retourne un message d'indisponibilite explicite, identique a
  celui du chat Imara.
- L'agent informe poliment l'utilisateur qu'il ne peut pas faire de
  recherche en temps reel pour le moment.
- L'agent repond au mieux a la demande en utilisant uniquement ses
  connaissances internes existantes.
- Le cache local reste fonctionnel : une recherche identique effectuee
  il y a moins de 24h sera retournee depuis le cache, meme sans cle.
- Aucun crash, aucune erreur bloquante, aucune interruption de session.

## 5. Cache local

Emplacement : ~/.imara/search-cache.json

- Duree de vie : 24 heures.
- Taille maximale : 200 entrees, eviction FIFO (les plus anciennes sortent).
- Normalisation des requetes : minuscules, sans accents, sans ponctuation,
  espaces multiples reduits a un seul (ex: "Météo, Paris!" -> "meteo paris").
- Si le fichier est corrompu, il est purge silencieusement puis recree.
- La cle API n'est jamais stockee dans le cache, uniquement des resultats
  de recherche publics (titres, URL, extraits).

Purge manuelle du cache : supprimer le fichier ~/.imara/search-cache.json.

## 6. Modes de l'outil web_search

L'agent appelle l'outil automatiquement. Trois usages :

- Recherche (query) : interroge Tavily, retourne reponse directe + sources.
- Extraction de page (url) : recupere le contenu textuel d'une page via
  Jina Reader, avec repli sur un fetch direct si Jina echoue.
- Analyse design (mode design + url) : analyse visuelle d'un site
  (framework CSS, couleurs, polices, structure du DOM, breakpoints).

## 7. Depannage

Symptome : l'agent repond "le service de recherche en ligne est actuellement
indisponible (la cle API Tavily n'est pas configuree...)".
Cause : aucune cle Tavily resolue.
Action : imara config set tavilyApiKey tvly-votre-cle, puis relancer.

Symptome : "Quota Tavily depasse (rate limit)".
Cause : trop de requetes sur la periode gratuite/payante de la cle.
Action : attendre, reduire le nombre de recherches, ou augmenter le quota
sur https://tavily.com.

Symptome : "Cle API Tavily invalide ou expiree".
Cause : cle incorrecte ou revoquee.
Action : verifier la cle et la reconfigurer.

Symptome : "Tavily a retourne une erreur (HTTP ...)".
Cause : service Tavily indisponible ou autre erreur cote API.
Action : reessayer plus tard ; l'agent retombe sur ses connaissances internes.

## 8. Pour aller plus loin

- Obtenir une cle Tavily : https://tavily.com (compte gratuit avec quota).
- Le cache evite de consommer le quota a chaque recherche : il est vivement
  recommande de le conserver.
- La cle de developpement du projet est definie dans backend/.env
  (TAVILY_API_KEY) pour le chat. Elle peut etre reutilisee cote CLI via la
  methode 1 ou 2.

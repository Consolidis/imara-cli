import * as net from 'net';

/**
 * Trouve un port TCP libre sur l'interface loopback (127.0.0.1).
 *
 * Crée un serveur temporaire sur le port 0 (allocation dynamique par l'OS),
 * récupère le port attribué, puis ferme immédiatement le serveur.
 *
 * REGLE CRITIQUE : Ne JAMAIS utiliser kill, taskkill ou process.kill()
 * pour libérer un port. Seule l'écoute passive (listen + close) est autorisée.
 *
 * @returns Une promesse résolue avec le numéro de port libre.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Le port 0 ne devrait jamais produire EADDRINUSE,
        // mais on retry une fois par sécurité
        server.close(() => {
          const retryServer = net.createServer();
          retryServer.listen(0, '127.0.0.1', () => {
            const port = (retryServer.address() as net.AddressInfo).port;
            retryServer.close(() => resolve(port));
          });
          retryServer.on('error', (retryErr) => reject(retryErr));
        });
      } else {
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo;
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

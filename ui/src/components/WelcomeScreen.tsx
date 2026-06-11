import React from 'react';

interface WelcomeScreenProps {
  projectName?: string;
  onSelectFile?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ projectName, onSelectFile }) => {
  return (
    <div className="welcome-screen">
      <div className="logo">⚡</div>
      <h1>IMARA STUDIO CODE</h1>
      <p>
        Bienvenue dans votre environnement de développement intelligent.
        <br />
        {projectName
          ? `Projet : ${projectName}`
          : 'Explorez votre projet, éditez vos fichiers, et collaborez avec l\'agent IA.'}
      </p>
      <div className="shortcuts">
        <div className="shortcut">
          <kbd>Ctrl+P</kbd> Rechercher un fichier
        </div>
        <div className="shortcut">
          <kbd>Ctrl+Enter</kbd> Envoyer au chat
        </div>
        <div className="shortcut">
          Cliquez à gauche Ouvrir un fichier
        </div>
      </div>
      <p style={{ marginTop: 32, color: '#71717a', fontSize: 12 }}>
        IMARA STUDIO CODE — IDE Web Local · Propulsé par IMARA AI
      </p>
    </div>
  );
};

export default WelcomeScreen;

import type { QuestionTextCatalog } from "./nerdacolo-question-texts";

export const NERDACOLO_QUESTION_TEXTS_FR: QuestionTextCatalog = {
  "mood-night": {
    text: "Quel genre de soirée c'est ?",
    subtitle: "Nerdacolo sniffe l'ambiance du canapé.",
    options: {
      cozy: { label: "Canapé, couverture et zéro traumatisme", funnyReaction: "Ton canapé vient de pousser un soupir de soulagement." },
      laugh: { label: "Je veux rire sans trop utiliser mes neurones", funnyReaction: "Neurones économisés. Nerdacolo approuve." },
      mystery: { label: "Je veux du mystère et des soupçons sur tout le monde", funnyReaction: "Personne n'est innocent tant que Nerdacolo n'a pas dit le contraire." },
      cry: { label: "Je veux me faire détruire émotionnellement", funnyReaction: "Mouchoirs prêts. La sphère ne juge pas." },
      action: { label: "Je veux de l'action, du rythme et du chaos", funnyReaction: "Mode pop-corn activé." },
      weird: { label: "Je veux quelque chose de bizarre, mais bien", funnyReaction: "La sphère adore les pépites bizarres." },
    },
  },
  "energy-brain": {
    text: "Combien de neurones as-tu disponibles ce soir ?",
    options: {
      two: { label: "Deux, et ils se disputent", funnyReaction: "Intrigue simple incoming." },
      normal: { label: "Assez pour suivre une intrigue normale", funnyReaction: "Intrigue normale = déjà un luxe." },
      conspiracy: { label: "Prêt pour complots, timelines et tableaux blancs", funnyReaction: "Nerdacolo prépare le tableau blanc et la timeline." },
      elegant: { label: "Fais-moi souffrir, mais avec élégance", funnyReaction: "Souffrance avec belle photo, incoming." },
    },
  },
  "time-movie": {
    text: "Combien de temps veux-tu investir ?",
    options: {
      "90": { label: "90 minutes max", funnyReaction: "J'ai écarté les films qui demandent une entracte." },
      "120": { label: "Même 2 heures ça va", funnyReaction: "Soirée cinéma classique." },
      "180": { label: "Même 3 heures, mais ça doit le mériter", funnyReaction: "Seulement des épopées dignes de ton temps." },
      decide: { label: "Je sais pas, décide toi", funnyReaction: "Ok, commande acceptée." },
    },
  },
  "time-tv": {
    text: "Combien de temps veux-tu investir ?",
    options: {
      "one-ep": { label: "Un épisode et je dors", funnyReaction: "Un épisode, promis. (Nerdacolo ment souvent.)" },
      "few-eps": { label: "2-3 épisodes", funnyReaction: "Juste le bon binge." },
      addiction: { label: "Je veux commencer une dépendance", funnyReaction: "J'ai écarté les séries de 12 saisons. Blague. Peut-être." },
      miniseries: { label: "Je cherche une mini-série", funnyReaction: "Histoires closes, zéro crédit émotionnel." },
    },
  },
  "comfort-zone": {
    text: "Tu veux quelque chose proche de tes goûts ou tu veux prendre un risque ?",
    options: {
      total: { label: "Zone de confort totale", funnyReaction: "Aucun saut dans le vide ce soir." },
      similar: { label: "Similaire, mais avec du nouveau", funnyReaction: "Demi-pas hors zone." },
      surprise: { label: "Surprends-moi", funnyReaction: "La sphère s'échauffe." },
      far: { label: "Emmène-moi loin, mais sans regrets", funnyReaction: "Risque calibré. J'aime." },
    },
  },
  darkness: {
    text: "Combien de noirceur tu supportes ?",
    options: {
      light: { label: "Lumière allumée et happy end", funnyReaction: "Pas de cauchemars ce soir." },
      tension: { label: "Un peu de tension ça va", funnyReaction: "Thriller soft, incoming." },
      thriller: { label: "Thriller, anxiété, gens louches", funnyReaction: "Ne fais confiance à personne." },
      destroy: { label: "Détruis-moi carrément", funnyReaction: "La sphère a mis ses écouteurs dark." },
    },
  },
  pace: {
    text: "Quel rythme tu veux ?",
    options: {
      slow: { label: "Lent mais profond", funnyReaction: "Pas de rush, juste des vibes." },
      balanced: { label: "Équilibré", funnyReaction: "Zone Goldilocks." },
      fast: { label: "Rapide, je dois dire 'encore un'", funnyReaction: "Rythme impitoyable." },
      chaos: { label: "Chaos, rebondissements et zéro pause", funnyReaction: "Coups d'adrénaline." },
    },
  },
  mainstream: {
    text: "Tu veux jouer la sécurité ou cartonner avec une pépite ?",
    options: {
      safe: { label: "Mainstream, je veux pas risquer", funnyReaction: "Des titres que tout le monde connaît (pour une raison)." },
      quality: { label: "Qualité mais pas trop inconnu", funnyReaction: "Le sweet spot de Nerdacolo." },
      gem: { label: "Pépite cachée", funnyReaction: "Je cherche des perles sous-cotées." },
      "weird-hit": { label: "Titre absurde que je recommanderai à tout le monde", funnyReaction: "La reco que personne n'a demandée." },
    },
  },
  fantasy: {
    text: "Le monde doit être à quel point normal ?",
    options: {
      real: { label: "Réaliste", funnyReaction: "Pas de dragons, juste du drama." },
      "weird-real": { label: "Réaliste mais avec des bizarreries", funnyReaction: "Légèrement unhinged." },
      sf: { label: "Sci-fi/fantasy ok", funnyReaction: "Espace et magie bienvenus." },
      "all-in": { label: "Multivers, monstres, magie, tout dedans", funnyReaction: "Mode lore infini." },
    },
  },
  social: {
    text: "Tu regardes avec qui ?",
    options: {
      solo: { label: "Seul", funnyReaction: "Zéro compromis." },
      couple: { label: "En couple", funnyReaction: "Rien de trop traumatisant, peut-être." },
      friends: { label: "Avec des amis", funnyReaction: "Quelque chose qui génère des memes." },
      distracted: { label: "Avec quelqu'un qui regarde son téléphone toutes les 5 minutes", funnyReaction: "Intrigue simple ou épisodes courts." },
    },
  },
  ending: {
    text: "Quel rapport tu veux avoir avec la fin ?",
    options: {
      comfort: { label: "Elle doit me réconforter", funnyReaction: "Happy end ou remboursement émotionnel." },
      bittersweet: { label: "Doux-amer ça va aussi", funnyReaction: "Émotions mélangées." },
      questions: { label: "Elle peut me laisser des questions", funnyReaction: "Une fin qui alimente les théories." },
      ruin: { label: "Elle doit me ruiner la semaine", funnyReaction: "Trauma narratif incoming." },
    },
  },
  "binge-tv": {
    text: "C'est binge à quel point ce soir ?",
    options: {
      one: { label: "Juste un, je jure", funnyReaction: "Un. Mensonge classique." },
      marathon: { label: "Marathon jusqu'à 3h", funnyReaction: "Mode addiction aux cliffhangers." },
      background: { label: "En fond pendant que je fais autre chose", funnyReaction: "Comédie ou épisodes courts." },
      weekend: { label: "Week-end entier", funnyReaction: "Longues séries, zéro regret." },
    },
  },
  language: {
    text: "Sous-titres : amis ou ennemis ?",
    options: {
      "no-subs": { label: "Pas de sous-titres, doublage only", funnyReaction: "Priorité aux titres faciles à suivre." },
      "subs-ok": { label: "Sous-titres ok", funnyReaction: "Plus d'options en jeu." },
      original: { label: "Je veux l'original, même si je dois lire", funnyReaction: "Puriste de l'audio original." },
      whatever: { label: "Je m'en fous", funnyReaction: "La sphère décide pour toi." },
    },
  },
  romance: {
    text: "Combien de romance tu supportes ?",
    options: {
      zero: { label: "Zéro, merci", funnyReaction: "Pas de meet-cute ce soir." },
      side: { label: "En sous-intrigue ça va", funnyReaction: "Romance en condiment." },
      yes: { label: "Je veux des papillons", funnyReaction: "Cœur en mode flutter." },
      pain: { label: "Amour qui fait mal", funnyReaction: "Drama romantique incoming." },
    },
  },
  "comedy-style": {
    text: "Si tu ris, comment tu ris ?",
    options: {
      sitcom: { label: "Sitcom et blagues faciles", funnyReaction: "Rires low-effort." },
      "dark-humor": { label: "Humour noir", funnyReaction: "Rire de trucs pas bien." },
      smart: { label: "Comédie intelligente", funnyReaction: "Blagues pour ceux qui ont trop vu de sitcoms." },
      "no-laugh": { label: "Ce soir je veux pas rire", funnyReaction: "Comédie off the table." },
    },
  },
  horror: {
    text: "Vrai horror ou juste des frissons ?",
    options: {
      none: { label: "Zéro horror", funnyReaction: "Pas de démons, même les mignons." },
      mild: { label: "Frissons soft", funnyReaction: "Tension sans cauchemars." },
      real: { label: "Horror qui compte", funnyReaction: "Lumière allumée recommandée." },
      gore: { label: "Sang et cris", funnyReaction: "La sphère a trop vu de mauvais jump scares." },
    },
  },
  "complexity-deep": {
    text: "Tu veux t'engager mentalement à quel point ?",
    options: {
      off: { label: "Cerveau éteint", funnyReaction: "Mode zombie." },
      normal: { label: "Intrigue normale", funnyReaction: "Suivable sans wiki." },
      deep: { label: "Intrigues entremêlées", funnyReaction: "Notes recommandées." },
      wiki: { label: "Je veux ouvrir Reddit au milieu de l'épisode", funnyReaction: "Lore à décrypter." },
    },
  },
  "emotional-light": {
    text: "Combien de poids émotionnel tu encaisses ?",
    options: {
      feather: { label: "Plume, zéro drama", funnyReaction: "Pas de larmes." },
      medium: { label: "Un peu de cœur ça va", funnyReaction: "Émotions dosées." },
      heavy: { label: "Je veux ressentir quelque chose", funnyReaction: "Cœur en mode actif." },
      wreck: { label: "Démolis-moi", funnyReaction: "Mouchoirs x2." },
    },
  },
  visual: {
    text: "Combien de spectacle visuel ?",
    options: {
      minimal: { label: "Minimal, l'histoire compte", funnyReaction: "Petit budget, grand cœur." },
      nice: { label: "Beau à regarder", funnyReaction: "Esthétique soignée." },
      epic: { label: "Vibes blockbuster", funnyReaction: "Explosions optionnelles." },
      art: { label: "Art visuel, même si c'est lent", funnyReaction: "Chaque frame un tableau." },
    },
  },
  "genre-crime": {
    text: "Crime et enquêtes, ça t'attire ?",
    options: {
      love: { label: "Détectives, indices, coupable", funnyReaction: "Énergie true crime." },
      maybe: { label: "Si c'est pas trop lent", funnyReaction: "Crime avec du rythme." },
      no: { label: "Non merci", funnyReaction: "Crime off the table." },
      psych: { label: "Thriller psychologique", funnyReaction: "Esprits tordus incoming." },
    },
  },
  "scifi-depth": {
    text: "Sci-fi : pop-corn ou philosophie ?",
    options: {
      popcorn: { label: "Lasers et trucs qui explosent", funnyReaction: "Sci-fi action." },
      philosophy: { label: "Conscience, simulations, existence", funnyReaction: "Vibes Blade Runner." },
      "no-sci": { label: "Pas de sci-fi", funnyReaction: "Terre ferme only." },
      dystopia: { label: "Dystopie qui fait réfléchir", funnyReaction: "Énergie Black Mirror." },
    },
  },
  animation: {
    text: "Animation : oui ou non ?",
    options: {
      "yes-adult": { label: "Animation adulte ok", funnyReaction: "Pas que des dessins pour gamins." },
      "yes-all": { label: "Tout ok", funnyReaction: "Animation bienvenue." },
      no: { label: "Je préfère le live action", funnyReaction: "Que des acteurs en chair et en os." },
      family: { label: "Quelque chose pour tout le monde", funnyReaction: "Family friendly." },
    },
  },
  docu: {
    text: "Documentaires ce soir ?",
    options: {
      yes: { label: "Je veux apprendre quelque chose", funnyReaction: "Cerveau en mode curieux." },
      no: { label: "Non, je veux de la fiction", funnyReaction: "Pas de réalité ce soir." },
      maybe: { label: "Docu-drama ok", funnyReaction: "Moitié vrai, moitié inventé." },
      "true-crime": { label: "True crime (mais pas trop lourd)", funnyReaction: "Crimes réels, anxiété contrôlée." },
    },
  },
  nostalgia: {
    text: "Nostalgie ou nouveauté ?",
    options: {
      classic: { label: "Classiques qui ne vieillissent pas", funnyReaction: "Icônes du passé." },
      recent: { label: "Sorties récentes", funnyReaction: "Que du frais." },
      new: { label: "Jamais entendu nommer", funnyReaction: "Pépite absolue." },
      mix: { label: "Mix de tout", funnyReaction: "Surprise totale." },
    },
  },
  "violence-tv": {
    text: "Sang à la TV : quel niveau ?",
    options: {
      zero: { label: "Family-friendly", funnyReaction: "Pas de rouge à l'écran." },
      pg13: { label: "PG-13 ça va", funnyReaction: "Violence soft." },
      mature: { label: "Contenu mature ok", funnyReaction: "Zone Game of Thrones." },
      extreme: { label: "Aucune limite", funnyReaction: "La sphère ne regarde pas." },
    },
  },
  twist: {
    text: "Rebondissements : tu en veux combien ?",
    options: {
      predictable: { label: "Prévisible ça va", funnyReaction: "Intrigue confort." },
      some: { label: "Quelques twists", funnyReaction: "Surprise dosée." },
      many: { label: "Un twist toutes les 10 minutes", funnyReaction: "Whiplash narratif." },
      unreliable: { label: "Narrateur peu fiable", funnyReaction: "Ne fais confiance à rien." },
    },
  },
  music: {
    text: "Comédies musicales ou bandes originales iconiques ?",
    options: {
      musical: { label: "Des gens qui chantent", funnyReaction: "Break into song." },
      soundtrack: { label: "Une belle BO suffit", funnyReaction: "L'audio fait le boulot." },
      no: { label: "Pas de comédie musicale", funnyReaction: "Zéro jazz hands." },
      whatever: { label: "Je m'en fous", funnyReaction: "Ok." },
    },
  },
};

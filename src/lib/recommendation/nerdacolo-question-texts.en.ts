import type { QuestionTextCatalog } from "./nerdacolo-question-texts";

export const NERDACOLO_QUESTION_TEXTS_EN: QuestionTextCatalog = {
  "mood-night": {
    text: "What kind of night is it?",
    subtitle: "Nerdacolo is sniffing the couch vibes.",
    options: {
      cozy: { label: "Couch, blanket, zero trauma", funnyReaction: "Your couch just sighed in relief." },
      laugh: { label: "I want to laugh without using too many brain cells", funnyReaction: "Brain cells saved. Nerdacolo approves." },
      mystery: { label: "I want mystery and suspicion about everyone", funnyReaction: "Nobody's innocent until Nerdacolo says otherwise." },
      cry: { label: "I want to get emotionally wrecked", funnyReaction: "Tissues ready. The orb does not judge." },
      action: { label: "I want action, pace, and chaos", funnyReaction: "Popcorn mode activated." },
      weird: { label: "I want something weird, but good", funnyReaction: "The orb loves bizarre hidden gems." },
    },
  },
  "energy-brain": {
    text: "How many brain cells do you have available tonight?",
    options: {
      two: { label: "Two, and they're fighting", funnyReaction: "Simple plot incoming." },
      normal: { label: "Enough to follow a normal plot", funnyReaction: "A normal plot = already a luxury." },
      conspiracy: { label: "Ready for conspiracies, timelines, and whiteboards", funnyReaction: "Nerdacolo is prepping the whiteboard and timeline." },
      elegant: { label: "Make me suffer, but with elegance", funnyReaction: "Suffering with great cinematography, coming up." },
    },
  },
  "time-movie": {
    text: "How much time do you want to invest?",
    options: {
      "90": { label: "90 minutes max", funnyReaction: "I ruled out movies that need an intermission." },
      "120": { label: "Even 2 hours is fine", funnyReaction: "Classic movie night." },
      "180": { label: "Even 3 hours, but it has to earn it", funnyReaction: "Only epics worthy of your time." },
      decide: { label: "I don't know, you decide", funnyReaction: "Okay, command accepted." },
    },
  },
  "time-tv": {
    text: "How much time do you want to invest?",
    options: {
      "one-ep": { label: "One episode and I'm asleep", funnyReaction: "One episode, promise. (Nerdacolo lies a lot.)" },
      "few-eps": { label: "2–3 episodes", funnyReaction: "Just the right amount of binge." },
      addiction: { label: "I want to start an addiction", funnyReaction: "I ruled out 12-season shows. Just kidding. Maybe." },
      miniseries: { label: "Looking for a miniseries", funnyReaction: "Closed stories, zero emotional mortgages." },
    },
  },
  "comfort-zone": {
    text: "Do you want something close to your taste or do you want to take a risk?",
    options: {
      total: { label: "Total comfort zone", funnyReaction: "No leaps into the void tonight." },
      similar: { label: "Similar, but with something new", funnyReaction: "Half a step outside the zone." },
      surprise: { label: "Surprise me", funnyReaction: "The orb is warming up." },
      far: { label: "Take me far, but don't make me regret it", funnyReaction: "Calibrated risk. I like it." },
    },
  },
  darkness: {
    text: "How much darkness can you handle?",
    options: {
      light: { label: "Lights on and a happy ending", funnyReaction: "No nightmares tonight." },
      tension: { label: "A little tension is fine", funnyReaction: "Soft thriller, coming up." },
      thriller: { label: "Thriller, anxiety, shady people", funnyReaction: "Trust no one." },
      destroy: { label: "Go ahead and destroy me", funnyReaction: "The orb put on its dark headphones." },
    },
  },
  pace: {
    text: "What pace do you want?",
    options: {
      slow: { label: "Slow but deep", funnyReaction: "No rush, just vibes." },
      balanced: { label: "Balanced", funnyReaction: "Goldilocks zone." },
      fast: { label: "Fast — I need to say 'just one more'", funnyReaction: "A pace that doesn't forgive." },
      chaos: { label: "Chaos, plot twists, zero breaks", funnyReaction: "Adrenaline hits incoming." },
    },
  },
  mainstream: {
    text: "Play it safe or go viral with a hidden gem?",
    options: {
      safe: { label: "Mainstream, I don't want to risk it", funnyReaction: "Titles everyone knows (for a reason)." },
      quality: { label: "Quality but not too obscure", funnyReaction: "Nerdacolo's sweet spot." },
      gem: { label: "Hidden gem", funnyReaction: "Hunting for underrated pearls." },
      "weird-hit": { label: "Absurd title I'll recommend to everyone later", funnyReaction: "The recommendation nobody asked for." },
    },
  },
  fantasy: {
    text: "How normal should the world be?",
    options: {
      real: { label: "Realistic", funnyReaction: "No dragons, just drama." },
      "weird-real": { label: "Realistic but with weirdness", funnyReaction: "Slightly unhinged." },
      sf: { label: "Sci-fi/fantasy is fine", funnyReaction: "Space and magic welcome." },
      "all-in": { label: "Multiverses, monsters, magic — all of it", funnyReaction: "Infinite lore mode." },
    },
  },
  social: {
    text: "Who are you watching with?",
    options: {
      solo: { label: "Alone", funnyReaction: "Zero compromises." },
      couple: { label: "With my partner", funnyReaction: "Nothing too traumatic, maybe." },
      friends: { label: "With friends", funnyReaction: "Something that generates memes." },
      distracted: { label: "With someone who checks their phone every 5 minutes", funnyReaction: "Simple plot or short episodes." },
    },
  },
  ending: {
    text: "What kind of relationship do you want with the ending?",
    options: {
      comfort: { label: "It should comfort me", funnyReaction: "Happy ending or emotional refunds." },
      bittersweet: { label: "Bittersweet is fine too", funnyReaction: "Mixed emotions." },
      questions: { label: "It can leave me with questions", funnyReaction: "An ending that fuels theories." },
      ruin: { label: "It should ruin my week", funnyReaction: "Narrative trauma incoming." },
    },
  },
  "binge-tv": {
    text: "How binge-y is tonight?",
    options: {
      one: { label: "Just one, I swear", funnyReaction: "One. Classic lie." },
      marathon: { label: "Marathon until 3 a.m.", funnyReaction: "Cliffhanger addiction mode." },
      background: { label: "Background while I do other stuff", funnyReaction: "Comedy or short episodes." },
      weekend: { label: "The whole weekend", funnyReaction: "Long series, zero regrets." },
    },
  },
  language: {
    text: "Subtitles: friends or enemies?",
    options: {
      "no-subs": { label: "No subtitles, dubbing only", funnyReaction: "Prioritizing easy-to-follow titles." },
      "subs-ok": { label: "Subtitles are fine", funnyReaction: "More options in play." },
      original: { label: "I want the original, even if I have to read", funnyReaction: "Original audio purist." },
      whatever: { label: "I don't care", funnyReaction: "The orb decides for you." },
    },
  },
  romance: {
    text: "How much romance can you handle?",
    options: {
      zero: { label: "Zero, thanks", funnyReaction: "No meet-cutes tonight." },
      side: { label: "A subplot is fine", funnyReaction: "Romance as seasoning." },
      yes: { label: "I want butterflies", funnyReaction: "Heart in flutter mode." },
      pain: { label: "Love that hurts", funnyReaction: "Romance drama incoming." },
    },
  },
  "comedy-style": {
    text: "If you laugh, how do you laugh?",
    options: {
      sitcom: { label: "Sitcom and easy jokes", funnyReaction: "Low-effort laughs." },
      "dark-humor": { label: "Dark humor", funnyReaction: "Laughing at the wrong things." },
      smart: { label: "Smart comedy", funnyReaction: "Jokes for people who've seen too many sitcoms." },
      "no-laugh": { label: "I don't want to laugh tonight", funnyReaction: "Comedy off the table." },
    },
  },
  horror: {
    text: "Real horror or just chills?",
    options: {
      none: { label: "Zero horror", funnyReaction: "No demons, not even the cute ones." },
      mild: { label: "Soft chills", funnyReaction: "Tension without nightmares." },
      real: { label: "Horror that counts", funnyReaction: "Lights on recommended." },
      gore: { label: "Blood and screams", funnyReaction: "The orb has seen too many bad jump scares." },
    },
  },
  "complexity-deep": {
    text: "How much do you want to engage your brain?",
    options: {
      off: { label: "Brain off", funnyReaction: "Zombie mode." },
      normal: { label: "Normal plot", funnyReaction: "Followable without a wiki." },
      deep: { label: "Interwoven plots", funnyReaction: "Notes recommended." },
      wiki: { label: "I want to open Reddit mid-episode", funnyReaction: "Lore to decipher." },
    },
  },
  "emotional-light": {
    text: "How much emotional weight can you handle?",
    options: {
      feather: { label: "Feather-light, zero drama", funnyReaction: "No tears." },
      medium: { label: "A little heart is fine", funnyReaction: "Emotions in measured doses." },
      heavy: { label: "I want to feel something", funnyReaction: "Heart in active mode." },
      wreck: { label: "Demolish me", funnyReaction: "Tissues x2." },
    },
  },
  visual: {
    text: "How much visual spectacle?",
    options: {
      minimal: { label: "Minimal — the story matters", funnyReaction: "Low budget, big heart." },
      nice: { label: "Nice to look at", funnyReaction: "Curated aesthetics." },
      epic: { label: "Blockbuster vibes", funnyReaction: "Explosions optional." },
      art: { label: "Visual art, even if slow", funnyReaction: "Every frame a painting." },
    },
  },
  "genre-crime": {
    text: "Do crime and investigations appeal to you?",
    options: {
      love: { label: "Detectives, clues, culprit", funnyReaction: "True crime energy." },
      maybe: { label: "If it's not too slow", funnyReaction: "Crime with pace." },
      no: { label: "No thanks", funnyReaction: "Crime off the table." },
      psych: { label: "Psychological thriller", funnyReaction: "Twisted minds incoming." },
    },
  },
  "scifi-depth": {
    text: "Sci-fi: popcorn or philosophy?",
    options: {
      popcorn: { label: "Lasers and things that explode", funnyReaction: "Sci-fi action." },
      philosophy: { label: "Consciousness, simulations, existence", funnyReaction: "Blade Runner vibes." },
      "no-sci": { label: "No sci-fi", funnyReaction: "Terra firma only." },
      dystopia: { label: "Dystopia that makes you think", funnyReaction: "Black Mirror energy." },
    },
  },
  animation: {
    text: "Animation: yes or no?",
    options: {
      "yes-adult": { label: "Adult animation is fine", funnyReaction: "Not just cartoons for kids." },
      "yes-all": { label: "All good", funnyReaction: "Animation welcome." },
      no: { label: "I prefer live action", funnyReaction: "Flesh-and-blood actors only." },
      family: { label: "Something for everyone", funnyReaction: "Family friendly." },
    },
  },
  docu: {
    text: "Documentaries tonight?",
    options: {
      yes: { label: "I want to learn something", funnyReaction: "Brain in curious mode." },
      no: { label: "No, I want fiction", funnyReaction: "No reality tonight." },
      maybe: { label: "Docu-drama is fine", funnyReaction: "Half true, half invented." },
      "true-crime": { label: "True crime (but not too heavy)", funnyReaction: "Real crimes, controlled anxiety." },
    },
  },
  nostalgia: {
    text: "Nostalgia or something new?",
    options: {
      classic: { label: "Classics that never age", funnyReaction: "Icons from the past." },
      recent: { label: "Recent releases", funnyReaction: "Only fresh stuff." },
      new: { label: "Never heard of it", funnyReaction: "Absolute hidden gem." },
      mix: { label: "Mix of everything", funnyReaction: "Total surprise." },
    },
  },
  "violence-tv": {
    text: "Blood on TV: what level?",
    options: {
      zero: { label: "Family-friendly", funnyReaction: "No red on the screen." },
      pg13: { label: "PG-13 is fine", funnyReaction: "Soft violence." },
      mature: { label: "Mature content okay", funnyReaction: "Game of Thrones zone." },
      extreme: { label: "No limits", funnyReaction: "The orb isn't watching." },
    },
  },
  twist: {
    text: "Plot twists: how many do you want?",
    options: {
      predictable: { label: "Predictable is fine", funnyReaction: "Comfort plot." },
      some: { label: "A few twists", funnyReaction: "Surprise in measured doses." },
      many: { label: "A twist every 10 minutes", funnyReaction: "Narrative whiplash." },
      unreliable: { label: "Unreliable narrator", funnyReaction: "Don't trust anything." },
    },
  },
  music: {
    text: "Musicals or iconic soundtracks?",
    options: {
      musical: { label: "People breaking into song", funnyReaction: "Break into song." },
      soundtrack: { label: "A great soundtrack is enough", funnyReaction: "Audio doing the heavy lifting." },
      no: { label: "No musicals", funnyReaction: "Zero jazz hands." },
      whatever: { label: "I don't care", funnyReaction: "Okay." },
    },
  },
};

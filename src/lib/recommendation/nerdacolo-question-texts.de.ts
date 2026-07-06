import type { QuestionTextCatalog } from "./nerdacolo-question-texts";

export const NERDACOLO_QUESTION_TEXTS_DE: QuestionTextCatalog = {
  "mood-night": {
    text: "Was für ein Abend ist es?",
    subtitle: "Nerdacolo schnuppert die Couch-Atmosphäre.",
    options: {
      cozy: { label: "Couch, Decke und null Trauma", funnyReaction: "Deine Couch hat erleichtert aufgeatmet." },
      laugh: { label: "Ich will lachen, ohne zu viele Neuronen zu verbrauchen", funnyReaction: "Neuronen gespart. Nerdacolo approbiert." },
      mystery: { label: "Ich will Mystery und Verdacht gegen alle", funnyReaction: "Niemand ist unschuldig, bis Nerdacolo das Gegenteil sagt." },
      cry: { label: "Ich will mich emotional zerstören lassen", funnyReaction: "Taschentücher bereit. Die Kugel urteilt nicht." },
      action: { label: "Ich will Action, Tempo und Chaos", funnyReaction: "Popcorn-Modus aktiviert." },
      weird: { label: "Ich will was Verrücktes, aber Gutes", funnyReaction: "Die Kugel liebt bizarre Schätze." },
    },
  },
  "energy-brain": {
    text: "Wie viele Neuronen hast du heute Abend verfügbar?",
    options: {
      two: { label: "Zwei, und die streiten", funnyReaction: "Einfache Handlung incoming." },
      normal: { label: "Genug für eine normale Handlung", funnyReaction: "Normale Handlung = schon Luxus." },
      conspiracy: { label: "Bereit für Verschwörungen, Timelines und Whiteboards", funnyReaction: "Nerdacolo bereitet Whiteboard und Timeline vor." },
      elegant: { label: "Lass mich leiden, aber mit Eleganz", funnyReaction: "Leiden mit guter Fotografie, incoming." },
    },
  },
  "time-movie": {
    text: "Wie viel Zeit willst du investieren?",
    options: {
      "90": { label: "Maximal 90 Minuten", funnyReaction: "Filme mit Pause hab ich aussortiert." },
      "120": { label: "Auch 2 Stunden geht klar", funnyReaction: "Klassischer Kinoabend." },
      "180": { label: "Auch 3 Stunden, aber es muss sich lohnen", funnyReaction: "Nur Epics, die deine Zeit wert sind." },
      decide: { label: "Keine Ahnung, du entscheidest", funnyReaction: "Ok, Befehl angenommen." },
    },
  },
  "time-tv": {
    text: "Wie viel Zeit willst du investieren?",
    options: {
      "one-ep": { label: "Eine Folge und dann schlafen", funnyReaction: "Eine Folge, versprochen. (Nerdacolo lügt oft.)" },
      "few-eps": { label: "2–3 Folgen", funnyReaction: "Genau der richtige Binge." },
      addiction: { label: "Ich will eine Sucht starten", funnyReaction: "12-Staffel-Serien hab ich rausgeworfen. Spaß. Vielleicht." },
      miniseries: { label: "Ich suche eine Miniserie", funnyReaction: "Abgeschlossene Stories, null emotionale Hypotheken." },
    },
  },
  "comfort-zone": {
    text: "Willst du was Nahes an deinem Geschmack oder willst du riskieren?",
    options: {
      total: { label: "Totale Comfort Zone", funnyReaction: "Heute Abend kein Sprung ins Ungewisse." },
      similar: { label: "Ähnlich, aber mit was Neuem", funnyReaction: "Halber Schritt raus aus der Zone." },
      surprise: { label: "Überrasch mich", funnyReaction: "Die Kugel wärmt sich auf." },
      far: { label: "Bring mich weit weg, aber ohne Reue", funnyReaction: "Kalibriertes Risiko. Gefällt mir." },
    },
  },
  darkness: {
    text: "Wie viel Dunkelheit verträgst du?",
    options: {
      light: { label: "Licht an und Happy End", funnyReaction: "Keine Alpträume heute Nacht." },
      tension: { label: "Ein bisschen Spannung geht klar", funnyReaction: "Soft-Thriller, incoming." },
      thriller: { label: "Thriller, Angst, zwielichtige Leute", funnyReaction: "Vertrau niemandem." },
      destroy: { label: "Zerstör mich ruhig", funnyReaction: "Die Kugel hat ihre Dark-Kopfhörer aufgesetzt." },
    },
  },
  pace: {
    text: "Welches Tempo willst du?",
    options: {
      slow: { label: "Langsam aber tief", funnyReaction: "Keine Eile, nur Vibes." },
      balanced: { label: "Ausgewogen", funnyReaction: "Goldilocks-Zone." },
      fast: { label: "Schnell — ich muss 'noch eine' sagen", funnyReaction: "Tempo ohne Gnade." },
      chaos: { label: "Chaos, Twists und null Pausen", funnyReaction: "Adrenalin-Schübe incoming." },
    },
  },
  mainstream: {
    text: "Auf Nummer sicher gehen oder mit einem Geheimtipp glänzen?",
    options: {
      safe: { label: "Mainstream, ich will nicht riskieren", funnyReaction: "Titel, die jeder kennt (aus gutem Grund)." },
      quality: { label: "Qualität, aber nicht zu unbekannt", funnyReaction: "Nerdacolos Sweet Spot." },
      gem: { label: "Verstecktes Juwel", funnyReaction: "Suche nach unterschätzten Perlen." },
      "weird-hit": { label: "Absurder Titel, den ich später allen empfehle", funnyReaction: "Die Empfehlung, die niemand wollte." },
    },
  },
  fantasy: {
    text: "Wie normal soll die Welt sein?",
    options: {
      real: { label: "Realistisch", funnyReaction: "Keine Drachen, nur Drama." },
      "weird-real": { label: "Realistisch, aber mit Schrulligkeiten", funnyReaction: "Leicht unhinged." },
      sf: { label: "Sci-Fi/Fantasy ok", funnyReaction: "Weltraum und Magie willkommen." },
      "all-in": { label: "Multiversen, Monster, Magie — alles rein", funnyReaction: "Unendlicher-Lore-Modus." },
    },
  },
  social: {
    text: "Mit wem schaust du?",
    options: {
      solo: { label: "Alleine", funnyReaction: "Null Kompromisse." },
      couple: { label: "Zu zweit", funnyReaction: "Nichts zu Traumatisches, vielleicht." },
      friends: { label: "Mit Freunden", funnyReaction: "Was, das Memes produziert." },
      distracted: { label: "Mit jemandem, der alle 5 Minuten aufs Handy schaut", funnyReaction: "Einfache Handlung oder kurze Folgen." },
    },
  },
  ending: {
    text: "Welche Beziehung willst du zum Ende haben?",
    options: {
      comfort: { label: "Es soll mich trösten", funnyReaction: "Happy End oder emotionale Rückerstattung." },
      bittersweet: { label: "Bittersüß geht auch", funnyReaction: "Gemischte Gefühle." },
      questions: { label: "Es darf Fragen offen lassen", funnyReaction: "Ein Finale, das Theorien nährt." },
      ruin: { label: "Es soll meine Woche ruinieren", funnyReaction: "Narratives Trauma incoming." },
    },
  },
  "binge-tv": {
    text: "Wie binge-lastig ist der Abend?",
    options: {
      one: { label: "Nur eine, schwöre", funnyReaction: "Eine. Klassische Lüge." },
      marathon: { label: "Marathon bis 3 Uhr", funnyReaction: "Cliffhanger-Sucht-Modus." },
      background: { label: "Hintergrund, während ich was anderes mache", funnyReaction: "Comedy oder kurze Folgen." },
      weekend: { label: "Ganzes Wochenende", funnyReaction: "Lange Serien, null Reue." },
    },
  },
  language: {
    text: "Untertitel: Freunde oder Feinde?",
    options: {
      "no-subs": { label: "Keine Untertitel, nur Synchronisation", funnyReaction: "Priorität für leicht verfolgbare Titel." },
      "subs-ok": { label: "Untertitel ok", funnyReaction: "Mehr Optionen im Spiel." },
      original: { label: "Ich will Original, auch wenn ich lesen muss", funnyReaction: "Original-Audio-Purist." },
      whatever: { label: "Mir egal", funnyReaction: "Die Kugel entscheidet für dich." },
    },
  },
  romance: {
    text: "Wie viel Romance verträgst du?",
    options: {
      zero: { label: "Null, danke", funnyReaction: "Kein Meet-Cute heute Abend." },
      side: { label: "Als Nebenhandlung geht klar", funnyReaction: "Romance als Würze." },
      yes: { label: "Ich will Schmetterlinge", funnyReaction: "Herz im Flutter-Modus." },
      pain: { label: "Liebe, die wehtut", funnyReaction: "Romance-Drama incoming." },
    },
  },
  "comedy-style": {
    text: "Wenn du lachst, wie lachst du?",
    options: {
      sitcom: { label: "Sitcom und einfache Gags", funnyReaction: "Low-Effort-Lacher." },
      "dark-humor": { label: "Schwarzer Humor", funnyReaction: "Über falsche Dinge lachen." },
      smart: { label: "Intelligente Comedy", funnyReaction: "Gags für Leute, die zu viele Sitcoms gesehen haben." },
      "no-laugh": { label: "Heute will ich nicht lachen", funnyReaction: "Comedy off the table." },
    },
  },
  horror: {
    text: "Echter Horror oder nur Gänsehaut?",
    options: {
      none: { label: "Null Horror", funnyReaction: "Keine Dämonen, nicht mal die süßen." },
      mild: { label: "Sanfte Gänsehaut", funnyReaction: "Spannung ohne Alpträume." },
      real: { label: "Horror, der zählt", funnyReaction: "Licht an empfohlen." },
      gore: { label: "Blut und Schreie", funnyReaction: "Die Kugel hat zu viele schlechte Jump Scares gesehen." },
    },
  },
  "complexity-deep": {
    text: "Wie sehr willst du mental mitdenken?",
    options: {
      off: { label: "Gehirn aus", funnyReaction: "Zombie-Modus." },
      normal: { label: "Normale Handlung", funnyReaction: "Ohne Wiki followbar." },
      deep: { label: "Verflochtene Handlungen", funnyReaction: "Notizen empfohlen." },
      wiki: { label: "Ich will mitten in der Folge Reddit öffnen", funnyReaction: "Lore zum Entschlüsseln." },
    },
  },
  "emotional-light": {
    text: "Wie viel emotionales Gewicht hältst du aus?",
    options: {
      feather: { label: "Federleicht, null Drama", funnyReaction: "Keine Tränen." },
      medium: { label: "Ein bisschen Herz geht klar", funnyReaction: "Emotionen dosiert." },
      heavy: { label: "Ich will was fühlen", funnyReaction: "Herz im Aktivmodus." },
      wreck: { label: "Demolier mich", funnyReaction: "Taschentücher x2." },
    },
  },
  visual: {
    text: "Wie viel visuelles Spektakel?",
    options: {
      minimal: { label: "Minimal — die Story zählt", funnyReaction: "Kleines Budget, großes Herz." },
      nice: { label: "Schön anzusehen", funnyReaction: "Kuratierte Ästhetik." },
      epic: { label: "Blockbuster-Vibes", funnyReaction: "Explosionen optional." },
      art: { label: "Visuelle Kunst, auch wenn langsam", funnyReaction: "Jeder Frame ein Gemälde." },
    },
  },
  "genre-crime": {
    text: "Reizt dich Krimi und Ermittlungen?",
    options: {
      love: { label: "Detektive, Hinweise, Täter", funnyReaction: "True-Crime-Energie." },
      maybe: { label: "Wenn's nicht zu langsam ist", funnyReaction: "Krimi mit Tempo." },
      no: { label: "Nein danke", funnyReaction: "Krimi off the table." },
      psych: { label: "Psychothriller", funnyReaction: "Verdrehte Köpfe incoming." },
    },
  },
  "scifi-depth": {
    text: "Sci-Fi: Popcorn oder Philosophie?",
    options: {
      popcorn: { label: "Laser und Dinge, die explodieren", funnyReaction: "Sci-Fi-Action." },
      philosophy: { label: "Bewusstsein, Simulationen, Existenz", funnyReaction: "Blade-Runner-Vibes." },
      "no-sci": { label: "Kein Sci-Fi", funnyReaction: "Nur Festland." },
      dystopia: { label: "Dystopie zum Nachdenken", funnyReaction: "Black-Mirror-Energie." },
    },
  },
  animation: {
    text: "Animation: ja oder nein?",
    options: {
      "yes-adult": { label: "Erwachsenen-Animation ok", funnyReaction: "Nicht nur Cartoons für Kinder." },
      "yes-all": { label: "Alles ok", funnyReaction: "Animation willkommen." },
      no: { label: "Ich bevorzuge Live Action", funnyReaction: "Nur Schauspieler aus Fleisch und Blut." },
      family: { label: "Was für alle", funnyReaction: "Family friendly." },
    },
  },
  docu: {
    text: "Dokus heute Abend?",
    options: {
      yes: { label: "Ich will was lernen", funnyReaction: "Gehirn im Neugier-Modus." },
      no: { label: "Nein, ich will Fiction", funnyReaction: "Heute Abend keine Realität." },
      maybe: { label: "Docu-Drama ok", funnyReaction: "Halb wahr, halb erfunden." },
      "true-crime": { label: "True Crime (aber nicht zu heavy)", funnyReaction: "Echte Verbrechen, kontrollierte Angst." },
    },
  },
  nostalgia: {
    text: "Nostalgie oder was Neues?",
    options: {
      classic: { label: "Klassiker, die nicht altern", funnyReaction: "Ikonen der Vergangenheit." },
      recent: { label: "Aktuelle Releases", funnyReaction: "Nur frisches Zeug." },
      new: { label: "Noch nie gehört", funnyReaction: "Absolutes Geheimjuwel." },
      mix: { label: "Mix aus allem", funnyReaction: "Totale Überraschung." },
    },
  },
  "violence-tv": {
    text: "Blut im TV: welches Level?",
    options: {
      zero: { label: "Familienfreundlich", funnyReaction: "Kein Rot auf dem Bildschirm." },
      pg13: { label: "PG-13 geht klar", funnyReaction: "Sanfte Gewalt." },
      mature: { label: "Erwachseneninhalt ok", funnyReaction: "Game-of-Thrones-Zone." },
      extreme: { label: "Keine Limits", funnyReaction: "Die Kugel schaut nicht hin." },
    },
  },
  twist: {
    text: "Plot Twists: wie viele willst du?",
    options: {
      predictable: { label: "Vorhersehbar geht klar", funnyReaction: "Comfort-Plot." },
      some: { label: "Ein paar Twists", funnyReaction: "Überraschung dosiert." },
      many: { label: "Ein Twist alle 10 Minuten", funnyReaction: "Narrativer Whiplash." },
      unreliable: { label: "Unzuverlässiger Erzähler", funnyReaction: "Vertrau nichts." },
    },
  },
  music: {
    text: "Musicals oder ikonische Soundtracks?",
    options: {
      musical: { label: "Leute, die anfangen zu singen", funnyReaction: "Break into song." },
      soundtrack: { label: "Guter Soundtrack reicht", funnyReaction: "Audio macht die Arbeit." },
      no: { label: "Keine Musicals", funnyReaction: "Null Jazz Hands." },
      whatever: { label: "Mir egal", funnyReaction: "Ok." },
    },
  },
};

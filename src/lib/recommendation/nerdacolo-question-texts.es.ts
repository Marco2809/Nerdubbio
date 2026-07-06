import type { QuestionTextCatalog } from "./nerdacolo-question-texts";

export const NERDACOLO_QUESTION_TEXTS_ES: QuestionTextCatalog = {
  "mood-night": {
    text: "¿Qué tipo de noche es?",
    subtitle: "Nerdacolo olfatea el ambiente del sofá.",
    options: {
      cozy: { label: "Sofá, manta y cero traumas", funnyReaction: "Tu sofá acaba de suspirar aliviado." },
      laugh: { label: "Quiero reír sin usar demasiadas neuronas", funnyReaction: "Neuronas ahorradas. Nerdacolo aprueba." },
      mystery: { label: "Quiero misterio y sospechas sobre todos", funnyReaction: "Nadie es inocente hasta que Nerdacolo diga lo contrario." },
      cry: { label: "Quiero que me destrocen emocionalmente", funnyReaction: "Pañuelos listos. La esfera no juzga." },
      action: { label: "Quiero acción, ritmo y caos", funnyReaction: "Modo palomitas activado." },
      weird: { label: "Quiero algo raro, pero bueno", funnyReaction: "La esfera adora las joyas bizarra." },
    },
  },
  "energy-brain": {
    text: "¿Cuántas neuronas tienes disponibles esta noche?",
    options: {
      two: { label: "Dos, y están peleando", funnyReaction: "Trama sencilla incoming." },
      normal: { label: "Suficientes para seguir una trama normal", funnyReaction: "Trama normal = ya un lujo." },
      conspiracy: { label: "Listo para conspiraciones, timelines y pizarras", funnyReaction: "Nerdacolo prepara pizarra y timeline." },
      elegant: { label: "Hazme sufrir, pero con elegancia", funnyReaction: "Sufrimiento con buena fotografía, incoming." },
    },
  },
  "time-movie": {
    text: "¿Cuánto tiempo quieres invertir?",
    options: {
      "90": { label: "Máximo 90 minutos", funnyReaction: "Descarté las pelis que piden intermedio." },
      "120": { label: "Hasta 2 horas está bien", funnyReaction: "Noche clásica de cine." },
      "180": { label: "Hasta 3 horas, pero tiene que merecerlo", funnyReaction: "Solo épicas dignas de tu tiempo." },
      decide: { label: "No lo sé, tú decides", funnyReaction: "Ok, comando aceptado." },
    },
  },
  "time-tv": {
    text: "¿Cuánto tiempo quieres invertir?",
    options: {
      "one-ep": { label: "Un capítulo y a dormir", funnyReaction: "Un episodio, prometido. (Nerdacolo miente mucho.)" },
      "few-eps": { label: "2-3 episodios", funnyReaction: "Justo el binge perfecto." },
      addiction: { label: "Quiero empezar una adicción", funnyReaction: "Descarté las series de 12 temporadas. Broma. Quizá." },
      miniseries: { label: "Busco una miniserie", funnyReaction: "Historias cerradas, cero hipotecas emocionales." },
    },
  },
  "comfort-zone": {
    text: "¿Quieres algo cercano a tus gustos o quieres arriesgar?",
    options: {
      total: { label: "Zona de confort total", funnyReaction: "Ningún salto al vacío esta noche." },
      similar: { label: "Similar, pero con algo nuevo", funnyReaction: "Medio paso fuera de la zona." },
      surprise: { label: "Sorpréndeme", funnyReaction: "La esfera se calienta." },
      far: { label: "Llévame lejos, pero que no me arrepienta", funnyReaction: "Riesgo calibrado. Me gusta." },
    },
  },
  darkness: {
    text: "¿Cuánta oscuridad aguantas?",
    options: {
      light: { label: "Luz encendida y final feliz", funnyReaction: "Nada de pesadillas esta noche." },
      tension: { label: "Un poco de tensión está bien", funnyReaction: "Thriller suave, incoming." },
      thriller: { label: "Thriller, ansiedad, gente sospechosa", funnyReaction: "No confíes en nadie." },
      destroy: { label: "Destrúyeme sin piedad", funnyReaction: "La esfera se puso los auriculares dark." },
    },
  },
  pace: {
    text: "¿Qué ritmo quieres?",
    options: {
      slow: { label: "Lento pero profundo", funnyReaction: "Sin prisa, solo vibes." },
      balanced: { label: "Equilibrado", funnyReaction: "Zona Goldilocks." },
      fast: { label: "Rápido, tengo que decir 'uno más'", funnyReaction: "Ritmo que no perdona." },
      chaos: { label: "Caos, giros y cero pausas", funnyReaction: "Dosis de adrenalina." },
    },
  },
  mainstream: {
    text: "¿Ir a lo seguro o triunfar con una joya oculta?",
    options: {
      safe: { label: "Mainstream, no quiero arriesgar", funnyReaction: "Títulos que todos conocen (por algo)." },
      quality: { label: "Calidad pero no demasiado desconocida", funnyReaction: "El sweet spot de Nerdacolo." },
      gem: { label: "Joya oculta", funnyReaction: "Busco perlas infravaloradas." },
      "weird-hit": { label: "Título absurdo que luego recomendaré a todos", funnyReaction: "La recomendación que nadie pidió." },
    },
  },
  fantasy: {
    text: "¿Qué tan normal debe ser el mundo?",
    options: {
      real: { label: "Realista", funnyReaction: "Nada de dragones, solo drama." },
      "weird-real": { label: "Realista pero con rarezas", funnyReaction: "Ligeramente desquiciado." },
      sf: { label: "Ciencia ficción/fantasy ok", funnyReaction: "Espacio y magia bienvenidos." },
      "all-in": { label: "Multiversos, monstruos, magia, todo dentro", funnyReaction: "Modo lore infinito." },
    },
  },
  social: {
    text: "¿Con quién ves?",
    options: {
      solo: { label: "Solo", funnyReaction: "Cero compromisos." },
      couple: { label: "En pareja", funnyReaction: "Nada demasiado traumático, quizá." },
      friends: { label: "Con amigos", funnyReaction: "Algo que genere memes." },
      distracted: { label: "Con alguien que mira el móvil cada 5 minutos", funnyReaction: "Trama simple o episodios cortos." },
    },
  },
  ending: {
    text: "¿Qué relación quieres tener con el final?",
    options: {
      comfort: { label: "Que me consuele", funnyReaction: "Final feliz o reembolso emocional." },
      bittersweet: { label: "Agridulce también vale", funnyReaction: "Emociones mezcladas." },
      questions: { label: "Puede dejarme con preguntas", funnyReaction: "Final que alimenta teorías." },
      ruin: { label: "Que me arruine la semana", funnyReaction: "Trauma narrativo incoming." },
    },
  },
  "binge-tv": {
    text: "¿Qué tan binge es la noche?",
    options: {
      one: { label: "Solo uno, lo juro", funnyReaction: "Uno. Mentira clásica." },
      marathon: { label: "Maratón hasta las 3", funnyReaction: "Modo adicción a cliffhangers." },
      background: { label: "De fondo mientras hago otras cosas", funnyReaction: "Comedia o episodios cortos." },
      weekend: { label: "Fin de semana entero", funnyReaction: "Series largas, cero arrepentimientos." },
    },
  },
  language: {
    text: "Subtítulos: ¿amigos o enemigos?",
    options: {
      "no-subs": { label: "Nada de subtítulos, solo doblaje", funnyReaction: "Prioridad a títulos fáciles de seguir." },
      "subs-ok": { label: "Subtítulos ok", funnyReaction: "Más opciones en juego." },
      original: { label: "Quiero original, aunque tenga que leer", funnyReaction: "Purista del audio original." },
      whatever: { label: "Me da igual", funnyReaction: "La esfera decide por ti." },
    },
  },
  romance: {
    text: "¿Cuánto romance aguantas?",
    options: {
      zero: { label: "Cero, gracias", funnyReaction: "Nada de meet-cute esta noche." },
      side: { label: "De fondo está bien", funnyReaction: "Romance como condimento." },
      yes: { label: "Quiero mariposas", funnyReaction: "Corazón en modo flutter." },
      pain: { label: "Amor que duele", funnyReaction: "Drama romántico incoming." },
    },
  },
  "comedy-style": {
    text: "Si te ríes, ¿cómo te ríes?",
    options: {
      sitcom: { label: "Sitcom y chistes fáciles", funnyReaction: "Risas low-effort." },
      "dark-humor": { label: "Humor negro", funnyReaction: "Reírse de cosas que no deberían." },
      smart: { label: "Comedia inteligente", funnyReaction: "Chistes para quien ha visto demasiadas sitcom." },
      "no-laugh": { label: "Esta noche no quiero reír", funnyReaction: "Comedia fuera de la mesa." },
    },
  },
  horror: {
    text: "¿Horror de verdad o solo escalofríos?",
    options: {
      none: { label: "Cero horror", funnyReaction: "Nada de demonios, ni los monos." },
      mild: { label: "Escalofríos suaves", funnyReaction: "Tensión sin pesadillas." },
      real: { label: "Horror que cuenta", funnyReaction: "Luz encendida recomendada." },
      gore: { label: "Sangre y gritos", funnyReaction: "La esfera ha visto demasiados jump scares malos." },
    },
  },
  "complexity-deep": {
    text: "¿Cuánto quieres esforzarte mentalmente?",
    options: {
      off: { label: "Cerebro apagado", funnyReaction: "Modo zombi." },
      normal: { label: "Trama normal", funnyReaction: "Seguible sin wiki." },
      deep: { label: "Tramas enredadas", funnyReaction: "Apuntes recomendados." },
      wiki: { label: "Quiero abrir Reddit a mitad de episodio", funnyReaction: "Lore por descifrar." },
    },
  },
  "emotional-light": {
    text: "¿Cuánto peso emocional aguantas?",
    options: {
      feather: { label: "Pluma, cero drama", funnyReaction: "Nada de lágrimas." },
      medium: { label: "Un poco de corazón está bien", funnyReaction: "Emociones dosificadas." },
      heavy: { label: "Quiero sentir algo", funnyReaction: "Corazón en modo activo." },
      wreck: { label: "Demoléceme", funnyReaction: "Pañuelos x2." },
    },
  },
  visual: {
    text: "¿Cuánto espectáculo visual?",
    options: {
      minimal: { label: "Minimal, cuenta la historia", funnyReaction: "Presupuesto bajo, corazón grande." },
      nice: { label: "Bonito de ver", funnyReaction: "Estética cuidada." },
      epic: { label: "Vibes de blockbuster", funnyReaction: "Explosiones opcionales." },
      art: { label: "Arte visual, aunque sea lento", funnyReaction: "Cada frame un cuadro." },
    },
  },
  "genre-crime": {
    text: "¿Te atraen el crimen y las investigaciones?",
    options: {
      love: { label: "Detectives, pistas, culpable", funnyReaction: "Energía true crime." },
      maybe: { label: "Si no es demasiado lento", funnyReaction: "Crimen con ritmo." },
      no: { label: "No, gracias", funnyReaction: "Crimen fuera de la mesa." },
      psych: { label: "Thriller psicológico", funnyReaction: "Mentes retorcidas incoming." },
    },
  },
  "scifi-depth": {
    text: "¿Ciencia ficción: palomitas o filosofía?",
    options: {
      popcorn: { label: "Láseres y cosas que explotan", funnyReaction: "Sci-fi action." },
      philosophy: { label: "Consciencia, simulaciones, existencia", funnyReaction: "Vibes Blade Runner." },
      "no-sci": { label: "Nada de sci-fi", funnyReaction: "Solo tierra firme." },
      dystopia: { label: "Distopía que hace pensar", funnyReaction: "Energía Black Mirror." },
    },
  },
  animation: {
    text: "¿Animación: sí o no?",
    options: {
      "yes-adult": { label: "Animación adulta ok", funnyReaction: "No solo dibujos para niños." },
      "yes-all": { label: "Todo ok", funnyReaction: "Animación bienvenida." },
      no: { label: "Prefiero live action", funnyReaction: "Solo actores de carne y hueso." },
      family: { label: "Algo para todos", funnyReaction: "Family friendly." },
    },
  },
  docu: {
    text: "¿Documentales esta noche?",
    options: {
      yes: { label: "Quiero aprender algo", funnyReaction: "Cerebro en modo curioso." },
      no: { label: "No, quiero ficción", funnyReaction: "Nada de realidad esta noche." },
      maybe: { label: "Docu-drama ok", funnyReaction: "Mitad verdad, mitad invento." },
      "true-crime": { label: "True crime (pero no demasiado pesado)", funnyReaction: "Crímenes reales, ansiedad controlada." },
    },
  },
  nostalgia: {
    text: "¿Nostalgia o novedad?",
    options: {
      classic: { label: "Clásicos que no envejecen", funnyReaction: "Iconos del pasado." },
      recent: { label: "Estrenos recientes", funnyReaction: "Solo cosas frescas." },
      new: { label: "Nunca oído nombrar", funnyReaction: "Joya absoluta." },
      mix: { label: "Mezcla de todo", funnyReaction: "Sorpresa total." },
    },
  },
  "violence-tv": {
    text: "¿Sangre en TV: qué nivel?",
    options: {
      zero: { label: "Family-friendly", funnyReaction: "Nada de rojo en pantalla." },
      pg13: { label: "PG-13 está bien", funnyReaction: "Violencia suave." },
      mature: { label: "Contenido adulto ok", funnyReaction: "Zona Game of Thrones." },
      extreme: { label: "Sin límites", funnyReaction: "La esfera no mira." },
    },
  },
  twist: {
    text: "¿Giros de trama: cuántos quieres?",
    options: {
      predictable: { label: "Predecible está bien", funnyReaction: "Trama de confort." },
      some: { label: "Algún que otro giro", funnyReaction: "Sorpresa dosificada." },
      many: { label: "Un giro cada 10 minutos", funnyReaction: "Latigazo narrativo." },
      unreliable: { label: "Narrador poco fiable", funnyReaction: "No te fíes de nada." },
    },
  },
  music: {
    text: "¿Musicales o bandas sonoras icónicas?",
    options: {
      musical: { label: "Gente que canta", funnyReaction: "Break into song." },
      soundtrack: { label: "Buena banda sonora basta", funnyReaction: "El audio hace el trabajo." },
      no: { label: "Nada de musicales", funnyReaction: "Cero jazz hands." },
      whatever: { label: "Me da igual", funnyReaction: "Ok." },
    },
  },
};

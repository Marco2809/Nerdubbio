/**
 * Libreria di motivi animati per i video-recap.
 * Ogni motivo è un SVG generico e riutilizzabile: lo storyboard generato dall'AI
 * mappa ogni beat della trama su uno di questi nomi. Le classi di animazione
 * (rb-*) sono definite in RecapReel.tsx.
 *
 * I nomi qui DEVONO restare allineati a RECAP_MOTIFS in api/lib/recap.php.
 */

const person = `<svg viewBox="0 0 300 300"><path d="M150 44 L108 256 H192 Z" fill="#e0a52e" opacity=".12"/><g class="rb-fx" style="transform-origin:150px 172px;animation:rb-pop .7s ease both"><circle cx="150" cy="126" r="30" fill="#d8c5a6"/><path d="M102 252 q0 -74 48 -74 q48 0 48 74 z" fill="#3c5230"/></g></svg>`;

const duo = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:112px 172px;animation:rb-pop .6s ease both"><circle cx="112" cy="120" r="26" fill="#d8c5a6"/><path d="M72 240 q0 -62 40 -62 q40 0 40 62z" fill="#6f8f4f"/></g><g class="rb-fx" style="transform-origin:190px 172px;animation:rb-pop .6s ease .18s both"><circle cx="190" cy="120" r="26" fill="#c9b184"/><path d="M150 240 q0 -62 40 -62 q40 0 40 62z" fill="#3c5230"/></g></svg>`;

const group = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:88px 190px;animation:rb-pop .6s ease both"><circle cx="88" cy="132" r="22" fill="#c9b184"/><path d="M52 244 q0 -56 36 -56 q36 0 36 56z" fill="#5f7d43"/></g><g class="rb-fx" style="transform-origin:212px 190px;animation:rb-pop .6s ease .14s both"><circle cx="212" cy="132" r="22" fill="#d8c5a6"/><path d="M176 244 q0 -56 36 -56 q36 0 36 56z" fill="#6f8f4f"/></g><g class="rb-fx" style="transform-origin:150px 182px;animation:rb-pop .6s ease .28s both"><circle cx="150" cy="120" r="26" fill="#e0d3b4"/><path d="M108 250 q0 -64 42 -64 q42 0 42 64z" fill="#3c5230"/></g></svg>`;

const home = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 200px;animation:rb-pop .7s ease both"><path d="M64 152 L150 80 L236 152 Z" fill="#c0392b"/><rect x="86" y="152" width="128" height="92" fill="#e8e2d0"/><rect x="132" y="192" width="36" height="52" fill="#6f4a2a"/><rect x="100" y="166" width="26" height="26" fill="#e0a52e" class="rb-fx" style="transform-origin:113px 179px;animation:rb-throb 2.2s ease-in-out infinite"/><rect x="174" y="166" width="26" height="26" fill="#e0a52e"/></g><line x1="46" y1="244" x2="254" y2="244" stroke="#20241b" stroke-width="3"/></svg>`;

const city = (() => {
  const b = [
    { x: 54, h: 120 }, { x: 96, h: 172 }, { x: 138, h: 92 },
    { x: 180, h: 150 }, { x: 222, h: 110 },
  ];
  let s = '<svg viewBox="0 0 300 300">';
  b.forEach((it, i) => {
    const y = 244 - it.h;
    s += `<g class="rb-fx" style="transform-origin:${it.x}px 244px;animation:rb-grow .6s ease ${(i * 0.12).toFixed(2)}s both"><rect x="${it.x}" y="${y}" width="34" height="${it.h}" fill="#3c5230" stroke="#20241b" stroke-width="2"/>`;
    for (let wy = y + 12; wy < 236; wy += 22) {
      s += `<rect x="${it.x + 7}" y="${wy}" width="8" height="10" fill="#e0a52e" opacity=".85"/><rect x="${it.x + 20}" y="${wy}" width="8" height="10" fill="#e0a52e" opacity=".85"/>`;
    }
    s += '</g>';
  });
  s += '<line x1="40" y1="244" x2="260" y2="244" stroke="#20241b" stroke-width="3"/></svg>';
  return s;
})();

const journey = `<svg viewBox="0 0 300 300"><path d="M96 250 C150 210 90 170 150 140 C205 112 150 70 200 46" fill="none" stroke="#8a6a3e" stroke-width="18" stroke-linecap="round"/><path d="M96 250 C150 210 90 170 150 140 C205 112 150 70 200 46" fill="none" stroke="#e8e2d0" stroke-width="3" stroke-dasharray="9 13"/><g class="rb-fx" style="transform-origin:200px 66px;animation:rb-pop .5s ease .35s both"><path d="M200 30 a22 22 0 0 1 22 24 q0 20 -22 40 q-22 -20 -22 -40 a22 22 0 0 1 22 -24z" fill="#c0392b"/><circle cx="200" cy="54" r="9" fill="#e8e2d0"/></g></svg>`;

const money = (() => {
  const st = [{ x: 60, h: 54 }, { x: 106, h: 80 }, { x: 152, h: 106 }, { x: 198, h: 132 }];
  let s = '<svg viewBox="0 0 300 300">';
  st.forEach((it, i) => {
    const y = 228 - it.h;
    s += `<g class="rb-fx" style="transform-origin:${it.x}px 228px;animation:rb-grow .6s ease ${(i * 0.16).toFixed(2)}s both"><rect x="${it.x}" y="${y}" width="38" height="${it.h}" rx="3" fill="#5f7d43" stroke="#3c5230" stroke-width="2"/><circle cx="${it.x + 19}" cy="${y + 18}" r="8" fill="none" stroke="#e8e2d0" stroke-width="2"/><line x1="${it.x}" y1="${y + 34}" x2="${it.x + 38}" y2="${y + 34}" stroke="#3c5230" stroke-width="1.4" opacity=".55"/></g>`;
  });
  s += '<line x1="42" y1="230" x2="272" y2="230" stroke="#20241b" stroke-width="3"/></svg>';
  return s;
})();

const crown = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 160px;animation:rb-pop .7s ease both"><path d="M78 208 L78 116 L120 158 L150 96 L180 158 L222 116 L222 208 Z" fill="#e0a52e" stroke="#a06f10" stroke-width="3"/><rect x="78" y="204" width="144" height="22" rx="3" fill="#c98f14" stroke="#a06f10" stroke-width="2"/><circle cx="150" cy="92" r="8" fill="#c0392b"/><circle cx="78" cy="112" r="7" fill="#c0392b"/><circle cx="222" cy="112" r="7" fill="#c0392b"/></g></svg>`;

const love = `<svg viewBox="0 0 300 300"><path class="rb-fx" d="M150 214 C86 166 88 104 132 104 C150 104 150 122 150 132 C150 122 150 104 168 104 C212 104 214 166 150 214 Z" fill="#c0392b" style="transform-origin:150px 158px;animation:rb-throb 1.3s ease-in-out infinite"/></svg>`;

const betrayal = `<svg viewBox="0 0 300 300"><path d="M150 214 C86 166 88 104 132 104 C150 104 150 122 150 132 C150 122 150 104 168 104 C212 104 214 166 150 214 Z" fill="#8f2f26"/><polyline points="150,116 136,150 162,168 144,196 150,214" fill="none" stroke="#0d0f0c" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="150" stroke-dashoffset="150" style="animation:rb-draw 1s ease .3s forwards"/></svg>`;

const danger = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-spin 9s linear infinite"><circle cx="150" cy="150" r="104" fill="none" stroke="#c0392b" stroke-width="2.5" stroke-dasharray="10 14"/><line x1="150" y1="32" x2="150" y2="58" stroke="#c0392b" stroke-width="2.5"/><line x1="150" y1="242" x2="150" y2="268" stroke="#c0392b" stroke-width="2.5"/><line x1="32" y1="150" x2="58" y2="150" stroke="#c0392b" stroke-width="2.5"/><line x1="242" y1="150" x2="268" y2="150" stroke="#c0392b" stroke-width="2.5"/></g><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-throb 1.8s ease-in-out infinite"><path d="M150 96 q-46 0 -46 44 q0 26 18 38 v20 h56 v-20 q18 -12 18 -38 q0 -44 -46 -44z" fill="#ece6d6"/><circle cx="134" cy="146" r="11" fill="#20241b"/><circle cx="166" cy="146" r="11" fill="#20241b"/><path d="M150 160 l-7 16 h14 z" fill="#20241b"/><g stroke="#20241b" stroke-width="3"><line x1="138" y1="188" x2="138" y2="202"/><line x1="150" y1="190" x2="150" y2="204"/><line x1="162" y1="188" x2="162" y2="202"/></g></g></svg>`;

const mystery = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-sweep 3.4s ease-in-out infinite"><circle cx="138" cy="138" r="54" fill="rgba(79,184,224,.14)" stroke="#e8e2d0" stroke-width="8"/><circle cx="138" cy="138" r="54" fill="none" stroke="#4fb8e0" stroke-width="2" opacity=".5"/><line x1="178" y1="178" x2="230" y2="230" stroke="#e8e2d0" stroke-width="13" stroke-linecap="round"/></g></svg>`;

const illness = `<svg viewBox="0 0 300 300"><rect x="44" y="98" width="212" height="104" rx="10" fill="#0f1a14" stroke="#3c5230" stroke-width="3"/><polyline points="58,150 104,150 122,116 140,188 158,150 200,150 242,150" fill="none" stroke="#4fb8e0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="280" stroke-dashoffset="280" style="animation:rb-draw 1.7s linear forwards"/><circle cx="242" cy="150" r="5" fill="#c0392b" class="rb-fx" style="transform-origin:242px 150px;animation:rb-throb 1.2s ease-in-out 1.7s infinite"/></svg>`;

const fall = `<svg viewBox="0 0 300 300"><polyline points="46,210 92,150 132,176 168,96 210,120" fill="none" stroke="#6f8f4f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="260" stroke-dashoffset="260" style="animation:rb-draw 1.3s ease forwards"/><polyline points="210,120 250,238" fill="none" stroke="#c0392b" stroke-width="5" stroke-linecap="round" stroke-dasharray="130" stroke-dashoffset="130" style="animation:rb-draw .7s ease 1.2s forwards"/><g fill="#c0392b"><rect class="rb-fx" x="242" y="230" width="12" height="12" style="transform-origin:248px 236px;animation:rb-fall 1.4s ease 1.7s infinite"/><rect class="rb-fx" x="224" y="222" width="9" height="9" style="transform-origin:228px 226px;animation:rb-fall 1.4s ease 2s infinite"/><circle class="rb-fx" cx="266" cy="236" r="5" style="transform-origin:266px 236px;animation:rb-fall 1.4s ease 2.3s infinite"/></g><line x1="40" y1="244" x2="264" y2="244" stroke="#20241b" stroke-width="3"/></svg>`;

const secret = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 158px;animation:rb-pop .7s ease both"><path d="M84 116 q66 -30 132 0 q6 62 -34 100 q-32 26 -66 -2 q-40 -34 -32 -98z" fill="#20241b" stroke="#e0a52e" stroke-width="3"/><path d="M104 146 q24 -16 48 0 l-7 13 q-17 -9 -34 0z" fill="#e8e2d0"/><path d="M148 146 q24 -16 48 0 l-7 13 q-17 -9 -34 0z" fill="#e8e2d0"/><line x1="150" y1="116" x2="150" y2="216" stroke="#e0a52e" stroke-width="2" opacity=".4"/></g></svg>`;

const chem = `<svg viewBox="0 0 300 300"><path d="M132 70 h36 v46 l40 84 a20 20 0 0 1 -18 30 h-80 a20 20 0 0 1 -18 -30 l40 -84 z" fill="none" stroke="#dfeaf0" stroke-width="4"/><clipPath id="rb-flask-clip"><path d="M132 116 l-38 80 a18 18 0 0 0 16 28 h80 a18 18 0 0 0 16 -28 l-38 -80z"/></clipPath><g clip-path="url(#rb-flask-clip)"><rect x="80" y="150" width="140" height="90" fill="#4fb8e0"/><circle class="rb-fx" cx="130" cy="210" r="6" fill="#bfeaf7" style="transform-origin:130px 210px;animation:rb-rise 2s linear infinite"/><circle class="rb-fx" cx="158" cy="210" r="4.5" fill="#bfeaf7" style="transform-origin:158px 210px;animation:rb-rise 2s linear .6s infinite"/><circle class="rb-fx" cx="176" cy="210" r="5.5" fill="#bfeaf7" style="transform-origin:176px 210px;animation:rb-rise 2s linear 1.1s infinite"/></g><rect x="124" y="64" width="52" height="10" rx="4" fill="#dfeaf0"/></svg>`;

const fight = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="animation:rb-shake .45s ease-in-out infinite"><g><circle cx="96" cy="128" r="22" fill="#d8c5a6"/><path d="M60 236 q0 -56 36 -56 q36 0 36 56z" fill="#6f8f4f"/></g><g><circle cx="204" cy="128" r="22" fill="#c9b184"/><path d="M168 236 q0 -56 36 -56 q36 0 36 56z" fill="#8f2f26"/></g></g><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-throb .6s ease-in-out infinite"><path d="M150 116 l10 24 24 -8 -14 22 18 18 -26 -2 -6 26 -14 -22 -22 8 12 -22 -18 -16 24 -4z" fill="#e0a52e"/></g></svg>`;

const arrest = `<svg viewBox="0 0 300 300"><circle cx="150" cy="126" r="28" fill="#d8c5a6"/><path d="M106 236 q0 -66 44 -66 q44 0 44 66z" fill="#3c5230"/><g class="rb-fx" style="transform-origin:150px 52px;animation:rb-grow .7s ease both"><g stroke="#9aa096" stroke-width="8"><line x1="86" y1="56" x2="86" y2="244"/><line x1="118" y1="56" x2="118" y2="244"/><line x1="150" y1="56" x2="150" y2="244"/><line x1="182" y1="56" x2="182" y2="244"/><line x1="214" y1="56" x2="214" y2="244"/></g><rect x="78" y="50" width="144" height="10" fill="#6f746c"/></g></svg>`;

const message = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 152px;animation:rb-pop .6s ease both"><rect x="104" y="72" width="92" height="160" rx="14" fill="#20241b" stroke="#e0a52e" stroke-width="3"/><rect x="116" y="92" width="68" height="104" rx="4" fill="#0f1a14"/><g stroke="#4fb8e0" stroke-width="4" stroke-linecap="round"><line x1="126" y1="120" x2="174" y2="120"/><line x1="126" y1="136" x2="174" y2="136"/><line x1="126" y1="152" x2="158" y2="152"/></g><circle cx="150" cy="216" r="7" fill="#e0a52e"/></g><circle class="rb-fx" cx="196" cy="90" r="16" fill="#c0392b" style="transform-origin:196px 90px;animation:rb-flash 1.1s ease-in-out infinite"/></svg>`;

const deal = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-pop .6s ease both"><rect x="92" y="66" width="116" height="150" rx="6" fill="#ece6d6" stroke="#b5a988" stroke-width="3"/><g stroke="#9aa096" stroke-width="4" stroke-linecap="round"><line x1="108" y1="92" x2="192" y2="92"/><line x1="108" y1="112" x2="192" y2="112"/><line x1="108" y1="132" x2="168" y2="132"/></g><path d="M110 178 q22 -22 42 0 q12 12 32 -8" fill="none" stroke="#20241b" stroke-width="3" stroke-linecap="round"/></g><circle class="rb-fx" cx="182" cy="196" r="20" fill="#c0392b" style="transform-origin:182px 196px;animation:rb-pop .5s ease .4s both"/></svg>`;

const explosion = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-throb .8s ease-in-out infinite"><path d="M150 44 l22 58 58 -20 -32 52 52 36 -62 6 12 60 -50 -36 -50 36 12 -60 -62 -6 52 -36 -32 -52 58 20z" fill="#e0a52e"/><path d="M150 86 l15 40 40 -13 -22 36 36 25 -44 4 8 42 -33 -25 -33 25 8 -42 -44 -4 36 -25 -22 -36 40 13z" fill="#c0392b"/></g><circle class="rb-fx" cx="150" cy="150" r="20" fill="#f2efe4" style="animation:rb-flash .6s ease-in-out infinite"/></svg>`;

const car = `<svg viewBox="0 0 300 300"><line x1="20" y1="216" x2="280" y2="216" stroke="#8a6a3e" stroke-width="4" stroke-dasharray="18 12"/><g class="rb-fx" style="animation:rb-slide .8s ease both"><path d="M64 190 l16 -34 h60 l26 34 h44 a10 10 0 0 1 10 10 v12 h-206 v-12 a10 10 0 0 1 10 -10z" fill="#c0392b" stroke="#7a241c" stroke-width="2"/><rect x="98" y="164" width="38" height="24" rx="3" fill="#4fb8e0" opacity=".8"/><circle cx="104" cy="212" r="16" fill="#20241b"/><circle cx="104" cy="212" r="6" fill="#6f8f4f"/><circle cx="196" cy="212" r="16" fill="#20241b"/><circle cx="196" cy="212" r="6" fill="#6f8f4f"/></g></svg>`;

const justice = `<svg viewBox="0 0 300 300"><line x1="150" y1="66" x2="150" y2="214" stroke="#c98f14" stroke-width="6"/><rect x="110" y="214" width="80" height="12" rx="4" fill="#c98f14"/><g class="rb-fx" style="transform-origin:150px 76px;animation:rb-swing 3s ease-in-out infinite"><line x1="84" y1="76" x2="216" y2="76" stroke="#e0a52e" stroke-width="6"/><circle cx="150" cy="76" r="8" fill="#e0a52e"/><g stroke="#e0a52e" stroke-width="2"><line x1="84" y1="76" x2="70" y2="116"/><line x1="84" y1="76" x2="98" y2="116"/><line x1="216" y1="76" x2="202" y2="116"/><line x1="216" y1="76" x2="230" y2="116"/></g><path d="M64 116 a20 12 0 0 0 40 0z" fill="#c98f14"/><path d="M196 116 a20 12 0 0 0 40 0z" fill="#c98f14"/></g></svg>`;

const union = `<svg viewBox="0 0 300 300"><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-pop .7s ease both"><circle cx="126" cy="156" r="46" fill="none" stroke="#e0a52e" stroke-width="9"/><circle cx="174" cy="156" r="46" fill="none" stroke="#c98f14" stroke-width="9"/><path d="M126 100 l9 16 h-18z" fill="#e0a52e"/><path d="M174 100 l9 16 h-18z" fill="#c98f14"/></g></svg>`;

const time = `<svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="86" fill="#20241b" stroke="#e0a52e" stroke-width="6"/><g stroke="#e8e2d0" stroke-width="4"><line x1="150" y1="72" x2="150" y2="84"/><line x1="150" y1="216" x2="150" y2="228"/><line x1="72" y1="150" x2="84" y2="150"/><line x1="216" y1="150" x2="228" y2="150"/></g><line x1="150" y1="150" x2="150" y2="102" stroke="#e8e2d0" stroke-width="5" stroke-linecap="round"/><g class="rb-fx" style="transform-origin:150px 150px;animation:rb-spin 3s linear infinite"><line x1="150" y1="150" x2="196" y2="150" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/></g><circle cx="150" cy="150" r="7" fill="#e0a52e"/></svg>`;

const monster = `<svg viewBox="0 0 300 300"><path d="M78 232 q-8 -112 72 -122 q80 10 72 122 q-24 -30 -36 -6 q-12 -26 -36 -2 q-24 -24 -36 2 q-12 -24 -36 6z" fill="#141712" stroke="#3c5230" stroke-width="2"/><g class="rb-fx" style="animation:rb-flash 1.6s ease-in-out infinite"><ellipse cx="126" cy="150" rx="12" ry="16" fill="#e0a52e"/><ellipse cx="174" cy="150" rx="12" ry="16" fill="#e0a52e"/></g><circle cx="126" cy="153" r="4" fill="#20241b"/><circle cx="174" cy="153" r="4" fill="#20241b"/></svg>`;

export const RECAP_MOTIFS: Record<string, string> = {
  person, duo, group, home, city, journey, money, crown,
  love, betrayal, danger, mystery, illness, fall, secret, chem,
  fight, arrest, message, deal, explosion, car, justice, union, time, monster,
};

export function motifSvg(name: string): string {
  return RECAP_MOTIFS[name] ?? person;
}

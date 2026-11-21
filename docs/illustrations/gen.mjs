// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets on a made-up Pushsafer account (fixed date): API calls
// close to the low API calls threshold, the pushes of the month, three
// devices and a group, and the last pushes of Gladys (one not sent). Every
// number and text is made up; the contents around them come from
// src/widgets.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildAccountWidget, buildRecentWidget } = await load('src/widgets.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Saturday 21 November 2026, 19:00 in Paris.
const NOW = Date.parse('2026-11-21T18:00:00Z');
const MINUTE = 60000;

const snapshot = {
  configured: true,
  username: 'jane@example.com',
  account: {
    devices: [
      { id: '52', name: 'iPhone', enabled: true },
      { id: '65', name: 'Pixel', enabled: true },
      { id: '71', name: 'Chrome', enabled: false },
    ],
    groups: [{ id: 'gs12', name: 'Family', devices: 2 }],
  },
  readAt: NOW - 7 * MINUTE,
  readFailure: null,
  apiCalls: { left: 34, at: NOW - 12 * MINUTE },
  lastFailure: null,
  counters: { month: '2026-11', sent: 63, failed: 1 },
  threshold: 20,
};

// The pushes of Gladys, per language (titles and texts the house wrote).
const TEXTS = {
  en: [
    ['Alarm', 'Water leak detected in the cellar'],
    ['Gladys', 'Motion at the front door'],
    ['Gladys', 'The washing machine has finished'],
    ['Gladys', 'Good night: everything is locked'],
  ],
  fr: [
    ['Alarme', "Fuite d'eau détectée dans la cave"],
    ['Gladys', "Mouvement devant la porte d'entrée"],
    ['Gladys', 'Le lave-linge a terminé'],
    ['Gladys', 'Bonne nuit : tout est verrouillé'],
  ],
  de: [
    ['Alarm', 'Wasserleck im Keller erkannt'],
    ['Gladys', 'Bewegung an der Haustür'],
    ['Gladys', 'Die Waschmaschine ist fertig'],
    ['Gladys', 'Gute Nacht: alles ist verriegelt'],
  ],
  es: [
    ['Alarma', 'Fuga de agua detectada en el sótano'],
    ['Gladys', 'Movimiento en la puerta de entrada'],
    ['Gladys', 'La lavadora ha terminado'],
    ['Gladys', 'Buenas noches: todo está cerrado'],
  ],
};
const pushes = (language) =>
  TEXTS[language].map(([title, message], index) => ({
    title,
    message,
    target: ['gs12', '52', '52', 'a'][index],
    targetName: ['Family (gs12)', 'iPhone (52)', 'iPhone (52)', 'a'][index],
    at: NOW - [12, 48, 190, 1260][index] * MINUTE,
    ok: index !== 2,
    ...(index === 2 ? { reason: 'timeout' } : {}),
  }));

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    account: buildAccountWidget({ snapshot, language, now: NOW }),
    recent: buildRecentWidget({ pushes: pushes(language), counters: snapshot.counters, language }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));

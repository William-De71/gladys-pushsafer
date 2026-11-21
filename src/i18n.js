// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: the connection status of the Configuration screen, the results of
// its buttons, the widget contents. Vocabulary of the Gladys interface
// (intégration, appareil / Gerät / dispositivo, scène / Szene / escena) and of
// the Pushsafer dashboard (clé privée / privater Schlüssel / clave privada,
// appels d'API / API-Aufrufe / llamadas a la API, groupe d'appareils).
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // connection status and Configuration screen buttons
  noKey: {
    en: 'Enter the private key of your Pushsafer account in the configuration.',
    fr: 'Saisissez la clé privée de votre compte Pushsafer dans la configuration.',
    de: 'Geben Sie den privaten Schlüssel Ihres Pushsafer-Kontos in der Konfiguration ein.',
    es: 'Introduzca la clave privada de su cuenta de Pushsafer en la configuración.',
  },
  noUsername: {
    en: 'Enter the username or e-mail of your Pushsafer account in the configuration: it is needed to check the key and list the devices.',
    fr: 'Saisissez le nom d’utilisateur ou l’e-mail de votre compte Pushsafer dans la configuration : il sert à vérifier la clé et à lister les appareils.',
    de: 'Geben Sie den Benutzernamen oder die E-Mail Ihres Pushsafer-Kontos in der Konfiguration ein: Damit werden der Schlüssel geprüft und die Geräte aufgelistet.',
    es: 'Introduzca el nombre de usuario o el correo de su cuenta de Pushsafer en la configuración: sirve para comprobar la clave y listar los dispositivos.',
  },
  statusKeyOnly: {
    en: 'Ready to send (key not checked: add the username to check it). API calls left: {calls}.',
    fr: 'Prêt à envoyer (clé non vérifiée : ajoutez le nom d’utilisateur pour la vérifier). Appels d’API restants : {calls}.',
    de: 'Bereit zum Senden (Schlüssel nicht geprüft: Benutzernamen ergänzen, um ihn zu prüfen). Verbleibende API-Aufrufe: {calls}.',
    es: 'Listo para enviar (clave no comprobada: añada el nombre de usuario para comprobarla). Llamadas a la API restantes: {calls}.',
  },
  statusConnected: {
    en: 'Pushsafer account {username}. Devices: {devices}, groups: {groups}. API calls left: {calls}.',
    fr: 'Compte Pushsafer {username}. Appareils : {devices}, groupes : {groups}. Appels d’API restants : {calls}.',
    de: 'Pushsafer-Konto {username}. Geräte: {devices}, Gruppen: {groups}. Verbleibende API-Aufrufe: {calls}.',
    es: 'Cuenta de Pushsafer {username}. Dispositivos: {devices}, grupos: {groups}. Llamadas a la API restantes: {calls}.',
  },
  apiCallsUnknown: {
    en: 'known after the first push',
    fr: 'connu après le premier push',
    de: 'nach dem ersten Push bekannt',
    es: 'se sabrá tras el primer push',
  },
  status_not_configured: {
    en: 'The private key of Pushsafer is missing in the configuration.',
    fr: 'La clé privée de Pushsafer manque dans la configuration.',
    de: 'Der private Schlüssel von Pushsafer fehlt in der Konfiguration.',
    es: 'Falta la clave privada de Pushsafer en la configuración.',
  },
  status_invalid_key: {
    en: 'Pushsafer refuses the key: check the private key (or alias key) and the username or e-mail of the account.',
    fr: 'Pushsafer refuse la clé : vérifiez la clé privée (ou clé alias) et le nom d’utilisateur ou l’e-mail du compte.',
    de: 'Pushsafer lehnt den Schlüssel ab: Prüfen Sie den privaten Schlüssel (oder Alias-Schlüssel) und den Benutzernamen oder die E-Mail des Kontos.',
    es: 'Pushsafer rechaza la clave: compruebe la clave privada (o clave alias) y el nombre de usuario o el correo de la cuenta.',
  },
  status_unreachable: {
    en: 'Pushsafer does not answer: check the internet connection of Gladys.',
    fr: 'Pushsafer ne répond pas : vérifiez la connexion Internet de Gladys.',
    de: 'Pushsafer antwortet nicht: Prüfen Sie die Internetverbindung von Gladys.',
    es: 'Pushsafer no responde: compruebe la conexión a Internet de Gladys.',
  },
  status_error: {
    en: 'Pushsafer answered something unexpected: see the logs of the integration.',
    fr: 'Pushsafer a répondu quelque chose d’inattendu : voir les journaux de l’intégration.',
    de: 'Pushsafer hat unerwartet geantwortet: siehe Protokolle der Integration.',
    es: 'Pushsafer respondió algo inesperado: consulte los registros de la integración.',
  },
  testOk: {
    en: 'Connected. Devices: {devices}. Groups: {groups}. API calls left: {calls}.',
    fr: 'Connecté. Appareils : {devices}. Groupes : {groups}. Appels d’API restants : {calls}.',
    de: 'Verbunden. Geräte: {devices}. Gruppen: {groups}. Verbleibende API-Aufrufe: {calls}.',
    es: 'Conectado. Dispositivos: {devices}. Grupos: {groups}. Llamadas a la API restantes: {calls}.',
  },
  devicesNone: {
    en: 'none, install the Pushsafer app',
    fr: 'aucun, installez l’application Pushsafer',
    de: 'keine, installieren Sie die Pushsafer-App',
    es: 'ninguno, instale la aplicación Pushsafer',
  },
  groupsNone: { en: 'none', fr: 'aucun', de: 'keine', es: 'ninguno' },
  invalidTarget: {
    en: '"{device}" is not a valid device: use a (all devices), a device ID (52), several (52|65) or a group (gs12).',
    fr: '« {device} » n’est pas un appareil valide : utilisez a (tous les appareils), un ID d’appareil (52), plusieurs (52|65) ou un groupe (gs12).',
    de: '„{device}“ ist kein gültiges Gerät: Verwenden Sie a (alle Geräte), eine Geräte-ID (52), mehrere (52|65) oder eine Gruppe (gs12).',
    es: '«{device}» no es un dispositivo válido: use a (todos los dispositivos), un ID de dispositivo (52), varios (52|65) o un grupo (gs12).',
  },
  testSent: {
    en: 'Test push sent to {device}. API calls left: {calls}.',
    fr: 'Push de test envoyé à {device}. Appels d’API restants : {calls}.',
    de: 'Test-Push an {device} gesendet. Verbleibende API-Aufrufe: {calls}.',
    es: 'Push de prueba enviado a {device}. Llamadas a la API restantes: {calls}.',
  },
  testNotSent: {
    en: 'The test push was not sent: {reason}.',
    fr: 'Le push de test n’est pas parti : {reason}.',
    de: 'Der Test-Push wurde nicht gesendet: {reason}.',
    es: 'El push de prueba no se envió: {reason}.',
  },

  // failure reasons (FAILURE_REASONS of src/pushsafer-api.js)
  reason_not_configured: {
    en: 'private key missing',
    fr: 'clé privée manquante',
    de: 'privater Schlüssel fehlt',
    es: 'falta la clave privada',
  },
  reason_invalid_key: {
    en: 'key refused',
    fr: 'clé refusée',
    de: 'Schlüssel abgelehnt',
    es: 'clave rechazada',
  },
  reason_invalid_device: {
    en: 'device refused',
    fr: 'appareil refusé',
    de: 'Gerät abgelehnt',
    es: 'dispositivo rechazado',
  },
  reason_invalid_group: {
    en: 'device group refused',
    fr: 'groupe d’appareils refusé',
    de: 'Gerätegruppe abgelehnt',
    es: 'grupo de dispositivos rechazado',
  },
  reason_no_api_calls: {
    en: 'no API calls left',
    fr: 'plus d’appels d’API',
    de: 'keine API-Aufrufe mehr',
    es: 'sin llamadas a la API',
  },
  reason_empty_message: {
    en: 'empty message',
    fr: 'message vide',
    de: 'leere Nachricht',
    es: 'mensaje vacío',
  },
  reason_rejected: {
    en: 'push refused by Pushsafer',
    fr: 'push refusé par Pushsafer',
    de: 'Push von Pushsafer abgelehnt',
    es: 'push rechazado por Pushsafer',
  },
  reason_server_error: {
    en: 'Pushsafer server error',
    fr: 'erreur du serveur Pushsafer',
    de: 'Serverfehler bei Pushsafer',
    es: 'error del servidor de Pushsafer',
  },
  reason_timeout: {
    en: 'no answer in time',
    fr: 'pas de réponse à temps',
    de: 'keine Antwort rechtzeitig',
    es: 'sin respuesta a tiempo',
  },
  reason_unreachable: {
    en: 'Pushsafer unreachable',
    fr: 'Pushsafer injoignable',
    de: 'Pushsafer nicht erreichbar',
    es: 'Pushsafer inaccesible',
  },
  reason_unexpected: {
    en: 'unexpected answer',
    fr: 'réponse inattendue',
    de: 'unerwartete Antwort',
    es: 'respuesta inesperada',
  },

  // account widget
  accountCaption: {
    en: 'Account {username}, read {ago}',
    fr: 'Compte {username}, lu {ago}',
    de: 'Konto {username}, gelesen {ago}',
    es: 'Cuenta {username}, leída {ago}',
  },
  accountCaptionKeyOnly: {
    en: 'Pushsafer account',
    fr: 'Compte Pushsafer',
    de: 'Pushsafer-Konto',
    es: 'Cuenta de Pushsafer',
  },
  tileApiCalls: {
    en: 'API calls left',
    fr: 'Appels d’API',
    de: 'API-Aufrufe übrig',
    es: 'Llamadas restantes',
  },
  tileSent: {
    en: 'Pushes this month',
    fr: 'Pushes ce mois',
    de: 'Pushes diesen Monat',
    es: 'Pushes este mes',
  },
  apiCallsLowText: {
    en: 'Few API calls left: buy more on pushsafer.com, or the notifications will stop.',
    fr: 'Peu d’appels d’API restants : rachetez-en sur pushsafer.com, sinon les notifications s’arrêteront.',
    de: 'Nur noch wenige API-Aufrufe: Kaufen Sie welche auf pushsafer.com nach, sonst stoppen die Benachrichtigungen.',
    es: 'Quedan pocas llamadas a la API: compre más en pushsafer.com o las notificaciones se detendrán.',
  },
  rowConnection: { en: 'Key', fr: 'Clé', de: 'Schlüssel', es: 'Clave' },
  connectionOk: { en: 'accepted', fr: 'acceptée', de: 'akzeptiert', es: 'aceptada' },
  rowDevices: { en: 'Devices', fr: 'Appareils', de: 'Geräte', es: 'Dispositivos' },
  devicesValue: {
    en: '{enabled} on / {total} · groups: {groups}',
    fr: '{enabled} actifs / {total} · groupes : {groups}',
    de: '{enabled} aktiv / {total} · Gruppen: {groups}',
    es: '{enabled} activos / {total} · grupos: {groups}',
  },
  devicesNoUsername: {
    en: 'add the username',
    fr: 'ajoutez le nom d’utilisateur',
    de: 'Benutzernamen ergänzen',
    es: 'añada el usuario',
  },
  rowApiCallsAt: {
    en: 'Calls counted',
    fr: 'Appels comptés',
    de: 'Aufrufe gezählt',
    es: 'Llamadas contadas',
  },
  rowThreshold: {
    en: 'Alert below',
    fr: 'Alerte sous',
    de: 'Alarm unter',
    es: 'Alerta por debajo de',
  },
  thresholdValue: {
    en: '{threshold} calls',
    fr: '{threshold} appels',
    de: '{threshold} Aufrufe',
    es: '{threshold} llamadas',
  },
  rowFailed: {
    en: 'Not sent this month',
    fr: 'Non partis ce mois',
    de: 'Nicht gesendet (Monat)',
    es: 'No enviados este mes',
  },
  rowLastFailure: {
    en: 'Last failure ({ago})',
    fr: 'Dernier échec ({ago})',
    de: 'Letzter Fehler ({ago})',
    es: 'Último fallo ({ago})',
  },

  // recent widget
  recentEmpty: {
    en: 'No push sent by Gladys yet.',
    fr: 'Aucun push envoyé par Gladys pour l’instant.',
    de: 'Gladys hat noch keinen Push gesendet.',
    es: 'Gladys aún no ha enviado ningún push.',
  },
  recentCaption: {
    en: 'Sent this month: {sent} · not sent: {failed}',
    fr: 'Envoyés ce mois : {sent} · non partis : {failed}',
    de: 'Diesen Monat gesendet: {sent} · nicht gesendet: {failed}',
    es: 'Enviados este mes: {sent} · no enviados: {failed}',
  },
  badgeSent: { en: 'sent', fr: 'envoyé', de: 'gesendet', es: 'enviado' },
  badgeNotSent: { en: 'not sent', fr: 'non parti', de: 'nicht gesendet', es: 'no enviado' },
  detailDevice: { en: 'To:', fr: 'À :', de: 'An:', es: 'Para:' },
  detailReason: { en: 'Reason:', fr: 'Raison :', de: 'Grund:', es: 'Motivo:' },

  // relative times
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: {
    en: '{n} days ago',
    fr: 'il y a {n} jours',
    de: 'vor {n} Tagen',
    es: 'hace {n} días',
  },
};

/**
 * @description Whether a value is one of the four languages.
 * @param {any} value - The value.
 * @returns {boolean} True for en, fr, de or es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('tileCredits', 'fr'); // -> 'Crédits restants'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * Substitutions may be functions of the language.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('testSent', { phone: '+336******78', credits: 1 });
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(
        key,
        language,
        Object.fromEntries(
          Object.entries(values).map(([name, value]) => [
            name,
            typeof value === 'function' ? value(language) : value,
          ]),
        ),
      ),
    ]),
  );
}

/**
 * @description A number written the way a language does, with at most
 * `digits` decimals ("12,5" in French).
 * @param {number|null} value - The number.
 * @param {string} language - The language.
 * @param {number} [digits] - The decimals.
 * @returns {string} The text, "?" when unknown.
 * @example
 * formatNumber(12.5, 'fr'); // -> '12,5'
 */
function formatNumber(value, language, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '?';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 * @example
 * ago(Date.now() - 600000, Date.now(), 'en'); // -> '10 min ago'
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, isLanguage, t, all, formatNumber, ago };

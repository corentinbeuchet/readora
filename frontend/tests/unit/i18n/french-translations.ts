/** Every French translation file merged, as the French build merges `angular.json` `i18n.locales.fr.translation`. */
import auth from '../../../src/locale/fr/auth.json';
import catalog from '../../../src/locale/fr/catalog.json';
import common from '../../../src/locale/fr/common.json';
import community from '../../../src/locale/fr/community.json';
import discovery from '../../../src/locale/fr/discovery.json';
import errors from '../../../src/locale/fr/errors.json';
import home from '../../../src/locale/fr/home.json';
import labels from '../../../src/locale/fr/labels.json';
import layout from '../../../src/locale/fr/layout.json';
import library from '../../../src/locale/fr/library.json';
import lists from '../../../src/locale/fr/lists.json';
import moderation from '../../../src/locale/fr/moderation.json';
import profile from '../../../src/locale/fr/profile.json';
import reader from '../../../src/locale/fr/reader.json';
import scanlation from '../../../src/locale/fr/scanlation.json';
import social from '../../../src/locale/fr/social.json';
import upload from '../../../src/locale/fr/upload.json';

export const FRENCH: Record<string, string> = Object.assign(
  {},
  auth.translations,
  catalog.translations,
  common.translations,
  community.translations,
  discovery.translations,
  errors.translations,
  home.translations,
  labels.translations,
  layout.translations,
  library.translations,
  lists.translations,
  moderation.translations,
  profile.translations,
  reader.translations,
  scanlation.translations,
  social.translations,
  upload.translations
);

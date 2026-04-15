/**
 * Inline SVGs — no network or chrome-extension asset fetches; works in closed Shadow DOM.
 * Stroke uses currentColor so nav / buttons inherit theme colors.
 */
import {
  Activity,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Home,
  Hourglass,
  Link2,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  SkipForward,
  Square,
  Trash2,
  Upload
} from 'lucide';
import { createElement } from 'lucide';

function lucideSvg(icon, size, extraClass = '') {
  const el = createElement(icon, {
    width: size,
    height: size,
    class: `aa-inline-icon${extraClass ? ` ${extraClass}` : ''}`,
    'aria-hidden': 'true'
  });
  return el.outerHTML;
}

export const inlineIcons = {
  home: (s = 24) => lucideSvg(Home, s),
  settings: (s = 24) => lucideSvg(Settings, s),
  activity: (s = 24) => lucideSvg(Activity, s),
  play: (s = 22) => lucideSvg(Play, s),
  pause: (s = 22) => lucideSvg(Pause, s),
  stop: (s = 22) => lucideSvg(Square, s),
  skip: (s = 22) => lucideSvg(SkipForward, s),
  connect: (s = 18) => lucideSvg(Link2, s),
  signOut: (s = 22) => lucideSvg(LogOut, s),
  refresh: (s = 22) => lucideSvg(RefreshCw, s),
  document: (s = 22) => lucideSvg(FileText, s),
  preview: (s = 20) => lucideSvg(Eye, s),
  chevronRight: (s = 18) => lucideSvg(ChevronRight, s),
  block: (s = 48) => lucideSvg(Ban, s),
  add: (s = 22) => lucideSvg(Plus, s),
  save: (s = 22) => lucideSvg(Save, s),
  hourglass: (s = 22) => lucideSvg(Hourglass, s),
  uploadFile: (s = 22) => lucideSvg(Upload, s),
  check: (s = 22) => lucideSvg(Check, s),
  skipNext: (s = 22) => lucideSvg(SkipForward, s),
  delete: (s = 18) => lucideSvg(Trash2, s),
  checkCircle: (s = 48) => lucideSvg(CheckCircle2, s)
};

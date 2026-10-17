// Entry point: on Android, restore the save mirror (if the WebView lost localStorage) before the game reads it.
import { restoreSave } from './native';
restoreSave('starforge.v2').finally(() => import('./main'));

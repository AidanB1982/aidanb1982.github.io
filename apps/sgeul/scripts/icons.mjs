import {copyFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'resources'),{recursive:true});
await copyFile(path.join(root,'../../assets/Sgeul Icon Square.png'),path.join(root,'resources/icon.png'));
const result=spawnSync(path.join(root,'node_modules/.bin/capacitor-assets'),['generate','--android','--assetPath','resources','--iconBackgroundColor','#0e2028','--iconBackgroundColorDark','#0e2028','--splashBackgroundColor','#101820','--splashBackgroundColorDark','#101820'],{cwd:root,stdio:'inherit'});
process.exitCode=result.status??1;

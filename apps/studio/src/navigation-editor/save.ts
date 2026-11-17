import {createId} from '@schema-baron/model';
import type {Project,NavigationMenu} from '@schema-baron/model';
import type {StudioClient} from '../project-ui/api.js';
/** Read canonical state after the revision-checked owner save; never invent success. */
export async function saveNavigation(client:Pick<StudioClient,'read'|'snapshot'>,baseline:Project,menu:NavigationMenu):Promise<Project>{
 await client.read(`projects/${encodeURIComponent(baseline.id)}/commands`,{requestId:createId(),operation:'navigation.configure',expectedRevision:baseline.revision,input:{menu}});
 return client.snapshot(baseline.id);
}

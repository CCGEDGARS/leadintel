import {handleScriptLibraryRoute} from '../src/script-library-routes.js';
export async function creatorCookie(env){
 env.ADMIN_PASSWORD='test-only-creator-password';
 const response=await handleScriptLibraryRoute(new Request('https://app.test/api/script-library/creator/unlock?workspace_id=storage-w1',{method:'POST',headers:{Cookie:'leadintel_session=admin','Content-Type':'application/json'},body:JSON.stringify({password:env.ADMIN_PASSWORD})}),env);
 if(response.status!==200)throw Error('Fixture unlock failed: '+await response.text());
 return response.headers.get('Set-Cookie').split(';')[0];
}

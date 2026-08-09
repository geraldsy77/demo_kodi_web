import { handlePublicApiRequest } from '../apiProxy';

export const onRequest: PagesFunction<Env> = async ({ request, env }) =>
  handlePublicApiRequest(request, env.API);

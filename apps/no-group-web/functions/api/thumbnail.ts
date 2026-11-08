import { handleThumbnail } from '../../platform/thumbnail-handler';
export const onRequest = ({request}:{request:Request})=>handleThumbnail(request);

import {handleInsights} from '../../platform/insights-handler';
import type {Context} from '../../platform/contracts';
export const onRequest=(context:Context)=>handleInsights(context,'weather');

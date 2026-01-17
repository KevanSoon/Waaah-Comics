import { Template } from './index';
import templatesConfig from '@/config/templates.json';

export const STAGE_WIDTH = 800;
export const STAGE_HEIGHT = 800;

// Load templates from JSON config
export const TEMPLATES: Template[] = templatesConfig.templates;

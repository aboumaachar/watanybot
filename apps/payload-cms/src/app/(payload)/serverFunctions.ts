'use server';

import type { ServerFunctionClient } from 'payload';
import { handleServerFunctions } from '@payloadcms/next/layouts';
import config from '../../payload.config';

export const serverFunction: ServerFunctionClient = async (args) => handleServerFunctions({
	...args,
	config,
	importMap: {},
});
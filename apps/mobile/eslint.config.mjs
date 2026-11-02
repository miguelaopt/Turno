import globals from 'globals';
import { baseConfig } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];

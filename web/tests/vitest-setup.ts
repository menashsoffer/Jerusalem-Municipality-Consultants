// Coverage on CI makes the first render of a lazy screen slow; wait longer than the 1s default.
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 4000 });

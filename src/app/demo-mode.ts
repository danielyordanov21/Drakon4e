import { isDevMode } from '@angular/core';
import { environment } from '../environments/environment';

export const isDemoModeEnabled = isDevMode() && environment.demoMode;

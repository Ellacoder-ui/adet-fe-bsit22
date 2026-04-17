import { GoogleLoginProvider, SocialAuthServiceConfig, SocialLoginModule } from '@abacritt/angularx-social-login';
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    // Import Social Login module
    importProvidersFrom(SocialLoginModule),

    // Configure Google Login
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              '392872215964-b20698ugfh1vli2akf0hul6qioaeco37.apps.googleusercontent.com'
            )
          }
        ],
        onError: (err) => {
          console.error('Social login error:', err);
        }
      } as SocialAuthServiceConfig,
    },
    provideHttpClient()
  ]
};

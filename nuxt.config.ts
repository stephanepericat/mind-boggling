// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxtjs/color-mode',
    '@nuxt/ui',
    '@clerk/nuxt',
    'nitro-cloudflare-dev'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storage: 'localStorage',
    storageKey: 'mind-boggling-color-mode'
  },

  runtimeConfig: {
    inviteCookieSecret: '',
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      demoMode: process.env.NUXT_PUBLIC_DEMO_MODE === 'true'
    }
  },

  compatibilityDate: '2026-08-08',

  nitro: {
    preset: 'cloudflare_pages',
    entry: './cloudflare-pages-entry.ts'
  },

  clerk: {
    publishableKey: process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    skipServerMiddleware: true,
    signInUrl: '/sign-in',
    signInFallbackRedirectUrl: '/',
    signUpUrl: '/access-required'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})

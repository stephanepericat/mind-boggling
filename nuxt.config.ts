// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@clerk/nuxt',
    'nitro-cloudflare-dev'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    inviteCookieSecret: '',
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      demoMode: process.env.NUXT_PUBLIC_DEMO_MODE === 'true'
    }
  },

  compatibilityDate: '2026-08-08',

  nitro: {
    preset: 'cloudflare_pages'
  },

  clerk: {
    publishableKey: process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
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
